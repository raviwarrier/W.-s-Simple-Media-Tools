// Client-side AES encryption utility with Web Crypto API and non-secure context fallbacks
import CryptoJS from 'crypto-js';
import { SecretStore } from '../types';

const SALT_STORAGE_KEY = 'vault_salt_v1';
const ENCRYPTED_VAULT_KEY = 'vault_payload_enc_v1';
const VAULT_META_KEY = 'vault_meta_v1';

export const DEFAULT_VAULT_PASSPHRASE = 'w_media_suite_vault_key_2026_aes256';
export const KNOWN_PASSPHRASES = [
  'w_media_suite_vault_key_2026_aes256',
  'media_suite_vault_key_2026',
  'w_media_suite_vault_key_2026',
];

/**
 * Checks whether Web Cryptography API (crypto.subtle) is accessible.
 * In non-secure contexts (e.g. HTTP over LAN / non-localhost IPs), modern browsers
 * intentionally disable window.crypto.subtle.
 */
export function isWebCryptoAvailable(): boolean {
  return (
    typeof window !== 'undefined' &&
    typeof window.crypto !== 'undefined' &&
    typeof window.crypto.subtle !== 'undefined' &&
    typeof window.crypto.subtle.importKey === 'function'
  );
}

function getRandomBytes(length: number): Uint8Array {
  const bytes = new Uint8Array(length);
  if (
    typeof window !== 'undefined' &&
    typeof window.crypto !== 'undefined' &&
    typeof window.crypto.getRandomValues === 'function'
  ) {
    window.crypto.getRandomValues(bytes);
  } else {
    for (let i = 0; i < length; i++) {
      bytes[i] = Math.floor(Math.random() * 256);
    }
  }
  return bytes;
}

function bufferToBase64(buffer: ArrayBuffer): string {
  const bytes = new Uint8Array(buffer);
  let binary = '';
  for (let i = 0; i < bytes.byteLength; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary);
}

function base64ToBuffer(base64: string): ArrayBuffer {
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes.buffer;
}

export async function deriveKeyFromPassword(password: string, salt: Uint8Array): Promise<CryptoKey | null> {
  if (!isWebCryptoAvailable()) return null;
  const enc = new TextEncoder();
  const keyMaterial = await window.crypto.subtle.importKey(
    'raw',
    enc.encode(password),
    { name: 'PBKDF2' },
    false,
    ['deriveKey']
  );

  return window.crypto.subtle.deriveKey(
    {
      name: 'PBKDF2',
      salt: salt,
      iterations: 100000,
      hash: 'SHA-256',
    },
    keyMaterial,
    { name: 'AES-GCM', length: 256 },
    false,
    ['encrypt', 'decrypt']
  );
}

function decryptWithCryptoJS(ciphertext: string, password: string): SecretStore | null {
  try {
    const bytes = CryptoJS.AES.decrypt(ciphertext, password);
    const decryptedStr = bytes.toString(CryptoJS.enc.Utf8);
    if (!decryptedStr) return null;
    return JSON.parse(decryptedStr) as SecretStore;
  } catch {
    return null;
  }
}

export async function encryptVault(store: SecretStore, password: string): Promise<string> {
  // 1. If Web Crypto API is available (secure context: HTTPS or localhost), use standard AES-GCM
  if (isWebCryptoAvailable()) {
    try {
      const salt = getRandomBytes(16);
      const saltBase64 = bufferToBase64(salt.buffer);
      try {
        localStorage.setItem(SALT_STORAGE_KEY, saltBase64);
      } catch {}

      const key = await deriveKeyFromPassword(password, salt);
      if (key) {
        const iv = getRandomBytes(12);
        const enc = new TextEncoder();
        const plaintext = enc.encode(JSON.stringify(store));

        const ciphertext = await window.crypto.subtle.encrypt(
          {
            name: 'AES-GCM',
            iv: iv,
          },
          key,
          plaintext
        );

        const combined = {
          salt: saltBase64,
          iv: bufferToBase64(iv.buffer),
          data: bufferToBase64(ciphertext),
          updated: Date.now(),
        };

        const serialized = JSON.stringify(combined);
        try {
          localStorage.setItem(ENCRYPTED_VAULT_KEY, serialized);
          localStorage.setItem(VAULT_META_KEY, JSON.stringify({ isConfigured: true, lastUpdated: Date.now() }));
        } catch {}

        return serialized;
      }
    } catch (webCryptoErr) {
      console.warn('Web Crypto encryption failed, attempting fallback:', webCryptoErr);
    }
  }

  // 2. Server-assisted encryption: if browser is on HTTP / non-secure context, ask local Express server
  try {
    const res = await fetch('/api/vault/encrypt', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ store, password }),
    });
    if (res.ok) {
      const json = await res.json();
      if (json.encryptedPayload && typeof json.encryptedPayload === 'string') {
        try {
          localStorage.setItem(ENCRYPTED_VAULT_KEY, json.encryptedPayload);
          localStorage.setItem(VAULT_META_KEY, JSON.stringify({ isConfigured: true, lastUpdated: Date.now() }));
        } catch {}
        return json.encryptedPayload;
      }
    }
  } catch (serverErr) {
    console.warn('Server vault encrypt unavailable, using CryptoJS local fallback:', serverErr);
  }

  // 3. Client-side pure JS fallback with CryptoJS (100% offline & independent of browser secure-context rules)
  const plaintext = JSON.stringify(store);
  const encrypted = CryptoJS.AES.encrypt(plaintext, password).toString();
  const envelope = {
    format: 'cryptojs-v1',
    data: encrypted,
    updated: Date.now(),
  };
  const serialized = JSON.stringify(envelope);
  try {
    localStorage.setItem(ENCRYPTED_VAULT_KEY, serialized);
    localStorage.setItem(VAULT_META_KEY, JSON.stringify({ isConfigured: true, lastUpdated: Date.now() }));
  } catch {}

  return serialized;
}

