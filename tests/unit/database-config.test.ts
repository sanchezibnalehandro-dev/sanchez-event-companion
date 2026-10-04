import { describe, expect, it } from "vitest";

import { resolveDatabaseConfig } from "@/lib/data/database";
import { createPostgresPoolConfig } from "@/lib/data/postgres-connection";

const caCertificate = `-----BEGIN CERTIFICATE-----
example-root-ca
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
    expect(message).not.toContain("example-root-ca");
  }
}

describe("database configuration", () => {
  it("rejects SQLite in production", () => {
    expect(() =>
      resolveDatabaseConfig({
        NODE_ENV: "production",
        EVENT_COMPANION_DATABASE_DRIVER: "sqlite",
      }),
    ).toThrow("PostgreSQL is required in production");
  });

  it("rejects PostgreSQL without DATABASE_URL in production", () => {
    expect(() =>
      resolveDatabaseConfig({
        NODE_ENV: "production",
        EVENT_COMPANION_DATABASE_DRIVER: "postgres",
      }),
    ).toThrow("DATABASE_URL is required for PostgreSQL");
  });

  it("rejects missing or blank CA before production PostgreSQL startup without disclosing secrets", () => {
    for (const configuredCa of [undefined, "   "]) {
      expectSafeConfigurationError(
        () =>
          resolveDatabaseConfig({
            NODE_ENV: "production",
            EVENT_COMPANION_DATABASE_DRIVER: "postgres",
            DATABASE_URL: secureDnsUrl,
            DATABASE_CA_CERT: configuredCa,
          }),
        "DATABASE_CA_CERT is required for verified PostgreSQL TLS",
      );
    }
  });

  it("rejects malformed, non-PostgreSQL, and IP-literal production endpoints before startup", () => {
    const cases = [
      ["not a URL", "DATABASE_URL must be a valid PostgreSQL URL"],
      [
        "https://user:password@db.example.com/companion",
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

    for (const [databaseUrl, expectedMessage] of cases) {
      expectSafeConfigurationError(
        () =>
          resolveDatabaseConfig({
            NODE_ENV: "production",
            EVENT_COMPANION_DATABASE_DRIVER: "postgres",
            DATABASE_URL: databaseUrl,
            DATABASE_CA_CERT: caCertificate,
          }),
        expectedMessage,
      );
    }
  });

  it("accepts a DNS production endpoint with CA and preserves verified TLS policy", () => {
    const config = resolveDatabaseConfig({
      NODE_ENV: "production",
      EVENT_COMPANION_DATABASE_DRIVER: "postgres",
      DATABASE_URL: `${secureDnsUrl}?sslmode=disable&ssl=false&application_name=companion`,
      DATABASE_CA_CERT: caCertificate,
    });

    expect(config).toEqual({
      driver: "postgres",
      databaseUrl: `${secureDnsUrl}?sslmode=disable&ssl=false&application_name=companion`,
    });
    if (config.driver !== "postgres") throw new Error("Expected PostgreSQL configuration");

    const poolConfig = createPostgresPoolConfig(config.databaseUrl, caCertificate, {
      strict: true,
    });
    expect(poolConfig).toEqual({
      connectionString: `${secureDnsUrl}?application_name=companion`,
      ssl: { ca: caCertificate, rejectUnauthorized: true },
    });
    expect(poolConfig.ssl).not.toHaveProperty("checkServerIdentity");
  });

  it("keeps PostgreSQL without CA compatible outside production", () => {
    expect(
      resolveDatabaseConfig({
        NODE_ENV: "test",
        EVENT_COMPANION_DATABASE_DRIVER: "postgres",
        DATABASE_URL: "postgresql://localhost:5432/companion",
      }),
    ).toEqual({
      driver: "postgres",
      databaseUrl: "postgresql://localhost:5432/companion",
    });
  });

  it("uses the existing local SQLite path in development", () => {
    expect(
      resolveDatabaseConfig({
        NODE_ENV: "development",
        EVENT_COMPANION_DATABASE_DRIVER: "sqlite",
      }),
    ).toEqual({
      driver: "sqlite",
      databasePath: ".data/event-companion.sqlite",
    });
  });

  it("requires an explicit driver outside the demo launcher", () => {
    expect(() => resolveDatabaseConfig({ NODE_ENV: "development" })).toThrow(
      "EVENT_COMPANION_DATABASE_DRIVER must be sqlite or postgres",
    );
  });
});
