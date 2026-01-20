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

const client = new Client({ connectionString, ssl: { rejectUnauthorized: false } })
await client.connect()
try {
  const { rows } = await client.query("select id, public, allowed_mime_types, file_size_limit from storage.buckets where id = 'courses-media'")
  console.log(rows[0] || null)
  const { rows: policies } = await client.query(
    "select polname from pg_policy where polrelid = 'storage.objects'::regclass and polname like 'courses-media %' order by polname"
  )
  console.log({ policies: policies.map(r => r.polname) })
} finally {
  await client.end()
}

