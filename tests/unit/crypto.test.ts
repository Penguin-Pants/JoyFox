import { describe, expect, it } from "vitest";
import {
  decrypt,
  encrypt,
  ENCRYPTION_PARAMETERS,
} from "../../src/crypto/encryption";

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
  it("rejects altered parameters before key derivation", async () => {
    const encrypted = await encrypt("synthetic content", "right secret");
    const altered = {
      ...encrypted,
      parameters: { ...encrypted.parameters, iterations: 1 },
    };
    await expect(decrypt(altered, "right secret")).rejects.toThrow(
      "Unsupported encrypted payload parameters",
    );
  });
  it("rejects malformed serialized payloads cleanly", async () => {
    await expect(
      decrypt({ version: 1 } as never, "right secret"),
    ).rejects.toThrow("Invalid encrypted payload");
  });
  it("never exposes the shared parameter object to callers", async () => {
    const encrypted = await encrypt("synthetic content", "right secret");
    expect(encrypted.parameters).not.toBe(ENCRYPTION_PARAMETERS);
    expect(() => {
      (encrypted.parameters as { iterations: number }).iterations = 1;
    }).toThrow();
    expect(ENCRYPTION_PARAMETERS.iterations).toBe(600_000);
    await expect(decrypt(encrypted, "right secret")).resolves.toBe(
      "synthetic content",
    );
  });
  it("round-trips payloads larger than a JavaScript argument stack", async () => {
    const plaintext = "synthetic-data-".repeat(20_000);
    const encrypted = await encrypt(plaintext, "large payload secret");
    await expect(decrypt(encrypted, "large payload secret")).resolves.toBe(
      plaintext,
    );
  });
});
