import { supabase } from '@/lib/supabaseClient'
import { canUploadBytes, resolvePlanKey } from '@/services/planEntitlements'
import { beginUpload } from '@/services/uploadGuard'

function isImageFile(file) {
  return !!file && typeof file.type === 'string' && file.type.startsWith('image/');
}

function getExtension(file) {
  let byMime = (file?.type || '').split('/')[1];
  if (byMime) {
    byMime = byMime.split('+')[0];
    return byMime.toLowerCase();
  }
  const name = file?.name || '';
  const m = name.match(/\.([a-zA-Z0-9]+)$/);
  return m ? m[1].toLowerCase() : 'bin';
}

function generateUuid() {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }
  const s4 = () => Math.floor((1 + Math.random()) * 0x10000).toString(16).substring(1);
  return `${s4()}${s4()}-${s4()}-${s4()}-${s4()}-${s4()}${s4()}${s4()}`;
}

/**
 * Upload e salvar imagem no Supabase.
 *
 * @param {{ file: File, contentId?: string|number, title?: string }} params
 * @returns {Promise<{ id: string|number, image_url: string }>}
 */
export async function uploadAndSaveImage({ file, contentId, title }) {
  if (!file) throw new Error('Nenhum arquivo selecionado.');
  if (!isImageFile(file)) throw new Error('O arquivo precisa ser uma imagem.');
  const maxBytes = 5 * 1024 * 1024; // 5MB
  if (typeof file.size === 'number' && file.size > maxBytes) {
    throw new Error('A imagem excede 5MB. Selecione um arquivo menor.');
  }

  const endUpload = beginUpload()
  try {
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

    const bucket = 'images';
    const ext = getExtension(file);
    const uuid = generateUuid();
    const objectPath = `public/${uuid}.${ext}`;

    // Upload no Storage
    const { data: uploadData, error: uploadError } = await supabase
      .storage
      .from(bucket)
      .upload(objectPath, file, { contentType: file.type || 'application/octet-stream', upsert: true });
    if (uploadError) throw uploadError;

    const { data: pub } = await supabase
      .storage
      .from(bucket)
      .getPublicUrl(uploadData?.path || objectPath);
    const publicUrl = pub?.publicUrl || '';
    if (!publicUrl) throw new Error('Não foi possível obter a URL pública.');

    // Persistir em tabela content
    let recordId = null;
    if (contentId) {
      const { data, error } = await supabase
        .from('content')
        .update({ image_url: publicUrl })
        .eq('id', contentId)
        .select('id')
        .single();
      if (error) throw error;
      recordId = data?.id || contentId;
    } else {
      const payload = { image_url: publicUrl };
      if (title && String(title).trim().length > 0) payload.title = String(title).trim();
      const { data, error } = await supabase
        .from('content')
        .insert(payload)
        .select('id')
        .single();
      if (error) throw error;
      recordId = data?.id;
    }

    return { id: recordId, image_url: publicUrl };
  } finally {
    endUpload()
  }
}

export default { uploadAndSaveImage };
