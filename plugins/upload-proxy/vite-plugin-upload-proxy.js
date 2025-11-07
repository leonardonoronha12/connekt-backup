import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createClient } from '@supabase/supabase-js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const PROJECT_ROOT = path.resolve(__dirname, '../..');

function loadEnvLocal() {
  const envPath = path.resolve(PROJECT_ROOT, '.env.local');
  const env = {};
  try {
    const content = fs.readFileSync(envPath, 'utf-8');
    for (const line of content.split(/\r?\n/)) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith('#')) continue;
      const eqIdx = trimmed.indexOf('=');
      if (eqIdx === -1) continue;
      const key = trimmed.slice(0, eqIdx).trim();
      const value = trimmed.slice(eqIdx + 1).trim();
      env[key] = value;
    }
  } catch (e) {
    // ignore
  }
  return env;
}

function parseDataUrl(dataUrl) {
  const match = /^data:([^;]+);base64,(.*)$/.exec(dataUrl || '');
  if (!match) return null;
  const contentType = match[1];
  const b64 = match[2];
  return { contentType, buffer: Buffer.from(b64, 'base64') };
}

export default function uploadProxyPlugin() {
  return {
    name: 'vite-upload-proxy-plugin',
    configureServer(server) {
      const env = loadEnvLocal();
      const SUPABASE_URL = env.VITE_SUPABASE_URL || process.env.VITE_SUPABASE_URL;
      const SERVICE_ROLE_KEY = env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY;
      const BUCKET = env.VITE_SUPABASE_QUESTION_IMAGES_BUCKET || process.env.VITE_SUPABASE_QUESTION_IMAGES_BUCKET || 'question-images';

      if (!SUPABASE_URL || !SERVICE_ROLE_KEY) {
        console.warn('[upload-proxy] Missing SUPABASE_URL or SERVICE_ROLE_KEY; proxy disabled.');
        return;
      }

      const admin = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, { auth: { persistSession: false } });

      server.middlewares.use('/api/upload-question-image', async (req, res, next) => {
        if (req.method !== 'POST') return next();
        try {
          const chunks = [];
          await new Promise((resolve, reject) => {
            req.on('data', (c) => chunks.push(c));
            req.on('end', resolve);
            req.on('error', reject);
          });

          const json = JSON.parse(Buffer.concat(chunks).toString('utf-8'));
          const { bankId, questionId, filename, contentType, dataUrl } = json || {};

          if (!filename || !dataUrl) {
            res.statusCode = 400;
            res.setHeader('Content-Type', 'application/json');
            res.end(JSON.stringify({ error: 'Missing filename or dataUrl' }));
            return;
          }

          const parsed = parseDataUrl(dataUrl);
          if (!parsed) {
            res.statusCode = 400;
            res.setHeader('Content-Type', 'application/json');
            res.end(JSON.stringify({ error: 'Invalid dataUrl' }));
            return;
          }

          const ct = contentType || parsed.contentType || 'application/octet-stream';
          const safeName = String(filename).replace(/[^a-zA-Z0-9_.-]/g, '_');
          const ts = new Date().toISOString().replace(/[:.]/g, '-');
          const bankSegment = String(bankId || 'local');
          const questionSegment = String(questionId || 'local');
          const objectPath = `service/upload/question-banks/${bankSegment}/questions/${questionSegment}/${ts}_${safeName}`;

          // Ensure bucket exists (public for reads)
          try {
            await admin.storage.createBucket(BUCKET, { public: true });
          } catch (e) {
            // Ignore if already exists
          }

          const uploadRes = await admin.storage.from(BUCKET).upload(objectPath, parsed.buffer, { contentType: ct, upsert: true });
          if (uploadRes.error) {
            res.statusCode = 500;
            res.setHeader('Content-Type', 'application/json');
            res.end(JSON.stringify({ error: uploadRes.error.message }));
            return;
          }

          // Preferir URL assinada para garantir acesso independentemente da configuração de público do bucket
          let finalUrl = null;
          try {
            const { data: signed } = await admin.storage.from(BUCKET).createSignedUrl(objectPath, 60 * 60 * 24 * 7);
            finalUrl = signed?.signedUrl || null;
          } catch (_) {
            const { data: pub } = await admin.storage.from(BUCKET).getPublicUrl(objectPath);
            finalUrl = pub?.publicUrl || null;
          }

          // Registrar log do upload na tabela imagens_logs
          try {
            await admin.from('imagens_logs').insert({
              bank_id: bankId || null,
              question_id: questionId || null,
              filename: safeName,
              content_type: ct,
              path: objectPath,
              url: finalUrl,
              uploader_external_id: null,
              created_at: new Date().toISOString(),
            });
          } catch (logErr) {
            // não falhar a resposta por causa de log
            console.warn('[upload-proxy] falha ao registrar log:', logErr?.message || String(logErr));
          }

          // Fallback: registrar log como JSON em bucket de logs (imagens-logs)
          try {
            const LOG_BUCKET = 'imagens-logs';
            try {
              await admin.storage.createBucket(LOG_BUCKET, { public: true });
            } catch (_) {}
            const logObject = {
              bank_id: bankId || null,
              question_id: questionId || null,
              filename: safeName,
              content_type: ct,
              path: objectPath,
              url: finalUrl,
              uploader_external_id: null,
              created_at: new Date().toISOString(),
              source: 'proxy',
            };
            const logPath = `logs/${ts}_${safeName}.json`;
            await admin.storage.from(LOG_BUCKET).upload(logPath, Buffer.from(JSON.stringify(logObject), 'utf-8'), {
              contentType: 'application/json',
              upsert: true,
            });
          } catch (logBucketErr) {
            console.warn('[upload-proxy] falha ao gravar log em storage:', logBucketErr?.message || String(logBucketErr));
          }

          // Atualizar metadata.imageUrl e metadata.imagePath na questão (quando questionId fornecido)
          if (questionId) {
            try {
              const { data: row } = await admin
                .from('questions')
                .select('id, metadata')
                .eq('id', questionId)
                .single();
              const currentMeta = (row && typeof row.metadata === 'object' && row.metadata) ? row.metadata : {};
              const nextMeta = { ...currentMeta, imageUrl: finalUrl, imagePath: objectPath };
              await admin
                .from('questions')
                .update({ metadata: nextMeta, updated_at: new Date().toISOString() })
                .eq('id', questionId);
            } catch (updateErr) {
              console.warn('[upload-proxy] falha ao atualizar metadata da questão:', updateErr?.message || String(updateErr));
            }
          }

          res.statusCode = 200;
          res.setHeader('Content-Type', 'application/json');
          res.end(JSON.stringify({ url: finalUrl, path: objectPath }));
        } catch (err) {
          res.statusCode = 500;
          res.setHeader('Content-Type', 'application/json');
          res.end(JSON.stringify({ error: err?.message || String(err) }));
        }
      });

      // Novo endpoint: Upload de Vídeo para questão (similar ao de imagem)
      server.middlewares.use('/api/upload-question-video', async (req, res, next) => {
        if (req.method !== 'POST') return next();
        try {
          const chunks = [];
          await new Promise((resolve, reject) => {
            req.on('data', (c) => chunks.push(c));
            req.on('end', resolve);
            req.on('error', reject);
          });

          const json = JSON.parse(Buffer.concat(chunks).toString('utf-8'));
          const { bankId, questionId, filename, contentType, dataUrl } = json || {};

          if (!filename || !dataUrl) {
            res.statusCode = 400;
            res.setHeader('Content-Type', 'application/json');
            res.end(JSON.stringify({ error: 'Missing filename or dataUrl' }));
            return;
          }

          const parsed = parseDataUrl(dataUrl);
          if (!parsed) {
            res.statusCode = 400;
            res.setHeader('Content-Type', 'application/json');
            res.end(JSON.stringify({ error: 'Invalid dataUrl' }));
            return;
          }

          const ct = contentType || parsed.contentType || 'application/octet-stream';
          const safeName = String(filename).replace(/[^a-zA-Z0-9_.-]/g, '_');
          const ts = new Date().toISOString().replace(/[:.]/g, '-');
          const bankSegment = String(bankId || 'local');
          const questionSegment = String(questionId || 'local');
          const objectPath = `service/upload/question-banks/${bankSegment}/questions/${questionSegment}/${ts}_${safeName}`;

          // Ensure bucket exists (public for reads)
          try {
            await admin.storage.createBucket(BUCKET, { public: true });
          } catch (e) {
            // Ignore if already exists
          }

          const uploadRes = await admin.storage.from(BUCKET).upload(objectPath, parsed.buffer, { contentType: ct, upsert: true });
          if (uploadRes.error) {
            res.statusCode = 500;
            res.setHeader('Content-Type', 'application/json');
            res.end(JSON.stringify({ error: uploadRes.error.message }));
            return;
          }

          // Preferir URL assinada
          let finalUrl = null;
          try {
            const { data: signed } = await admin.storage.from(BUCKET).createSignedUrl(objectPath, 60 * 60 * 24 * 7);
            finalUrl = signed?.signedUrl || null;
          } catch (_) {
            const { data: pub } = await admin.storage.from(BUCKET).getPublicUrl(objectPath);
            finalUrl = pub?.publicUrl || null;
          }

          // Registrar log (reutiliza imagens_logs)
          try {
            await admin.from('imagens_logs').insert({
              bank_id: bankId || null,
              question_id: questionId || null,
              filename: safeName,
              content_type: ct,
              path: objectPath,
              url: finalUrl,
              uploader_external_id: null,
              created_at: new Date().toISOString(),
            });
          } catch (logErr) {
            console.warn('[upload-proxy] falha ao registrar log de vídeo:', logErr?.message || String(logErr));
          }

          // Atualizar metadata.videoUrl e metadata.videoPath na questão
          if (questionId) {
            try {
              const { data: row } = await admin
                .from('questions')
                .select('id, metadata')
                .eq('id', questionId)
                .single();
              const currentMeta = (row && typeof row.metadata === 'object' && row.metadata) ? row.metadata : {};
              const nextMeta = { ...currentMeta, videoUrl: finalUrl, videoPath: objectPath };
              await admin
                .from('questions')
                .update({ metadata: nextMeta, updated_at: new Date().toISOString() })
                .eq('id', questionId);
            } catch (updateErr) {
              console.warn('[upload-proxy] falha ao atualizar metadata.video da questão:', updateErr?.message || String(updateErr));
            }
          }

          res.statusCode = 200;
          res.setHeader('Content-Type', 'application/json');
          res.end(JSON.stringify({ url: finalUrl, path: objectPath }));
        } catch (err) {
          res.statusCode = 500;
          res.setHeader('Content-Type', 'application/json');
          res.end(JSON.stringify({ error: err?.message || String(err) }));
        }
      });

      // Novo endpoint: Upload de Imagem → Supabase + Log (bucket 'images')
      server.middlewares.use('/api/upload-image-with-log', async (req, res, next) => {
        if (req.method !== 'POST') return next();
        try {
          const chunks = [];
          await new Promise((resolve, reject) => {
            req.on('data', (c) => chunks.push(c));
            req.on('end', resolve);
            req.on('error', reject);
          });

          const json = JSON.parse(Buffer.concat(chunks).toString('utf-8'));
          const { filename, contentType, dataUrl, title = null, contentId = null } = json || {};
          if (!filename || !dataUrl) {
            res.statusCode = 400;
            res.setHeader('Content-Type', 'application/json');
            res.end(JSON.stringify({ error: 'Missing filename or dataUrl' }));
            return;
          }

          const parsed = parseDataUrl(dataUrl);
          if (!parsed) {
            res.statusCode = 400;
            res.setHeader('Content-Type', 'application/json');
            res.end(JSON.stringify({ error: 'Invalid dataUrl' }));
            return;
          }

          const mime = contentType || parsed.contentType || 'application/octet-stream';
          if (!String(mime).startsWith('image/')) {
            res.statusCode = 400;
            res.setHeader('Content-Type', 'application/json');
            res.end(JSON.stringify({ error: 'File must be image/*' }));
            return;
          }

          const size = parsed.buffer.length;
          if (size > 5 * 1024 * 1024) {
            res.statusCode = 400;
            res.setHeader('Content-Type', 'application/json');
            res.end(JSON.stringify({ error: 'Max size 5MB exceeded' }));
            return;
          }

          const imagesBucket = 'images';
          try { await admin.storage.createBucket(imagesBucket, { public: true }); } catch (_) {}

          const safeExt = (mime.split('/')[1] || 'bin').split('+')[0].toLowerCase();
          const uuid = (globalThis.crypto && crypto.randomUUID) ? crypto.randomUUID() : `${Date.now()}_${Math.random().toString(16).slice(2)}`;
          const fileName = `${uuid}.${safeExt}`;
          const objectPath = `public/${fileName}`;

          const { error: upErr } = await admin.storage.from(imagesBucket).upload(objectPath, parsed.buffer, {
            contentType: mime,
            upsert: false,
          });
          if (upErr) throw upErr;

          const { data: pub } = await admin.storage.from(imagesBucket).getPublicUrl(objectPath);
          const imageUrl = pub?.publicUrl || '';

          let logId = null;
          try {
            const payload = {
              image_url: imageUrl,
              file_name: fileName,
              path: objectPath,
              bucket: imagesBucket,
              mime_type: mime,
              size_bytes: size,
              title: title || null,
              content_id: contentId || null,
            };
            const { data: inserted, error: logErr } = await admin
              .from('imagens_logs')
              .insert(payload)
              .select('id')
              .single();
            if (logErr) throw logErr;
            logId = inserted?.id || null;
          } catch (e) {
            // Fallback para schema antigo (bank_id, question_id, filename, content_type, path, url, uploader_external_id)
            try {
              const { data: inserted2, error: logErr2 } = await admin
                .from('imagens_logs')
                .insert({
                  bank_id: null,
                  question_id: null,
                  filename: fileName,
                  content_type: mime,
                  path: objectPath,
                  url: imageUrl,
                  uploader_external_id: null,
                })
                .select('id')
                .single();
              if (!logErr2) logId = inserted2?.id || null;
            } catch (_) {}
          }

          res.statusCode = 200;
          res.setHeader('Content-Type', 'application/json');
          res.end(JSON.stringify({
            log_id: logId,
            image_url: imageUrl,
            file_name: fileName,
            path: objectPath,
            bucket: imagesBucket,
            mime_type: mime,
            size_bytes: size,
            content_id: contentId || null,
            title: title || null,
          }));
        } catch (err) {
          res.statusCode = 500;
          res.setHeader('Content-Type', 'application/json');
          res.end(JSON.stringify({ error: err?.message || String(err) }));
        }
      });
    },
  };
}