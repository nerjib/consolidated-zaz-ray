const crypto = require('crypto');
const siphash24 = require('siphash24'); // Correct package

// Token types (matching Python enum)
const TokenType = {
  ADD_TIME: 0x00,
  SET_TIME: 0x01,
  DISABLE_PAYG: 0x02,
  COUNTER_SYNC: 0x03
};

// Helper to validate starting code (now flexible: 4 or 9 digits)
function isValidStartingCode(code, restrictedDigitSet = false, expectedLength = null) {
  const length = expectedLength || 4; // Default to standard 4
  if (typeof code !== 'string' || code.length !== length || !/^\d{4}|\d{9}$/.test(code)) {
    return false;
  }
  if (restrictedDigitSet) {
    const pattern = length === 4 ? /^[1-4]{4}$/ : /^[1-4]{9}$/;
    return pattern.test(code);
  }
  return true;
}

function generateStartingCode(secretKey, count, restrictedDigitSet = false, length = 4) {
  const key = Buffer.from(secretKey, 'hex'); // Full 16-byte key
  if (key.length !== 16) {
    throw new Error('Secret key must be 16 bytes (32 hex chars)');
  }

  const countBytes = Buffer.alloc(4);
  countBytes.writeUInt32BE(count, 0);

  const hash = siphash24(countBytes, key); // 8-byte hash as Uint8Array
  const hashBuffer = Buffer.from(hash);

  let codeStr = '';
  if (length === 4) {
    if (!restrictedDigitSet) {
      // Standard: First 4 bytes as uint32 mod 10000, pad to 4 digits
      const codeNum = hashBuffer.readUInt32BE(0) % 10000;
      codeStr = codeNum.toString().padStart(4, '0');
    } else {
      // Restricted: First byte (0-255) as base-4 number, digits 0-3 → 1-4
      const codeNum = hashBuffer.readUInt8(0);
      let temp = codeNum;
      for (let i = 0; i < 4; i++) {
        const digit = temp % 4;
        codeStr = (digit + 1) + codeStr; // Map 0→1, 1→2, 2→3, 3→4
        temp = Math.floor(temp / 4);
      }
    }
  } else if (length === 9) {
    // Custom 9-digit: Use first 9 bytes of hash as base-10 mod 10^9, pad to 9 digits
    // (Adapt as needed if manufacturer uses a different derivation; this is a secure fallback)
    let codeNum = 0n;
    for (let i = 0; i < 9; i++) {
      codeNum = (codeNum * 256n) + BigInt(hashBuffer[i]);
    }
    const base = 10n ** 9n;
    codeNum = codeNum % base;
    codeStr = codeNum.toString().padStart(9, '0');

    if (restrictedDigitSet) {
      // Map to 1-4 cycling for restricted
      codeStr = codeStr.split('').map(d => String((Number(d) % 4) + 1)).join('');
    }
  } else {
    throw new Error('Unsupported starting code length; use 4 or 9');
  }
  return codeStr;
}

function generateToken(secretKey, value = 0, count = 0, tokenType = TokenType.ADD_TIME, 
                       valueDivider = 1, restrictedDigitSet = false, extendedToken = false,
                       startingCode = null, startingCodeLength = 9) {  // Default to 9 for your setup
  if (secretKey.length !== 32 || !/^[0-9a-fA-F]+$/.test(secretKey)) {
    throw new Error('Invalid secret_key: must be 32 hex chars');
  }
  if (value < 0 || value > (extendedToken ? 999999 : 995)) {
    throw new Error('Value out of range');
  }

  // Handle starting code (now supports 4 or 9 digits)
  let finalStartingCode;
  if (startingCode && isValidStartingCode(startingCode, restrictedDigitSet, startingCodeLength)) {
    finalStartingCode = startingCode;
    console.warn(`Using provided ${startingCodeLength}-digit starting code; ensure device compatibility.`);
  } else if (startingCode) {
    throw new Error(`Invalid starting_code: must be ${startingCodeLength} digits (0-9 or 1-4 if restricted)`);
  } else {
    finalStartingCode = generateStartingCode(secretKey, count, restrictedDigitSet, startingCodeLength);
  }

  const key = Buffer.from(secretKey, 'hex');
  const plaintext = Buffer.alloc(16);

  // Pack counter (bytes 0-3, big-endian)
  plaintext.writeUInt32BE(count, 0);

  // Pack value / divider (bytes 4-7, big-endian)
  const packedValue = Math.floor(value / valueDivider);
  plaintext.writeUInt32BE(packedValue, 4);

  // Pack token type (byte 8)
  plaintext[8] = tokenType;

  // Bytes 9-15: zero-padded

  // AES-128-ECB encrypt
  const cipher = crypto.createCipheriv('aes-128-ecb', key, null);
  let encrypted = cipher.update(plaintext);
  encrypted = Buffer.concat([encrypted, cipher.final()]);

  // Convert to big int (128-bit)
  let bigInt = 0n;
  for (const byte of encrypted) {
    bigInt = (bigInt * 256n) + BigInt(byte);
  }

  // Determine base and digits
  const numDigits = extendedToken ? 20 : 16;
  const isRestricted = restrictedDigitSet;
  const base = isRestricted ? 4n ** BigInt(numDigits) : 10n ** BigInt(numDigits);
  let remainder = bigInt % base;
  let digitsStr;

  if (!isRestricted) {
    // Standard: base-10 string, pad leading zeros
    digitsStr = remainder.toString().padStart(numDigits, '0');
  } else {
    // Restricted: base-4 string (digits 0-3), map to 1-4, pad leading '1's (for 0)
    let base4Str = remainder.toString(4).padStart(numDigits, '0');
    digitsStr = base4Str.split('').map(d => String(Number(d) + 1)).join(''); // 0→1, etc.
  }

  // Full token: startingCodeLength + numDigits
  const token = finalStartingCode + digitsStr;

  // Updated count (increment for next token)
  const updatedCount = count + 1;

  return { updatedCount, token };
}

module.exports = { generateToken, TokenType };