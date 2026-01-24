import { supabase } from '@/lib/supabaseClient'
import { canCreateQuestion as canCreateQuestionByPlan, canUploadBytes, resolvePlanKey } from '@/services/planEntitlements'
import { beginUpload } from '@/services/uploadGuard'
import { getActiveProducerUserId } from '@/services/producerScope'

// Dados mock para o frontend (fallback)
const mockQuestionBanks = [
  {
    id: 1,
    name: 'Nome do banco de questões',
    category: 'Neurologia',
    subcategory: 'Subcategoria A',
    tags: [
      { id: 1, name: 'Tag', color: '#FFC107' },
      { id: 2, name: 'Tag', color: '#2196F3' }
    ],
    description: 'Descrição que foi adicionada no ato da criação do banco de questões',
    question_count: 50,
    created_at: '2025-08-20T10:00:00Z',
    updated_at: '2025-08-20T10:00:00Z'
  },
  {
    id: 2,
    name: 'Nome do banco de questões',
    category: 'Cardiologia',
    subcategory: 'Subcategoria B',
    tags: [
      { id: 3, name: 'Tag', color: '#F44336' },
      { id: 4, name: 'Tag Adicional', color: '#4CAF50' }
    ],
    description: 'Descrição que foi adicionada no ato da criação do banco de questões',
    question_count: 50,
    created_at: '2025-08-20T10:00:00Z',
    updated_at: '2025-08-20T10:00:00Z'
  }
];

// Armazenamento em memória de perguntas por banco quando em modo offline (fallback)
const mockQuestionsByBankId = {};

// Utilitários de persistência local (fallback offline)
const LS_BANKS_KEY = 'connekt_mock_banks';
const LS_QUESTIONS_KEY = 'connekt_mock_questions';

function isAbortError(error) {
  const name = String(error?.name || '')
  const msg = String(error?.message || error || '')
  return name === 'AbortError' || msg.toLowerCase().includes('aborted') || msg.toLowerCase().includes('abort')
}

function loadPersistedBanks() {
  try {
    const raw = localStorage.getItem(LS_BANKS_KEY);
    if (!raw) return [];
    const arr = JSON.parse(raw);
    return Array.isArray(arr) ? arr : [];
  } catch { return []; }
}

function savePersistedBanks(banks) {
  try { localStorage.setItem(LS_BANKS_KEY, JSON.stringify(banks || [])); } catch {}
}

function loadPersistedQuestions() {
  try {
    const raw = localStorage.getItem(LS_QUESTIONS_KEY);
    if (!raw) return {};
    const obj = JSON.parse(raw);
    return obj && typeof obj === 'object' ? obj : {};
  } catch { return {}; }
}

function savePersistedQuestions(map) {
  try { localStorage.setItem(LS_QUESTIONS_KEY, JSON.stringify(map || {})); } catch {}
}

async function getCurrentUserExternalId() {
  try {
    // Evitar chamada à /auth/v1/user quando não há sessão
    const { data: { session } } = await supabase.auth.getSession();
    return session?.user?.id || '';
  } catch {
    return '';
  }
}

function getLoginMode() {
  try {
    const v = localStorage.getItem('connekt_login_mode')
    return v ? String(v) : ''
  } catch (_) {
    return ''
  }
}

async function getScopedProducerExternalId() {
  const current = await getCurrentUserExternalId()
  const mode = getLoginMode()
  const scoped = getActiveProducerUserId()
  if (mode === 'aluno' && scoped) return scoped
  return current
}

async function isStudentScopedToDifferentProducer() {
  const mode = getLoginMode()
  if (mode !== 'aluno') return false
  const scoped = getActiveProducerUserId()
  if (!scoped) return false
  const current = await getCurrentUserExternalId()
  return !!current && String(scoped) !== String(current)
}

async function getBearerAuthHeader() {
  try {
    const { data: { session } } = await supabase.auth.getSession()
    const token = session?.access_token || null
    return token ? { Authorization: `Bearer ${token}` } : {}
  } catch {
    return {}
  }
}

function uploadProxyHint() {
  try {
    const host = String(window?.location?.hostname || '').toLowerCase()
    const isLocal = host === 'localhost' || host === '127.0.0.1'
    if (isLocal) {
      return 'Configure SUPABASE_SERVICE_ROLE_KEY em .env.local e reinicie o dev server (ou use vercel dev).'
    }
  } catch (_) {}
  return 'Configure SUPABASE_SERVICE_ROLE_KEY nas variáveis de ambiente da Vercel e faça redeploy.'
}

function mapDbRowToUi(row) {
  // Derivar status baseado em informações principais
  const isMainInfoComplete = (data) => {
    const name = (data?.name || '').trim();
    const description = (data?.description || '').trim();
    const category = (data?.category || '').trim();
    return !!name && !!description && !!category;
  };
  const derivedStatus = isMainInfoComplete(row) ? 'active' : 'draft';

  return {
    id: row.id,
    name: row.name,
    description: row.description || '',
    tags: Array.isArray(row.tags) ? row.tags : [],
    category: row.category || '',
    subcategory: row.subcategory || '',
    questionCount: row.question_count ?? 0,
    createdAt: row.created_at || null,
    updatedAt: row.updated_at || null,
    status: row.status || derivedStatus,
  }
}

function isUuid(v) {
  return typeof v === 'string' && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(v);
}

// Gera um UUID v4 válido quando crypto.randomUUID não estiver disponível
function generateUuid() {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }
  // fallback simples para v4
  const hex = [...Array(256)].map((_, i) => (i + 0x100).toString(16).substring(1));
  const r = () => Math.floor(Math.random() * 256);
  return (
    hex[r()] + hex[r()] +
    '-' + hex[r()] +
    '-' + ((r() & 0x0f) | 0x40).toString(16) + hex[r()].substring(1) +
    '-' + ((r() & 0x3f) | 0x80).toString(16) + hex[r()].substring(1) +
    '-' + hex[r()] + hex[r()] + hex[r()] + hex[r()] + hex[r()] + hex[r()]
  ).toLowerCase();
}

class QuestionBankService {
  constructor() {
    // Tentar usar Supabase; fallback para mock em caso de erro
    this.isSupabaseAvailable = true;
    this.QUESTION_IMAGES_BUCKET = (typeof import.meta !== 'undefined' && import.meta.env && import.meta.env.VITE_SUPABASE_QUESTION_IMAGES_BUCKET)
      ? import.meta.env.VITE_SUPABASE_QUESTION_IMAGES_BUCKET
      : 'question-images';
    this.DISABLE_SUPABASE_STORAGE = !!(typeof import.meta !== 'undefined' && import.meta.env && import.meta.env.VITE_DISABLE_SUPABASE_STORAGE);
    this.USE_LOCAL_UPLOAD_PROXY = !!(typeof import.meta !== 'undefined' && import.meta.env && import.meta.env.VITE_USE_LOCAL_UPLOAD_PROXY);
  }

