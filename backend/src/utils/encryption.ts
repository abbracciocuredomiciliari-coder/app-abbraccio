import crypto from 'crypto';

const SALT = 'abbraccio-field-encryption-salt-v1';
const ENCRYPTION_KEY = process.env.ENCRYPTION_KEY;
const LEGACY_KEY = process.env.JWT_SECRET;
const IV_LENGTH = 16;
const TAG_LENGTH = 16;

function getKey(): Buffer {
  if (!ENCRYPTION_KEY || ENCRYPTION_KEY.length < 32) {
    throw new Error('ENCRYPTION_KEY mancante o troppo corta. Usare chiave AES-256 di almeno 32 caratteri.');
  }
  return crypto.scryptSync(ENCRYPTION_KEY, SALT, 32);
}

/**
 * Cripta testo sensibile (AES-256-GCM + scryptSync key derivation)
 * Formato: iv:authTag:ciphertext (hex)
 */
export const encrypt = (text: string): string => {
  if (!text) return text;
  try {
    const key = getKey();
    const iv = crypto.randomBytes(IV_LENGTH);
    const cipher = crypto.createCipheriv('aes-256-gcm', key, iv);
    let encrypted = cipher.update(text, 'utf8', 'hex');
    encrypted += cipher.final('hex');
    const authTag = cipher.getAuthTag();
    return `${iv.toString('hex')}:${authTag.toString('hex')}:${encrypted}`;
  } catch (err) {
    console.error('[Encryption] Errore criptazione:', err);
    return text;
  }
};

/**
 * Decripta testo (supporta legacy AES-256-CBC iv:ciphertext e nuovo GCM iv:tag:ciphertext)
 */
export const decrypt = (encryptedText: string): string => {
  if (!encryptedText) return encryptedText;
  if (!ENCRYPTION_KEY) return encryptedText;
  const parts = encryptedText.split(':');

  // Legacy AES-256-CBC: iv:ciphertext
  if (parts.length === 2) {
    try {
      const iv = Buffer.from(parts[0], 'hex');
      const encrypted = parts[1];
      const decipher = crypto.createDecipheriv('aes-256-cbc', Buffer.from(LEGACY_KEY.slice(0, 32)), iv);
      let decrypted = decipher.update(encrypted, 'hex', 'utf8');
      decrypted += decipher.final('utf8');
      return decrypted;
    } catch (err) {
      console.error('[Encryption] Errore decriptazione legacy CBC:', err);
      return encryptedText;
    }
  }

  // AES-256-GCM: iv:authTag:ciphertext
  if (parts.length === 3) {
    try {
      const iv = Buffer.from(parts[0], 'hex');
      const authTag = Buffer.from(parts[1], 'hex');
      const encrypted = parts[2];
      const key = getKey();
      const decipher = crypto.createDecipheriv('aes-256-gcm', key, iv);
      decipher.setAuthTag(authTag);
      let decrypted = decipher.update(encrypted, 'hex', 'utf8');
      decrypted += decipher.final('utf8');
      return decrypted;
    } catch (err) {
      console.error('[Encryption] Errore decriptazione GCM:', err);
      return encryptedText;
    }
  }

  return encryptedText;
};

/**
 * Hash one-way per ricerca (non reversibile)
 * Usato per: codice fiscale (ricerca paziente senza esporre dato)
 */
export const hashForSearch = (text: string): string => {
  if (!text) return '';
  const key = getKey();
  return crypto.createHmac('sha256', key).update(text.toLowerCase().trim()).digest('hex');
};
