import { describe, expect, it } from "vitest";
import { decrypt, encrypt } from "../../src/crypto/encryption";

describe("F4 encryption", () => {
  it("round-trips exact content without serializing plaintext or passphrase", async () => {
    const plaintext = "Invented private note: meet near the blue fountain 🌙";
    const secret = "correct horse battery staple";
    const encrypted = await encrypt(plaintext, secret);
    const serialized = JSON.stringify(encrypted);
    expect(serialized).not.toContain(plaintext);
    expect(serialized).not.toContain(secret);
    expect(await decrypt(JSON.parse(serialized), secret)).toBe(plaintext);
  });
  it("fails cleanly with the wrong secret", async () => {
    const encrypted = await encrypt("synthetic content", "right secret");
    await expect(decrypt(encrypted, "wrong secret")).rejects.toThrow(
      "Unable to decrypt payload",
    );
  });
});