  async getQuestionBanks() {
    try {
      const producerExternalId = await getScopedProducerExternalId();
      let query = supabase
        .from('question_banks')
        .select('id,name,description,tags,category,subcategory,question_count,created_at,updated_at,producer_external_id')
        .order('created_at', { ascending: false });

      if (producerExternalId) {
        query = query.eq('producer_external_id', producerExternalId);
      }

      const { data, error } = await query;
      if (error) throw error;
      // Overlay dados persistidos localmente (inclui status e campos atualizados em fallback)
      const persisted = loadPersistedBanks();
      const merged = (data || []).map(dbRow => {
        const local = persisted.find(b => String(b.id) === String(dbRow.id));
        return local ? { ...dbRow, ...local } : dbRow;
      });
      const mapped = merged.map(mapDbRowToUi);
      // Confiar na coluna question_count mantida por triggers; não consultar a tabela questions aqui
      return { data: mapped, error: null };
    } catch (error) {
      this.isSupabaseAvailable = false;
      console.warn('getQuestionBanks fallback to mock:', error?.message || error);
      // Unir bancos mock com os persistidos localmente
      const persisted = loadPersistedBanks();
      const combined = [...persisted, ...mockQuestionBanks];
      // Eliminar duplicados por id (preferir persistido)
      const uniqueById = Object.values(
        combined.reduce((acc, b) => {
          acc[String(b.id)] = b;
          return acc;
        }, {})
      );
      return { data: uniqueById.map(mapDbRowToUi), error: null };
    }
  }

  async uploadQuestionImage(file, { bankId, questionId }) {
    const endUpload = beginUpload()
    try {
      if (!(file instanceof File)) throw new Error('Invalid file');
      try {
        const uid = await getCurrentUserExternalId()
        if (uid) {
          const allowed = await canUploadBytes(uid, file.size, resolvePlanKey())
          if (!allowed.ok) throw new Error('Limite de armazenamento atingido. Faça upgrade do seu plano para continuar.')
        }
      } catch (e) {
        if (String(e?.message || '').toLowerCase().includes('limite de armazenamento')) throw e
      }
      // Flag de desenvolvimento: desabilitar uso do Supabase Storage e retornar data URL
      if (this.DISABLE_SUPABASE_STORAGE) {
        const toDataUrl = (f) => new Promise((resolve, reject) => {
          try {
            const reader = new FileReader();
            reader.onload = () => resolve(reader.result);
            reader.onerror = (err) => reject(err);
            reader.readAsDataURL(f);
          } catch (err) {
            reject(err);
          }
        });
        const dataUrl = await toDataUrl(file);
        this.isSupabaseAvailable = false;
        return { url: dataUrl, path: null };
      }

      const toDataUrl = (f) => new Promise((resolve, reject) => {
        try {
          const reader = new FileReader();
          reader.onload = () => resolve(reader.result);
          reader.onerror = (err) => reject(err);
          reader.readAsDataURL(f);
        } catch (err) { reject(err); }
      });

      const isRlsBlocked = (e) => {
        const msg = String(e?.message || e || '').toLowerCase();
        const sc = String(e?.statusCode || e?.status || '');
        return sc === '403' || msg.includes('row-level security') || (msg.includes('unauthorized') && msg.includes('policy'));
      };

      const isProxyDisabled = (e) => {
        const msg = String(e?.message || e || '');
        const sc = String(e?.status || e?.statusCode || '');
        return sc === '501' || msg.includes('Upload proxy disabled') || msg.includes('proxy_disabled');
      };

      const proxyUpload = async () => {
        const ext = (file.type || '').split('/')[1] || 'bin';
        const safeName = (file.name || `image.${ext}`).replace(/[^a-zA-Z0-9_.-]/g, '_');
        const u = new URL('/api/upload-question-media', window.location.origin);
        u.searchParams.set('type', 'image');
        if (bankId) u.searchParams.set('bankId', String(bankId));
        if (questionId) u.searchParams.set('questionId', String(questionId));
        u.searchParams.set('filename', safeName);
        u.searchParams.set('contentType', file.type || 'application/octet-stream');

        const body = await file.arrayBuffer();
        const authHeader = await getBearerAuthHeader()
        const resp = await fetch(u.toString(), {
          method: 'POST',
          headers: { 'Content-Type': file.type || 'application/octet-stream', ...authHeader },
          body,
        });
        if (!resp.ok) {
          const errText = await resp.text().catch(() => '');
          const err = new Error(errText || `Proxy upload failed (${resp.status})`);
          err.status = resp.status;
          throw err;
        }
        const json = await resp.json().catch(() => ({}));
        const finalUrl = json?.url || null;
        const objectPath = json?.path || null;
        if (!finalUrl) throw new Error('Proxy retornou sem URL');
        this.isSupabaseAvailable = true;
        return { url: finalUrl, path: objectPath };
      };

      // Helper: upload direto ao Supabase (sem proxy)
      const directUpload = async () => {
        // Permitir upload mesmo quando IDs não são UUID (modo mock/local)
        const bankSegment = isUuid(bankId) ? bankId : String(bankId || generateUuid());
        const questionSegment = isUuid(questionId) ? questionId : String(questionId || generateUuid());

        const userId = await getCurrentUserExternalId();
        const ext = (file.type || '').split('/')[1] || 'bin';
        const safeName = (file.name || `image.${ext}`).replace(/[^a-zA-Z0-9_.-]/g, '_');
        const ts = new Date().toISOString().replace(/[:.]/g, '-');
        const path = `${userId || 'anonymous'}/question-banks/${bankSegment}/questions/${questionSegment}/${ts}_${safeName}`;

        const { data, error } = await supabase
          .storage
          .from(this.QUESTION_IMAGES_BUCKET)
          .upload(path, file, {
            contentType: file.type || 'application/octet-stream',
            upsert: true,
          });
        if (error) throw error;

        const objectPath = data?.path || path;
        const { data: pub } = await supabase
          .storage
          .from(this.QUESTION_IMAGES_BUCKET)
          .getPublicUrl(objectPath);

        let finalUrl = pub?.publicUrl || null;
        if (!finalUrl) {
          const { data: signed, error: signErr } = await supabase
            .storage
            .from(this.QUESTION_IMAGES_BUCKET)
            .createSignedUrl(objectPath, 60 * 60 * 24 * 7);
          if (!signErr && signed?.signedUrl) {
            finalUrl = signed.signedUrl;
          }
        }

        this.isSupabaseAvailable = true;
        try {
          await supabase.from('imagens_logs').insert({
            bank_id: bankSegment,
            question_id: questionSegment,
            filename: safeName,
            content_type: file.type || 'application/octet-stream',
            path: objectPath,
            url: finalUrl,
            uploader_external_id: userId || null,
          });
        } catch (logErr) {
          console.warn('uploadQuestionImage: falha ao registrar log:', logErr?.message || String(logErr));
        }
        try {
          const LOG_BUCKET = 'imagens-logs';
          try { await supabase.storage.createBucket(LOG_BUCKET, { public: true }); } catch (_) {}
          const logObject = {
            bank_id: bankSegment,
            question_id: questionSegment,
            filename: safeName,
            content_type: file.type || 'application/octet-stream',
            path: objectPath,
            url: finalUrl,
            uploader_external_id: userId || null,
            created_at: new Date().toISOString(),
            source: 'client',
          };
          const logPath = `logs/${Date.now()}_${safeName}.json`;
          const blob = new Blob([JSON.stringify(logObject)], { type: 'application/json' });
          await supabase.storage.from(LOG_BUCKET).upload(logPath, blob, { upsert: true });
        } catch (logBucketErr) {
          console.warn('uploadQuestionImage: falha ao gravar log em storage:', logBucketErr?.message || String(logBucketErr));
        }
        return { url: finalUrl, path: objectPath };
      };
      if (this.USE_LOCAL_UPLOAD_PROXY) {
        try {
          return await proxyUpload();
        } catch (proxyErr) {
          if (isProxyDisabled(proxyErr)) {
            const dataUrl = await toDataUrl(file);
            this.isSupabaseAvailable = false;
            return {
              url: dataUrl,
              path: null,
              warning: `Proxy de upload desabilitado. ${uploadProxyHint()}`,
            };
          }
          console.warn('Falha ao usar proxy, tentando upload direto:', proxyErr?.message || String(proxyErr));
          return await directUpload();
        }
      }

      try {
        return await directUpload();
      } catch (directErr) {
        if (isRlsBlocked(directErr)) {
          try {
            return await proxyUpload();
          } catch (proxyErr) {
            const dataUrl = await toDataUrl(file);
            this.isSupabaseAvailable = false;
            return {
              url: dataUrl,
              path: null,
              warning: `Upload bloqueado por RLS no Storage. ${uploadProxyHint()}`,
            };
          }
        }
        throw directErr;
      }
    } catch (error) {
      if (isAbortError(error)) {
        return { url: null, path: null, aborted: true };
      }
      this.isSupabaseAvailable = false;
      console.warn('uploadQuestionImage error:', error?.message || error);
      return { url: null, path: null, error: error?.message || String(error) };
    } finally {
      endUpload()
    }
  }

