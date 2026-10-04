import { randomUUID } from "node:crypto";
import { readFileSync } from "node:fs";
import { join } from "node:path";

import { Pool } from "pg";
import { afterAll, beforeAll, describe } from "vitest";

import { PostgresCompanionRepository } from "@/lib/data/postgres-repository";
import { defineEventLifecycleContract } from "@/tests/helpers/event-lifecycle-contract";

const testDatabaseUrl = process.env.TEST_DATABASE_URL?.trim();
const postgresDescribe = testDatabaseUrl ? describe : describe.skip;

postgresDescribe("PostgreSQL organizer event lifecycle", () => {
  const schema = `event_lifecycle_${process.pid}_${Date.now()}_${randomUUID().slice(0, 8)}`;
  let adminPool: Pool;
  let scopedPool: Pool;
  let repository: PostgresCompanionRepository;

  beforeAll(async () => {
    if (!testDatabaseUrl) return;
    adminPool = new Pool({ connectionString: testDatabaseUrl });
    await adminPool.query(`CREATE SCHEMA "${schema}"`);
    scopedPool = new Pool({
      connectionString: testDatabaseUrl,
      options: `-c search_path=${schema}`,
    });
    await scopedPool.query(
      readFileSync(join(process.cwd(), "db", "migrations", "postgres", "0001_initial.sql"), "utf8"),
    );
    repository = new PostgresCompanionRepository(scopedPool);
  });

  afterAll(async () => {
    if (!testDatabaseUrl) return;
    await scopedPool.end();
    await adminPool.query(`DROP SCHEMA IF EXISTS "${schema}" CASCADE`);
    await adminPool.end();
  });

  defineEventLifecycleContract("PostgreSQL", async () => {
    await scopedPool.query("TRUNCATE events CASCADE");
    return { repository, close: async () => undefined };
  });
});
