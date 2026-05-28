// scraper/crypto.js
// AES-GCM credential encryption. Key derived from master password via PBKDF2.
// Salt is random per-install, persisted to storage. _derivedKey held in memory only.

let _derivedKey = null;

const SALT_KEY = "scraper_crypto_salt";

async function getOrCreateSalt() {
  const result = await browser.storage.local.get(SALT_KEY);
  if (result[SALT_KEY]) {
    return Uint8Array.from(atob(result[SALT_KEY]), (c) => c.charCodeAt(0));
  }
  const salt = crypto.getRandomValues(new Uint8Array(16));
  await browser.storage.local.set({
    [SALT_KEY]: btoa(String.fromCharCode(...salt)),
  });
  return salt;
}

export async function setMasterPassword(password) {
  const salt = await getOrCreateSalt();
  const raw = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(password),
    "PBKDF2",
    false,
    ["deriveKey"]
  );
  _derivedKey = await crypto.subtle.deriveKey(
    { name: "PBKDF2", salt, iterations: 100000, hash: "SHA-256" },
    raw,
    { name: "AES-GCM", length: 256 },
    false,
    ["encrypt", "decrypt"]
  );
}

export function hasMasterPassword() {
  return _derivedKey !== null;
}

export function clearMasterPassword() {
  _derivedKey = null;
}

export async function encrypt(plaintext) {
  if (!_derivedKey) throw new Error("Master password not set");
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const ciphertext = await crypto.subtle.encrypt(
    { name: "AES-GCM", iv },
    _derivedKey,
    new TextEncoder().encode(plaintext)
  );
  return {
    iv: btoa(Array.from(iv, (b) => String.fromCharCode(b)).join("")),
    data: btoa(Array.from(new Uint8Array(ciphertext), (b) => String.fromCharCode(b)).join("")),
  };
}

export async function decrypt({ iv, data }) {
  if (!_derivedKey) throw new Error("Master password not set");
  const ivBytes = Uint8Array.from(atob(iv), (c) => c.charCodeAt(0));
  const dataBytes = Uint8Array.from(atob(data), (c) => c.charCodeAt(0));
  const plain = await crypto.subtle.decrypt(
    { name: "AES-GCM", iv: ivBytes },
    _derivedKey,
    dataBytes
  );
  return new TextDecoder().decode(plain);
}