  async uploadQuestionVideo(file, { bankId, questionId }) {
    const endUpload = beginUpload()
    try {
      if (!(file instanceof File)) throw new Error('Invalid file');
      try {
        const uid = await getCurrentUserExternalId()
        if (uid) {
          const allowed = await canUploadBytes(uid, file.size, resolvePlanKey())
          if (!allowed.ok) throw new Error('Limite de armazenamento atingido. Faça upgrade do seu plano para continuar.')
        }
      } catch (e) {
        if (String(e?.message || '').toLowerCase().includes('limite de armazenamento')) throw e
      }
      // Flag de desenvolvimento: desabilitar uso do Supabase Storage e retornar data URL
      if (this.DISABLE_SUPABASE_STORAGE) {
        const toDataUrl = (f) => new Promise((resolve, reject) => {
          try {
            const reader = new FileReader();
            reader.onload = () => resolve(reader.result);
            reader.onerror = (err) => reject(err);
            reader.readAsDataURL(f);
          } catch (err) {
            reject(err);
          }
        });
        const dataUrl = await toDataUrl(file);
        this.isSupabaseAvailable = false;
        return { url: dataUrl, path: null };
      }

      const isRlsBlocked = (e) => {
        const msg = String(e?.message || e || '').toLowerCase();
        const sc = String(e?.statusCode || e?.status || '');
        return sc === '403' || msg.includes('row-level security') || (msg.includes('unauthorized') && msg.includes('policy'));
      };

      const isProxyDisabled = (e) => {
        const msg = String(e?.message || e || '');
        const sc = String(e?.status || e?.statusCode || '');
        return sc === '501' || msg.includes('Upload proxy disabled') || msg.includes('proxy_disabled');
      };

      const proxyUpload = async () => {
        const ext = (file.type || '').split('/')[1] || 'bin';
        const safeName = (file.name || `video.${ext}`).replace(/[^a-zA-Z0-9_.-]/g, '_');
        const u = new URL('/api/upload-question-media', window.location.origin);
        u.searchParams.set('type', 'video');
        if (bankId) u.searchParams.set('bankId', String(bankId));
        if (questionId) u.searchParams.set('questionId', String(questionId));
        u.searchParams.set('filename', safeName);
        u.searchParams.set('contentType', file.type || 'application/octet-stream');

        const body = await file.arrayBuffer();
        const authHeader = await getBearerAuthHeader()
        const resp = await fetch(u.toString(), {
          method: 'POST',
          headers: { 'Content-Type': file.type || 'application/octet-stream', ...authHeader },
          body,
        });
        if (!resp.ok) {
          const errText = await resp.text().catch(() => '');
          const err = new Error(errText || `Proxy upload failed (${resp.status})`);
          err.status = resp.status;
          throw err;
        }
        const json = await resp.json().catch(() => ({}));
        const finalUrl = json?.url || null;
        const objectPath = json?.path || null;
        if (!finalUrl) throw new Error('Proxy retornou sem URL');
        this.isSupabaseAvailable = true;
        return { url: finalUrl, path: objectPath };
      };

      // Helper: upload direto ao Supabase (sem proxy)
      const directUpload = async () => {
        const bankSegment = isUuid(bankId) ? bankId : String(bankId || generateUuid());
        const questionSegment = isUuid(questionId) ? questionId : String(questionId || generateUuid());

        const userId = await getCurrentUserExternalId();
        const ext = (file.type || '').split('/')[1] || 'bin';
        const safeName = (file.name || `video.${ext}`).replace(/[^a-zA-Z0-9_.-]/g, '_');
        const ts = new Date().toISOString().replace(/[:.]/g, '-');
        const path = `${userId || 'anonymous'}/question-banks/${bankSegment}/questions/${questionSegment}/${ts}_${safeName}`;

        const { data, error } = await supabase
          .storage
          .from(this.QUESTION_IMAGES_BUCKET)
          .upload(path, file, {
            contentType: file.type || 'application/octet-stream',
            upsert: true,
          });
        if (error) throw error;

        const objectPath = data?.path || path;
        const { data: pub } = await supabase
          .storage
          .from(this.QUESTION_IMAGES_BUCKET)
          .getPublicUrl(objectPath);

        let finalUrl = pub?.publicUrl || null;
        if (!finalUrl) {
          const { data: signed, error: signErr } = await supabase
            .storage
            .from(this.QUESTION_IMAGES_BUCKET)
            .createSignedUrl(objectPath, 60 * 60 * 24 * 7);
          if (!signErr && signed?.signedUrl) {
            finalUrl = signed.signedUrl;
          }
        }

        this.isSupabaseAvailable = true;
        try {
          await supabase.from('imagens_logs').insert({
            bank_id: bankSegment,
            question_id: questionSegment,
            filename: safeName,
            content_type: file.type || 'application/octet-stream',
            path: objectPath,
            url: finalUrl,
            uploader_external_id: userId || null,
          });
        } catch (logErr) {
          console.warn('uploadQuestionVideo: falha ao registrar log:', logErr?.message || String(logErr));
        }
        try {
          const LOG_BUCKET = 'imagens-logs';
          try { await supabase.storage.createBucket(LOG_BUCKET, { public: true }); } catch (_) {}
          const logObject = {
            bank_id: bankSegment,
            question_id: questionSegment,
            filename: safeName,
            content_type: file.type || 'application/octet-stream',
            path: objectPath,
            url: finalUrl,
            uploader_external_id: userId || null,
            created_at: new Date().toISOString(),
            source: 'client',
          };
          const logPath = `logs/${Date.now()}_${safeName}.json`;
          const blob = new Blob([JSON.stringify(logObject)], { type: 'application/json' });
          await supabase.storage.from(LOG_BUCKET).upload(logPath, blob, { upsert: true });
        } catch (logBucketErr) {
          console.warn('uploadQuestionVideo: falha ao gravar log em storage:', logBucketErr?.message || String(logBucketErr));
        }
        return { url: finalUrl, path: objectPath };
      };
      if (this.USE_LOCAL_UPLOAD_PROXY) {
        try {
          return await proxyUpload();
        } catch (proxyErr) {
          if (isProxyDisabled(proxyErr)) {
            this.isSupabaseAvailable = false;
            return {
              url: null,
              path: null,
              warning: `Proxy de upload desabilitado. ${uploadProxyHint()}`,
            };
          }
          console.warn('Falha ao usar proxy de vídeo, tentando upload direto:', proxyErr?.message || String(proxyErr));
          return await directUpload();
        }
      }

      try {
        return await directUpload();
      } catch (directErr) {
        if (isRlsBlocked(directErr)) {
          try {
            return await proxyUpload();
          } catch (proxyErr) {
            this.isSupabaseAvailable = false;
            return {
              url: null,
              path: null,
              warning: isProxyDisabled(proxyErr)
                ? `Upload bloqueado por RLS e o proxy está desabilitado. ${uploadProxyHint()}`
                : `Upload bloqueado por RLS no Storage. ${uploadProxyHint()}`,
            };
          }
        }
        throw directErr;
      }
    } catch (error) {
      if (isAbortError(error)) {
        return { url: null, path: null, aborted: true };
      }
      this.isSupabaseAvailable = false;
      console.warn('uploadQuestionVideo error:', error?.message || error);
      return { url: null, path: null, error: error?.message || String(error) };
    } finally {
      endUpload()
    }
  }

