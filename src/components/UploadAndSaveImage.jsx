import React, { useRef, useState } from 'react';
import { useToast } from '@/components/ui/use-toast';
import { uploadAndSaveImage } from '@/services/uploadService';

/**
 * Componente de ação: Upload e salvar imagem no Supabase.
 * Props opcionais: contentId, title, onComplete(result)
 */
const UploadAndSaveImage = ({ contentId, title, onComplete }) => {
  const { toast } = useToast();
  const inputRef = useRef(null);
  const [result, setResult] = useState(null);
  const [isUploading, setIsUploading] = useState(false);

  const handleSelectClick = () => {
    inputRef.current?.click();
  };

  const handleChange = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!file.type?.startsWith('image/')) {
      toast({ description: 'Selecione um arquivo de imagem.', variant: 'destructive' });
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      toast({ description: 'Tamanho máximo permitido: 5MB.', variant: 'destructive' });
      return;
    }
    setIsUploading(true);
    try {
      const res = await uploadAndSaveImage({ file, contentId, title });
      setResult(res);
      if (onComplete) onComplete(res);
      toast({ description: 'Upload concluído e URL salva com sucesso.' });
    } catch (err) {
      console.warn('UploadAndSaveImage error:', err);
      toast({ description: `Falha no upload: ${err?.message || String(err)}`, variant: 'destructive' });
    } finally {
      setIsUploading(false);
      if (inputRef.current) inputRef.current.value = '';
    }
  };

  return (
    <div className="p-4 rounded-md border border-gray-200 bg-white max-w-md">
      <p className="text-sm text-[#22252B] mb-2">Upload e salvar imagem no Supabase</p>
      <div className="flex items-center gap-2">
        <button
          type="button"
          className="px-3 py-2 rounded bg-[#0047BB] text-white text-sm"
          onClick={handleSelectClick}
          disabled={isUploading}
        >
          {isUploading ? 'Enviando...' : 'Selecionar imagem'}
        </button>
        <input
          ref={inputRef}
          type="file"
          accept="image/*"
          className="hidden"
          onChange={handleChange}
        />
      </div>

      {result?.image_url ? (
        <div className="mt-4">
          <p className="text-xs text-[#9291A5] mb-1">URL (Supabase):</p>
          <div className="text-xs break-all select-text">{result.image_url}</div>
          <img src={result.image_url} alt="Imagem enviada" className="mt-2 w-[240px] h-[160px] object-cover rounded" />
        </div>
      ) : null}
    </div>
  );
};

export default UploadAndSaveImage;