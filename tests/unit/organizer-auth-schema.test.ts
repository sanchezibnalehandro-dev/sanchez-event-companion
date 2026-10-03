import { readFileSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

describe("organizer auth PostgreSQL schema", () => {
  const migration = readFileSync(
    join(process.cwd(), "db", "migrations", "postgres", "0002_organizer_auth.sql"),
    "utf8",
  );

  it("requires canonical email in the database and keeps it unique", () => {
    expect(migration).toMatch(/email TEXT NOT NULL UNIQUE/i);
    expect(migration).toMatch(/CHECK \(email = lower\(btrim\(email\)\)\)/i);
  });

  it("stores only a token hash in organizer sessions", () => {
    expect(migration).toMatch(/token_hash TEXT PRIMARY KEY/i);
    expect(migration).toMatch(/token_hash ~ '\^\[0-9a-f\]\{64\}\$'/i);
    expect(migration).not.toMatch(/raw_token|session_token(?!_hash)/i);
  });
});