  async getQuestionBankById(id) {
    try {
      // Se o ID não for UUID, evitar consulta ao Supabase e tentar localizar no mock
      if (!isUuid(id)) {
        const found = mockQuestionBanks.find(b => String(b.id) === String(id));
        if (found) return { data: mapDbRowToUi(found), error: null };
        return { data: null, error: 'Invalid question bank id' };
      }
      const { data, error } = await supabase
        .from('question_banks')
        .select('id,name,description,tags,category,subcategory,question_count,created_at,updated_at,producer_external_id')
        .eq('id', id)
        .single();

      if (error) throw error;
      const bank = mapDbRowToUi(data);
      // Confiar na coluna question_count mantida por triggers; não consultar a tabela questions aqui
      return { data: bank, error: null };
    } catch (error) {
      this.isSupabaseAvailable = false;
      console.warn('getQuestionBankById fallback to mock:', error?.message || error);
      const persisted = loadPersistedBanks();
      const found = persisted.find(b => String(b.id) === String(id))
        || mockQuestionBanks.find(b => String(b.id) === String(id));
      if (!found) {
        return { data: null, error: 'Question bank not found' };
      }
      return { data: mapDbRowToUi(found), error: null };
    }
  }

  async getBankWithRelations(bankId) {
    // Consulta completa para um banco específico, com relações expandidas
    try {
      if (!isUuid(bankId)) {
        // Fallback rápido para IDs não-UUID
        const base = await this.getQuestionBankById(bankId);
        const qs = await this.getQuestionsByBankId(bankId);
        const normalized = {
          id: base?.data?.id || bankId,
          title: base?.data?.name || base?.data?.title || '',
          created_at: base?.data?.createdAt || base?.data?.created_at || new Date().toISOString(),
          description: base?.data?.description || '',
          category: base?.data?.category || '',
          subcategory: base?.data?.subcategory || '',
          tags: Array.isArray(base?.data?.tags) ? base.data.tags : [],
          question_count: typeof base?.data?.questionCount === 'number' ? base.data.questionCount : 0,
          questions: (qs?.data || []).map(q => {
            const meta = q?.metadata || {};
            const choicesMeta = Array.isArray(meta.choices) ? meta.choices : (Array.isArray(meta.alternatives) ? meta.alternatives : (Array.isArray(meta.options) ? meta.options : []));
            return {
              id: q.id,
              stem: q.body || meta.body || meta.text || meta.statement || meta.question || '',
              points: typeof meta.points === 'number' ? meta.points : 0,
              attempts_allowed: typeof meta.attempts === 'number' ? meta.attempts : 0,
              category: null,
              subcategory: null,
              choices: choicesMeta.map(c => ({ id: c?.id || null, label: typeof c === 'string' ? c : (c?.label || c?.text || ''), is_correct: !!(typeof c === 'object' && c?.is_correct) })),
              question_tags: [],
              attempts: []
            };
          })
        };
        return { data: normalized, error: null };
      }

      const { data, error } = await supabase
        .from('question_banks')
        .select(`
          id, name, description, tags, category, subcategory, question_count, created_at, updated_at,
          questions (
            id, body, metadata, created_at, updated_at
          )
        `)
        .eq('id', bankId)
        .single();

      if (error) throw error;

      const normalized = {
        id: data?.id,
        title: data?.name || data?.title || '',
        created_at: data?.created_at,
        description: data?.description || '',
        category: data?.category || '',
        subcategory: data?.subcategory || '',
        tags: Array.isArray(data?.tags) ? data.tags : [],
        question_count: typeof data?.question_count === 'number' ? data.question_count : 0,
        questions: (data?.questions || []).map(q => {
          const meta = q?.metadata || {};
          const stem = q?.body || meta?.body || meta?.text || meta?.statement || meta?.question || '';
          const points = typeof meta?.points === 'number' ? meta.points : 0;
          const attemptsAllowed = typeof meta?.attempts === 'number' ? meta.attempts : 0;

          const choicesMeta = Array.isArray(meta.choices)
            ? meta.choices
            : (Array.isArray(meta.alternatives) ? meta.alternatives : (Array.isArray(meta.options) ? meta.options : []));
          const choices = choicesMeta.map(c => ({ id: c?.id || null, label: typeof c === 'string' ? c : (c?.label || c?.text || ''), is_correct: !!(typeof c === 'object' && c?.is_correct) }));

          const questionTags = [];

          return {
            id: q.id,
            stem,
            points,
            attempts_allowed: attemptsAllowed,
            category: null,
            subcategory: null,
            choices,
            question_tags: questionTags,
            attempts: [],
          };
        })
      };

      this.isSupabaseAvailable = true;
      return { data: normalized, error: null };
    } catch (error) {
      // Fallback: tentar view agregada v_bank_questions
      try {
        const { data: rows, error: viewError } = await supabase
          .from('v_bank_questions')
          .select('*')
          .eq('bank_id', bankId);
        if (viewError) throw viewError;

        const bank = { id: null, title: '', created_at: null, questions: [] };
        const qMap = new Map();
        for (const r of rows || []) {
          bank.id = bank.id || r.bank_id;
          bank.title = bank.title || r.bank_title || r.bank_name || '';
          bank.created_at = bank.created_at || r.bank_created_at;
          const qid = r.question_id;
          if (!qMap.has(qid)) {
            qMap.set(qid, {
              id: qid,
              stem: r.question_stem || r.question_body || '',
              points: typeof r.points === 'number' ? r.points : (typeof r.metadata_points === 'number' ? r.metadata_points : 0),
              attempts_allowed: typeof r.attempts_allowed === 'number' ? r.attempts_allowed : (typeof r.metadata_attempts === 'number' ? r.metadata_attempts : 0),
              category: r.category_id ? { id: r.category_id, name: r.category_name } : null,
              subcategory: r.subcategory_id ? { id: r.subcategory_id, name: r.subcategory_name } : null,
              choices: [],
              question_tags: [],
              attempts: [],
            });
          }
          const qObj = qMap.get(qid);
          if (r.choice_id) {
            if (!qObj.choices.find(c => c.id === r.choice_id)) {
              qObj.choices.push({ id: r.choice_id, label: r.choice_label, is_correct: !!r.choice_is_correct });
            }
          }
          if (r.tag_id) {
            if (!qObj.question_tags.find(t => t?.tags?.id === r.tag_id)) {
              qObj.question_tags.push({ tags: { id: r.tag_id, name: r.tag_name } });
            }
          }
          if (r.attempt_id) {
            if (!qObj.attempts.find(a => a.id === r.attempt_id)) {
              qObj.attempts.push({ id: r.attempt_id, user_id: r.attempt_user_id, score: r.attempt_score, created_at: r.attempt_created_at });
            }
          }
        }
        bank.questions = Array.from(qMap.values());
        return { data: bank, error: null };
      } catch (fallbackError) {
        this.isSupabaseAvailable = false;
        console.warn('getBankWithRelations error:', error?.message || error);
        console.warn('view fallback failed:', fallbackError?.message || fallbackError);
        const base = await this.getQuestionBankById(bankId);
        const qs = await this.getQuestionsByBankId(bankId);
        const normalized = {
          id: base?.data?.id || bankId,
          title: base?.data?.name || base?.data?.title || '',
          created_at: base?.data?.created_at || new Date().toISOString(),
          questions: (qs?.data || []).map(q => {
            const meta = q?.metadata || {};
            const choicesMeta = Array.isArray(meta.choices) ? meta.choices : (Array.isArray(meta.alternatives) ? meta.alternatives : (Array.isArray(meta.options) ? meta.options : []));
            return {
              id: q.id,
              stem: q.body || meta.body || meta.text || meta.statement || meta.question || '',
              points: typeof meta.points === 'number' ? meta.points : 0,
              attempts_allowed: typeof meta.attempts === 'number' ? meta.attempts : 0,
              category: null,
              subcategory: null,
              choices: choicesMeta.map(c => ({ id: c?.id || null, label: typeof c === 'string' ? c : (c?.label || c?.text || ''), is_correct: !!(typeof c === 'object' && c?.is_correct) })),
              question_tags: [],
              attempts: []
            };
          })
        };
        return { data: normalized, error: null };
      }
    }
  }

