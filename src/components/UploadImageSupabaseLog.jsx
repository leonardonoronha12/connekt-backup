import React, { useRef, useState } from 'react';
import { useToast } from '@/components/ui/use-toast';
import { uploadImageWithLog } from '@/services/imageLogService';

/**
 * Componente de demonstração: Upload de Imagem → Supabase + Log
 * Permite informar opcionalmente title e contentId.
 */
const UploadImageSupabaseLog = () => {
  const { toast } = useToast();
  const inputRef = useRef(null);
  const [title, setTitle] = useState('');
  const [contentId, setContentId] = useState('');
  const [result, setResult] = useState(null);
  const [isUploading, setIsUploading] = useState(false);

  const handleSelect = () => inputRef.current?.click();

  const handleChange = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!file.type?.startsWith('image/')) {
      toast({ description: 'O arquivo deve ser uma imagem (image/*).', variant: 'destructive' });
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      toast({ description: 'Tamanho máximo: 5MB.', variant: 'destructive' });
      return;
    }
    setIsUploading(true);
    try {
      const res = await uploadImageWithLog({ file, contentId: contentId || null, title: title || null });
      setResult(res);
      toast({ description: 'Upload concluído e log inserido.' });
      // Pós-ação: preencher estados/variáveis locais para exibir a imagem imediatamente
    } catch (err) {
      console.warn('UploadImageSupabaseLog error:', err);
      toast({ description: `Falha: ${err?.message || String(err)}`, variant: 'destructive' });
    } finally {
      setIsUploading(false);
      if (inputRef.current) inputRef.current.value = '';
    }
  };

  return (
    <div className="p-4 rounded-md border border-gray-200 bg-white max-w-md">
      <p className="text-sm text-[#22252B] mb-3">Upload de Imagem → Supabase + Log</p>

      <div className="flex items-center gap-2 mb-2">
        <input
          type="text"
          placeholder="Title (opcional)"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          className="px-2 py-1 text-sm border rounded w-full"
        />
      </div>
      <div className="flex items-center gap-2 mb-4">
        <input
          type="text"
          placeholder="contentId (UUID opcional)"
          value={contentId}
          onChange={(e) => setContentId(e.target.value)}
          className="px-2 py-1 text-sm border rounded w-full"
        />
      </div>

      <div className="flex items-center gap-2">
        <button
          type="button"
          onClick={handleSelect}
          disabled={isUploading}
          className="px-3 py-2 rounded bg-[#0047BB] text-white text-sm"
        >
          {isUploading ? 'Enviando...' : 'Selecionar imagem'}
        </button>
        <input ref={inputRef} type="file" accept="image/*" className="hidden" onChange={handleChange} />
      </div>

      {result?.image_url ? (
        <div className="mt-4">
          <p className="text-xs text-[#9291A5] mb-1">URL (Supabase):</p>
          <div className="text-xs break-all select-text">{result.image_url}</div>
          <img src={result.image_url} alt="Imagem enviada" className="mt-2 w-[240px] h-[160px] object-cover rounded" />
          <div className="mt-3 text-xs text-[#22252B]">
            <div><span className="text-[#9291A5]">log_id:</span> {result.log_id}</div>
            <div><span className="text-[#9291A5]">file_name:</span> {result.file_name}</div>
            <div><span className="text-[#9291A5]">path:</span> {result.path}</div>
            <div><span className="text-[#9291A5]">bucket:</span> {result.bucket}</div>
            <div><span className="text-[#9291A5]">mime_type:</span> {result.mime_type}</div>
            <div><span className="text-[#9291A5]">size_bytes:</span> {String(result.size_bytes || '')}</div>
            <div><span className="text-[#9291A5]">content_id:</span> {result.content_id || 'null'}</div>
            <div><span className="text-[#9291A5]">title:</span> {result.title || 'null'}</div>
          </div>
        </div>
      ) : null}
    </div>
  );
};

export default UploadImageSupabaseLog;