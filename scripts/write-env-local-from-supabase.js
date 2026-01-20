import fs from 'node:fs'
import path from 'node:path'
import { execFile } from 'node:child_process'

function execFileAsync(file, args, opts = {}) {
  return new Promise((resolve, reject) => {
    execFile(file, args, { ...opts, windowsHide: true, maxBuffer: 10 * 1024 * 1024 }, (err, stdout, stderr) => {
      if (err) {
        err.stdout = stdout
        err.stderr = stderr
        reject(err)
        return
      }
      resolve({ stdout, stderr })
    })
  })
}

function getProjectRef() {
  const fromEnv = process.env.SUPABASE_PROJECT_REF || process.env.VITE_SUPABASE_PROJECT_REF
  if (fromEnv) return String(fromEnv).trim()
  const p = path.resolve('supabase/.temp/project-ref')
  if (fs.existsSync(p)) return fs.readFileSync(p, 'utf8').trim()
  return null
}

function pickKey(payload, candidates) {
  for (const k of candidates) {
    if (payload && typeof payload[k] === 'string' && payload[k].trim()) return payload[k].trim()
  }
  return null
}

function findWindowsNpxCli() {
  const candidates = [
    'C:\\\\Program Files\\\\nodejs\\\\node_modules\\\\npm\\\\bin\\\\npx-cli.js',
    'C:\\\\Program Files (x86)\\\\nodejs\\\\node_modules\\\\npm\\\\bin\\\\npx-cli.js',
  ]
  for (const p of candidates) {
    if (fs.existsSync(p)) return p
  }
  return null
}

async function main() {
  const projectRef = getProjectRef()
  if (!projectRef) {
    console.log('Project ref não encontrado (supabase/.temp/project-ref).')
    process.exit(1)
  }

  let keysJson = null
  const tmpKeysPath = path.resolve('.tmp_api_keys.json')
  if (fs.existsSync(tmpKeysPath)) {
    keysJson = JSON.parse(fs.readFileSync(tmpKeysPath, 'utf8'))
  } else {
    try {
      const npxCli = process.platform === 'win32' ? findWindowsNpxCli() : null
      if (process.platform === 'win32' && !npxCli) {
        console.log('Não foi possível localizar npx-cli.js no Windows.')
        process.exit(1)
      }
      const args = [
        '--yes',
        'supabase@2.70.5',
        'projects',
        'api-keys',
        '--project-ref',
        projectRef,
        '--output',
        'json',
      ]
      const cmd = process.platform === 'win32' ? process.execPath : 'npx'
      const cmdArgs = process.platform === 'win32' ? [npxCli, ...args] : args
      const { stdout } = await execFileAsync(cmd, cmdArgs, { cwd: process.cwd() })
      keysJson = JSON.parse(String(stdout || '').trim())
    } catch (e) {
      console.log('Falha ao obter api-keys via Supabase CLI. Você está logado no CLI?')
      process.exit(1)
    }
  }

  let anonKey = null
  let serviceRoleKey = null
  if (Array.isArray(keysJson)) {
    const anonRow = keysJson.find((k) => String(k?.name || '').toLowerCase() === 'anon')
    const srRow = keysJson.find((k) => String(k?.name || '').toLowerCase() === 'service_role')
    anonKey = anonRow?.api_key ? String(anonRow.api_key).trim() : null
    serviceRoleKey = srRow?.api_key ? String(srRow.api_key).trim() : null
  } else {
    anonKey = pickKey(keysJson, ['anon_key', 'anonKey', 'anon'])
    serviceRoleKey = pickKey(keysJson, ['service_role_key', 'serviceRoleKey', 'service_role'])
  }
  if (!anonKey || !serviceRoleKey) {
    console.log('Não foi possível extrair anon/service_role do retorno do CLI.')
    process.exit(1)
  }

  const envPath = path.resolve('.env.local')
  if (fs.existsSync(envPath)) {
    const backupPath = path.resolve(`.env.local.bak.${Date.now()}`)
    fs.copyFileSync(envPath, backupPath)
  }

  const lines = [
    `VITE_SUPABASE_URL=https://${projectRef}.supabase.co`,
    `VITE_SUPABASE_ANON_KEY=${anonKey}`,
    `VITE_SUPABASE_QUESTION_IMAGES_BUCKET=question-images`,
    `VITE_USE_LOCAL_UPLOAD_PROXY=true`,
    `SUPABASE_SERVICE_ROLE_KEY=${serviceRoleKey}`,
    '',
  ]
  fs.writeFileSync(envPath, lines.join('\n'), 'utf8')
  console.log('OK: .env.local gerado/atualizado.')

  try {
    if (fs.existsSync(tmpKeysPath)) fs.unlinkSync(tmpKeysPath)
  } catch {}
}

main().catch((e) => {
  console.log('Erro:', e?.message || String(e))
  process.exit(1)
})