/**
 * Safely attempts to decrypt a serialized vault envelope across WebCrypto, CryptoJS, or server-side fallback.
 */
export async function tryDecryptPayload(
  rawPayload: string | null,
  password: string
): Promise<SecretStore | null> {
  if (!rawPayload) return null;
  try {
    let parsed: any = null;
    try {
      parsed = JSON.parse(rawPayload);
    } catch {
      // Raw string format: attempt CryptoJS decryption directly
      return decryptWithCryptoJS(rawPayload, password);
    }

    if (!parsed) return null;

    // Format A: CryptoJS envelope
    if (parsed.format === 'cryptojs-v1' && parsed.data) {
      return decryptWithCryptoJS(parsed.data, password);
    }

    // Format B: Standard AES-GCM envelope
    if (parsed.data && parsed.iv) {
      let salt: Uint8Array | null = null;
      if (parsed.salt) {
        salt = new Uint8Array(base64ToBuffer(parsed.salt));
      } else {
        const saltStr = localStorage.getItem(SALT_STORAGE_KEY);
        if (saltStr) {
          salt = new Uint8Array(base64ToBuffer(saltStr));
        }
      }

      // If Web Crypto is accessible in this browser context, decrypt natively
      if (isWebCryptoAvailable() && salt) {
        try {
          const key = await deriveKeyFromPassword(password, salt);
          if (key) {
            const iv = new Uint8Array(base64ToBuffer(parsed.iv));
            const ciphertext = base64ToBuffer(parsed.data);

            const decrypted = await window.crypto.subtle.decrypt(
              {
                name: 'AES-GCM',
                iv: iv,
              },
              key,
              ciphertext
            );

            const dec = new TextDecoder();
            return JSON.parse(dec.decode(decrypted)) as SecretStore;
          }
        } catch {
          // Passphrase mismatch or WebCrypto error; continue to server fallback check
        }
      }

      // If Web Crypto is unavailable (insecure HTTP context / Firefox LAN IP) or failed, try server endpoint
      try {
        const res = await fetch('/api/vault/decrypt', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ payload: parsed, password }),
        });
        if (res.ok) {
          const json = await res.json();
          if (json.status === 'ok' && json.store) {
            return json.store as SecretStore;
          }
        }
      } catch {}
    }

    // Format C: Try CryptoJS on parsed.data if available
    if (parsed.data && typeof parsed.data === 'string') {
      const fallbackStore = decryptWithCryptoJS(parsed.data, password);
      if (fallbackStore) return fallbackStore;
    }

    return null;
  } catch {
    return null;
  }
}

export async function decryptVault(password: string, payload?: string): Promise<SecretStore | null> {
  const rawPayload = payload || localStorage.getItem(ENCRYPTED_VAULT_KEY);
  if (!rawPayload) return null;

  const result = await tryDecryptPayload(rawPayload, password);
  if (!result) {
    throw new Error('Invalid master passphrase or corrupted vault data.');
  }
  return result;
}

export async function saveEncryptedVault(
  store: SecretStore,
  password: string = DEFAULT_VAULT_PASSPHRASE
): Promise<string> {
  const serialized = await encryptVault(store, password);
  return serialized;
}

export async function loadEncryptedVault(
  customPassword?: string
): Promise<SecretStore | null> {
  try {
    const rawPayload = localStorage.getItem(ENCRYPTED_VAULT_KEY);
    if (!rawPayload) return null;

    const passphrasesToTry = customPassword
      ? [customPassword, ...KNOWN_PASSPHRASES]
      : KNOWN_PASSPHRASES;

    for (const pass of passphrasesToTry) {
      const store = await tryDecryptPayload(rawPayload, pass);
      if (store) {
        return store;
      }
    }

    try {
      localStorage.removeItem(ENCRYPTED_VAULT_KEY);
      localStorage.removeItem(VAULT_META_KEY);
    } catch {}
    return null;
  } catch (err) {
    console.warn('Could not auto-decrypt stored vault:', err);
    return null;
  }
}

export function isVaultConfigured(): boolean {
  return !!localStorage.getItem(ENCRYPTED_VAULT_KEY);
}

export function getInitialSecretStore(): SecretStore {
  return {
    keyMode: 'unified',
    unifiedOpenAiKey: '',
    moduleOpenAiKeys: {
      videoTranscriber: '',
      audiobookTranscriber: '',
      audioExtractor: '',
    },
    customTokens: {},
    isLocked: false,
  };
}
