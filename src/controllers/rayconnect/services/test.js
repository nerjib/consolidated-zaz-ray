const { generateToken, TokenType } = require('./openPayGoService'); // Adjust path to your module

const secretKey = 'dca6bd9bf3eb8741e7fdb0d42f91291c';
const count = 3;
const value = 7; // e.g., 1 day
startCode='484511834'

const result = generateToken(secretKey, value, count, TokenType.ADD_TIME, 1, false, false, startCode); // Example with extended token and starting code
console.log('Generated Token:', result.token);
console.log('Updated Count:', result.updatedCount);

// Expected output (matches Python lib): Token should be '28147497671065600000'