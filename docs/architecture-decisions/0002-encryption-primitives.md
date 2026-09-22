# ADR 0002: PBKDF2 and AES-GCM encryption proof

Status: accepted for the isolated proof of concept; sync transport remains open.

Derive a non-exportable 256-bit AES key from the user-held passphrase with
PBKDF2-HMAC-SHA-256, a random 16-byte salt, and 600,000 iterations. Encrypt with
AES-256-GCM and a fresh random 12-byte IV. Store the version, parameters, salt,
IV, and ciphertext. Never store the passphrase or derived key.

AES-GCM provides authenticated encryption and makes an incorrect secret fail
cleanly. Explicit, versioned parameters allow later migration without guessing.
The choice does not decide a future self-hosted sync protocol.
