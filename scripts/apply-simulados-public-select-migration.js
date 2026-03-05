import fs from 'node:fs'
import path from 'node:path'
import dotenv from 'dotenv'
import { Client } from 'pg'

const envPath = path.resolve('.env.migration')
if (fs.existsSync(envPath)) dotenv.config({ path: envPath })

const sqlPath = path.resolve('supabase/migrations/20260210123000_simulados_public_select_published.sql')
if (!fs.existsSync(sqlPath)) {
  console.error('Migração não encontrada:', sqlPath)
  process.exit(1)
}

const sql = fs.readFileSync(sqlPath, 'utf8')

function getClient() {
  const connectionString = process.env.SUPABASE_DB_URL
  if (connectionString) return new Client({ connectionString, ssl: { rejectUnauthorized: false } })

  const host = process.env.PGHOST || process.env.SUPABASE_PG_HOST
  const port = Number(process.env.PGPORT || process.env.SUPABASE_PG_PORT || 5432)
  const database = process.env.PGDATABASE || process.env.SUPABASE_PG_DATABASE
  const user = process.env.PGUSER || process.env.SUPABASE_PG_USER
  const password = process.env.PGPASSWORD || process.env.SUPABASE_PG_PASSWORD
  if (!host || !database || !user || !password) {
    console.error('Credenciais insuficientes. Defina SUPABASE_DB_URL ou PGHOST/PGPORT/PGDATABASE/PGUSER/PGPASSWORD.')
    process.exit(1)
  }
  return new Client({ host, port, database, user, password, ssl: { rejectUnauthorized: false } })
}

async function run() {
  const client = getClient()
  await client.connect()
  try {
    await client.query(sql)
    console.log('Migração aplicada com sucesso:', path.basename(sqlPath))
  } catch (e) {
    console.error('Erro ao aplicar migração:', e?.message || String(e))
    process.exitCode = 1
  } finally {
    await client.end()
  }
}

run()

