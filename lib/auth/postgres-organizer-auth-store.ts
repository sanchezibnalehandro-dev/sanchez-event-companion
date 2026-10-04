import { Pool, type QueryResultRow } from "pg";

import { createPostgresPoolConfig } from "../data/postgres-connection.ts";
import type {
  OrganizerAuthStore,
  OrganizerIdentity,
  OrganizerUserRecord,
  OrganizerUserWrite,
} from "./organizer-auth-service.ts";

type Row = QueryResultRow;

function text(row: Row, key: string): string {
  const value = row[key];
  if (typeof value !== "string") throw new Error(`Expected text column ${key}`);
  return value;
}

function nullableText(row: Row, key: string): string | null {
  const value = row[key];
  if (value === null) return null;
  if (typeof value !== "string") throw new Error(`Expected nullable text column ${key}`);
  return value;
}

function nullableDate(row: Row, key: string): Date | null {
  const value = row[key];
  if (value === null) return null;
  if (value instanceof Date) return value;
  if (typeof value === "string") return new Date(value);
  throw new Error(`Expected nullable timestamp column ${key}`);
}

export function requirePostgresDatabaseUrl(databaseUrl: string | undefined): string {
  const trimmed = databaseUrl?.trim();
  if (!trimmed) throw new Error("DATABASE_URL is required for organizer authentication");
  const parsed = new URL(trimmed);
  if (parsed.protocol !== "postgres:" && parsed.protocol !== "postgresql:") {
    throw new Error("DATABASE_URL must use the postgres or postgresql protocol");
  }
  return trimmed;
}

export class PostgresOrganizerAuthStore implements OrganizerAuthStore {
  private readonly pool: Pool;

  constructor(pool: Pool) {
    this.pool = pool;
  }

  static open(databaseUrl: string): PostgresOrganizerAuthStore {
    return new PostgresOrganizerAuthStore(
      new Pool(
        createPostgresPoolConfig(databaseUrl, process.env.DATABASE_CA_CERT, {
          strict: process.env.NODE_ENV === "production",
        }),
      ),
    );
  }

  async close(): Promise<void> {
    await this.pool.end();
  }

  async findUserByEmail(email: string): Promise<OrganizerUserRecord | null> {
    const result = await this.pool.query(
      `SELECT id, email, display_name, password_hash, disabled_at
       FROM organizer_users WHERE email = $1`,
      [email],
    );
    const row = result.rows[0];
    if (!row) return null;
    return {
      id: text(row, "id"),
      email: text(row, "email"),
      displayName: nullableText(row, "display_name"),
      passwordHash: text(row, "password_hash"),
      disabledAt: nullableDate(row, "disabled_at"),
    };
  }

  async createUser(user: OrganizerUserWrite): Promise<void> {
    await this.pool.query(
      `INSERT INTO organizer_users (
        id, email, display_name, password_hash, created_at, disabled_at
      ) VALUES ($1, $2, $3, $4, $5, $6)`,
      [
        user.id,
        user.email,
        user.displayName,
        user.passwordHash,
        user.createdAt,
        user.disabledAt,
      ],
    );
  }

  async createSession(session: {
    tokenHash: string;
    organizerUserId: string;
    createdAt: Date;
    expiresAt: Date;
  }): Promise<void> {
    await this.pool.query(
      `INSERT INTO organizer_sessions (
        token_hash, organizer_user_id, created_at, expires_at
      ) VALUES ($1, $2, $3, $4)`,
      [session.tokenHash, session.organizerUserId, session.createdAt, session.expiresAt],
    );
  }

  async findValidSession(tokenHash: string, now: Date): Promise<OrganizerIdentity | null> {
    const result = await this.pool.query(
      `SELECT users.id, users.email, users.display_name
       FROM organizer_sessions AS sessions
       JOIN organizer_users AS users ON users.id = sessions.organizer_user_id
       WHERE sessions.token_hash = $1
         AND sessions.expires_at > $2
         AND users.disabled_at IS NULL`,
      [tokenHash, now],
    );
    const row = result.rows[0];
    if (!row) return null;
    return {
      id: text(row, "id"),
      email: text(row, "email"),
      displayName: nullableText(row, "display_name"),
    };
  }

  async deleteSession(tokenHash: string): Promise<void> {
    await this.pool.query("DELETE FROM organizer_sessions WHERE token_hash = $1", [tokenHash]);
  }
}
