import fs from 'node:fs'
import path from 'node:path'
import dotenv from 'dotenv'
import { Client } from 'pg'

// Load migration env (.env.migration) without affecting runtime env
const envPath = path.resolve('.env.migration')
if (fs.existsSync(envPath)) {
  dotenv.config({ path: envPath })
} else {
  console.warn('Aviso: .env.migration não encontrado. Crie o arquivo com SUPABASE_DB_URL ou credenciais PG.')
}

const sqlPath = path.resolve('supabase/migrations/20251208_create_profiles.sql')
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
    // Ativa VITE_USE_PROFILES_TABLE=true em .env.local
    const envLocalPath = path.resolve('.env.local')
    if (fs.existsSync(envLocalPath)) {
      let content = fs.readFileSync(envLocalPath, 'utf8')
      if (content.includes('VITE_USE_PROFILES_TABLE')) {
        content = content.replace(/VITE_USE_PROFILES_TABLE\s*=\s*false/gi, 'VITE_USE_PROFILES_TABLE=true')
      } else {
        content = content.trim() + '\nVITE_USE_PROFILES_TABLE=true\n'
      }
      fs.writeFileSync(envLocalPath, content, 'utf8')
      console.log('Atualizado .env.local: VITE_USE_PROFILES_TABLE=true')
    } else {
      console.warn('.env.local não encontrado para ativar VITE_USE_PROFILES_TABLE')
    }
  } catch (e) {
    console.error('Erro ao aplicar migração:', e?.message)
    process.exitCode = 1
  } finally {
    await client.end()
  }
}

run()

