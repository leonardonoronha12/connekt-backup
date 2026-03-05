import fs from 'node:fs'
import path from 'node:path'
import dotenv from 'dotenv'
import { Client } from 'pg'

const envPath = path.resolve('.env.migration')
if (fs.existsSync(envPath)) {
  dotenv.config({ path: envPath })
}

function getClient() {
  const connectionString = process.env.SUPABASE_DB_URL
  if (!connectionString) throw new Error('SUPABASE_DB_URL ausente')
  return new Client({ connectionString, ssl: { rejectUnauthorized: false } })
}

async function run() {
  const client = getClient()
  await client.connect()
  try {
    const sqlPath = path.resolve('supabase/migrations/20260210_create_notifications_and_sales.sql')
    const sql = fs.readFileSync(sqlPath, 'utf8')
    await client.query(sql)
    const { rows } = await client.query(
      "select to_regclass('public.notifications') as notifications, to_regclass('public.sales') as sales"
    )
    process.stdout.write(JSON.stringify(rows?.[0] || {}) + '\n')
  } finally {
    await client.end()
  }
}

run().catch((e) => {
  process.stderr.write(String(e?.message || e) + '\n')
  process.exit(1)
})
