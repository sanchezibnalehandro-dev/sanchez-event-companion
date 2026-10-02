import { describe, expect, it } from "vitest";

import { resolveDatabaseConfig } from "@/lib/data/database";

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
