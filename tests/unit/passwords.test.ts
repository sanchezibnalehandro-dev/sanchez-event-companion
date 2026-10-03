import { describe, expect, it } from "vitest";

import { hashPassword, verifyPassword } from "@/lib/auth/passwords";

describe("organizer passwords", () => {
  it("accepts the correct password and rejects a wrong password", async () => {
    const encoded = await hashPassword("correct horse battery staple");

    await expect(verifyPassword("correct horse battery staple", encoded)).resolves.toBe(true);
    await expect(verifyPassword("wrong password", encoded)).resolves.toBe(false);
  });

  it("rejects malformed hashes without accepting the password", async () => {
    await expect(verifyPassword("anything", "not-a-password-hash")).resolves.toBe(false);
  });
});