  async createQuestionBank(questionBankData) {
    // Normalizar tags: aceitar array de objetos (com name/color) ou strings
    const normalizedTags = Array.isArray(questionBankData.tags)
      ? questionBankData.tags
      : typeof questionBankData.tags === 'string'
        ? questionBankData.tags.split(',').map(t => ({ name: t.trim() })).filter(t => t.name.length > 0)
        : [];

    const payload = {
      name: (questionBankData.name || '').trim(),
      description: (questionBankData.description || '').trim(),
      category: (questionBankData.category || '').trim(),
      subcategory: (questionBankData.subcategory || '').trim(),
      tags: normalizedTags,
      question_count: 0,
      producer_external_id: await getCurrentUserExternalId(),
    };

    try {
      if (await isStudentScopedToDifferentProducer()) {
        return { data: null, error: 'forbidden' }
      }
      const { data, error } = await supabase
        .from('question_banks')
        .insert(payload)
        .select('id,name,description,tags,category,subcategory,question_count,created_at,updated_at,producer_external_id')
        .single();

      if (error) throw error;
      this.isSupabaseAvailable = true;
      return { data: mapDbRowToUi(data), error: null };
    } catch (error) {
      this.isSupabaseAvailable = false;
      console.warn('createQuestionBank fallback to mock:', error?.message || error);
      const isMainInfoComplete = (data) => {
        const name = (data?.name || '').trim();
        const description = (data?.description || '').trim();
        const category = (data?.category || '').trim();
        return !!name && !!description && !!category;
      };
      const derivedStatus = isMainInfoComplete(payload) ? 'active' : 'draft';
      const finalStatus = typeof questionBankData?.status === 'string'
        ? questionBankData.status
        : derivedStatus;
      const newBank = {
        ...payload,
        id: generateUuid(),
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
        status: finalStatus,
      };
      // Persistir localmente o novo banco
      const persisted = loadPersistedBanks();
      const nextBanks = [newBank, ...persisted];
      savePersistedBanks(nextBanks);
      // Também manter em memória durante a sessão
      mockQuestionBanks.unshift(newBank);
      return { data: mapDbRowToUi(newBank), error: null };
    }
  }

