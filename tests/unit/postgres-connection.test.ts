import { describe, expect, it } from "vitest";

import { createPostgresPoolConfig } from "@/lib/data/postgres-connection";

describe("PostgreSQL connection configuration", () => {
  it("uses the provided CA for verified TLS and ignores connection-string SSL controls", () => {
    const caCertificate = `-----BEGIN CERTIFICATE-----
timeweb-root-ca
-----END CERTIFICATE-----`;
    const connectionString =
      "postgresql://user:password@db.example.com:5432/companion" +
      "?ssl=1&sslmode=require&sslcert=%2Ftmp%2Fclient.crt" +
      "&sslkey=%2Ftmp%2Fclient.key&sslrootcert=%2Ftmp%2Froot.crt" +
      "&uselibpqcompat=true&application_name=companion";

    expect(createPostgresPoolConfig(connectionString, caCertificate)).toEqual({
      connectionString:
        "postgresql://user:password@db.example.com:5432/companion?application_name=companion",
      ssl: {
        ca: caCertificate,
        rejectUnauthorized: true,
      },
    });
  });

  it("preserves the existing connection behavior when no CA is configured", () => {
    const connectionString =
      "postgresql://localhost:5432/companion?sslmode=disable&uselibpqcompat=true";

    for (const caCertificate of [undefined, "   "]) {
      expect(createPostgresPoolConfig(connectionString, caCertificate)).toEqual({
        connectionString,
      });
    }
  });
});
