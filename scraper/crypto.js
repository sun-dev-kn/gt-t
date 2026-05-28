// scraper/crypto.js
let _derivedKey = null;

const SALT = new TextEncoder().encode("dotgit-scraper-v1");

export async function setMasterPassword(password) {
  const raw = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(password),
    "PBKDF2",
    false,
    ["deriveKey"]
  );
  _derivedKey = await crypto.subtle.deriveKey(
    { name: "PBKDF2", salt: SALT, iterations: 100000, hash: "SHA-256" },
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
    iv: btoa(String.fromCharCode(...iv)),
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