  async updateQuestionBank(id, updates) {
    // Normalizar campos
    const normalizedUpdates = { ...updates };
    if (normalizedUpdates.tags && !Array.isArray(normalizedUpdates.tags)) {
      normalizedUpdates.tags = String(normalizedUpdates.tags)
        .split(',')
        .map(t => ({ name: t.trim() }))
        .filter(t => t.name.length > 0);
    }

    try {
      if (await isStudentScopedToDifferentProducer()) {
        return { data: null, error: 'forbidden' }
      }
      const { data, error } = await supabase
        .from('question_banks')
        .update({
          ...normalizedUpdates,
          updated_at: new Date().toISOString(),
        })
        .eq('id', id)
        .select('id,name,description,tags,category,subcategory,question_count,created_at,updated_at,producer_external_id')
        .single();

      if (error) throw error;
      this.isSupabaseAvailable = true;
      return { data: mapDbRowToUi(data), error: null };
    } catch (error) {
      this.isSupabaseAvailable = false;
      console.warn('updateQuestionBank fallback to mock:', error?.message || error);
      // Atualizar mock em memória
      const index = mockQuestionBanks.findIndex(bank => String(bank.id) === String(id));
      if (index !== -1) {
        const next = {
          ...mockQuestionBanks[index],
          ...normalizedUpdates,
          updated_at: new Date().toISOString()
        };
        const isMainInfoComplete = (data) => {
          const name = (data?.name || '').trim();
          const description = (data?.description || '').trim();
          const category = (data?.category || '').trim();
          return !!name && !!description && !!category;
        };
        next.status = typeof normalizedUpdates?.status === 'string'
          ? normalizedUpdates.status
          : (isMainInfoComplete(next) ? 'active' : 'draft');
        mockQuestionBanks[index] = next;
      }

      // Atualizar persistência local (localStorage)
      const persisted = loadPersistedBanks();
      const pIndex = persisted.findIndex(b => String(b.id) === String(id));
      if (pIndex !== -1) {
        const nextPersisted = {
          ...persisted[pIndex],
          ...normalizedUpdates,
          updated_at: new Date().toISOString()
        };
        const isMainInfoComplete = (data) => {
          const name = (data?.name || '').trim();
          const description = (data?.description || '').trim();
          const category = (data?.category || '').trim();
          return !!name && !!description && !!category;
        };
        nextPersisted.status = typeof normalizedUpdates?.status === 'string'
          ? normalizedUpdates.status
          : (isMainInfoComplete(nextPersisted) ? 'active' : 'draft');
        persisted[pIndex] = nextPersisted;
      }
      // Se não existir no persistido e existir em memória, garantir persistência
      if (pIndex === -1 && index !== -1) {
        persisted.unshift({ ...mockQuestionBanks[index] });
      }
      savePersistedBanks(persisted);

      if (index !== -1) {
        return { data: mapDbRowToUi(mockQuestionBanks[index]), error: null };
      }
      return { data: null, error: 'Question bank not found' };
    }
  }

  async deleteQuestionBank(id) {
    try {
      if (await isStudentScopedToDifferentProducer()) {
        return { data: null, error: 'forbidden' }
      }
      const { error } = await supabase
        .from('question_banks')
        .delete()
        .eq('id', id);

      if (error) throw error;
      this.isSupabaseAvailable = true;
      return { data: { id }, error: null };
    } catch (error) {
      this.isSupabaseAvailable = false;
      console.warn('deleteQuestionBank fallback to mock:', error?.message || error);
      const index = mockQuestionBanks.findIndex(bank => bank.id === id);
      if (index !== -1) {
        const deletedBank = mockQuestionBanks.splice(index, 1)[0];
        return { data: mapDbRowToUi(deletedBank), error: null };
      }
      return { data: null, error: 'Question bank not found' };
    }
  }

  async createQuestion(questionBankId, question) {
    try {
      if (await isStudentScopedToDifferentProducer()) {
        return { data: null, error: 'forbidden' }
      }
      if (!isUuid(questionBankId)) {
        throw new Error('Invalid question bank id');
      }

      try {
        const uid = await getCurrentUserExternalId()
        if (uid) {
          const allowed = await canCreateQuestionByPlan(uid, resolvePlanKey())
          if (!allowed.ok) {
            return { data: null, error: 'Limite de questões do plano atingido. Faça upgrade para criar novas questões.' }
          }
        }
      } catch (_) {}

      const baseMeta = typeof question?.metadata === 'object' && question?.metadata
        ? { ...question.metadata }
        : {};
      const payloadMeta = {
        ...baseMeta,
        type: baseMeta.type ?? (question?.type ?? 'multiple_choice'),
        required: baseMeta.required ?? !!question?.required,
        disabled: baseMeta.disabled ?? !!question?.disabled,
        choices: Array.isArray(baseMeta.choices)
          ? baseMeta.choices
          : (Array.isArray(question?.choices) ? question.choices : []),
        correctChoiceIndex: typeof baseMeta.correctChoiceIndex === 'number'
          ? baseMeta.correctChoiceIndex
          : (typeof question?.correctChoiceIndex === 'number' ? question.correctChoiceIndex : null),
        points: typeof baseMeta.points === 'number'
          ? baseMeta.points
          : (typeof question?.points === 'number' ? question.points : 0),
        attempts: typeof baseMeta.attempts === 'number'
          ? baseMeta.attempts
          : (typeof question?.attempts === 'number' ? question.attempts : 0),
      };

      const payload = {
        question_bank_id: questionBankId,
        title: (question?.name || question?.title || '').trim() || 'Sem título',
        body: (question?.text || question?.body || '').trim() || '',
        metadata: payloadMeta,
      };

      const { data, error } = await supabase
        .from('questions')
        .insert(payload)
        .select('id, question_bank_id, title, body, metadata, created_at, updated_at')
        .single();

      if (error) throw error;
      this.isSupabaseAvailable = true;
      return { data, error: null };
    } catch (error) {
      this.isSupabaseAvailable = false;
      console.warn('createQuestion fallback or error:', error?.message || error);
      // Fallback: não persiste realmente; retorna objeto simulado
      const baseMeta = typeof question?.metadata === 'object' && question?.metadata
        ? { ...question.metadata }
        : {};
      const mockMeta = {
        ...baseMeta,
        type: baseMeta.type ?? (question?.type ?? 'multiple_choice'),
        required: baseMeta.required ?? !!question?.required,
        disabled: baseMeta.disabled ?? !!question?.disabled,
        choices: Array.isArray(baseMeta.choices)
          ? baseMeta.choices
          : (Array.isArray(question?.choices) ? question.choices : []),
        correctChoiceIndex: typeof baseMeta.correctChoiceIndex === 'number'
          ? baseMeta.correctChoiceIndex
          : (typeof question?.correctChoiceIndex === 'number' ? question.correctChoiceIndex : null),
        points: typeof baseMeta.points === 'number'
          ? baseMeta.points
          : (typeof question?.points === 'number' ? question.points : 0),
        attempts: typeof baseMeta.attempts === 'number'
          ? baseMeta.attempts
          : (typeof question?.attempts === 'number' ? question.attempts : 0),
      };
      const mock = {
        id: generateUuid(),
        question_bank_id: questionBankId,
        title: question?.name || question?.title || 'Sem título',
        body: question?.text || question?.body || '',
        metadata: mockMeta,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      };
      // Guardar pergunta em memória por banco e atualizar contagem
      if (!mockQuestionsByBankId[questionBankId]) {
        mockQuestionsByBankId[questionBankId] = [];
      }
      mockQuestionsByBankId[questionBankId].push(mock);
      // Persistir localmente
      const persistedQuestions = loadPersistedQuestions();
      const list = Array.isArray(persistedQuestions[questionBankId]) ? persistedQuestions[questionBankId] : [];
      persistedQuestions[questionBankId] = [...list, mock];
      savePersistedQuestions(persistedQuestions);
      const bankIndex = mockQuestionBanks.findIndex(b => String(b.id) === String(questionBankId));
      if (bankIndex !== -1) {
        const currentCount = Number(mockQuestionBanks[bankIndex].question_count || 0);
        mockQuestionBanks[bankIndex].question_count = currentCount + 1;
      }
      return { data: mock, error: null };
    }
  }

