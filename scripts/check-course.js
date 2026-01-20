import fs from 'node:fs'
import path from 'node:path'
import dotenv from 'dotenv'
import { Client } from 'pg'

const envPath = path.resolve('.env.migration')
if (fs.existsSync(envPath)) {
  dotenv.config({ path: envPath })
}

const connectionString = process.env.SUPABASE_DB_URL
if (!connectionString) {
  console.error('SUPABASE_DB_URL ausente em .env.migration')
  process.exit(1)
}

const id = process.argv[2]
if (!id) {
  console.error('Uso: node scripts/check-course.js <courseId>')
  process.exit(1)
}

const client = new Client({ connectionString, ssl: { rejectUnauthorized: false } })
await client.connect()
try {
  const { rows } = await client.query(
    'select id, user_id, title, status, cover_image_url, promo_video_url, module_layout_image_url, created_at from public.courses where id = $1',
    [id],
  )
  console.log(rows[0] || null)
} finally {
  await client.end()
}

