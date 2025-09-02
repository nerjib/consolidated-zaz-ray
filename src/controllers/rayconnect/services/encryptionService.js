
const crypto = require('crypto');

// Ensure the ENCRYPTION_KEY is set in your environment variables.
// It must be a 32-character string for AES-256.
const ENCRYPTION_KEY = process.env.ENCRYPTION_KEY;
const ALGORITHM = 'aes-256-gcm';
const IV_LENGTH = 16; // For AES, this is always 16

if (!ENCRYPTION_KEY || ENCRYPTION_KEY.length !== 32) {
  throw new Error('ENCRYPTION_KEY environment variable must be set and be 32 characters long.');
}

/**
 * Encrypts a plaintext string.
 * @param {string} text - The text to encrypt.
 * @returns {string} The encrypted text, formatted as 'iv:encryptedData:authTag'.
 */
function encrypt(text) {
  if (text === null || typeof text === 'undefined') {
    return null;
  }
  const iv = crypto.randomBytes(IV_LENGTH);
  const cipher = crypto.createCipheriv(ALGORITHM, Buffer.from(ENCRYPTION_KEY), iv);
  let encrypted = cipher.update(text, 'utf8', 'hex');
  encrypted += cipher.final('hex');
  const authTag = cipher.getAuthTag().toString('hex');
  return `${iv.toString('hex')}:${encrypted}:${authTag}`;
}

/**
 * Decrypts an encrypted string.
 * @param {string} encryptedText - The text to decrypt, formatted as 'iv:encryptedData:authTag'.
 * @returns {string} The decrypted plaintext.
 */
function decrypt(encryptedText) {
  if (encryptedText === null || typeof encryptedText === 'undefined') {
    return null;
  }
  try {
    const parts = encryptedText.split(':');
    if (parts.length !== 3) {
      throw new Error('Invalid encrypted text format.');
    }
    const iv = Buffer.from(parts[0], 'hex');
    const encryptedData = parts[1];
    const authTag = Buffer.from(parts[2], 'hex');
    
    const decipher = crypto.createDecipheriv(ALGORITHM, Buffer.from(ENCRYPTION_KEY), iv);
    decipher.setAuthTag(authTag);
    
    let decrypted = decipher.update(encryptedData, 'hex', 'utf8');
    decrypted += decipher.final('utf8');
    
    return decrypted;
  } catch (error) {
    console.error('Decryption failed:', error.message);
    // In a production environment, you might want to handle this error more gracefully,
    // but for now, returning null indicates a failure.
    return null;
  }
}

module.exports = { encrypt, decrypt };
