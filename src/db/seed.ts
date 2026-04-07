import 'dotenv/config';
import * as bcrypt from 'bcryptjs';
import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient, UserType } from '../generated/prisma/client';

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL! });
const prisma = new PrismaClient({ adapter });
const SALT_ROUNDS = 10;

const users = [
  { username: 'user1', password: 'password1', user_type: UserType.DRIVER },
  { username: 'user2', password: 'password2', user_type: UserType.RIDER },
  { username: 'user3', password: 'password3', user_type: UserType.RIDER },
];

async function seed() {
  for (const { username, password, user_type } of users) {
    const password_hash = await bcrypt.hash(password, SALT_ROUNDS);
    await prisma.user.upsert({
      where: { username },
      update: {},
      create: { username, password_hash, user_type },
    });
    console.log(`Seeded user: ${username}`);
  }
  await prisma.$disconnect();
}

seed().catch((err) => {
  console.error(err);
  process.exit(1);
});
