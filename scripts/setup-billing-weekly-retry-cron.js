import fs from 'node:fs'
import path from 'node:path'
import dotenv from 'dotenv'
import { Client } from 'pg'

const envPath = path.resolve('.env.migration')
if (fs.existsSync(envPath)) dotenv.config({ path: envPath })

function readProjectRefFromRepo() {
  const p = path.resolve('supabase/supabase/.temp/project-ref')
  if (!fs.existsSync(p)) return ''
  return String(fs.readFileSync(p, 'utf8') || '').trim()
}

function getClient() {
  const connectionString = process.env.SUPABASE_DB_URL
  if (connectionString) return new Client({ connectionString, ssl: { rejectUnauthorized: false } })
  const host = process.env.PGHOST || process.env.SUPABASE_PG_HOST
  const port = Number(process.env.PGPORT || process.env.SUPABASE_PG_PORT || 5432)
  const database = process.env.PGDATABASE || process.env.SUPABASE_PG_DATABASE
  const user = process.env.PGUSER || process.env.SUPABASE_PG_USER
  const password = process.env.PGPASSWORD || process.env.SUPABASE_PG_PASSWORD
  if (!host || !database || !user || !password) throw new Error('missing_db_env')
  return new Client({ host, port, database, user, password, ssl: { rejectUnauthorized: false } })
}

async function safeQuery(client, sql, params) {
  try {
    return await client.query(sql, params)
  } catch (e) {
    return { error: e }
  }
}

async function ensureExtensions(client) {
  await safeQuery(client, 'create extension if not exists pg_cron', [])
  await safeQuery(client, 'create extension if not exists pg_net', [])
  await safeQuery(client, 'create extension if not exists supabase_vault', [])
}

async function ensureVaultSecret(client, name, value) {
  const reg = await safeQuery(client, "select to_regclass('vault.secrets') as t", [])
  const has = reg?.rows?.[0]?.t
  if (has) {
    await safeQuery(client, 'delete from vault.secrets where name = $1', [name])
  }
  await safeQuery(client, 'select vault.create_secret($1, $2)', [String(value), String(name)])
}

async function unscheduleJobByName(client, jobName) {
  const r = await safeQuery(client, 'select jobid from cron.job where jobname = $1 limit 1', [jobName])
  const jobid = r?.rows?.[0]?.jobid
  if (!jobid) return
  await safeQuery(client, 'select cron.unschedule($1)', [jobid])
}

async function scheduleWeeklyRetry(client, { jobName, cronExpr, urlSecretName, secretName }) {
  const sql = `
    select cron.schedule(
      $1,
      $2,
      $$
      select
        net.http_post(
          url:= (select decrypted_secret from vault.decrypted_secrets where name = '${urlSecretName}'),
          headers:=jsonb_build_object(
            'Content-type','application/json',
            'Authorization', 'Bearer ' || (select decrypted_secret from vault.decrypted_secrets where name = '${secretName}')
          ),
          body:='{}'::jsonb
        ) as request_id;
      $$
    );
  `
  await safeQuery(client, sql, [jobName, cronExpr])
}

async function run() {
  const projectRef = String(process.env.SUPABASE_PROJECT_REF || process.env.PROJECT_REF || readProjectRefFromRepo() || '').trim()
  if (!projectRef) throw new Error('missing_project_ref')

  const cronSecret = String(process.env.CRON_SECRET || process.env.BILLING_WEEKLY_RETRY_CRON_SECRET || '').trim()
  if (!cronSecret) throw new Error('missing_cron_secret')

  const cronExpr = String(process.env.BILLING_WEEKLY_RETRY_CRON || '0 12 * * 1').trim()

  const functionUrl = `https://${projectRef}.supabase.co/functions/v1/billing-weekly-retry`
  const jobName = 'billing-weekly-retry-weekly'
  const urlSecretName = 'billing_weekly_retry_url'
  const secretName = 'billing_weekly_retry_cron_secret'

  const client = getClient()
  await client.connect()
  try {
    await ensureExtensions(client)
    await ensureVaultSecret(client, urlSecretName, functionUrl)
    await ensureVaultSecret(client, secretName, cronSecret)
    await unscheduleJobByName(client, jobName)
    await scheduleWeeklyRetry(client, { jobName, cronExpr, urlSecretName, secretName })
  } finally {
    await client.end()
  }
}

run().catch((e) => {
  process.stderr.write(String(e?.message || e) + '\n')
  process.exit(1)
})

