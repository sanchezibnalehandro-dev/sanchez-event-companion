import { createHash, randomBytes } from "node:crypto";

import { verifyPassword } from "./passwords.ts";

const SESSION_DURATION_MS = 7 * 24 * 60 * 60 * 1000;

export type OrganizerUserRecord = {
  id: string;
  email: string;
  displayName: string | null;
  passwordHash: string;
  disabledAt: Date | null;
};

export type OrganizerIdentity = {
  id: string;
  email: string;
  displayName: string | null;
};

export type OrganizerUserWrite = OrganizerUserRecord & { createdAt: Date };

export interface OrganizerAuthStore {
  findUserByEmail(email: string): Promise<OrganizerUserRecord | null>;
  createUser(user: OrganizerUserWrite): Promise<void>;
  createSession(session: {
    tokenHash: string;
    organizerUserId: string;
    createdAt: Date;
    expiresAt: Date;
  }): Promise<void>;
  findValidSession(tokenHash: string, now: Date): Promise<OrganizerIdentity | null>;
  deleteSession(tokenHash: string): Promise<void>;
}

export type OrganizerLoginResult = {
  organizer: OrganizerIdentity;
  rawToken: string;
  expiresAt: Date;
};

export function normalizeOrganizerEmail(email: string): string {
  return email.trim().toLowerCase();
}

export function hashSessionToken(rawToken: string): string {
  return createHash("sha256").update(rawToken, "utf8").digest("hex");
}

const DUMMY_PASSWORD_HASH =
  "scrypt-v1$131072$8$1$AAAAAAAAAAAAAAAAAAAAAA$AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA";

export class OrganizerAuthService {
  private readonly store: OrganizerAuthStore;

  constructor(store: OrganizerAuthStore) {
    this.store = store;
  }

  async login(email: string, password: string, now = new Date()): Promise<OrganizerLoginResult | null> {
    const user = await this.store.findUserByEmail(normalizeOrganizerEmail(email));
    const passwordMatches = await verifyPassword(password, user?.passwordHash ?? DUMMY_PASSWORD_HASH);
    if (!user || !passwordMatches || user.disabledAt) return null;

    const rawToken = randomBytes(32).toString("base64url");
    const createdAt = new Date(now);
    const expiresAt = new Date(createdAt.getTime() + SESSION_DURATION_MS);
    await this.store.createSession({
      tokenHash: hashSessionToken(rawToken),
      organizerUserId: user.id,
      createdAt,
      expiresAt,
    });
    return {
      organizer: { id: user.id, email: user.email, displayName: user.displayName },
      rawToken,
      expiresAt,
    };
  }

  async authenticateSession(rawToken: string, now = new Date()): Promise<OrganizerIdentity | null> {
    if (!rawToken) return null;
    return this.store.findValidSession(hashSessionToken(rawToken), now);
  }

  async logout(rawToken: string): Promise<void> {
    if (!rawToken) return;
    await this.store.deleteSession(hashSessionToken(rawToken));
  }
}
