import { beforeAll, describe, expect, it } from "vitest";

import {
  hashSessionToken,
  OrganizerAuthService,
  type OrganizerAuthStore,
  type OrganizerIdentity,
  type OrganizerUserRecord,
  type OrganizerUserWrite,
} from "@/lib/auth/organizer-auth-service";
import { hashPassword } from "@/lib/auth/passwords";

class MemoryAuthStore implements OrganizerAuthStore {
  users = new Map<string, OrganizerUserRecord>();
  sessions = new Map<
    string,
    { organizerUserId: string; createdAt: Date; expiresAt: Date }
  >();

  async findUserByEmail(email: string): Promise<OrganizerUserRecord | null> {
    return this.users.get(email) ?? null;
  }

  async createUser(user: OrganizerUserWrite): Promise<void> {
    this.users.set(user.email, user);
  }

  async createSession(session: {
    tokenHash: string;
    organizerUserId: string;
    createdAt: Date;
    expiresAt: Date;
  }): Promise<void> {
    this.sessions.set(session.tokenHash, session);
  }

  async findValidSession(tokenHash: string, now: Date): Promise<OrganizerIdentity | null> {
    const session = this.sessions.get(tokenHash);
    if (!session || session.expiresAt <= now) return null;
    const user = [...this.users.values()].find((candidate) => candidate.id === session.organizerUserId);
    if (!user || user.disabledAt) return null;
    return { id: user.id, email: user.email, displayName: user.displayName };
  }

  async deleteSession(tokenHash: string): Promise<void> {
    this.sessions.delete(tokenHash);
  }
}

describe("organizer auth service", () => {
  let passwordHash: string;

  beforeAll(async () => {
    passwordHash = await hashPassword("production-password");
  });

  function createUser(disabledAt: Date | null = null): OrganizerUserRecord {
    return {
      id: "organizer-1",
      email: "organizer@example.com",
      displayName: "Organizer",
      passwordHash,
      disabledAt,
    };
  }

  it("accepts correct credentials and stores only a hash of the raw token", async () => {
    const store = new MemoryAuthStore();
    store.users.set("organizer@example.com", createUser());
    const service = new OrganizerAuthService(store);

    const result = await service.login(
      " Organizer@Example.com ",
      "production-password",
      new Date("2026-10-03T08:00:00.000Z"),
    );

    expect(result?.organizer).toMatchObject({ id: "organizer-1" });
    expect(result?.expiresAt.toISOString()).toBe("2026-10-10T08:00:00.000Z");
    expect(store.sessions.has(result!.rawToken)).toBe(false);
    expect(store.sessions.has(hashSessionToken(result!.rawToken))).toBe(true);
    await expect(service.authenticateSession(result!.rawToken)).resolves.toMatchObject({
      id: "organizer-1",
    });
  });

  it("rejects wrong and unknown credentials with the same null result", async () => {
    const store = new MemoryAuthStore();
    store.users.set("organizer@example.com", createUser());
    const service = new OrganizerAuthService(store);

    const wrong = await service.login("organizer@example.com", "wrong-password");
    const unknown = await service.login("unknown@example.com", "wrong-password");

    expect(wrong).toBeNull();
    expect(unknown).toBeNull();
  });

  it("rejects expired sessions and disabled organizers", async () => {
    const store = new MemoryAuthStore();
    const user = createUser();
    store.users.set(user.email, user);
    const service = new OrganizerAuthService(store);
    const expiredToken = "expired-token";
    store.sessions.set(hashSessionToken(expiredToken), {
      organizerUserId: user.id,
      createdAt: new Date("2026-10-01T00:00:00.000Z"),
      expiresAt: new Date("2026-10-02T00:00:00.000Z"),
    });

    await expect(
      service.authenticateSession(expiredToken, new Date("2026-10-03T00:00:00.000Z")),
    ).resolves.toBeNull();

    const login = await service.login(user.email, "production-password");
    user.disabledAt = new Date();
    await expect(service.authenticateSession(login!.rawToken)).resolves.toBeNull();
    await expect(service.login(user.email, "production-password")).resolves.toBeNull();
  });

  it("invalidates the stored session on logout", async () => {
    const store = new MemoryAuthStore();
    const user = createUser();
    store.users.set(user.email, user);
    const service = new OrganizerAuthService(store);
    const login = await service.login(user.email, "production-password");

    await service.logout(login!.rawToken);

    expect(store.sessions.size).toBe(0);
    await expect(service.authenticateSession(login!.rawToken)).resolves.toBeNull();
  });
});
