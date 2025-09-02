-- Script to create a platform_owner user directly in the database.
--
-- Instructions:
-- 1. Replace the placeholder values below for username, email, and name.
-- 2. For the password, you MUST use a bcrypt hash.
-- 3. To generate a bcrypt hash, you can use the following Node.js script.
--    - Save it as `hash-password.js` in the root of the project.
--    - Make sure `bcryptjs` is installed (`npm install bcryptjs`).
--    - Run the script: `node hash-password.js`
--    - Copy the output hash and paste it into the 'password' field below, enclosed in single quotes.
--
-- Node.js script to generate a password hash:
/*
const bcrypt = require('bcryptjs');
const password = 'your_strong_password_here'; // <-- IMPORTANT: Change this!
const saltRounds = 10;

bcrypt.hash(password, saltRounds, (err, hash) => {
  if (err) {
    console.error('Error hashing password:', err);
    return;
  }
  console.log('Your hashed password is:');
  console.log(hash);
});
*/

-- =================================================================
-- INSERT SCRIPT
-- =================================================================

INSERT INTO ray_users (username, email, password, role, name, status)
VALUES (
  'superadmin',                               -- <-- Replace with your desired username
  'owner@raykonet.com',                          -- <-- Replace with your desired email
  '$2b$10$1gZ25n7gWNpXBPG3I1nNGujvE063fMNRP32/2/ZUejBnwnhOFhxPW',            -- <-- IMPORTANT: Replace with the generated hash
  'platform_owner',
  'Super Admin',                              -- <-- Replace with the desired name
  'active'
);

-- After running this script against your database, you should be able to log in
-- with the username and password you chose.
