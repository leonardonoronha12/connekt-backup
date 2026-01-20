import fs from 'node:fs'
import path from 'node:path'
import dotenv from 'dotenv'
import { Client } from 'pg'

const envPath = path.resolve('.env.migration')
if (fs.existsSync(envPath)) {
  dotenv.config({ path: envPath })
} else {
  console.warn('Aviso: .env.migration não encontrado. Crie o arquivo com SUPABASE_DB_URL.')
}

const sqlPath = path.resolve('supabase/migrations/20251230190000_courses_media_and_data.sql')
if (!fs.existsSync(sqlPath)) {
  console.error('Migração não encontrada:', sqlPath)
  process.exit(1)
}

function getClient() {
  const connectionString = process.env.SUPABASE_DB_URL
  if (!connectionString) {
    console.error('SUPABASE_DB_URL ausente em .env.migration')
    process.exit(1)
  }
  return new Client({ connectionString, ssl: { rejectUnauthorized: false } })
}

async function run() {
  const client = getClient()
  await client.connect()
  try {
    const sql = fs.readFileSync(sqlPath, 'utf8')
    await client.query(sql)
    console.log('OK. Bucket courses-media e policies aplicadas.')
  } finally {
    await client.end()
  }
}

run().catch((e) => {
  console.error(e?.message || e)
  process.exit(1)
})

