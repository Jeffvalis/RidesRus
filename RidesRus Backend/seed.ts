import { Pool } from 'pg';
import * as bcrypt from 'bcryptjs';
import * as dotenv from 'dotenv';

dotenv.config();

async function seed() {
  const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false },
  });

  try {
    const passwordHash = await bcrypt.hash('ridesrus2026', 10);
    const phone = '+2349000000001';
    const email = 'jeffery@ridesrus.test';
    const name = 'Jeffery Isah';

    // Upsert — safe to run multiple times
    await pool.query(
      `INSERT INTO "User" (id, name, email, phone, "passwordHash", "walletBalance", "createdAt", "updatedAt")
       VALUES (gen_random_uuid(), $1, $2, $3, $4, 5000, NOW(), NOW())
       ON CONFLICT (phone) DO UPDATE SET "passwordHash" = EXCLUDED."passwordHash"`,
      [name, email, phone, passwordHash]
    );

    console.log('✅ Test passenger seeded successfully!');
    console.log('-----------------------------------');
    console.log('📱 Phone:    +2349000000001');
    console.log('🔑 Password: ridesrus2026');
    console.log('💰 Wallet:   ₦5,000 (pre-loaded)');
    console.log('-----------------------------------');
  } catch (err) {
    console.error('❌ Seed failed:', err.message);
  } finally {
    await pool.end();
  }
}

seed();
