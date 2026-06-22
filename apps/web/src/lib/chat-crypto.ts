export interface WrappedKey {
  ciphertext: string;
  iv: string;
  salt: string;
}

export interface EncryptedMessagePayload {
  ciphertext: string;
  iv: string;
}

function stringToBuffer(value: string): ArrayBuffer {
  const bytes = new TextEncoder().encode(value);
  return bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength) as ArrayBuffer;
}

function bufferToString(buffer: ArrayBuffer): string {
  return new TextDecoder().decode(buffer);
}

function arrayBufferToBase64(buffer: ArrayBuffer): string {
  const bytes = new Uint8Array(buffer);
  let binary = '';
  for (let i = 0; i < bytes.byteLength; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary);
}

function base64ToArrayBuffer(value: string): ArrayBuffer {
  const binary = atob(value);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes.buffer.slice(0, bytes.byteLength) as ArrayBuffer;
}

function randomBytes(length: number): ArrayBuffer {
  return crypto.getRandomValues(new Uint8Array(length)).buffer as ArrayBuffer;
}

async function deriveAesKey(passphrase: string, salt: ArrayBuffer): Promise<CryptoKey> {
  const keyMaterial = await crypto.subtle.importKey(
    'raw',
    stringToBuffer(passphrase),
    { name: 'PBKDF2' },
    false,
    ['deriveKey']
  );
  return crypto.subtle.deriveKey(
    { name: 'PBKDF2', salt, iterations: 100_000, hash: 'SHA-256' },
    keyMaterial,
    { name: 'AES-GCM', length: 256 },
    false,
    ['encrypt', 'decrypt']
  );
}

export async function generateChannelKey(): Promise<CryptoKey> {
  return crypto.subtle.generateKey({ name: 'AES-GCM', length: 256 }, true, ['encrypt', 'decrypt']);
}

export async function wrapChannelKey(
  channelKey: CryptoKey,
  passphrase: string
): Promise<WrappedKey> {
  const salt = randomBytes(16);
  const iv = randomBytes(12);
  const wrappingKey = await deriveAesKey(passphrase, salt);
  const exported = await crypto.subtle.exportKey('raw', channelKey);
  const encrypted = await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, wrappingKey, exported);
  return {
    ciphertext: arrayBufferToBase64(encrypted),
    iv: arrayBufferToBase64(iv),
    salt: arrayBufferToBase64(salt),
  };
}

export async function unwrapChannelKey(
  wrapped: WrappedKey,
  passphrase: string
): Promise<CryptoKey> {
  const salt = base64ToArrayBuffer(wrapped.salt);
  const iv = base64ToArrayBuffer(wrapped.iv);
  const wrappingKey = await deriveAesKey(passphrase, salt);
  const decrypted = await crypto.subtle.decrypt(
    { name: 'AES-GCM', iv },
    wrappingKey,
    base64ToArrayBuffer(wrapped.ciphertext)
  );
  return crypto.subtle.importKey('raw', decrypted, { name: 'AES-GCM', length: 256 }, false, [
    'encrypt',
    'decrypt',
  ]);
}

export async function encryptMessage(
  text: string,
  channelKey: CryptoKey
): Promise<EncryptedMessagePayload> {
  const iv = randomBytes(12);
  const encrypted = await crypto.subtle.encrypt(
    { name: 'AES-GCM', iv },
    channelKey,
    stringToBuffer(text)
  );
  return {
    ciphertext: arrayBufferToBase64(encrypted),
    iv: arrayBufferToBase64(iv),
  };
}

export async function decryptMessage(
  payload: EncryptedMessagePayload,
  channelKey: CryptoKey
): Promise<string> {
  const iv = base64ToArrayBuffer(payload.iv);
  const decrypted = await crypto.subtle.decrypt(
    { name: 'AES-GCM', iv },
    channelKey,
    base64ToArrayBuffer(payload.ciphertext)
  );
  return bufferToString(decrypted);
}
