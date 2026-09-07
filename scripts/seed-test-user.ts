// Dev-only: seed a verified student account into the local DB, bypassing the
// email-OTP action layer (calls the register handler directly). For local UI
// verification only. Run: npx tsx --env-file=.env.local scripts/seed-test-user.ts
import { handleRegister } from '@/server/users';

async function main() {
  const res: unknown = await handleRegister({
    name: 'Naveen Test',
    email: 'sajjanboynaveen4@gmail.com',
    password: 'snav1234',
    role: 'student',
    mobile: '9000000001',
    location: 'Tripura',
  } as never);
  console.log('register result:', JSON.stringify(res, null, 2).slice(0, 800));
}

main().then(() => process.exit(0)).catch((e) => { console.error('SEED FAILED:', e); process.exit(1); });
