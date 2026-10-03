import { randomUUID } from "node:crypto";
import { readFileSync } from "node:fs";
import { join } from "node:path";

import { Pool } from "pg";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";

import {
  hashSessionToken,
  OrganizerAuthService,
} from "@/lib/auth/organizer-auth-service";
import { hashPassword } from "@/lib/auth/passwords";
import { PostgresOrganizerAuthStore } from "@/lib/auth/postgres-organizer-auth-store";

const testDatabaseUrl = process.env.TEST_DATABASE_URL?.trim();
const postgresDescribe = testDatabaseUrl ? describe : describe.skip;

postgresDescribe("PostgreSQL organizer auth integration", () => {
  const schema = `event_companion_auth_${process.pid}_${Date.now()}_${randomUUID().slice(0, 8)}`;
  let adminPool: Pool;
  let scopedPool: Pool;
  let store: PostgresOrganizerAuthStore;
  let service: OrganizerAuthService;
  let passwordHash: string;

  beforeAll(async () => {
    if (!testDatabaseUrl) return;
    adminPool = new Pool({ connectionString: testDatabaseUrl });
    await adminPool.query(`CREATE SCHEMA "${schema}"`);
    scopedPool = new Pool({
      connectionString: testDatabaseUrl,
      options: `-c search_path=${schema}`,
    });
    for (const migrationName of ["0001_initial.sql", "0002_organizer_auth.sql"]) {
      const migration = readFileSync(
        join(process.cwd(), "db", "migrations", "postgres", migrationName),
        "utf8",
      );
      await scopedPool.query(migration);
    }
    store = new PostgresOrganizerAuthStore(scopedPool);
    service = new OrganizerAuthService(store);
    passwordHash = await hashPassword("postgres-password");
  });

  beforeEach(async () => {
    if (!testDatabaseUrl) return;
    await scopedPool.query("TRUNCATE organizer_users CASCADE");
  });

  afterAll(async () => {
    if (!testDatabaseUrl) return;
    await scopedPool.end();
    await adminPool.query(`DROP SCHEMA IF EXISTS "${schema}" CASCADE`);
    await adminPool.end();
  });

  async function createUser(options?: { disabledAt?: Date | null }): Promise<void> {
    await store.createUser({
      id: "organizer-1",
      email: "organizer@example.com",
      displayName: "Organizer",
      passwordHash,
      createdAt: new Date("2026-10-03T08:00:00.000Z"),
      disabledAt: options?.disabledAt ?? null,
    });
  }

  it("enforces canonical unique email for direct database writes", async () => {
    await createUser();

    await expect(
      scopedPool.query(
        `INSERT INTO organizer_users (id, email, password_hash)
         VALUES ('organizer-2', 'Test@Example.com', 'hash')`,
      ),
    ).rejects.toThrow();
    await expect(
      scopedPool.query(
        `INSERT INTO organizer_users (id, email, password_hash)
         VALUES ('organizer-3', 'organizer@example.com', 'hash')`,
      ),
    ).rejects.toThrow();
  });

  it("accepts a valid login and stores only the token hash", async () => {
    await createUser();

    const login = await service.login(
      " Organizer@Example.com ",
      "postgres-password",
      new Date("2026-10-03T09:00:00.000Z"),
    );

    expect(login?.organizer.id).toBe("organizer-1");
    const rows = await scopedPool.query(
      "SELECT token_hash, expires_at FROM organizer_sessions WHERE organizer_user_id = $1",
      ["organizer-1"],
    );
    expect(rows.rows).toHaveLength(1);
    expect(rows.rows[0]?.token_hash).toBe(hashSessionToken(login!.rawToken));
    expect(rows.rows[0]?.token_hash).not.toBe(login!.rawToken);
    await expect(
      service.authenticateSession(login!.rawToken, new Date("2026-10-03T10:00:00.000Z")),
    ).resolves.toMatchObject({ id: "organizer-1" });
  });

  it("rejects expired sessions and disabled organizers", async () => {
    await createUser();
    const expiredToken = "expired-postgres-token";
    await scopedPool.query(
      `INSERT INTO organizer_sessions (
        token_hash, organizer_user_id, created_at, expires_at
      ) VALUES ($1, $2, $3, $4)`,
      [
        hashSessionToken(expiredToken),
        "organizer-1",
        new Date("2026-10-01T08:00:00.000Z"),
        new Date("2026-10-02T08:00:00.000Z"),
      ],
    );

    await expect(
      service.authenticateSession(expiredToken, new Date("2026-10-03T08:00:00.000Z")),
    ).resolves.toBeNull();

    const login = await service.login("organizer@example.com", "postgres-password");
    await scopedPool.query(
      "UPDATE organizer_users SET disabled_at = CURRENT_TIMESTAMP WHERE id = $1",
      ["organizer-1"],
    );
    await expect(service.authenticateSession(login!.rawToken)).resolves.toBeNull();
    await expect(service.login("organizer@example.com", "postgres-password")).resolves.toBeNull();
  });

  it("invalidates the database session on logout", async () => {
    await createUser();
    const login = await service.login("organizer@example.com", "postgres-password");

    await service.logout(login!.rawToken);

    const rows = await scopedPool.query("SELECT token_hash FROM organizer_sessions");
    expect(rows.rows).toHaveLength(0);
    await expect(service.authenticateSession(login!.rawToken)).resolves.toBeNull();
  });
});
