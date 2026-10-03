import { randomUUID } from "node:crypto";
import { emitKeypressEvents } from "node:readline";
import { createInterface } from "node:readline/promises";
import { stdin, stdout } from "node:process";

import { hashPassword } from "../lib/auth/passwords.ts";
import { normalizeOrganizerEmail } from "../lib/auth/organizer-auth-service.ts";
import {
  PostgresOrganizerAuthStore,
  requirePostgresDatabaseUrl,
} from "../lib/auth/postgres-organizer-auth-store.ts";

async function promptVisible(question: string): Promise<string> {
  const input = createInterface({ input: stdin, output: stdout });
  try {
    return await input.question(question);
  } finally {
    input.close();
  }
}

async function promptHidden(question: string): Promise<string> {
  if (!stdin.isTTY || !stdout.isTTY || typeof stdin.setRawMode !== "function") {
    throw new Error("Hidden password input requires an interactive terminal");
  }
  stdout.write(question);
  emitKeypressEvents(stdin);
  stdin.setRawMode(true);
  stdin.resume();

  return new Promise<string>((resolve, reject) => {
    let password = "";
    const finish = (error?: Error) => {
      stdin.off("keypress", onKeypress);
      stdin.setRawMode(false);
      stdin.pause();
      stdout.write("\n");
      if (error) reject(error);
      else resolve(password);
    };
    const onKeypress = (character: string, key: { name?: string; ctrl?: boolean }) => {
      if (key.ctrl && key.name === "c") {
        finish(new Error("Organizer creation cancelled"));
        return;
      }
      if (key.name === "return" || key.name === "enter") {
        finish();
        return;
      }
      if (key.name === "backspace") {
        password = Array.from(password).slice(0, -1).join("");
        return;
      }
      if (character && !key.ctrl) password += character;
    };
    stdin.on("keypress", onKeypress);
  });
}

function isUniqueViolation(error: unknown): boolean {
  return typeof error === "object" && error !== null && "code" in error && error.code === "23505";
}

async function main(): Promise<void> {
  const databaseUrl = requirePostgresDatabaseUrl(process.env.DATABASE_URL);
  const email = normalizeOrganizerEmail(await promptVisible("Email: "));
  if (!email) throw new Error("Email is required");
  const password = await promptHidden("Password: ");
  const displayNameInput = (await promptVisible("Display name (optional): ")).trim();
  const passwordHash = await hashPassword(password);
  const store = PostgresOrganizerAuthStore.open(databaseUrl);

  try {
    await store.createUser({
      id: randomUUID(),
      email,
      displayName: displayNameInput || null,
      passwordHash,
      createdAt: new Date(),
      disabledAt: null,
    });
  } catch (error) {
    if (isUniqueViolation(error)) throw new Error("Organizer with this email already exists");
    throw error;
  } finally {
    await store.close();
  }

  stdout.write(`Organizer created: ${email}\n`);
}

main().catch((error: unknown) => {
  const message = error instanceof Error ? error.message : "Unable to create organizer";
  console.error(message);
  process.exitCode = 1;
});
