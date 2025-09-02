const bcrypt = require('bcryptjs');
const password = 'Raykonet#1'; // <-- IMPORTANT: Change this!
const saltRounds = 10;

bcrypt.hash(password, saltRounds, (err, hash) => {
  if (err) {
    console.error('Error hashing password:', err);
    return;
  }
  console.log('Your hashed password is:');
  console.log(hash);
});