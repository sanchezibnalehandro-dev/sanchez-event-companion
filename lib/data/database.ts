import { PostgresCompanionRepository } from "@/lib/data/postgres-repository";
import type { CompanionRepository } from "@/lib/data/repository";
import { SqliteCompanionRepository } from "@/lib/data/sqlite-repository";

const defaultSqlitePath = ".data/event-companion.sqlite";

export type DatabaseConfig =
  | { driver: "sqlite"; databasePath: string }
  | { driver: "postgres"; databaseUrl: string };

type DatabaseEnvironment = Partial<
  Record<
    "NODE_ENV" | "EVENT_COMPANION_DATABASE_DRIVER" | "EVENT_COMPANION_DATABASE_PATH" | "DATABASE_URL",
    string | undefined
  >
>;

export function resolveDatabaseConfig(environment: DatabaseEnvironment): DatabaseConfig {
  const driver = environment.EVENT_COMPANION_DATABASE_DRIVER;
  if (driver !== "sqlite" && driver !== "postgres") {
    throw new Error("EVENT_COMPANION_DATABASE_DRIVER must be sqlite or postgres");
  }

  if (environment.NODE_ENV === "production" && driver !== "postgres") {
    throw new Error("PostgreSQL is required in production");
  }

  if (driver === "postgres") {
    const databaseUrl = environment.DATABASE_URL?.trim();
    if (!databaseUrl) throw new Error("DATABASE_URL is required for PostgreSQL");
    return { driver, databaseUrl };
  }

  return {
    driver,
    databasePath: environment.EVENT_COMPANION_DATABASE_PATH?.trim() || defaultSqlitePath,
  };
}

let repository: CompanionRepository | undefined;

export function getRepository(): CompanionRepository {
  if (!repository) {
    const config = resolveDatabaseConfig(process.env);
    repository =
      config.driver === "sqlite"
        ? SqliteCompanionRepository.open(config.databasePath)
        : PostgresCompanionRepository.open(config.databaseUrl);
  }
  return repository;
}
