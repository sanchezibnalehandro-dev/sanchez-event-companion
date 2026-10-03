import { randomBytes, scrypt, timingSafeEqual } from "node:crypto";

const FORMAT = "scrypt-v1";
const COST = 2 ** 17;
const BLOCK_SIZE = 8;
const PARALLELIZATION = 1;
const KEY_LENGTH = 64;
const SALT_LENGTH = 16;
const MAX_MEMORY = 256 * 1024 * 1024;
const MAX_PASSWORD_BYTES = 1024;

type ScryptParameters = {
  cost: number;
  blockSize: number;
  parallelization: number;
  salt: Buffer;
  expected: Buffer;
  valid: boolean;
};

function acceptablePassword(password: string): boolean {
  const byteLength = Buffer.byteLength(password, "utf8");
  return byteLength > 0 && byteLength <= MAX_PASSWORD_BYTES;
}

function derive(password: string, parameters: Omit<ScryptParameters, "expected" | "valid">) {
  return new Promise<Buffer>((resolve, reject) => {
    scrypt(
      password,
      parameters.salt,
      KEY_LENGTH,
      {
        N: parameters.cost,
        r: parameters.blockSize,
        p: parameters.parallelization,
        maxmem: MAX_MEMORY,
      },
      (error, derivedKey) => {
        if (error) reject(error);
        else resolve(derivedKey);
      },
    );
  });
}

function parseHash(encodedHash: string): ScryptParameters {
  const fallback = {
    cost: COST,
    blockSize: BLOCK_SIZE,
    parallelization: PARALLELIZATION,
    salt: Buffer.alloc(SALT_LENGTH),
    expected: Buffer.alloc(KEY_LENGTH),
    valid: false,
  };
  const parts = encodedHash.split("$");
  if (parts.length !== 6 || parts[0] !== FORMAT) return fallback;

  const cost = Number(parts[1]);
  const blockSize = Number(parts[2]);
  const parallelization = Number(parts[3]);
  if (cost !== COST || blockSize !== BLOCK_SIZE || parallelization !== PARALLELIZATION) {
    return fallback;
  }

  try {
    const salt = Buffer.from(parts[4]!, "base64url");
    const expected = Buffer.from(parts[5]!, "base64url");
    if (salt.length !== SALT_LENGTH || expected.length !== KEY_LENGTH) return fallback;
    return { cost, blockSize, parallelization, salt, expected, valid: true };
  } catch {
    return fallback;
  }
}

export async function hashPassword(password: string): Promise<string> {
  if (!acceptablePassword(password)) {
    throw new Error("Password must contain between 1 and 1024 UTF-8 bytes");
  }
  const salt = randomBytes(SALT_LENGTH);
  const derived = await derive(password, {
    cost: COST,
    blockSize: BLOCK_SIZE,
    parallelization: PARALLELIZATION,
    salt,
  });
  return [
    FORMAT,
    COST,
    BLOCK_SIZE,
    PARALLELIZATION,
    salt.toString("base64url"),
    derived.toString("base64url"),
  ].join("$");
}

export async function verifyPassword(password: string, encodedHash: string): Promise<boolean> {
  const parsed = parseHash(encodedHash);
  const candidate = acceptablePassword(password) ? password : "invalid-password";
  const derived = await derive(candidate, parsed);
  const matches = timingSafeEqual(derived, parsed.expected);
  return parsed.valid && acceptablePassword(password) && matches;
}
