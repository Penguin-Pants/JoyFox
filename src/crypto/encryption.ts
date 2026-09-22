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
export const ENCRYPTION_PARAMETERS: Readonly<EncryptionParameters> =
  Object.freeze({
    algorithm: "AES-GCM",
    keyLength: 256,
    ivBytes: 12,
    kdf: "PBKDF2",
    hash: "SHA-256",
    iterations: 600_000,
    saltBytes: 16,
  });
export interface EncryptedPayload {
  version: 1;
  parameters: Readonly<EncryptionParameters>;
  salt: string;
  iv: string;
  ciphertext: string;
}

const encode = (bytes: Uint8Array) => {
  const chunks: string[] = [];
  const chunkSize = 0x8000;
  for (let offset = 0; offset < bytes.length; offset += chunkSize)
    chunks.push(
      String.fromCharCode(...bytes.subarray(offset, offset + chunkSize)),
    );
  return btoa(chunks.join(""));
};
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
  params: Readonly<EncryptionParameters>,
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

function validatePayload(payload: EncryptedPayload): {
  salt: Uint8Array<ArrayBuffer>;
  iv: Uint8Array<ArrayBuffer>;
  ciphertext: Uint8Array<ArrayBuffer>;
} {
  if (
    !payload ||
    typeof payload !== "object" ||
    !payload.parameters ||
    typeof payload.parameters !== "object"
  )
    throw new Error("Invalid encrypted payload");
  if (
    payload.version !== 1 ||
    payload.parameters.algorithm !== ENCRYPTION_PARAMETERS.algorithm ||
    payload.parameters.keyLength !== ENCRYPTION_PARAMETERS.keyLength ||
    payload.parameters.ivBytes !== ENCRYPTION_PARAMETERS.ivBytes ||
    payload.parameters.kdf !== ENCRYPTION_PARAMETERS.kdf ||
    payload.parameters.hash !== ENCRYPTION_PARAMETERS.hash ||
    payload.parameters.iterations !== ENCRYPTION_PARAMETERS.iterations ||
    payload.parameters.saltBytes !== ENCRYPTION_PARAMETERS.saltBytes
  )
    throw new Error("Unsupported encrypted payload parameters");
  try {
    const salt = decode(payload.salt);
    const iv = decode(payload.iv);
    const ciphertext = decode(payload.ciphertext);
    if (
      salt.byteLength !== payload.parameters.saltBytes ||
      iv.byteLength !== payload.parameters.ivBytes ||
      ciphertext.byteLength === 0
    )
      throw new Error("Invalid encrypted payload");
    return { salt, iv, ciphertext };
  } catch {
    throw new Error("Invalid encrypted payload");
  }
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
    // A fresh frozen copy: the payload must never hand callers a reference to
    // the module-level source of truth that validation compares against.
    parameters: Object.freeze({ ...ENCRYPTION_PARAMETERS }),
    salt: encode(salt),
    iv: encode(iv),
    ciphertext: encode(new Uint8Array(ciphertext)),
  };
}

export async function decrypt(
  payload: EncryptedPayload,
  secret: string,
): Promise<string> {
  const validated = validatePayload(payload);
  try {
    const key = await deriveKey(secret, validated.salt, payload.parameters);
    const plaintext = await crypto.subtle.decrypt(
      { name: payload.parameters.algorithm, iv: validated.iv },
      key,
      validated.ciphertext,
    );
    return decoder.decode(plaintext);
  } catch {
    throw new Error("Unable to decrypt payload");
  }
}
