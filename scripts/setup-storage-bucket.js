#!/usr/bin/env node
// Script para criar o bucket de Storage "question-images" no Supabase
// Usa a SERVICE_ROLE para executar operações administrativas.

import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'
import { createClient } from '@supabase/supabase-js'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)
const projectRoot = path.join(__dirname, '..')

function loadEnvLocal(filePath) {
  const env = {}
  try {
    const raw = fs.readFileSync(filePath, 'utf-8')
    for (const line of raw.split(/\r?\n/)) {
      const trimmed = line.trim()
      if (!trimmed || trimmed.startsWith('#')) continue
      const idx = trimmed.indexOf('=')
      if (idx === -1) continue
      const key = trimmed.slice(0, idx).trim()
      const value = trimmed.slice(idx + 1).trim()
      env[key] = value
    }
  } catch (e) {
    console.error('Falha ao ler .env.local:', e.message)
  }
  return env
}

async function main() {
  console.log('🗂️  Setup de Storage: question-images')
  const envPath = path.join(projectRoot, '.env.local')
  const env = loadEnvLocal(envPath)

  const SUPABASE_URL = process.env.VITE_SUPABASE_URL || env.VITE_SUPABASE_URL
  const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || env.SUPABASE_SERVICE_ROLE_KEY

  if (!SUPABASE_URL) {
    console.error('❌ VITE_SUPABASE_URL não definido. Configure em .env.local.')
    process.exit(1)
  }
  if (!SERVICE_ROLE_KEY || /sua_service_role_key/i.test(SERVICE_ROLE_KEY)) {
    console.error('❌ SUPABASE_SERVICE_ROLE_KEY ausente ou placeholder. Informe a chave SERVICE ROLE real em .env.local.')
    process.exit(1)
  }

  const admin = createClient(SUPABASE_URL, SERVICE_ROLE_KEY)

  // Verificar se o bucket já existe
  const { data: buckets, error: listErr } = await admin.storage.listBuckets()
  if (listErr) {
    console.error('❌ Erro ao listar buckets:', listErr.message)
    process.exit(1)
  }
  const exists = (buckets || []).some(b => b.id === 'question-images')
  if (exists) {
    console.log('✅ Bucket question-images já existe.')
  } else {
    console.log('📦 Criando bucket question-images...')
    const { data: created, error: createErr } = await admin.storage.createBucket('question-images', {
      public: true,
      fileSizeLimit: '50MB',
      allowedMimeTypes: ['image/png', 'image/jpeg', 'image/webp']
    })
    if (createErr) {
      console.error('❌ Erro ao criar bucket:', createErr.message)
      process.exit(1)
    }
    console.log('✅ Bucket criado:', created?.name || 'question-images')
  }

  // Avisos sobre policies
  console.log('ℹ️  Leitura pública habilitada pelo bucket. Para uploads pelo usuário, verifique policies em storage.objects:')
  console.log('   - Insert para role authenticated (e anon somente se for necessário em dev).')
  console.log('   - Exemplo (SQL Editor):')
  console.log('     CREATE POLICY "allow_authenticated_insert_question_images" ON storage.objects FOR INSERT')
  console.log('     TO authenticated WITH CHECK (bucket_id = \"question-images\");')

  console.log('🎉 Setup concluído.')
}

main().catch(err => {
  console.error('❌ Erro inesperado:', err?.message || err)
  process.exit(1)
})