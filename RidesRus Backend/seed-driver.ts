import * as dotenv from 'dotenv';
import { Pool } from 'pg';
import * as bcrypt from 'bcryptjs';
dotenv.config();

async function seedDriver() {
  const pool = new Pool({ connectionString: process.env.DATABASE_URL, ssl: { rejectUnauthorized: false } });
  try {
    const hash = await bcrypt.hash('ridesrus2026', 10);
    await pool.query(
      `INSERT INTO "Driver" (id, name, phone, "passwordHash", "createdAt", "updatedAt")
       VALUES (gen_random_uuid(), 'David Koko', '+2349000000002', $1, NOW(), NOW())
       ON CONFLICT (phone) DO UPDATE SET "passwordHash" = EXCLUDED."passwordHash"`,
      [hash]
    );
    console.log('✅ Driver seeded!');
    console.log('📱 Phone:    +2349000000002');
    console.log('🔑 Password: ridesrus2026');
  } catch (e: any) {
    console.error('❌', e.message);
  } finally {
    await pool.end();
  }
}
seedDriver();
