import crypto from 'crypto';

const ENCRYPTION_KEY = process.env.ENCRYPTION_KEY || process.env.JWT_SECRET;
const IV_LENGTH = 16;

if (!ENCRYPTION_KEY || ENCRYPTION_KEY.length < 32) {
  console.error('WARNING: ENCRYPTION_KEY non impostata o troppo corta. Usare chiave AES-256 di almeno 32 caratteri.');
}

/**
 * Cripta testo sensibile (AES-256-CBC)
 * Usato per: codice fiscale, numero telefono, indirizzo dettagliato
 */
export const encrypt = (text: string): string => {
  if (!text) return text;
  if (!ENCRYPTION_KEY) return text; // Fallback non sicuro per sviluppo
  
  try {
    const iv = crypto.randomBytes(IV_LENGTH);
    const cipher = crypto.createCipheriv(
      'aes-256-cbc',
      Buffer.from(ENCRYPTION_KEY!.slice(0, 32)),
      iv
    );
    
    let encrypted = cipher.update(text, 'utf8', 'hex');
    encrypted += cipher.final('hex');
    
    return iv.toString('hex') + ':' + encrypted;
  } catch (err) {
    console.error('[Encryption] Errore criptazione:', err);
    return text;
  }
};

/**
 * Decripta testo
 */
export const decrypt = (encryptedText: string): string => {
  if (!encryptedText) return encryptedText;
  if (!encryptedText.includes(':')) return encryptedText; // Non criptato
  if (!ENCRYPTION_KEY) return encryptedText;
  
  try {
    const parts = encryptedText.split(':');
    const iv = Buffer.from(parts[0], 'hex');
    const encrypted = parts[1];
    
    const decipher = crypto.createDecipheriv(
      'aes-256-cbc',
      Buffer.from(ENCRYPTION_KEY!.slice(0, 32)),
      iv
    );
    
    let decrypted = decipher.update(encrypted, 'hex', 'utf8');
    decrypted += decipher.final('utf8');
    
    return decrypted;
  } catch (err) {
    console.error('[Encryption] Errore decriptazione:', err);
    return encryptedText;
  }
};

/**
 * Hash one-way per ricerca (non reversibile)
 * Usato per: codice fiscale (ricerca paziente senza esporre dato)
 */
export const hashForSearch = (text: string): string => {
  if (!text) return '';
  return crypto
    .createHmac('sha256', ENCRYPTION_KEY || 'default-key')
    .update(text.toLowerCase().trim())
    .digest('hex');
};