  async updateQuestion(questionId, updates = {}) {
    try {
      if (await isStudentScopedToDifferentProducer()) {
        return { data: null, error: 'forbidden' }
      }
      if (!isUuid(questionId)) {
        throw new Error('Invalid question id');
      }

      const isRlsBlocked = (e) => {
        const msg = String(e?.message || e || '').toLowerCase();
        const sc = String(e?.statusCode || e?.status || '');
        return sc === '401' || sc === '403' || msg.includes('row-level security') || (msg.includes('unauthorized') && msg.includes('policy'));
      };

      const isProxyDisabled = (e) => {
        const msg = String(e?.message || e || '');
        const sc = String(e?.status || e?.statusCode || '');
        return sc === '501' || msg.includes('Upload proxy disabled') || msg.includes('proxy_disabled');
      };

      // Evitar que campos em updates.metadata sobrescrevam valores normalizados (choices, correctChoiceIndex, etc.)
      const reservedKeys = ['type', 'required', 'disabled', 'choices', 'correctChoiceIndex', 'points', 'attempts'];
      const rawExtras = (typeof updates?.metadata === 'object' && updates.metadata) ? updates.metadata : {};
      const extras = Object.keys(rawExtras).reduce((acc, k) => {
        if (!reservedKeys.includes(k)) acc[k] = rawExtras[k];
        return acc;
      }, {});

      const payload = {
        title: (updates?.name || updates?.title || '').trim() || null,
        body: (updates?.text || updates?.body || '').trim() || null,
        metadata: {
          // Mesclar extras primeiro (sem sobrescrever campos reservados)
          ...extras,
          // Em seguida definir campos normalizados que sempre devem prevalecer
          type: updates?.type ?? 'multiple_choice',
          required: !!updates?.required,
          disabled: !!updates?.disabled,
          choices: Array.isArray(updates?.choices) ? updates.choices : [],
          correctChoiceIndex: typeof updates?.correctChoiceIndex === 'number' ? updates.correctChoiceIndex : null,
          points: typeof updates?.points === 'number' ? updates.points : 0,
          attempts: typeof updates?.attempts === 'number' ? updates.attempts : 0,
        },
        updated_at: new Date().toISOString(),
      };

      try {
        const { data, error } = await supabase
          .from('questions')
          .update(payload)
          .eq('id', questionId)
          .select('id, question_bank_id, title, body, metadata, created_at, updated_at')
          .single();

        if (error) throw error;
        this.isSupabaseAvailable = true;
        return { data, error: null };
      } catch (directErr) {
        if (isRlsBlocked(directErr)) {
          try {
            const u = new URL('/api/update-question', window.location.origin);
            const authHeader = await getBearerAuthHeader()
            const resp = await fetch(u.toString(), {
              method: 'POST',
              headers: { 'Content-Type': 'application/json', ...authHeader },
              body: JSON.stringify({ questionId, updates: payload }),
            });
            if (!resp.ok) {
              const errText = await resp.text().catch(() => '');
              const err = new Error(errText || `Proxy update failed (${resp.status})`);
              err.status = resp.status;
              throw err;
            }
            const json = await resp.json().catch(() => ({}));
            const updated = json?.data || null;
            if (!updated) throw new Error('Proxy retornou sem data');
            this.isSupabaseAvailable = true;
            return { data: updated, error: null };
          } catch (proxyErr) {
            if (isProxyDisabled(proxyErr)) {
              throw directErr;
            }
            throw proxyErr;
          }
        }
        throw directErr;
      }
    } catch (error) {
      this.isSupabaseAvailable = false;
      console.warn('updateQuestion fallback or error:', error?.message || error);
      // Fallback: atualizar em memória e persistência local se disponível
      const persistedQuestions = loadPersistedQuestions();
      let updated = null;
      // Procurar em todas as listas persistidas
      for (const bankId of Object.keys(persistedQuestions)) {
        const list = Array.isArray(persistedQuestions[bankId]) ? persistedQuestions[bankId] : [];
        const idx = list.findIndex(q => String(q.id) === String(questionId));
        if (idx !== -1) {
          const current = list[idx];
          const hasCorrectIdx = Object.prototype.hasOwnProperty.call(updates || {}, 'correctChoiceIndex');
          const rawExtras = (typeof updates?.metadata === 'object' && updates.metadata) ? updates.metadata : {};
          const extras = Object.keys(rawExtras).reduce((acc, k) => {
            if (!reservedKeys.includes(k)) acc[k] = rawExtras[k];
            return acc;
          }, {});
          const next = {
            ...current,
            title: (updates?.name || updates?.title || current?.title || '').trim(),
            body: (updates?.text || updates?.body || current?.body || '').trim(),
            metadata: {
              ...current?.metadata,
              // Mesclar extras primeiro, sem sobrescrever reservados
              ...extras,
              type: updates?.type ?? current?.metadata?.type ?? 'multiple_choice',
              required: typeof updates?.required === 'boolean' ? updates.required : !!current?.metadata?.required,
              disabled: typeof updates?.disabled === 'boolean' ? updates.disabled : !!current?.metadata?.disabled,
              choices: Array.isArray(updates?.choices) ? updates.choices : (Array.isArray(current?.metadata?.choices) ? current.metadata.choices : []),
              // Permitir limpar explicitamente (null) o índice da resposta correta no modo offline
              correctChoiceIndex: hasCorrectIdx
                ? (typeof updates?.correctChoiceIndex === 'number' ? updates.correctChoiceIndex : null)
                : (typeof current?.metadata?.correctChoiceIndex === 'number' ? current.metadata.correctChoiceIndex : null),
              points: typeof updates?.points === 'number' ? updates.points : (typeof current?.metadata?.points === 'number' ? current.metadata.points : 0),
              attempts: typeof updates?.attempts === 'number' ? updates.attempts : (typeof current?.metadata?.attempts === 'number' ? current.metadata.attempts : 0),
              // Extras já mesclados no início
            },
            updated_at: new Date().toISOString(),
          };
          persistedQuestions[bankId][idx] = next;
          updated = next;
          break;
        }
      }
      savePersistedQuestions(persistedQuestions);
      // Também tentar atualizar em mockQuestionsByBankId
      for (const bankId of Object.keys(mockQuestionsByBankId)) {
        const list = mockQuestionsByBankId[bankId] || [];
        const idx = list.findIndex(q => String(q.id) === String(questionId));
        if (idx !== -1) {
          const current = list[idx];
          const hasCorrectIdx = Object.prototype.hasOwnProperty.call(updates || {}, 'correctChoiceIndex');
          const rawExtras = (typeof updates?.metadata === 'object' && updates.metadata) ? updates.metadata : {};
          const extras = Object.keys(rawExtras).reduce((acc, k) => {
            if (!reservedKeys.includes(k)) acc[k] = rawExtras[k];
            return acc;
          }, {});
          const next = {
            ...current,
            title: (updates?.name || updates?.title || current?.title || '').trim(),
            body: (updates?.text || updates?.body || current?.body || '').trim(),
            metadata: {
              ...current?.metadata,
              ...extras,
              type: updates?.type ?? current?.metadata?.type ?? 'multiple_choice',
              required: typeof updates?.required === 'boolean' ? updates.required : !!current?.metadata?.required,
              disabled: typeof updates?.disabled === 'boolean' ? updates.disabled : !!current?.metadata?.disabled,
              choices: Array.isArray(updates?.choices) ? updates.choices : (Array.isArray(current?.metadata?.choices) ? current.metadata.choices : []),
              // Permitir limpar explicitamente (null) o índice da resposta correta no modo offline
              correctChoiceIndex: hasCorrectIdx
                ? (typeof updates?.correctChoiceIndex === 'number' ? updates.correctChoiceIndex : null)
                : (typeof current?.metadata?.correctChoiceIndex === 'number' ? current.metadata.correctChoiceIndex : null),
              points: typeof updates?.points === 'number' ? updates.points : (typeof current?.metadata?.points === 'number' ? current.metadata.points : 0),
              attempts: typeof updates?.attempts === 'number' ? updates.attempts : (typeof current?.metadata?.attempts === 'number' ? current.metadata.attempts : 0),
              // Extras já mesclados no início
            },
            updated_at: new Date().toISOString(),
          };
          mockQuestionsByBankId[bankId][idx] = next;
          updated = next;
          break;
        }
      }
      return { data: updated, error: null };
    }
  }

