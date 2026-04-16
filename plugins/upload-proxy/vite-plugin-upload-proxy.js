import fs from 'node:fs';
import path from 'node:path';
import { Readable } from 'node:stream';
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
        const disabledHandler = async (req, res, next) => {
          if (req.method !== 'POST') return next();
          res.statusCode = 501;
          res.setHeader('Content-Type', 'application/json');
          res.end(JSON.stringify({
            error: 'Upload proxy disabled: missing SUPABASE_SERVICE_ROLE_KEY',
            hint: 'Configure SUPABASE_SERVICE_ROLE_KEY in .env.local for local uploads, or create the Storage bucket and policies in Supabase.',
          }));
        };
        server.middlewares.use('/api/media', async (req, res, next) => {
          if (req.method !== 'GET' && req.method !== 'HEAD') return next()
          res.statusCode = 501
          res.setHeader('Content-Type', 'application/json')
          res.end(JSON.stringify({ error: 'Media proxy disabled: missing SUPABASE_SERVICE_ROLE_KEY' }))
        })
        server.middlewares.use('/api/upload-course-media', disabledHandler);
        server.middlewares.use('/api/upload-question-image', disabledHandler);
        server.middlewares.use('/api/upload-question-video', disabledHandler);
        server.middlewares.use('/api/update-question', disabledHandler);
        console.warn('[upload-proxy] Missing SUPABASE_URL or SERVICE_ROLE_KEY; proxy disabled.');
        return;
      }

      const admin = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, { auth: { persistSession: false } });

      server.middlewares.use('/api/media', async (req, res, next) => {
        if (req.method !== 'GET' && req.method !== 'HEAD') return next()
        try {
          const u = new URL(req.url, 'http://localhost')
          const target = u.searchParams.get('u') || ''
          const isAllowed = (() => {
            try {
              const p = new URL(target)
              const host = String(p.hostname || '').toLowerCase()
              const envHost = (() => { try { return new URL(SUPABASE_URL).hostname.toLowerCase() } catch { return '' } })()
              const okHost = host.endsWith('.supabase.co') && host === envHost
              const okPath = String(p.pathname || '').startsWith('/storage/v1/object/')
              return okHost && okPath
            } catch {
              return false
            }
          })()
          if (!target || !isAllowed) {
            res.statusCode = 400
            res.setHeader('Content-Type', 'application/json')
            res.end(JSON.stringify({ error: 'invalid_target' }))
            return
          }

          const headers = {}
          const range = req.headers['range'] || req.headers['Range']
          if (range) headers['Range'] = range

          const upstream = await fetch(target, { method: req.method, headers })
          res.statusCode = upstream.status
          const passthrough = ['content-type', 'content-length', 'content-range', 'accept-ranges', 'etag', 'last-modified', 'cache-control', 'content-disposition']
          for (const h of passthrough) {
            const v = upstream.headers.get(h)
            if (v) res.setHeader(h, v)
          }
          if (!res.getHeader('accept-ranges')) res.setHeader('accept-ranges', 'bytes')

          if (req.method === 'HEAD') {
            res.end()
            return
          }

          if (!upstream.body) {
            res.end()
            return
          }
          const nodeStream = Readable.fromWeb(upstream.body)
          nodeStream.on('error', () => {
            try { res.end() } catch (_) {}
          })
          nodeStream.pipe(res)
        } catch (err) {
          res.statusCode = 500
          res.setHeader('Content-Type', 'application/json')
          res.end(JSON.stringify({ error: err?.message || String(err) }))
        }
      })

      server.middlewares.use('/api/update-question', async (req, res, next) => {
        if (req.method !== 'POST') return next();
        try {
          const chunks = [];
          await new Promise((resolve, reject) => {
            req.on('data', (c) => chunks.push(c));
            req.on('end', resolve);
            req.on('error', reject);
          });

          const json = JSON.parse(Buffer.concat(chunks).toString('utf-8') || '{}');
          const questionId = json?.questionId || json?.id || null;
          const updates = (json?.updates && typeof json.updates === 'object') ? json.updates : {};

          if (!questionId) {
            res.statusCode = 400;
            res.setHeader('Content-Type', 'application/json');
            res.end(JSON.stringify({ error: 'Missing questionId' }));
            return;
          }

          const payload = {};
          if (typeof updates.title === 'string' || updates.title === null) payload.title = updates.title;
          if (typeof updates.body === 'string' || updates.body === null) payload.body = updates.body;
          if (updates.metadata && typeof updates.metadata === 'object') payload.metadata = updates.metadata;
          payload.updated_at = new Date().toISOString();

          const { data, error } = await admin
            .from('questions')
            .update(payload)
            .eq('id', questionId)
            .select('id, question_bank_id, title, body, metadata, created_at, updated_at')
            .single();

          if (error) {
            res.statusCode = 500;
            res.setHeader('Content-Type', 'application/json');
            res.end(JSON.stringify({ error: error.message || String(error) }));
            return;
          }

          res.statusCode = 200;
          res.setHeader('Content-Type', 'application/json');
          res.end(JSON.stringify({ data }));
        } catch (err) {
          res.statusCode = 500;
          res.setHeader('Content-Type', 'application/json');
          res.end(JSON.stringify({ error: err?.message || String(err) }));
        }
      });

      server.middlewares.use('/api/upload-question-image', async (req, res, next) => {
        if (req.method !== 'POST') return next();
        try {
          const chunks = [];
          await new Promise((resolve, reject) => {
            req.on('data', (c) => chunks.push(c));
            req.on('end', resolve);
            req.on('error', reject);
          });

          const reqContentType = String(req.headers['content-type'] || '').toLowerCase();
          let bankId = null;
          let questionId = null;
          let filename = null;
          let ct = null;
          let buffer = null;

          if (reqContentType.includes('application/json')) {
            const json = JSON.parse(Buffer.concat(chunks).toString('utf-8'));
            bankId = json?.bankId || null;
            questionId = json?.questionId || null;
            filename = json?.filename || null;
            ct = json?.contentType || null;
            const dataUrl = json?.dataUrl || null;
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
            ct = ct || parsed.contentType || 'application/octet-stream';
            buffer = parsed.buffer;
          } else {
            const u = new URL(req.url, 'http://localhost');
            bankId = u.searchParams.get('bankId');
            questionId = u.searchParams.get('questionId');
            filename = u.searchParams.get('filename');
            ct = u.searchParams.get('contentType') || req.headers['content-type'] || 'application/octet-stream';
            buffer = Buffer.concat(chunks);
            if (!filename || !buffer || buffer.length === 0) {
              res.statusCode = 400;
              res.setHeader('Content-Type', 'application/json');
              res.end(JSON.stringify({ error: 'Missing filename or body' }));
              return;
            }
          }

          const safeName = String(filename).replace(/[^a-zA-Z0-9_.-]/g, '_');
          const ts = new Date().toISOString().replace(/[:.]/g, '-');
          const bankSegment = String(bankId || 'local').replace(/[^a-zA-Z0-9_.-]/g, '_');
          const questionSegment = String(questionId || 'local').replace(/[^a-zA-Z0-9_.-]/g, '_');
          const objectPath = `service/upload/question-banks/${bankSegment}/questions/${questionSegment}/${ts}_${safeName}`;

          // Ensure bucket exists (public for reads)
          try {
            await admin.storage.createBucket(BUCKET, { public: true });
          } catch (e) {
            // Ignore if already exists
          }

          const uploadRes = await admin.storage.from(BUCKET).upload(objectPath, buffer, { contentType: ct, upsert: true });
          if (uploadRes.error) {
            res.statusCode = 500;
            res.setHeader('Content-Type', 'application/json');
            res.end(JSON.stringify({ error: uploadRes.error.message }));
            return;
          }

          // Preferir URL pública (bucket é criado como public no proxy)
          let finalUrl = null;
          try {
            const { data: pub } = await admin.storage.from(BUCKET).getPublicUrl(objectPath);
            finalUrl = pub?.publicUrl || null;
          } catch (_) {
            const { data: signed } = await admin.storage.from(BUCKET).createSignedUrl(objectPath, 60 * 60 * 24 * 7);
            finalUrl = signed?.signedUrl || null;
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

          const reqContentType = String(req.headers['content-type'] || '').toLowerCase();
          let bankId = null;
          let questionId = null;
          let filename = null;
          let ct = null;
          let buffer = null;

          if (reqContentType.includes('application/json')) {
            const json = JSON.parse(Buffer.concat(chunks).toString('utf-8'));
            bankId = json?.bankId || null;
            questionId = json?.questionId || null;
            filename = json?.filename || null;
            ct = json?.contentType || null;
            const dataUrl = json?.dataUrl || null;
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
            ct = ct || parsed.contentType || 'application/octet-stream';
            buffer = parsed.buffer;
          } else {
            const u = new URL(req.url, 'http://localhost');
            bankId = u.searchParams.get('bankId');
            questionId = u.searchParams.get('questionId');
            filename = u.searchParams.get('filename');
            ct = u.searchParams.get('contentType') || req.headers['content-type'] || 'application/octet-stream';
            buffer = Buffer.concat(chunks);
            if (!filename || !buffer || buffer.length === 0) {
              res.statusCode = 400;
              res.setHeader('Content-Type', 'application/json');
              res.end(JSON.stringify({ error: 'Missing filename or body' }));
              return;
            }
          }

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

          const uploadRes = await admin.storage.from(BUCKET).upload(objectPath, buffer, { contentType: ct, upsert: true });
          if (uploadRes.error) {
            res.statusCode = 500;
            res.setHeader('Content-Type', 'application/json');
            res.end(JSON.stringify({ error: uploadRes.error.message }));
            return;
          }

          // Preferir URL pública (bucket é criado como public no proxy)
          let finalUrl = null;
          try {
            const { data: pub } = await admin.storage.from(BUCKET).getPublicUrl(objectPath);
            finalUrl = pub?.publicUrl || null;
          } catch (_) {
            const { data: signed } = await admin.storage.from(BUCKET).createSignedUrl(objectPath, 60 * 60 * 24 * 7);
            finalUrl = signed?.signedUrl || null;
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

      server.middlewares.use('/api/upload-course-media', async (req, res, next) => {
        if (req.method !== 'POST') return next();
        try {
          const u = new URL(req.url, 'http://localhost');
          const qpUserId = u.searchParams.get('userId');
          const qpCourseId = u.searchParams.get('courseId');
          const qpKind = u.searchParams.get('kind');
          const qpFilename = u.searchParams.get('filename');
          const qpContentType = u.searchParams.get('contentType');

          const contentTypeHeader = String(req.headers['content-type'] || '');
          const isJson = contentTypeHeader.includes('application/json');

          let userId = qpUserId;
          let courseId = qpCourseId;
          let kind = qpKind;
          let filename = qpFilename;
          let contentType = qpContentType || contentTypeHeader || 'application/octet-stream';
          let buffer = null;

          const chunks = [];
          await new Promise((resolve, reject) => {
            req.on('data', (c) => chunks.push(c));
            req.on('end', resolve);
            req.on('error', reject);
          });
          const bodyBuf = Buffer.concat(chunks);

          if (isJson) {
            const json = JSON.parse(bodyBuf.toString('utf-8'));
            userId = json?.userId || userId;
            courseId = json?.courseId || courseId;
            kind = json?.kind || kind;
            filename = json?.filename || filename;
            contentType = json?.contentType || contentType;
            const dataUrl = json?.dataUrl || null;
            const parsed = parseDataUrl(dataUrl);
            if (!parsed) {
              res.statusCode = 400;
              res.setHeader('Content-Type', 'application/json');
              res.end(JSON.stringify({ error: 'Invalid dataUrl' }));
              return;
            }
            buffer = parsed.buffer;
            contentType = contentType || parsed.contentType || 'application/octet-stream';
          } else {
            buffer = bodyBuf;
          }

          if (!userId || !courseId || !filename || !buffer || buffer.length === 0) {
            res.statusCode = 400;
            res.setHeader('Content-Type', 'application/json');
            res.end(JSON.stringify({ error: 'Missing userId, courseId, filename or body' }));
            return;
          }

          const safeName = String(filename).replace(/[^a-zA-Z0-9_.-]/g, '_');
          const ts = new Date().toISOString().replace(/[:.]/g, '-');
          const safeKind = String(kind || 'media').replace(/[^a-zA-Z0-9_.-]/g, '_');
          const courseSegment = String(courseId).replace(/[^a-zA-Z0-9_.-]/g, '_');
          const userSegment = String(userId).replace(/[^a-zA-Z0-9_.-]/g, '_');
          const bucket = 'courses-media';
          const objectPath = `users/${userSegment}/courses/${courseSegment}/${safeKind}/${ts}_${safeName}`;

          try {
            await admin.storage.createBucket(bucket, { public: true });
          } catch (e) {
          }

          const uploadRes = await admin.storage.from(bucket).upload(objectPath, buffer, { contentType, upsert: true });
          if (uploadRes.error) {
            res.statusCode = 500;
            res.setHeader('Content-Type', 'application/json');
            res.end(JSON.stringify({ error: uploadRes.error.message }));
            return;
          }

          let finalUrl = null;
          try {
            const { data: signed } = await admin.storage.from(bucket).createSignedUrl(objectPath, 60 * 60 * 24 * 365);
            finalUrl = signed?.signedUrl || null;
          } catch (_) {
            const { data: pub } = await admin.storage.from(bucket).getPublicUrl(objectPath);
            finalUrl = pub?.publicUrl || null;
          }

          res.statusCode = 200;
          res.setHeader('Content-Type', 'application/json');
          res.end(JSON.stringify({ url: finalUrl, path: objectPath, bucket }));
        } catch (err) {
          res.statusCode = 500;
          res.setHeader('Content-Type', 'application/json');
          res.end(JSON.stringify({ error: err?.message || String(err) }));
        }
      });
    },
  };
}
