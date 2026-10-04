import { afterEach, describe, expect, it, vi } from "vitest";

import { PostgresOrganizerAuthStore } from "@/lib/auth/postgres-organizer-auth-store";
import { createPostgresPoolConfig } from "@/lib/data/postgres-connection";
import { PostgresCompanionRepository } from "@/lib/data/postgres-repository";

const caCertificate = `-----BEGIN CERTIFICATE-----
timeweb-root-ca
-----END CERTIFICATE-----`;
const secureDnsUrl = "postgresql://user:password@db.example.com:5432/companion";

function expectSafeConfigurationError(operation: () => unknown, expectedMessage: string): void {
  try {
    operation();
    throw new Error("Expected configuration validation to throw");
  } catch (error) {
    expect(error).toBeInstanceOf(Error);
    const message = (error as Error).message;
    expect(message).toBe(expectedMessage);
    expect(message).not.toContain("user:password");
    expect(message).not.toContain("timeweb-root-ca");
  }
}

afterEach(() => {
  vi.unstubAllEnvs();
});

describe("PostgreSQL connection configuration", () => {
  it("uses the provided CA for verified TLS and ignores connection-string SSL controls", () => {
    const connectionString =
      secureDnsUrl +
      "?ssl=1&sslmode=require&sslcert=%2Ftmp%2Fclient.crt" +
      "&sslkey=%2Ftmp%2Fclient.key&sslrootcert=%2Ftmp%2Froot.crt" +
      "&uselibpqcompat=true&application_name=companion";

    const config = createPostgresPoolConfig(connectionString, caCertificate);

    expect(config).toEqual({
      connectionString: `${secureDnsUrl}?application_name=companion`,
      ssl: {
        ca: caCertificate,
        rejectUnauthorized: true,
      },
    });
    expect(config.ssl).not.toHaveProperty("checkServerIdentity");
  });

  it("rejects missing or blank CA in strict mode without disclosing configuration secrets", () => {
    for (const configuredCa of [undefined, "   "]) {
      expectSafeConfigurationError(
        () => createPostgresPoolConfig(secureDnsUrl, configuredCa, { strict: true }),
        "DATABASE_CA_CERT is required for verified PostgreSQL TLS",
      );
    }
  });

  it("rejects malformed, non-PostgreSQL, and IP-literal strict endpoints", () => {
    const cases = [
      ["not a URL", "DATABASE_URL must be a valid PostgreSQL URL"],
      [
        "mysql://user:password@db.example.com/companion",
        "DATABASE_URL must use the postgres or postgresql protocol",
      ],
      [
        "postgresql://user:password@192.0.2.8/companion",
        "DATABASE_URL must use a DNS hostname for verified PostgreSQL TLS",
      ],
      [
        "postgresql://user:password@[2001:db8::8]/companion",
        "DATABASE_URL must use a DNS hostname for verified PostgreSQL TLS",
      ],
      [
        "postgresql:///companion",
        "DATABASE_URL must use a DNS hostname for verified PostgreSQL TLS",
      ],
    ] as const;

    for (const [connectionString, expectedMessage] of cases) {
      expectSafeConfigurationError(
        () => createPostgresPoolConfig(connectionString, caCertificate, { strict: true }),
        expectedMessage,
      );
    }
  });

  it("keeps the existing local and test fallback when no CA is configured", () => {
    const connectionString =
      "postgresql://localhost:5432/companion?sslmode=disable&uselibpqcompat=true";

    for (const caCertificate of [undefined, "   "]) {
      expect(createPostgresPoolConfig(connectionString, caCertificate)).toEqual({
        connectionString,
      });
    }
  });

  it("enforces the shared strict policy at both production pool factories before connection", () => {
    vi.stubEnv("NODE_ENV", "production");
    vi.stubEnv("DATABASE_CA_CERT", "");

    for (const open of [PostgresCompanionRepository.open, PostgresOrganizerAuthStore.open]) {
      expectSafeConfigurationError(
        () => open(secureDnsUrl),
        "DATABASE_CA_CERT is required for verified PostgreSQL TLS",
      );
    }

    vi.stubEnv("DATABASE_CA_CERT", caCertificate);
    for (const open of [PostgresCompanionRepository.open, PostgresOrganizerAuthStore.open]) {
      expectSafeConfigurationError(
        () => open("postgresql://user:password@192.0.2.8/companion"),
        "DATABASE_URL must use a DNS hostname for verified PostgreSQL TLS",
      );
    }
  });
});
