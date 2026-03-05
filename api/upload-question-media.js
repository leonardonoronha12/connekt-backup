import { getSupabaseAdmin, getAuthedUser, readRawBody, json, safeName, isoSafeNow, isUuid } from '../src/server/supabaseAdmin.js'

export default async function handler(req, res) {
  if (req.method !== 'POST' && req.method !== 'GET') return json(res, 405, { error: 'method_not_allowed' })

  const admin = getSupabaseAdmin()
  if (!admin) return json(res, 501, { error: 'proxy_disabled', hint: 'Configure SUPABASE_SERVICE_ROLE_KEY no ambiente do deploy.' })

  const auth = await getAuthedUser(admin, req)
  if (!auth.user) return json(res, 401, { error: auth.error || 'unauthorized' })

  try {
    const u = new URL(req.url, `http://${req.headers.host}`)
    const action = String(u.searchParams.get('action') || '').trim().toLowerCase()
    const mediaType = String(u.searchParams.get('type') || '').trim().toLowerCase()
    const bankId = u.searchParams.get('bankId')
    const questionId = u.searchParams.get('questionId')
    const filename = u.searchParams.get('filename')
    const contentType = u.searchParams.get('contentType') || req.headers['content-type'] || 'application/octet-stream'
    const providedPath = String(u.searchParams.get('path') || '').trim()
    const expectsBody = !action || action === 'upload'
    const buffer = expectsBody ? await readRawBody(req) : null
    if (!filename) return json(res, 400, { error: 'missing_filename' })
    if (expectsBody && (!buffer || buffer.length === 0)) return json(res, 400, { error: 'missing_body' })

    if (mediaType !== 'image' && mediaType !== 'video') return json(res, 400, { error: 'invalid_type' })

    if (bankId && isUuid(bankId)) {
      const { data: bank } = await admin
        .from('question_banks')
        .select('id,producer_external_id')
        .eq('id', bankId)
        .maybeSingle()
      if (bank && String(bank.producer_external_id || '') !== String(auth.user.id)) return json(res, 403, { error: 'forbidden' })
    }

    const BUCKET = process.env.VITE_SUPABASE_QUESTION_IMAGES_BUCKET || process.env.SUPABASE_QUESTION_IMAGES_BUCKET || 'question-images'
    const ts = isoSafeNow()
    const bankSegment = isUuid(bankId) ? bankId : String(bankId || 'local')
    const questionSegment = isUuid(questionId) ? questionId : String(questionId || 'local')
    const objectPath = providedPath || `${auth.user.id}/question-banks/${bankSegment}/questions/${questionSegment}/${ts}_${safeName(filename)}`
    let url = null

    if (action === 'sign') {
      const storage = admin.storage.from(BUCKET)
      if (typeof storage.createSignedUploadUrl !== 'function') {
        return json(res, 501, { error: 'signed_upload_not_supported' })
      }
      const signed = await storage.createSignedUploadUrl(objectPath)
      if (signed?.error) return json(res, 500, { error: signed.error.message || String(signed.error) })
      const signedUrl = signed?.data?.signedUrl || null
      const token = signed?.data?.token || null
      const { data: pub } = await storage.getPublicUrl(objectPath)
      const publicUrl = pub?.publicUrl || null
      if (!signedUrl && !token) return json(res, 500, { error: 'missing_signed_upload_data' })
      return json(res, 200, { signedUrl, token, path: objectPath, publicUrl, bucket: BUCKET, contentType: String(contentType) })
    }

    try {
      if (action === 'finalize') {
        const { data: pub } = await admin.storage.from(BUCKET).getPublicUrl(objectPath)
        url = pub?.publicUrl || null
        try {
          await admin.from('imagens_logs').insert({
            bank_id: bankId || null,
            question_id: questionId || null,
            filename: safeName(filename),
            content_type: String(contentType),
            path: objectPath,
            url,
            uploader_external_id: auth.user.id,
          })
        } catch (_) {}
        if (questionId && isUuid(questionId)) {
          try {
            const { data: row } = await admin.from('questions').select('id,metadata').eq('id', questionId).maybeSingle()
            if (row) {
              const meta = (row.metadata && typeof row.metadata === 'object') ? row.metadata : {}
              const nextMeta = mediaType === 'image'
                ? { ...meta, imageUrl: url, imagePath: objectPath }
                : { ...meta, videoUrl: url, videoPath: objectPath }
              await admin.from('questions').update({ metadata: nextMeta, updated_at: new Date().toISOString() }).eq('id', questionId)
            }
          } catch (_) {}
        }
        return json(res, 200, { url, path: objectPath })
      }

      const up = await admin.storage.from(BUCKET).upload(objectPath, buffer, { contentType: String(contentType), upsert: true })
      if (up.error) return json(res, 500, { error: up.error.message || String(up.error) })

      const { data: pub } = await admin.storage.from(BUCKET).getPublicUrl(objectPath)
      url = pub?.publicUrl || null

      await admin.from('imagens_logs').insert({
        bank_id: bankId || null,
        question_id: questionId || null,
        filename: safeName(filename),
        content_type: String(contentType),
        path: objectPath,
        url,
        uploader_external_id: auth.user.id,
      })
    } catch (_) {}

    if (questionId && isUuid(questionId)) {
      try {
        const { data: row } = await admin.from('questions').select('id,metadata').eq('id', questionId).maybeSingle()
        if (row) {
          const meta = (row.metadata && typeof row.metadata === 'object') ? row.metadata : {}
          const nextMeta = mediaType === 'image'
            ? { ...meta, imageUrl: url, imagePath: objectPath }
            : { ...meta, videoUrl: url, videoPath: objectPath }
          await admin.from('questions').update({ metadata: nextMeta, updated_at: new Date().toISOString() }).eq('id', questionId)
        }
      } catch (_) {}
    }

    return json(res, 200, { url, path: objectPath })
  } catch (e) {
    return json(res, 500, { error: e?.message || String(e) })
  }
}
