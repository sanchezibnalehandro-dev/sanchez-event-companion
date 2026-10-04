import { isIP } from "node:net";

import type { PoolConfig } from "pg";

const connectionStringTlsParameters = [
  "ssl",
  "sslmode",
  "sslcert",
  "sslkey",
  "sslrootcert",
  "uselibpqcompat",
] as const;

interface PostgresPoolConfigOptions {
  strict?: boolean;
}

function postgresUrl(connectionString: string): URL {
  let parsed: URL;
  try {
    parsed = new URL(connectionString);
  } catch {
    throw new Error("DATABASE_URL must be a valid PostgreSQL URL");
  }

  if (parsed.protocol !== "postgres:" && parsed.protocol !== "postgresql:") {
    throw new Error("DATABASE_URL must use the postgres or postgresql protocol");
  }

  const hostname = parsed.hostname.replace(/^\[/, "").replace(/\]$/, "");
  if (!hostname || isIP(hostname) !== 0) {
    throw new Error("DATABASE_URL must use a DNS hostname for verified PostgreSQL TLS");
  }

  return parsed;
}

export function createPostgresPoolConfig(
  connectionString: string,
  caCertificate = process.env.DATABASE_CA_CERT,
  options: PostgresPoolConfigOptions = {},
): PoolConfig {
  if (!caCertificate?.trim()) {
    if (options.strict) {
      throw new Error("DATABASE_CA_CERT is required for verified PostgreSQL TLS");
    }
    return { connectionString };
  }

  const sanitizedConnectionUrl = postgresUrl(connectionString);
  for (const parameter of connectionStringTlsParameters) {
    sanitizedConnectionUrl.searchParams.delete(parameter);
  }

  return {
    connectionString: sanitizedConnectionUrl.toString(),
    ssl: {
      ca: caCertificate,
      rejectUnauthorized: true,
    },
  };
}
