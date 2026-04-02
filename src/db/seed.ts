import * as bcrypt from 'bcryptjs';
import { pool } from './pool';

const SALT_ROUNDS = 10;

const users = [
  { username: 'user1', password: 'password1' },
  { username: 'user2', password: 'password2' },
];

async function seed() {
  for (const { username, password } of users) {
    const passwordHash = await bcrypt.hash(password, SALT_ROUNDS);
    await pool.query(
      `INSERT INTO users (username, password_hash, created_at)
       VALUES ($1, $2, $3)
       ON CONFLICT (username) DO NOTHING`,
      [username, passwordHash, new Date()],
    );
    console.log(`Seeded user: ${username}`);
  }
  await pool.end();
}

seed().catch((err) => {
  console.error(err);
  process.exit(1);
});