  async deleteQuestion(questionId) {
    try {
      if (await isStudentScopedToDifferentProducer()) {
        return { data: null, error: 'forbidden' }
      }
      if (!isUuid(questionId)) {
        throw new Error('Invalid question id');
      }
      const { data, error } = await supabase
        .from('questions')
        .delete()
        .eq('id', questionId)
        .select('id, question_bank_id')
        .single();
      if (error) throw error;
      this.isSupabaseAvailable = true;
      return { data, error: null };
    } catch (error) {
      this.isSupabaseAvailable = false;
      console.warn('deleteQuestion fallback or error:', error?.message || error);
      const persistedQuestions = loadPersistedQuestions();
      let removed = null;
      for (const bankId of Object.keys(persistedQuestions)) {
        const list = Array.isArray(persistedQuestions[bankId]) ? persistedQuestions[bankId] : [];
        const idx = list.findIndex(q => String(q.id) === String(questionId));
        if (idx !== -1) {
          removed = list.splice(idx, 1)[0];
          persistedQuestions[bankId] = list;
          break;
        }
      }
      savePersistedQuestions(persistedQuestions);
      // Também remover de mockQuestionsByBankId
      for (const bankId of Object.keys(mockQuestionsByBankId)) {
        const list = mockQuestionsByBankId[bankId] || [];
        const idx = list.findIndex(q => String(q.id) === String(questionId));
        if (idx !== -1) {
          list.splice(idx, 1);
          mockQuestionsByBankId[bankId] = list;
          break;
        }
      }
      return { data: removed, error: null };
    }
  }
  async getQuestionsByBankId(questionBankId) {
    try {
      if (!isUuid(questionBankId)) {
        throw new Error('Invalid question bank id');
      }
      const { data, error } = await supabase
        .from('questions')
        .select('id, question_bank_id, title, body, metadata, created_at, updated_at')
        .eq('question_bank_id', questionBankId)
        .order('created_at', { ascending: true });
      if (error) throw error;
      this.isSupabaseAvailable = true;
      return { data: data || [], error: null };
    } catch (error) {
      this.isSupabaseAvailable = false;
      console.warn('getQuestionsByBankId fallback to mock:', error?.message || error);
      const persistedQuestions = loadPersistedQuestions();
      const localList = mockQuestionsByBankId[questionBankId] || [];
      const persistedList = Array.isArray(persistedQuestions[questionBankId]) ? persistedQuestions[questionBankId] : [];
      // Unir memória e persistido
      const combined = [...persistedList, ...localList];
      // Eliminar duplicados por id
      const unique = Object.values(combined.reduce((acc, q) => { acc[q.id] = q; return acc; }, {}));
      return { data: unique, error: null };
    }
  }
}

export const questionBankService = new QuestionBankService();
export default questionBankService;
