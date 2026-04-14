const supabaseUrl =
  process.env.VITE_SUPABASE_URL ||
  process.env.VITE_PUBLIC_SUPABASE_URL ||
  process.env.SUPABASE_URL

const anon =
  process.env.VITE_SUPABASE_ANON_KEY ||
  process.env.VITE_PUBLIC_SUPABASE_ANON_KEY ||
  process.env.SUPABASE_ANON_KEY

if (!supabaseUrl) {
  console.error('Missing Supabase URL in env: set VITE_SUPABASE_URL or SUPABASE_URL')
  process.exit(1)
}

const url = `${String(supabaseUrl).replace(/\/+$/, '')}/auth/v1/token?grant_type=password`
if (!anon) {
  console.error('Missing anon key in env: set VITE_SUPABASE_ANON_KEY or SUPABASE_ANON_KEY');
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
