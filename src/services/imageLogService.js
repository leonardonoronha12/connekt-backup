import { supabase } from '@/lib/supabaseClient'
import { canUploadBytes, resolvePlanKey } from '@/services/planEntitlements'

function isImage(file) {
  return !!file && typeof file.type === 'string' && file.type.startsWith('image/');
}

function getExt(file) {
  let byMime = (file?.type || '').split('/')[1];
  if (byMime) {
    // Normalizar sufixos como 'svg+xml' -> 'svg'
    byMime = byMime.split('+')[0];
    return byMime.toLowerCase();
  }
  const name = file?.name || '';
  const m = name.match(/\.([a-zA-Z0-9]+)$/);
  return m ? m[1].toLowerCase() : 'bin';
}

function uuid() {
  if (typeof crypto !== 'undefined' && crypto.randomUUID) return crypto.randomUUID();
  const s4 = () => Math.floor((1 + Math.random()) * 0x10000).toString(16).substring(1);
  return `${s4()}${s4()}-${s4()}-${s4()}-${s4()}-${s4()}${s4()}${s4()}`;
}

/**
 * Upload de Imagem → Supabase + Log
 * @param {{ file: File, contentId?: string, title?: string }} params
 * @returns {Promise<{log_id: string, image_url: string, file_name: string, path: string, bucket: string, mime_type: string, size_bytes: number, content_id: string|null, title: string|null}>}
 */
export async function uploadImageWithLog({ file, contentId = null, title = null }) {
  if (!file) throw new Error('Nenhum arquivo foi selecionado.');
  if (!isImage(file)) throw new Error('O arquivo deve ser uma imagem (image/*).');
  const maxBytes = 5 * 1024 * 1024; // 5MB
  if (typeof file.size === 'number' && file.size > maxBytes) {
    throw new Error('Tamanho máximo de 5MB excedido.');
  }

  try {
    const { data } = await supabase.auth.getUser()
    const uid = data?.user?.id || null
    if (uid) {
      const allowed = await canUploadBytes(uid, file.size, resolvePlanKey())
      if (!allowed.ok) throw new Error('Limite de armazenamento atingido. Faça upgrade do seu plano para continuar.')
    }
  } catch (e) {
    if (String(e?.message || '').toLowerCase().includes('limite de armazenamento')) throw e
  }

  // Em dev, usar proxy com Service Role para evitar bloqueios de RLS
  const useProxy = !!(typeof import.meta !== 'undefined' && import.meta.env && import.meta.env.VITE_USE_LOCAL_UPLOAD_PROXY);
  if (useProxy) {
    const toDataUrl = (f) => new Promise((resolve, reject) => {
      try {
        const reader = new FileReader();
        reader.onload = () => resolve(reader.result);
        reader.onerror = (err) => reject(err);
        reader.readAsDataURL(f);
      } catch (err) { reject(err); }
    });
    const dataUrl = await toDataUrl(file);
    const resp = await fetch('/api/upload-image-with-log', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ filename: file.name, contentType: file.type || 'application/octet-stream', dataUrl, title, contentId }),
    });
    if (!resp.ok) {
      const j = await resp.json().catch(() => ({}));
      throw new Error(j?.error || `Falha no proxy: ${resp.status}`);
    }
    const j = await resp.json();
    return j;
  }

  const bucket = 'images';
  const ext = getExt(file);
  const id = uuid();
  const fileName = `${id}.${ext}`;
  const objectPath = `public/${fileName}`;

  const { data: upData, error: upErr } = await supabase.storage.from(bucket).upload(objectPath, file, {
    contentType: file.type || 'application/octet-stream',
    upsert: false,
  });
  if (upErr) throw upErr;

  const { data: pub } = await supabase.storage.from(bucket).getPublicUrl(upData?.path || objectPath);
  const imageUrl = pub?.publicUrl || '';
  if (!imageUrl) throw new Error('Falha ao gerar URL pública.');

  const payload = {
    image_url: imageUrl,
    file_name: fileName,
    path: objectPath,
    bucket,
    mime_type: file.type || null,
    size_bytes: typeof file.size === 'number' ? file.size : null,
    title: title || null,
    content_id: contentId || null,
  };

  const { data: logRow, error: logErr } = await supabase
    .from('imagens_logs')
    .insert(payload)
    .select('id')
    .single();
  if (logErr) throw logErr;

  return {
    log_id: logRow?.id,
    image_url: imageUrl,
    file_name: fileName,
    path: objectPath,
    bucket,
    mime_type: payload.mime_type,
    size_bytes: payload.size_bytes,
    content_id: payload.content_id,
    title: payload.title,
  };
}

export default { uploadImageWithLog };
