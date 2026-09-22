const encoder = new TextEncoder();
const decoder = new TextDecoder();

export interface EncryptionParameters {
  algorithm: "AES-GCM";
  keyLength: 256;
  ivBytes: 12;
  kdf: "PBKDF2";
  hash: "SHA-256";
  iterations: number;
  saltBytes: 16;
}
export const ENCRYPTION_PARAMETERS: EncryptionParameters = {
  algorithm: "AES-GCM",
  keyLength: 256,
  ivBytes: 12,
  kdf: "PBKDF2",
  hash: "SHA-256",
  iterations: 600_000,
  saltBytes: 16,
};
export interface EncryptedPayload {
  version: 1;
  parameters: EncryptionParameters;
  salt: string;
  iv: string;
  ciphertext: string;
}

const encode = (bytes: Uint8Array) => btoa(String.fromCharCode(...bytes));
const decode = (value: string): Uint8Array<ArrayBuffer> => {
  const binary = atob(value);
  const bytes = new Uint8Array(new ArrayBuffer(binary.length));
  for (let index = 0; index < binary.length; index += 1)
    bytes[index] = binary.charCodeAt(index);
  return bytes;
};

async function deriveKey(
  secret: string,
  salt: Uint8Array<ArrayBuffer>,
  params: EncryptionParameters,
): Promise<CryptoKey> {
  const material = await crypto.subtle.importKey(
    "raw",
    encoder.encode(secret),
    "PBKDF2",
    false,
    ["deriveKey"],
  );
  return crypto.subtle.deriveKey(
    {
      name: params.kdf,
      salt,
      iterations: params.iterations,
      hash: params.hash,
    },
    material,
    { name: params.algorithm, length: params.keyLength },
    false,
    ["encrypt", "decrypt"],
  );
}

export async function encrypt(
  plaintext: string,
  secret: string,
): Promise<EncryptedPayload> {
  if (!secret) throw new Error("Secret must not be empty");
  const salt = crypto.getRandomValues(
    new Uint8Array(ENCRYPTION_PARAMETERS.saltBytes),
  );
  const iv = crypto.getRandomValues(
    new Uint8Array(ENCRYPTION_PARAMETERS.ivBytes),
  );
  const key = await deriveKey(secret, salt, ENCRYPTION_PARAMETERS);
  const ciphertext = await crypto.subtle.encrypt(
    { name: ENCRYPTION_PARAMETERS.algorithm, iv },
    key,
    encoder.encode(plaintext),
  );
  return {
    version: 1,
    parameters: ENCRYPTION_PARAMETERS,
    salt: encode(salt),
    iv: encode(iv),
    ciphertext: encode(new Uint8Array(ciphertext)),
  };
}

export async function decrypt(
  payload: EncryptedPayload,
  secret: string,
): Promise<string> {
  if (payload.version !== 1)
    throw new Error("Unsupported encrypted payload version");
  try {
    const key = await deriveKey(
      secret,
      decode(payload.salt),
      payload.parameters,
    );
    const plaintext = await crypto.subtle.decrypt(
      { name: payload.parameters.algorithm, iv: decode(payload.iv) },
      key,
      decode(payload.ciphertext),
    );
    return decoder.decode(plaintext);
  } catch {
    throw new Error("Unable to decrypt payload");
  }
}
