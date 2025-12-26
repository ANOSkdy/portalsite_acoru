import bcrypt from "bcryptjs";

export function hashPassword(password: string, rounds = 12): Promise<string> {
  return new Promise((resolve, reject) => {
    bcrypt.hash(password, rounds, (err, hash) => {
      if (err || !hash) return reject(err ?? new Error("Failed to hash password"));
      resolve(hash);
    });
  });
}

function looksLikeBcrypt(value: string) {
  return (
    value.startsWith("$2a$") ||
    value.startsWith("$2b$") ||
    value.startsWith("$2y$")
  );
}

// crypto を使わずに（edgeでも動く）定数時間っぽい比較
function constantTimeEqual(a: string, b: string) {
  const enc = new TextEncoder();
  const ab = enc.encode(a);
  const bb = enc.encode(b);
  if (ab.length !== bb.length) return false;
  let diff = 0;
  for (let i = 0; i < ab.length; i++) diff |= ab[i] ^ bb[i];
  return diff === 0;
}

export function verifyPassword(password: string, stored: string): Promise<boolean> {
  // bcrypt 形式なら bcrypt compare、それ以外は平文比較
  if (looksLikeBcrypt(stored)) {
    return new Promise((resolve, reject) => {
      bcrypt.compare(password, stored, (err, same) => {
        if (err) return reject(err);
        resolve(Boolean(same));
      });
    });
  }

  return Promise.resolve(constantTimeEqual(password, stored));
}