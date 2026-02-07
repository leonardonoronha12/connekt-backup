import fs from 'node:fs'
import path from 'node:path'
import dotenv from 'dotenv'
import { Client } from 'pg'

const envPath = path.resolve('.env.migration')
if (fs.existsSync(envPath)) {
  dotenv.config({ path: envPath })
} else {
  console.warn('Aviso: .env.migration não encontrado. Crie o arquivo com SUPABASE_DB_URL ou credenciais PG.')
}

const sqlPath = path.resolve('supabase/migrations/20260206120000_create_notifications.sql')
if (!fs.existsSync(sqlPath)) {
  console.error('Migração não encontrada:', sqlPath)
  process.exit(1)
}

const sql = fs.readFileSync(sqlPath, 'utf8')

function getClient() {
  const connectionString = process.env.SUPABASE_DB_URL
  if (connectionString) {
    return new Client({ connectionString, ssl: { rejectUnauthorized: false } })
  }
  const host = process.env.PGHOST || process.env.SUPABASE_PG_HOST
  const port = Number(process.env.PGPORT || process.env.SUPABASE_PG_PORT || 5432)
  const database = process.env.PGDATABASE || process.env.SUPABASE_PG_DATABASE
  const user = process.env.PGUSER || process.env.SUPABASE_PG_USER
  const password = process.env.PGPASSWORD || process.env.SUPABASE_PG_PASSWORD
  if (!host || !database || !user || !password) {
    console.error('Credenciais de banco insuficientes. Defina SUPABASE_DB_URL ou PGHOST/PGPORT/PGDATABASE/PGUSER/PGPASSWORD.')
    process.exit(1)
  }
  return new Client({ host, port, database, user, password, ssl: { rejectUnauthorized: false } })
}

async function run() {
  const client = getClient()
  console.log('Conectando ao banco...')
  await client.connect()
  try {
    console.log('Aplicando migração:', path.basename(sqlPath))
    await client.query(sql)
    console.log('Migração aplicada com sucesso.')
  } catch (e) {
    console.error('Erro ao aplicar migração:', e?.message)
    process.exitCode = 1
  } finally {
    await client.end()
  }
}

run()

