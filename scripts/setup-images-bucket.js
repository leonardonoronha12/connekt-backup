#!/usr/bin/env node
// Cria o bucket de Storage "images" no Supabase e valida com healthcheck
import { createClient } from '@supabase/supabase-js'

const url = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_ROLE

if (!url || !serviceKey) {
  console.error('❌ Missing SUPABASE URL or SERVICE ROLE key in env.')
  process.exit(1)
}

const admin = createClient(url, serviceKey, { auth: { persistSession: false } })

async function main() {
  const bucket = 'images'
  console.log('🗂️  Setup de Storage:', bucket)
  try {
    const { error } = await admin.storage.createBucket(bucket, {
      public: true,
      fileSizeLimit: '50MB',
      allowedMimeTypes: ['image/png', 'image/jpeg', 'image/webp', 'image/svg+xml']
    })
    if (error && !String(error.message || '').includes('already exists')) throw error
    console.log(`✅ Bucket ${bucket} pronto (public read).`)
  } catch (err) {
    console.warn('⚠️  Falha ao criar bucket (provavelmente já existe):', err?.message || String(err))
  }

  // Healthcheck: grava um objeto pequeno usando SERVICE ROLE
  try {
    const path = `healthcheck/${Date.now()}.json`
    const blob = new Blob([JSON.stringify({ ok: true, ts: new Date().toISOString() })], { type: 'application/json' })
    const { error } = await admin.storage.from(bucket).upload(path, blob, { upsert: true })
    if (error) throw error
    const { data } = await admin.storage.from(bucket).getPublicUrl(path)
    console.log('✅ Healthcheck gravado em:', data?.publicUrl || path)
  } catch (err) {
    console.warn('⚠️  Falha ao gravar healthcheck (verifique políticas de insert para clientes):', err?.message || String(err))
  }

  console.log('\nℹ️  Policies recomendadas (SQL Editor):')
  console.log('CREATE POLICY "allow_authenticated_insert_images" ON storage.objects FOR INSERT TO authenticated WITH CHECK (bucket_id = "images");')
  console.log('CREATE POLICY "allow_anon_insert_images_dev" ON storage.objects FOR INSERT TO anon WITH CHECK (bucket_id = "images"); // opcional dev')
}

main()