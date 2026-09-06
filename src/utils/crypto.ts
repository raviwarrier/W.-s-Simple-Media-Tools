// Client-side AES-GCM encryption utility utilizing Web Crypto API
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

export async function deriveKeyFromPassword(password: string, salt: Uint8Array): Promise<CryptoKey> {
  const enc = new TextEncoder();
  const keyMaterial = await crypto.subtle.importKey(
    'raw',
    enc.encode(password),
    { name: 'PBKDF2' },
    false,
    ['deriveKey']
  );

  return crypto.subtle.deriveKey(
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

export async function encryptVault(store: SecretStore, password: string): Promise<string> {
  // Always generate a fresh 16-byte random salt for the encryption envelope
  const salt = crypto.getRandomValues(new Uint8Array(16));
  const saltBase64 = bufferToBase64(salt.buffer);
  try {
    localStorage.setItem(SALT_STORAGE_KEY, saltBase64);
  } catch {}

  const key = await deriveKeyFromPassword(password, salt);
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const enc = new TextEncoder();
  const plaintext = enc.encode(JSON.stringify(store));

  const ciphertext = await crypto.subtle.encrypt(
    {
      name: 'AES-GCM',
      iv: iv,
    },
    key,
    plaintext
  );

  // Self-contained cryptographic envelope containing its own salt & IV
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

/**
 * Safely attempts to decrypt a serialized AES-GCM vault envelope without throwing or logging console errors.
 */
export async function tryDecryptPayload(
  rawPayload: string | null,
  password: string
): Promise<SecretStore | null> {
  if (!rawPayload) return null;
  try {
    const parsed = JSON.parse(rawPayload);
    if (!parsed || !parsed.data || !parsed.iv) return null;

    let salt: Uint8Array | null = null;
    if (parsed.salt) {
      salt = new Uint8Array(base64ToBuffer(parsed.salt));
    } else {
      const saltStr = localStorage.getItem(SALT_STORAGE_KEY);
      if (saltStr) {
        salt = new Uint8Array(base64ToBuffer(saltStr));
      }
    }
    if (!salt) return null;

    const key = await deriveKeyFromPassword(password, salt);
    const iv = new Uint8Array(base64ToBuffer(parsed.iv));
    const ciphertext = base64ToBuffer(parsed.data);

    const decrypted = await crypto.subtle.decrypt(
      {
        name: 'AES-GCM',
        iv: iv,
      },
      key,
      ciphertext
    );

    const dec = new TextDecoder();
    return JSON.parse(dec.decode(decrypted)) as SecretStore;
  } catch {
    // Gracefully return null on authentication or passphrase mismatch
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

    // If existing local storage has an obsolete or unrecoverable payload from old trials,
    // clear the invalid entry to prevent repeated attempts
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
