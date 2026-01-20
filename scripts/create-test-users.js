import { createClient } from '@supabase/supabase-js'

async function main() {
  const url = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_ROLE
  if (!url || !serviceKey) {
    console.error('Missing SUPABASE_URL or service role key in env')
    process.exit(1)
  }
  const admin = createClient(url, serviceKey, { auth: { persistSession: false } })

  const password = 'Connekt123!'
  const emails = [
    'cezar@teste.com',
    'darin@teste.com',
    'caio@teste.com',
  ]

  for (const email of emails) {
    try {
      const { data, error } = await admin.auth.admin.createUser({
        email,
        password,
        email_confirm: true,
      })
      if (error) {
        console.error(`createUser error for ${email}:`, error.message || error)
      } else {
        console.log(`User created for ${email}:`, data?.user?.id || null)
      }
    } catch (e) {
      console.error(`Exception creating ${email}:`, e?.message || String(e))
    }
  }
}

main().catch((err) => {
  console.error('Script failure:', err?.message || String(err))
  process.exit(1)
})

