// ==============================================================================
// Antar AI — Client-Side Biometric Cryptographic Service
// Zero-Cloud Biometric Privacy via Web Crypto API (AES-GCM-256 + PBKDF2) & IndexedDB
// ==============================================================================

import { SecureBiometricVault } from './SecureBiometricVault';

export interface AuthBiometricProfile {
  userId: string;
  enrolledAt: number;
  templateVersion: string;
  iv: string;                 // Base64 encoded 12-byte IV
  encryptedEmbedding: string; // Base64 encoded AES-GCM ciphertext
  salt: string;               // Base64 encoded 16-byte PBKDF2 salt
}

const DB_NAME = 'antar_secure_db';
const DB_VERSION = 1;
const STORE_NAME = 'antar_secure_credentials';
const PBKDF2_ITERATIONS = 100000;

// Utility: ArrayBuffer <-> Base64
function arrayBufferToBase64(buffer: ArrayBuffer | Uint8Array): string {
  const bytes = buffer instanceof Uint8Array ? buffer : new Uint8Array(buffer);
  let binary = '';
  for (let i = 0; i < bytes.byteLength; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return window.btoa(binary);
}

function base64ToArrayBuffer(base64: string): ArrayBuffer {
  const binary = window.atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes.buffer;
}

// ------------------------------------------------------------------------------
// IndexedDB Storage Engine (Encrypted At Rest)
// ------------------------------------------------------------------------------

function openDatabase(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    if (!window.indexedDB) {
      reject(new Error('IndexedDB is not supported in this browser environment.'));
      return;
    }

    const request = window.indexedDB.open(DB_NAME, DB_VERSION);

    request.onupgradeneeded = (event) => {
      const db = (event.target as IDBOpenDBRequest).result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME, { keyPath: 'userId' });
      }
    };

    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

export async function saveBiometricProfile(profile: AuthBiometricProfile): Promise<void> {
  const db = await openDatabase();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readwrite');
    const store = tx.objectStore(STORE_NAME);
    const request = store.put(profile);

    request.onsuccess = () => resolve();
    request.onerror = () => reject(request.error);
  });
}

export async function getBiometricProfile(userId: string): Promise<AuthBiometricProfile | null> {
  const db = await openDatabase();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readonly');
    const store = tx.objectStore(STORE_NAME);
    const request = store.get(userId);

    request.onsuccess = () => resolve(request.result || null);
    request.onerror = () => reject(request.error);
  });
}

export async function deleteBiometricProfile(userId: string): Promise<void> {
  await SecureBiometricVault.deleteReferenceEmbedding(userId).catch(() => {});
  const db = await openDatabase();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readwrite');
    const store = tx.objectStore(STORE_NAME);
    const request = store.delete(userId);

    request.onsuccess = () => resolve();
    request.onerror = () => reject(request.error);
  });
}

export async function hasEnrolledBiometrics(userId: string): Promise<boolean> {
  const inVault = await SecureBiometricVault.hasEnrolledBiometrics(userId);
  if (inVault) return true;
  const profile = await getBiometricProfile(userId);
  return profile !== null;
}

// ------------------------------------------------------------------------------
// Web Crypto API: Key Derivation & AES-GCM-256 Encryption
// ------------------------------------------------------------------------------

/**
 * Derives a 256-bit AES-GCM key from user passphrase/id using PBKDF2 (SHA-256, 100k rounds)
 */
async function deriveEncryptionKey(passphrase: string, salt: Uint8Array): Promise<CryptoKey> {
  const enc = new TextEncoder();
  const keyMaterial = await window.crypto.subtle.importKey(
    'raw',
    enc.encode(passphrase),
    { name: 'PBKDF2' },
    false,
    ['deriveKey']
  );

  return window.crypto.subtle.deriveKey(
    {
      name: 'PBKDF2',
      salt: salt as unknown as BufferSource,
      iterations: PBKDF2_ITERATIONS,
      hash: 'SHA-256'
    },
    keyMaterial,
    { name: 'AES-GCM', length: 256 },
    false,
    ['encrypt', 'decrypt']
  );
}

/**
 * Encrypts a 128-dimensional embedding vector using AES-GCM-256
 */
export async function encryptEmbedding(
  embedding: number[],
  passphrase: string,
  salt?: Uint8Array
): Promise<{ ciphertext: string; iv: string; salt: string }> {
  const activeSalt = salt || window.crypto.getRandomValues(new Uint8Array(16));
  const iv = window.crypto.getRandomValues(new Uint8Array(12));
  const key = await deriveEncryptionKey(passphrase, activeSalt);

  // Serialize float array into JSON or Float32 buffer
  const payload = JSON.stringify(embedding);
  const encodedPayload = new TextEncoder().encode(payload);

  const encryptedBuffer = await window.crypto.subtle.encrypt(
    { name: 'AES-GCM', iv },
    key,
    encodedPayload
  );

  return {
    ciphertext: arrayBufferToBase64(encryptedBuffer),
    iv: arrayBufferToBase64(iv),
    salt: arrayBufferToBase64(activeSalt)
  };
}

/**
 * Decrypts ciphertext back to a 128-dimensional embedding vector
 */
export async function decryptEmbedding(
  ciphertextBase64: string,
  ivBase64: string,
  saltBase64: string,
  passphrase: string
): Promise<number[]> {
  const ciphertext = base64ToArrayBuffer(ciphertextBase64);
  const iv = new Uint8Array(base64ToArrayBuffer(ivBase64));
  const salt = new Uint8Array(base64ToArrayBuffer(saltBase64));

  const key = await deriveEncryptionKey(passphrase, salt);

  const decryptedBuffer = await window.crypto.subtle.decrypt(
    { name: 'AES-GCM', iv },
    key,
    ciphertext
  );

  const decodedJson = new TextDecoder().decode(decryptedBuffer);
  return JSON.parse(decodedJson) as number[];
}

/**
 * Full High-Level Enrollment Storage
 */
export async function storeEnrolledEmbedding(
  userId: string,
  passphrase: string,
  embedding: number[]
): Promise<AuthBiometricProfile> {
  // Store into v2 production vault
  await SecureBiometricVault.storeReferenceEmbedding(userId, passphrase, embedding);

  const { ciphertext, iv, salt } = await encryptEmbedding(embedding, passphrase);

  const profile: AuthBiometricProfile = {
    userId,
    enrolledAt: Date.now(),
    templateVersion: 'antar-canonical-v3.0',
    iv,
    encryptedEmbedding: ciphertext,
    salt
  };

  await saveBiometricProfile(profile);
  return profile;
}

/**
 * Full High-Level Decrypted Embedding Loader
 */
export async function loadEnrolledEmbedding(
  userId: string,
  passphrase: string
): Promise<number[] | null> {
  // 1. Try v2 production vault first
  const buf = new Float32Array(128);
  const vaultSuccess = await SecureBiometricVault.loadReferenceEmbedding(userId, passphrase, buf);
  if (vaultSuccess) {
    const res = Array.from(buf);
    buf.fill(0);
    return res;
  }

  // 2. Fallback to legacy profile store
  const profile = await getBiometricProfile(userId);
  if (!profile) return null;

  try {
    return await decryptEmbedding(
      profile.encryptedEmbedding,
      profile.iv,
      profile.salt,
      passphrase
    );
  } catch (err) {
    console.error('Failed to decrypt biometric profile. Key or password mismatch.', err);
    return null;
  }
}
