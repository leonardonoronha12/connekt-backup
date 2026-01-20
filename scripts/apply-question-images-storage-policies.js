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

const sqlPath = path.resolve('supabase/migrations/20260102232000_question_images_storage_policies.sql')
if (!fs.existsSync(sqlPath)) {
  console.error('Migração não encontrada:', sqlPath)
  process.exit(1)
}

const sql = fs.readFileSync(sqlPath, 'utf8')

function getClientCandidates() {
  const connectionString = process.env.SUPABASE_DB_URL
  if (connectionString) {
    try {
      const u = new URL(connectionString)
      const host = u.hostname
      const port = Number(u.port || '5432')
      const database = (u.pathname || '/postgres').replace(/^\//, '') || 'postgres'
      const password = decodeURIComponent(u.password || '')
      const base = { host, port, database, password, ssl: { rejectUnauthorized: false } }
      const userCandidates = ['supabase_storage_admin', 'supabase_admin', u.username || 'postgres'].filter(Boolean)
      return userCandidates.map((user) => new Client({ ...base, user }))
    } catch {
      return [new Client({ connectionString, ssl: { rejectUnauthorized: false } })]
    }
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
  return [new Client({ host, port, database, user, password, ssl: { rejectUnauthorized: false } })]
}

async function connectFirst(candidates) {
  let lastErr = null
  for (const c of candidates) {
    try {
      await c.connect()
      return c
    } catch (e) {
      lastErr = e
      try { await c.end() } catch {}
    }
  }
  throw lastErr || new Error('Falha ao conectar ao banco.')
}

async function run() {
  console.log('Conectando ao banco...')
  const candidates = getClientCandidates()
  let client = await connectFirst(candidates)
  try {
    const trySetRole = async (role) => {
      try {
        await client.query(`set role ${role}`)
        console.log('SET ROLE ok:', role)
        return role
      } catch {
        return null
      }
    }

    const roleSet = (await trySetRole('supabase_storage_admin'))
      || (await trySetRole('supabase_admin'))
      || (await trySetRole('postgres'))

    if (!roleSet) {
      console.warn('Aviso: não foi possível executar SET ROLE. Prosseguindo com role atual.')
    }

    try {
      const { rows } = await client.query("select current_user, session_user")
      console.log('DB role:', rows?.[0] || {})
    } catch {}
    try {
      const { rows } = await client.query("select tableowner from pg_tables where schemaname = 'storage' and tablename = 'objects'")
      console.log('storage.objects owner:', rows?.[0]?.tableowner || null)
    } catch {}
    try {
      const { rows } = await client.query("select rolname, rolsuper, rolcreaterole, rolcreatedb from pg_roles where rolname = current_user")
      console.log('DB role flags:', rows?.[0] || {})
    } catch {}

    console.log('Aplicando migração:', path.basename(sqlPath))
    await client.query(sql)
    console.log('Migração aplicada com sucesso.')
  } catch (e) {
    console.error('Erro ao aplicar migração:', e?.message)
    process.exitCode = 1
  } finally {
    try { await client.query('reset role') } catch {}
    await client.end()
  }
}

run()
