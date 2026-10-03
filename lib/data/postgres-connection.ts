import type { PoolConfig } from "pg";

const connectionStringTlsParameters = [
  "ssl",
  "sslmode",
  "sslcert",
  "sslkey",
  "sslrootcert",
  "uselibpqcompat",
] as const;

export function createPostgresPoolConfig(
  connectionString: string,
  caCertificate = process.env.DATABASE_CA_CERT,
): PoolConfig {
  if (!caCertificate?.trim()) {
    return { connectionString };
  }

  const sanitizedConnectionUrl = new URL(connectionString);
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
