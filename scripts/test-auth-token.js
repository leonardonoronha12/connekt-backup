// ESM script to test Supabase Auth token endpoint with anon headers
const url = 'https://ucsijwfarkrljbkdvrbd.supabase.co/auth/v1/token?grant_type=password';
const anon = process.env.VITE_SUPABASE_ANON_KEY || process.env.SUPABASE_ANON_KEY;
if (!anon) {
  console.error('Missing anon key in env: set VITE_SUPABASE_ANON_KEY');
  process.exit(1);
}
const email = process.env.TEST_EMAIL || 'demo@example.com';
const password = process.env.TEST_PASSWORD || 'WrongPass123';

async function main() {
  const res = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'apikey': anon,
      'Authorization': `Bearer ${anon}`,
    },
    body: JSON.stringify({ email, password }),
  });
  const text = await res.text();
  console.log('Status:', res.status);
  console.log('Body:', text);
}

main().catch(err => { console.error('Auth test error:', err?.message || String(err)); process.exit(1); });