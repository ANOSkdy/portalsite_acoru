import bcrypt from "bcryptjs";

const password = process.argv[2];
if (!password) {
  console.error('Usage: node scripts/hash-password.mjs "<password>"');
  process.exit(1);
}

bcrypt.hash(password, 12, (err, hash) => {
  if (err) throw err;
  console.log(hash);
});
