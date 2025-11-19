import React, { useState, useRef, useEffect } from 'react';
import { Helmet } from 'react-helmet-async';
import { Plus } from 'lucide-react';
import questionBankService from '@/services/questionBankService';
import { useToast } from '@/components/ui/use-toast';
import { useAuth } from '@/contexts/SupabaseAuthContext';

const QuestoesPage = () => {
  const { toast } = useToast();
  const { user } = useAuth();
  // Ler o bankId da URL para identificar o banco específico
  const [currentBankId, setCurrentBankId] = useState(null);
  // Estado agregado do banco atual com relações completas
  const [bancoAtual, setBancoAtual] = useState(null);
  const [isCreating, setIsCreating] = useState(false);
  const [showUploadBox, setShowUploadBox] = useState(false);
  // Modo de upload atual: 'image' ou 'video'
  const [uploadMode, setUploadMode] = useState('image');
  // Upload de imagem (copiado do fluxo do Simulados)
  const [selectedImage, setSelectedImage] = useState(null);
  const [previewUrl, setPreviewUrl] = useState(null);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const uploadIntervalRef = useRef(null);
  // Upload de vídeo
  const [selectedVideo, setSelectedVideo] = useState(null);
  const [videoPreviewUrl, setVideoPreviewUrl] = useState(null);
  const videoFileInputRef = useRef(null);
  // Lista de questões e seleção atual
  const [questions, setQuestions] = useState([]);
  const [selectedQuestionIndex, setSelectedQuestionIndex] = useState(null);
  const [openQuestionMenuIndex, setOpenQuestionMenuIndex] = useState(null);
  const [pendingDeleteQuestionIndex, setPendingDeleteQuestionIndex] = useState(null);
  // Seleções para criação do banco (múltiplas, como tags)
  const [selectedCategories, setSelectedCategories] = useState([]); // array de objetos { id, name, color, description }
  const [selectedSubcategories, setSelectedSubcategories] = useState([]); // array de objetos { id, name, color, description }
  const [selectedTags, setSelectedTags] = useState([]); // array de objetos { id, name, color, description }
  // Editor rico por escolha (mapeia índice da escolha -> aberto/fechado)
  const [choiceRichEditorOpen, setChoiceRichEditorOpen] = useState({});
  // Helpers para acessar/atualizar a questão selecionada
  const getSelectedQuestion = () => (
    selectedQuestionIndex !== null && questions[selectedQuestionIndex]
      ? questions[selectedQuestionIndex]
      : null
  );
  const updateSelectedQuestion = (partial) => {
    if (selectedQuestionIndex === null) return;
    setQuestions(prev => {
      const next = [...prev];
      const current = next[selectedQuestionIndex];
      if (!current) return next;
      next[selectedQuestionIndex] = { ...current, ...partial };
      return next;
    });
  };

  // Persistir extras de metadata da questão atual no Supabase, preservando campos reservados
  const persistSelectedQuestionExtras = async (extras = {}, reservedOverrides = {}) => {
    try {
      const current = getSelectedQuestion();
      if (!current || !current.id) return;
      const updates = {
        name: current.name,
        title: current.title,
        text: current.text,
        body: current.body,
        type: reservedOverrides.type ?? current.type ?? (current.metadata?.type ?? 'multiple_choice'),
        required: reservedOverrides.required ?? (typeof current.required === 'boolean' ? current.required : !!current.metadata?.required),
        disabled: reservedOverrides.disabled ?? (typeof current.disabled === 'boolean' ? current.disabled : !!current.metadata?.disabled),
        choices: Array.isArray(reservedOverrides.choices) ? reservedOverrides.choices : (Array.isArray(current.choices) ? current.choices : []),
        correctChoiceIndex: typeof reservedOverrides.correctChoiceIndex === 'number' ? reservedOverrides.correctChoiceIndex : (typeof current.correctChoiceIndex === 'number' ? current.correctChoiceIndex : null),
        points: typeof reservedOverrides.points === 'number' ? reservedOverrides.points : (typeof current.points === 'number' ? current.points : (typeof current.metadata?.points === 'number' ? current.metadata.points : 0)),
        attempts: typeof reservedOverrides.attempts === 'number' ? reservedOverrides.attempts : (typeof current.attempts === 'number' ? current.attempts : (typeof current.metadata?.attempts === 'number' ? current.metadata.attempts : 0)),
        metadata: { ...(current.metadata || {}), ...extras },
      };
      await questionBankService.updateQuestion(current.id, updates);
    } catch (err) {
      console.warn('persistSelectedQuestionExtras error:', err);
    }
  };

  // Ao trocar para outra questão, fechar quaisquer caixas de upload/preview abertas
  useEffect(() => {
    // Fechar box e limpar estados de upload/preview para evitar herdar mídia de outra questão
    setShowUploadBox(false);
    setIsUploading(false);
    setUploadProgress(0);
    // Limpar imagem
    setSelectedImage(null);
    setPreviewUrl(null);
    if (imageFileInputRef.current) {
      imageFileInputRef.current.value = '';
    }
    setImageFileInputKey((k) => k + 1);
    // Limpar vídeo
    setSelectedVideo(null);
    setVideoPreviewUrl(null);
    if (videoFileInputRef.current) {
      videoFileInputRef.current.value = '';
    }
  }, [selectedQuestionIndex]);

  // Input de arquivo para imagem (ao clicar no ícone de imagem)
  const imageFileInputRef = useRef(null);
  // Chave para forçar re-montagem do input file ao limpar
  const [imageFileInputKey, setImageFileInputKey] = useState(0);
  const handleRevealUploadBox = () => {
    // Mantido para compatibilidade: revela box no modo atual
    setShowUploadBox(true);
  };
  const handleSwitchToImageUpload = () => {
    // Fechar qualquer box aberto e abrir a div de imagem
    setUploadMode('image');
    setShowUploadBox(false);
    // Se a questão atual possui imagem salva, pré-carregar no preview
    try {
      const current = getSelectedQuestion();
      if (current) {
        const meta = current.metadata || {};
        const candidates = [
          current.image,
          current.imageUrl,
          current.image_url,
          current.cover,
          current.capa,
          current.thumbnail,
          meta.image,
          meta.imageUrl,
          meta.image_url,
          meta.cover,
          meta.capa,
          meta.thumbnail,
        ];
        const saved = candidates.find(v => typeof v === 'string' && v.trim().length > 0) || null;
        if (saved && !selectedImage) {
          setSelectedImage(saved);
        }
      }
    } catch {}
    setTimeout(() => setShowUploadBox(true), 0);
  };
  const handleSwitchToVideoUpload = () => {
    // Fechar imagem e abrir box para vídeos
    setUploadMode('video');
    setShowUploadBox(false);
    // Se a questão atual possui vídeo salvo, pré-carregar no preview
    try {
      const current = getSelectedQuestion();
      if (current) {
        const meta = current.metadata || {};
        const candidates = [
          meta.videoUrl,
          meta.video_url,
          meta.video,
          current.videoUrl,
          current.video_url,
          current.video,
        ];
        const saved = candidates.find(v => typeof v === 'string' && v.trim().length > 0) || null;
        if (saved && !selectedVideo) {
          setSelectedVideo(saved);
        }
      }
    } catch {}
    setTimeout(() => setShowUploadBox(true), 0);
    // Não abrir automaticamente o seletor; apenas revelar a div
  };
  const handleOpenImageFileDialog = () => {
    // Abre o seletor de arquivos; se o input ainda não estiver montado, revela o box e tenta clicar após o render
    if (imageFileInputRef.current) {
      imageFileInputRef.current.click();
    } else {
      setShowUploadBox(true);
      setTimeout(() => {
        if (imageFileInputRef.current) {
          imageFileInputRef.current.click();
        }
      }, 0);
    }
  };
  const handleOpenVideoFileDialog = () => {
    // Abre seletor de vídeos com lógica similar
    if (videoFileInputRef.current) {
      videoFileInputRef.current.click();
    } else {
      setUploadMode('video');
      setShowUploadBox(true);
      setTimeout(() => {
        if (videoFileInputRef.current) {
          videoFileInputRef.current.click();
        }
      }, 0);
    }
  };

  // Converter data URL (base64) em File para tentar gerar URL pública
  const dataUrlToFile = (dataUrl, filename = 'imagem.png') => {
    try {
      const arr = dataUrl.split(',');
      const mimeMatch = arr[0].match(/:(.*?);/);
      const mime = mimeMatch ? mimeMatch[1] : 'application/octet-stream';
      const bstr = atob(arr[1]);
      let n = bstr.length;
      const u8arr = new Uint8Array(n);
      while (n--) {
        u8arr[n] = bstr.charCodeAt(n);
      }
      return new File([u8arr], filename, { type: mime });
    } catch {
      return null;
    }
  };

  // Tentar gerar uma URL pública a partir do preview/base64
  const handleGeneratePublicUrl = async () => {
    const current = getSelectedQuestion();
    if (!current) {
      toast({ description: 'Selecione uma questão antes de gerar a URL.', variant: 'destructive' });
      return;
    }
    // Descobrir o bankId por fallback: querystring -> bancoAtual -> question -> metadata
    const bankIdFallback = currentBankId 
      || (bancoAtual && bancoAtual.id) 
      || current.question_bank_id 
      || (current.metadata && current.metadata.bankId) 
      || null;
    if (!bankIdFallback) {
      toast({ description: 'Banco não identificado. Abra a página com ?bankId=... ou selecione um banco.', variant: 'destructive' });
      return;
    }
    try {
      let sourceFile = null;
      if (selectedImage instanceof File) {
        sourceFile = selectedImage;
      } else {
        const candidates = [previewUrl, selectedImage].filter(v => typeof v === 'string' && v.trim().length > 0);
        const base64 = candidates.find(v => v.toLowerCase().startsWith('data:')) || null;
        if (base64) {
          sourceFile = dataUrlToFile(base64, (current?.metadata?.imageName || 'imagem.png'));
        }
      }
      if (!sourceFile) {
        toast({ description: 'Nenhuma imagem base64 disponível para gerar URL.', variant: 'destructive' });
        return;
      }
      setIsUploading(true);
      setUploadProgress(0);
      const uploadRes = await questionBankService.uploadQuestionImage(sourceFile, { bankId: bankIdFallback, questionId: current.id });
      const publicUrl = uploadRes?.url || '';
      const objectPath = uploadRes?.path || null;
      if (publicUrl && publicUrl.startsWith('http')) {
        setPreviewUrl(publicUrl);
        setSelectedImage(publicUrl);
        setQuestions(prev => {
          if (!Array.isArray(prev)) return prev;
          return prev.map((q, idx) => {
            if (idx !== selectedQuestionIndex) return q;
            return {
              ...q,
              imageUrl: publicUrl,
              metadata: { ...(q.metadata || {}), imageUrl: publicUrl, imagePath: objectPath || (q.metadata && q.metadata.imagePath) }
            };
          });
        });
        // Persistir imediatamente na questão atual
        try {
          const metaExtras = { ...(current.metadata || {}), imageUrl: publicUrl, imagePath: objectPath || (current.metadata && current.metadata.imagePath) };
          await questionBankService.updateQuestion(current.id, {
            name: current.name,
            title: current.title,
            text: current.text,
            body: current.body,
            type: current.type,
            required: current.required,
            disabled: !!current.disabled,
            choices: current.choices,
            correctChoiceIndex: current.correctChoiceIndex,
            points: current.points,
            attempts: current.attempts,
            metadata: metaExtras,
          });
          try { toast({ description: 'Imagem salva na questão.' }); } catch {}
        } catch (persistErr) {
          console.warn('Falha ao persistir imagem na questão após gerar URL:', persistErr);
        }
        toast({ description: 'URL pública gerada com sucesso.' });
      } else {
        toast({ description: 'Falha ao gerar URL pública.', variant: 'destructive' });
      }
    } catch (err) {
      console.warn('handleGeneratePublicUrl error:', err);
      toast({ description: `Erro ao gerar URL: ${err?.message || String(err)}`, variant: 'destructive' });
    } finally {
      if (uploadIntervalRef.current) {
        clearInterval(uploadIntervalRef.current);
        uploadIntervalRef.current = null;
      }
      setIsUploading(false);
      setUploadProgress(100);
    }
  };

  // Efeito para capturar o bankId via query string ao montar
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const bankIdParam = params.get('bankId');
    if (bankIdParam) {
      // Usar o UUID diretamente (não converter para número)
      const bankId = bankIdParam;
      setCurrentBankId(bankId);
      (async () => {
        try {
          const { data, error } = await questionBankService.getQuestionBankById(bankId);
          if (error || !data) {
            toast({ description: 'Não foi possível carregar o banco selecionado', variant: 'destructive' });
            return;
          }
          // Pré-popular seleções com dados do banco (converter string única em arrays)
          setSelectedCategories(() => {
            const name = data.category || '';
            if (!name) return [];
            const found = (categories || []).find(c => c.name === name);
            return [found || { id: `tmp-cat-${name}`, name, color: '#8B5CF6', description: '' }];
          });
          setSelectedSubcategories(() => {
            const name = data.subcategory || '';
            if (!name) return [];
            const found = (subcategories || []).find(s => s.name === name);
            return [found || { id: `tmp-sub-${name}`, name, color: '#22C55E', description: '' }];
          });
          // Normalizar tags vindas do backend: podem ser strings
          // Mapeamos para objetos usando availableTags, com fallback seguro
          const normalizedTags = Array.isArray(data.tags)
            ? data.tags
                .map(t => {
                  if (t && typeof t === 'object' && t.name) return t;
                  if (typeof t === 'string') {
                    const found = availableTags.find(at => at && at.name === t);
                    return found || { id: `tmp-${t}`, name: t, color: '#FFC107', description: '' };
                  }
                  return null;
                })
                .filter(Boolean)
            : [];
          setSelectedTags(normalizedTags);
          toast({ description: `Banco selecionado: ${data.name || bankId}` });

          // Carregar banco com relações (questions, choices, categorias, subcategorias, tags, attempts)
          try {
            const full = await questionBankService.getBankWithRelations(bankId);
            if (full?.data) {
              setBancoAtual(full.data);
            }
          } catch (e) {
            console.warn('Falha ao carregar relações completas do banco:', e);
          }

          // Carregar questões existentes do banco (online ou fallback offline)
          const res = await questionBankService.getQuestionsByBankId(bankId);
          const items = (res.data || []).map(q => {
            const meta = q.metadata || {};
            // Título
            const title = q.title || meta.title || meta.name || 'Sem título';
            // Enunciado/Texto com fallback para diferentes chaves
            const body = q.body 
              || meta.body 
              || meta.text 
              || meta.statement 
              || meta.question 
              || '';
            // Choices com fallback para diferentes formatos
            let choices = [];
            if (Array.isArray(meta.choices)) {
              choices = meta.choices.map(c => typeof c === 'string' ? c : (c?.text || c?.label || ''));
            } else if (Array.isArray(meta.alternatives)) {
              choices = meta.alternatives.map(c => typeof c === 'string' ? c : (c?.text || c?.label || ''));
            } else if (Array.isArray(meta.options)) {
              choices = meta.options.map(c => typeof c === 'string' ? c : (c?.text || c?.label || ''));
            }
            // Índice da correta com fallback
            let correctChoiceIndex = null;
            if (typeof meta.correctChoiceIndex === 'number') {
              correctChoiceIndex = meta.correctChoiceIndex;
            } else if (typeof meta.answer_index === 'number') {
              correctChoiceIndex = meta.answer_index;
            } else if (typeof meta.correct === 'string') {
              const m = meta.correct.trim().toUpperCase();
              const idx = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'.indexOf(m);
              correctChoiceIndex = idx >= 0 ? idx : null;
            } else if (typeof meta.answer === 'string') {
              const m = meta.answer.trim().toUpperCase();
              const idx = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'.indexOf(m);
              correctChoiceIndex = idx >= 0 ? idx : null;
            }
            // Pontos/tentativas com fallback
            const points = typeof meta.points === 'number' 
              ? meta.points 
              : (typeof meta.score === 'number' ? meta.score : 0);
            const attempts = typeof meta.attempts === 'number' 
              ? meta.attempts 
              : (typeof meta.max_attempts === 'number' ? meta.max_attempts : 0);

            return {
              id: q.id,
              name: title,
              title,
              text: body,
              body,
              type: meta.type ?? 'multiple_choice',
              required: !!meta.required,
              disabled: !!meta.disabled,
              choices,
              correctChoiceIndex,
              points,
              attempts,
              metadata: meta,
            };
          });
          setQuestions(items);
          if (items.length > 0) {
            setSelectedQuestionIndex(0);
          }
        } catch (e) {
          console.error('Erro ao carregar banco por ID:', e);
          toast({ description: 'Erro ao carregar banco selecionado', variant: 'destructive' });
        }
      })();
    }
  }, []);
  // Gerenciar URL de preview para arquivo selecionado
  useEffect(() => {
    let url = null;
    if (selectedImage && selectedImage instanceof File) {
      url = URL.createObjectURL(selectedImage);
      setPreviewUrl(url);
    } else if (typeof selectedImage === 'string') {
      setPreviewUrl(selectedImage);
    } else {
      setPreviewUrl(null);
    }
    return () => {
      if (url) URL.revokeObjectURL(url);
    };
  }, [selectedImage]);
  const handleImageFileChange = (e) => {
    const file = e.target.files && e.target.files[0];
    if (file) {
      setSelectedImage(file);
      // Iniciar upload simulado: preenche o anel e sobe porcentagem até 100%
      if (uploadIntervalRef.current) {
        clearInterval(uploadIntervalRef.current);
        uploadIntervalRef.current = null;
      }
      setIsUploading(true);
      setUploadProgress(0);
      const totalDurationMs = 2500; // ~2.5s até 100%
      const tickMs = 50;
      const step = 100 / (totalDurationMs / tickMs);
      uploadIntervalRef.current = setInterval(() => {
        setUploadProgress((prev) => {
          const next = Math.min(100, prev + step);
          if (next >= 100) {
            clearInterval(uploadIntervalRef.current);
            uploadIntervalRef.current = null;
            // pequena pausa para mostrar 100% antes de concluir
            setTimeout(() => {
              setIsUploading(false);
            }, 500);
          }
          return next;
        });
      }, tickMs);

      // Upload imediato ao Supabase e uso da URL pública no preview
      (async () => {
        try {
          const current = getSelectedQuestion();
          if (!current) return;
          const uploadRes = await questionBankService.uploadQuestionImage(file, {
            bankId: currentBankId,
            questionId: current.id,
          });
          const publicUrl = uploadRes?.url || null;
          const objectPath = uploadRes?.path || null;
          if (publicUrl) {
            setSelectedImage(publicUrl);
            setPreviewUrl(publicUrl);
            // Atualizar a questão selecionada para refletir a URL já no estado
            setQuestions(prev => {
              if (!Array.isArray(prev)) return prev;
              return prev.map((q, idx) => {
                if (idx !== selectedQuestionIndex) return q;
                return {
                  ...q,
                  imageUrl: publicUrl,
                  metadata: { ...(q.metadata || {}), imageUrl: publicUrl, imagePath: objectPath || (q.metadata && q.metadata.imagePath) }
                };
              });
            });
            // Persistir imediatamente a URL e o path da imagem na questão atual
            try {
              const metaExtras = { ...(current.metadata || {}), imageUrl: publicUrl, imagePath: objectPath || (current.metadata && current.metadata.imagePath) };
              await questionBankService.updateQuestion(current.id, {
                name: current.name,
                title: current.title,
                text: current.text,
                body: current.body,
                type: current.type,
                required: current.required,
                disabled: !!current.disabled,
                choices: current.choices,
                correctChoiceIndex: current.correctChoiceIndex,
                points: current.points,
                attempts: current.attempts,
                metadata: metaExtras,
              });
              try { toast({ description: 'Imagem salva na questão.' }); } catch {}
            } catch (persistErr) {
              console.warn('Falha ao persistir imagem na questão:', persistErr);
            }
            try { toast({ description: 'Upload concluído. URL pública disponível.' }); } catch {}
          } else {
            // Fallback imediato: converter para data URL para evitar ficar em blob:
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
            try {
              const dataUrl = await toDataUrl(file);
              setSelectedImage(dataUrl);
              setPreviewUrl(dataUrl);
              // Tentar gerar automaticamente uma URL pública a partir do base64
              try {
                await handleGeneratePublicUrl();
              } catch (autoErr) {
                console.warn('Tentativa automática de gerar URL pública falhou:', autoErr);
              }
            } catch (convErr) {
              console.warn('Falha ao converter imagem para data URL:', convErr);
            }
            if (uploadRes?.error) {
              toast({ description: `Falha no upload ao Supabase: ${uploadRes.error}`, variant: 'destructive' });
            } else {
              toast({ description: 'Upload ao Supabase indisponível. Usando preview local/base64.', variant: 'destructive' });
            }
          }
        } catch (err) {
          console.warn('Upload imediato da imagem falhou:', err);
          toast({ description: `Erro de upload: ${err?.message || String(err)}`, variant: 'destructive' });
        } finally {
          if (uploadIntervalRef.current) {
            clearInterval(uploadIntervalRef.current);
            uploadIntervalRef.current = null;
          }
          setIsUploading(false);
          setUploadProgress(100);
        }
      })();
    }
  };

  // Gerenciar URL de preview para vídeo selecionado
  useEffect(() => {
    let url = null;
    if (selectedVideo && selectedVideo instanceof File) {
      url = URL.createObjectURL(selectedVideo);
      setVideoPreviewUrl(url);
    } else if (typeof selectedVideo === 'string') {
      setVideoPreviewUrl(selectedVideo);
    } else {
      setVideoPreviewUrl(null);
    }
    return () => {
      if (url) URL.revokeObjectURL(url);
    };
  }, [selectedVideo]);

  const handleVideoFileChange = (e) => {
    const file = e.target.files && e.target.files[0];
    if (file) {
      setSelectedVideo(file);
      // Simular upload com mesmo progresso
      if (uploadIntervalRef.current) {
        clearInterval(uploadIntervalRef.current);
        uploadIntervalRef.current = null;
      }
      setIsUploading(true);
      setUploadProgress(0);
      const totalDurationMs = 2500;
      const tickMs = 50;
      const step = 100 / (totalDurationMs / tickMs);
      uploadIntervalRef.current = setInterval(() => {
        setUploadProgress((prev) => {
          const next = Math.min(100, prev + step);
          if (next >= 100) {
            clearInterval(uploadIntervalRef.current);
            uploadIntervalRef.current = null;
            setTimeout(() => {
              setIsUploading(false);
            }, 500);
          }
          return next;
        });
      }, tickMs);

      // Upload imediato ao Supabase usando proxy e persistência de metadata.videoUrl/videoPath
      (async () => {
        try {
          const current = getSelectedQuestion();
          if (!current) return;
          const uploadRes = await questionBankService.uploadQuestionVideo(file, {
            bankId: currentBankId,
            questionId: current.id,
          });
          const publicUrl = uploadRes?.url || null;
          const objectPath = uploadRes?.path || null;
          if (publicUrl) {
            setSelectedVideo(publicUrl);
            setVideoPreviewUrl(publicUrl);
            // Atualizar questão selecionada no estado local
            setQuestions(prev => {
              if (!Array.isArray(prev)) return prev;
              return prev.map((q, idx) => {
                if (idx !== selectedQuestionIndex) return q;
                return {
                  ...q,
                  metadata: { ...(q.metadata || {}), videoUrl: publicUrl, videoPath: objectPath || (q.metadata && q.metadata.videoPath) }
                };
              });
            });
            // Persistir imediatamente a URL e o path do vídeo na questão atual (sem depender do proxy)
            try {
              const metaExtras = { ...(current.metadata || {}), videoUrl: publicUrl, videoPath: objectPath || (current.metadata && current.metadata.videoPath) };
              await questionBankService.updateQuestion(current.id, {
                name: current.name,
                title: current.title,
                text: current.text,
                body: current.body,
                type: current.type,
                required: current.required,
                disabled: !!current.disabled,
                choices: current.choices,
                correctChoiceIndex: current.correctChoiceIndex,
                points: current.points,
                attempts: current.attempts,
                metadata: metaExtras,
              });
              try { toast({ description: 'Vídeo salvo na questão.' }); } catch {}
            } catch (persistErr) {
              console.warn('Falha ao persistir vídeo na questão:', persistErr);
            }
            try { toast({ description: 'Upload de vídeo concluído. URL disponível.' }); } catch {}
          } else {
            // Fallback: converter para data URL e persistir na questão
            const toDataUrl = (f) => new Promise((resolve, reject) => {
              try {
                const reader = new FileReader();
                reader.onload = () => resolve(reader.result);
                reader.onerror = (err) => reject(err);
                reader.readAsDataURL(f);
              } catch (err) { reject(err); }
            });
            try {
              const dataUrl = await toDataUrl(file);
              setSelectedVideo(dataUrl);
              setVideoPreviewUrl(dataUrl);
              // Atualizar estado local da questão selecionada
              setQuestions(prev => {
                if (!Array.isArray(prev)) return prev;
                return prev.map((q, idx) => {
                  if (idx !== selectedQuestionIndex) return q;
                  return {
                    ...q,
                    metadata: { ...(q.metadata || {}), videoUrl: dataUrl, videoPath: (q.metadata && q.metadata.videoPath) }
                  };
                });
              });
              // Persistir metadados com base64 como fallback
              try {
                const metaExtras = { ...(current.metadata || {}), videoUrl: dataUrl, videoPath: (current.metadata && current.metadata.videoPath) };
                await questionBankService.updateQuestion(current.id, {
                  name: current.name,
                  title: current.title,
                  text: current.text,
                  body: current.body,
                  type: current.type,
                  required: current.required,
                  disabled: !!current.disabled,
                  choices: current.choices,
                  correctChoiceIndex: current.correctChoiceIndex,
                  points: current.points,
                  attempts: current.attempts,
                  metadata: metaExtras,
                });
                try { toast({ description: 'Preview base64 do vídeo salvo na questão.' }); } catch {}
              } catch (persistErr) {
                console.warn('Falha ao persistir vídeo base64 na questão:', persistErr);
              }
            } catch (convErr) {
              console.warn('Falha ao converter vídeo para data URL:', convErr);
            }
            if (uploadRes?.error) {
              toast({ description: `Falha no upload de vídeo: ${uploadRes.error}`, variant: 'destructive' });
            } else {
              toast({ description: 'Upload de vídeo indisponível. Usando preview local/base64.', variant: 'destructive' });
            }
          }
        } catch (err) {
          console.warn('Upload imediato do vídeo falhou:', err);
          toast({ description: `Erro de upload de vídeo: ${err?.message || String(err)}`, variant: 'destructive' });
        } finally {
          if (uploadIntervalRef.current) {
            clearInterval(uploadIntervalRef.current);
            uploadIntervalRef.current = null;
          }
          setIsUploading(false);
          setUploadProgress(100);
        }
      })();
    }
  };

  // Remover imagem selecionada e resetar estados de upload/preview
  const handleRemoveSelectedImage = () => {
    if (uploadIntervalRef.current) {
      clearInterval(uploadIntervalRef.current);
      uploadIntervalRef.current = null;
    }
    setIsUploading(false);
    setUploadProgress(0);
    setSelectedImage(null);
    setPreviewUrl(null);
    if (imageFileInputRef.current) {
      imageFileInputRef.current.value = '';
    }
    // Forçar re-montagem do input para limpar qualquer file persistente
    setImageFileInputKey((k) => k + 1);

    // Remover URLs de imagem salvas na questão atual para evitar re-preview ao reabrir
    try {
      const current = getSelectedQuestion();
      if (current) {
        const meta = { ...(current.metadata || {}) };
        delete meta.imageUrl;
        delete meta.image_url;
        delete meta.image;
        delete meta.thumbnail;
        delete meta.cover;
        delete meta.capa;
        updateSelectedQuestion({ metadata: meta, imageUrl: undefined, image_url: undefined, image: undefined, thumbnail: undefined, cover: undefined, capa: undefined });
      }
    } catch {}
  };

  const handleRemoveSelectedVideo = () => {
    if (uploadIntervalRef.current) {
      clearInterval(uploadIntervalRef.current);
      uploadIntervalRef.current = null;
    }
    setIsUploading(false);
    setUploadProgress(0);
    setSelectedVideo(null);
    setVideoPreviewUrl(null);
    if (videoFileInputRef.current) {
      videoFileInputRef.current.value = '';
    }
    // Remover URLs de vídeo salvas na questão atual para evitar re-preview ao reabrir
    try {
      const current = getSelectedQuestion();
      if (current) {
        const meta = { ...(current.metadata || {}) };
        delete meta.videoUrl;
        delete meta.video_url;
        delete meta.video;
        updateSelectedQuestion({ metadata: meta, videoUrl: undefined, video_url: undefined, video: undefined });
      }
    } catch {}
  };

  const handleCriarDoZero = async () => {
    if (!currentBankId) {
      toast({ description: 'Selecione um banco de questões antes de criar.', variant: 'destructive' });
      return;
    }
    const baseQuestion = {
      name: `Questão ${questions.length + 1}`,
      type: 'multiple_choice',
      required: false,
      disabled: false,
      text: '',
      choices: ['', '', '', ''],
      correctChoiceIndex: null,
      points: 5,
      attempts: 3,
    };
    try {
      const { data, error } = await questionBankService.createQuestion(currentBankId, baseQuestion);
      if (error) {
        toast({ description: 'Erro ao salvar a questão.', variant: 'destructive' });
        return;
      }
      const created = {
        ...baseQuestion,
        id: data?.id,
        title: data?.title,
        body: data?.body,
        metadata: data?.metadata,
      };
      setQuestions(prev => {
        const next = [...prev, created];
        setSelectedQuestionIndex(next.length - 1);
        return next;
      });
      setIsCreating(true);
      const offlineMsg = questionBankService.isSupabaseAvailable ? '' : ' (modo offline/memória: pode não persistir após recarregar)';
      toast({ description: `Questão criada e salva no banco${offlineMsg}.` });
      // Atualizar cabeçalho (bancoAtual) com relações para refletir a nova questão
      try {
        const full = await questionBankService.getBankWithRelations(currentBankId);
        if (full?.data) {
          setBancoAtual(full.data);
        }
      } catch (e) {
        console.warn('Falha ao atualizar cabeçalho do banco após criação:', e);
      }
    } catch (e) {
      console.error('Erro ao criar questão:', e);
      toast({ description: 'Erro ao criar questão.', variant: 'destructive' });
    }
  };

  // Salvar todas as questões do estado local (um por vez)
  const handleSalvarTodasQuestoes = async () => {
    if (!Array.isArray(questions) || questions.length === 0) {
      return { total: 0, sucesso: 0, falha: 0 };
    }
    let sucesso = 0;
    let falha = 0;
    const updatedList = [...questions];
    for (let i = 0; i < questions.length; i++) {
      const q = questions[i];
      try {
        const { data, error } = await questionBankService.updateQuestion(q.id, {
          name: q.name,
          title: q.title,
          text: q.text,
          body: q.body,
          type: q.type,
          required: q.required,
          disabled: !!q.disabled,
          choices: q.choices,
          correctChoiceIndex: q.correctChoiceIndex,
          points: q.points,
          attempts: q.attempts,
          // Preservar qualquer metadata existente (inclui imagem salva se houver)
          metadata: { ...(q.metadata || {}) },
        });
        if (error) {
          falha++;
          continue;
        }
        const meta = (data && data.metadata) || {};
        const title = data?.title || q.name || 'Sem título';
        const body = data?.body || meta.body || q.text || '';
        let choices = Array.isArray(meta.choices) ? meta.choices : (Array.isArray(q.choices) ? q.choices : []);
        choices = choices.map(c => typeof c === 'string' ? c : (c?.text || c?.label || ''));
        const correctChoiceIndex = typeof meta.correctChoiceIndex === 'number' ? meta.correctChoiceIndex : (typeof q.correctChoiceIndex === 'number' ? q.correctChoiceIndex : null);
        const points = typeof meta.points === 'number' ? meta.points : (typeof q.points === 'number' ? q.points : 0);
        const attempts = typeof meta.attempts === 'number' ? meta.attempts : (typeof q.attempts === 'number' ? q.attempts : 0);
        updatedList[i] = {
          ...q,
          name: title,
          title,
          text: body,
          body,
          disabled: !!meta.disabled,
          choices,
          correctChoiceIndex,
          points,
          attempts,
          metadata: meta,
        };
        sucesso++;
      } catch (e) {
        console.warn('Falha ao salvar questão em lote:', e);
        falha++;
      }
    }
    setQuestions(updatedList);
    return { total: questions.length, sucesso, falha };
  };

  const handleSalvarQuestao = async () => {
    const current = getSelectedQuestion();
    if (!current) {
      toast({ description: 'Nenhuma questão selecionada para salvar.', variant: 'destructive' });
      return;
    }
    try {
      // Se houver arquivo selecionado, fazer upload para Supabase Storage primeiro
      let imageCandidate = null;
      if (selectedImage && selectedImage instanceof File) {
        try {
          setIsUploading(true);
          setUploadProgress(0);
          // Upload real (sem progresso granular); manter anel com progresso simulado
          const uploadRes = await questionBankService.uploadQuestionImage(selectedImage, {
            bankId: currentBankId,
            questionId: current.id,
          });
          // Se o bucket não existir, avisar explicitamente e seguir para fallback
          if (uploadRes && typeof uploadRes.error === 'string' && uploadRes.error.toLowerCase().includes('bucket not found')) {
            toast({
              description: 'Bucket "question-images" não encontrado no Supabase. Crie o bucket em Storage e tente novamente.',
              variant: 'destructive'
            });
          }
          imageCandidate = uploadRes?.url || null;
          // Fallback: se o upload não retornou URL, salvar como data URL (base64)
          if (!imageCandidate) {
            const toDataUrl = (file) => new Promise((resolve, reject) => {
              try {
                const reader = new FileReader();
                reader.onload = () => resolve(reader.result);
                reader.onerror = (err) => reject(err);
                reader.readAsDataURL(file);
              } catch (err) {
                reject(err);
              }
            });
            try {
              imageCandidate = await toDataUrl(selectedImage);
            } catch (convErr) {
              console.warn('Falha ao converter imagem para data URL:', convErr);
              imageCandidate = null;
            }
          }
          if (imageCandidate) {
            // Atualizar preview e estado para refletir URL pública
            setSelectedImage(imageCandidate);
            setPreviewUrl(imageCandidate);
          }
        } catch (e) {
          console.warn('Falha no upload da imagem:', e);
        } finally {
          // Finalizar estado de upload
          if (uploadIntervalRef.current) {
            clearInterval(uploadIntervalRef.current);
            uploadIntervalRef.current = null;
          }
          setIsUploading(false);
          setUploadProgress(100);
        }
      } else {
        // Determinar o melhor candidato de URL de imagem para persistir (preview/base64 ou string existente)
        imageCandidate = (() => {
          if (typeof previewUrl === 'string' && previewUrl.trim()) return previewUrl;
          if (typeof selectedImage === 'string' && selectedImage.trim()) return selectedImage;
          return null;
        })();
      }
      // Preparar metadata extra para preservar imagem e dados auxiliares
      const metaExtras = { ...(current.metadata || {}) };
      if (imageCandidate) {
        metaExtras.imageUrl = imageCandidate;
      }
      if (selectedImage && typeof selectedImage === 'object' && selectedImage?.name) {
        metaExtras.imageName = selectedImage.name;
        metaExtras.imageSize = typeof selectedImage.size === 'number' ? selectedImage.size : undefined;
        metaExtras.imageType = selectedImage.type || undefined;
      }

      const { data, error } = await questionBankService.updateQuestion(current.id, {
        name: current.name,
        title: current.title,
        text: current.text,
        body: current.body,
        type: current.type,
        required: current.required,
        disabled: !!current.disabled,
        choices: current.choices,
        correctChoiceIndex: current.correctChoiceIndex,
        points: current.points,
        attempts: current.attempts,
        metadata: metaExtras,
      });
      if (error) {
        toast({ description: 'Erro ao salvar a questão.', variant: 'destructive' });
        return;
      }
      // Atualizar estado local com o retorno normalizado
      const meta = (data && data.metadata) || {};
      const title = data?.title || current.name || 'Sem título';
      const body = data?.body || meta.body || current.text || '';
      let choices = Array.isArray(meta.choices) ? meta.choices : (Array.isArray(current.choices) ? current.choices : []);
      choices = choices.map(c => typeof c === 'string' ? c : (c?.text || c?.label || ''));
      const correctChoiceIndex = typeof meta.correctChoiceIndex === 'number' ? meta.correctChoiceIndex : (typeof current.correctChoiceIndex === 'number' ? current.correctChoiceIndex : null);
      const points = typeof meta.points === 'number' ? meta.points : (typeof current.points === 'number' ? current.points : 0);
      const attempts = typeof meta.attempts === 'number' ? meta.attempts : (typeof current.attempts === 'number' ? current.attempts : 0);

      updateSelectedQuestion({
        name: title,
        title,
        text: body,
        body,
        disabled: !!meta.disabled,
        choices,
        correctChoiceIndex,
        points,
        attempts,
        metadata: meta,
      });
      const offlineMsg = questionBankService.isSupabaseAvailable ? '' : ' (modo offline/memória)';
      toast({ description: `Questão salva${offlineMsg}.` });
      // Atualizar cabeçalho (bancoAtual) para refletir últimas alterações e métricas
      try {
        const full = await questionBankService.getBankWithRelations(currentBankId);
        if (full?.data) {
          setBancoAtual(full.data);
        }
      } catch (e) {
        console.warn('Falha ao atualizar cabeçalho do banco após salvar:', e);
      }
    } catch (e) {
      console.error('Erro ao salvar questão:', e);
      toast({ description: 'Erro ao salvar questão.', variant: 'destructive' });
    }
  };

  const [openQuestionMenuSource, setOpenQuestionMenuSource] = useState(null); // 'list' | 'header' | null

  const handleToggleQuestionMenu = (e, idx, source = 'list') => {
    e.stopPropagation();
    // Resetar solicitação de exclusão ao alternar o menu
    setPendingDeleteQuestionIndex(null);
    // Se clicar no mesmo idx e mesma origem, alterna fechar
    if (openQuestionMenuIndex === idx && openQuestionMenuSource === source) {
      setOpenQuestionMenuIndex(null);
      setOpenQuestionMenuSource(null);
      return;
    }
    // Caso contrário, abre no idx e define a origem (lista ou cabeçalho)
    setOpenQuestionMenuIndex(idx);
    setOpenQuestionMenuSource(source);
  };

  const handleToggleQuestionDisabled = async (idx) => {
    const q = questions[idx];
    if (!q) return;
    try {
      const updates = {
        name: q.name,
        title: q.title,
        text: q.text,
        body: q.body,
        type: q.type,
        required: q.required,
        disabled: !q.disabled,
        choices: q.choices,
        correctChoiceIndex: q.correctChoiceIndex,
        points: q.points,
        attempts: q.attempts,
      };
      const { data, error } = await questionBankService.updateQuestion(q.id, updates);
      if (error) {
        toast({ description: 'Erro ao atualizar status da questão.', variant: 'destructive' });
        return;
      }
      const meta = (data && data.metadata) || { ...q.metadata };
      meta.disabled = typeof meta.disabled === 'boolean' ? meta.disabled : !q.disabled;
      setQuestions(prev => {
        const next = [...prev];
        next[idx] = { ...q, disabled: !!meta.disabled, metadata: meta };
        return next;
      });
      if (selectedQuestionIndex === idx) {
        updateSelectedQuestion({ disabled: !!meta.disabled, metadata: meta });
      }
      setOpenQuestionMenuIndex(null);
      setOpenQuestionMenuSource(null);
      const msg = meta.disabled ? 'Questão desativada.' : 'Questão ativada.';
      const offlineMsg = questionBankService.isSupabaseAvailable ? '' : ' (modo offline/memória)';
      toast({ description: msg + offlineMsg });
    } catch (e) {
      console.error('Erro ao alternar desativação da questão:', e);
      toast({ description: 'Erro ao alternar desativação.', variant: 'destructive' });
    }
  };

  const handleDeleteQuestion = async (idx) => {
    const q = questions[idx];
    if (!q) return;
    try {
      const { error } = await questionBankService.deleteQuestion(q.id);
      if (error) {
        toast({ description: 'Erro ao excluir a questão.', variant: 'destructive' });
        return;
      }
      setQuestions(prev => {
        const next = [...prev];
        next.splice(idx, 1);
        return next;
      });
      // Ajustar seleção
      setSelectedQuestionIndex(prev => {
        if (prev === null) return prev;
        if (prev === idx) {
          const remaining = questions.length - 1;
          if (remaining <= 0) return null;
          return Math.max(0, idx - 1);
        }
        return prev > idx ? prev - 1 : prev;
      });
      setOpenQuestionMenuIndex(null);
      setOpenQuestionMenuSource(null);
      setPendingDeleteQuestionIndex(null);
      const offlineMsg = questionBankService.isSupabaseAvailable ? '' : ' (modo offline/memória)';
      toast({ description: 'Questão excluída.' + offlineMsg });
      // Atualizar cabeçalho (bancoAtual) com relações para refletir a remoção
      try {
        if (currentBankId) {
          const full = await questionBankService.getBankWithRelations(currentBankId);
          if (full?.data) {
            setBancoAtual(full.data);
          }
        }
      } catch (e) {
        console.warn('Falha ao atualizar cabeçalho do banco após exclusão:', e);
      }
    } catch (e) {
      console.error('Erro ao excluir questão:', e);
      toast({ description: 'Erro ao excluir questão.', variant: 'destructive' });
    }
  };

  const handleDuplicateQuestion = async (idx) => {
    const q = questions[idx];
    if (!q) return;
    try {
      // Extrair escolhas de forma robusta (suporta metadata.choices, .alternatives, .options)
      let clonedChoices = Array.isArray(q.choices) && q.choices.length > 0
        ? [...q.choices]
        : [];
      if (clonedChoices.length === 0 && q.metadata) {
        const m = q.metadata || {};
        const fromMetaChoices = Array.isArray(m.choices) ? m.choices : (
          Array.isArray(m.alternatives) ? m.alternatives : (
            Array.isArray(m.options) ? m.options : []
          )
        );
        clonedChoices = fromMetaChoices.map(c => (typeof c === 'string' ? c : (c?.text || c?.label || '')));
      }

      const base = {
        name: q.name ? `${q.name} (cópia)` : 'Questão (cópia)',
        title: q.title ? `${q.title} (cópia)` : q.title,
        text: q.text,
        body: q.body,
        type: q.type,
        required: q.required,
        disabled: false,
        choices: clonedChoices,
        correctChoiceIndex: typeof q.correctChoiceIndex === 'number' ? q.correctChoiceIndex : null,
        points: typeof q.points === 'number' ? q.points : 0,
        attempts: typeof q.attempts === 'number' ? q.attempts : 0,
        metadata: { ...(q.metadata || {}) },
      };
      // Sincronizar metadata com os valores visíveis na UI para evitar divergências
      base.metadata = {
        ...(q.metadata || {}),
        type: base.type,
        required: base.required,
        disabled: false,
        choices: clonedChoices,
        correctChoiceIndex: base.correctChoiceIndex,
        points: base.points,
        attempts: base.attempts,
        originalId: q.id,
        copiedAt: new Date().toISOString(),
      };

      const { data, error } = await questionBankService.createQuestion(currentBankId, base);
      if (error) {
        toast({ description: 'Erro ao duplicar a questão.', variant: 'destructive' });
        return;
      }
      // Garanta que o objeto inserido no estado tenha o formato esperado pela UI
      const meta = (data && data.metadata) || base.metadata || {};
      const created = {
        ...base,
        id: data?.id ?? base.id,
        title: data?.title ?? base.title,
        body: data?.body ?? base.body,
        metadata: meta,
        // choices e demais campos mantidos em nível superior para a UI
        choices: (() => {
          const arr = Array.isArray(meta.choices) ? meta.choices : (
            Array.isArray(meta.alternatives) ? meta.alternatives : (
              Array.isArray(meta.options) ? meta.options : base.choices
            )
          );
          return arr.map(c => (typeof c === 'string' ? c : (c?.text || c?.label || '')));
        })(),
        correctChoiceIndex: typeof meta.correctChoiceIndex === 'number'
          ? meta.correctChoiceIndex
          : base.correctChoiceIndex,
        points: typeof meta.points === 'number' ? meta.points : base.points,
        attempts: typeof meta.attempts === 'number' ? meta.attempts : base.attempts,
        type: meta.type ?? base.type,
        required: typeof meta.required === 'boolean' ? meta.required : base.required,
        disabled: typeof meta.disabled === 'boolean' ? meta.disabled : false,
      };
      setQuestions((prev) => {
        const next = [...prev];
        next.splice(idx + 1, 0, created);
        return next;
      });
      setSelectedQuestionIndex(idx + 1);
      setOpenQuestionMenuIndex(null);
      setOpenQuestionMenuSource(null);
      const offlineMsg = questionBankService.isSupabaseAvailable ? '' : ' (modo offline/memória)';
      toast({ description: 'Questão duplicada.' + offlineMsg });
      try {
        if (currentBankId) {
          const full = await questionBankService.getBankWithRelations(currentBankId);
          if (full?.data) {
            setBancoAtual(full.data);
          }
        }
      } catch (e) {
        console.warn('Falha ao atualizar cabeçalho do banco após duplicação:', e);
      }
    } catch (e) {
      console.error('Erro ao duplicar questão:', e);
      toast({ description: 'Erro ao duplicar questão.', variant: 'destructive' });
    }
  };

  // Timeout para cancelar automaticamente a intenção de exclusão após alguns segundos
  useEffect(() => {
    if (pendingDeleteQuestionIndex !== null) {
      const t = setTimeout(() => setPendingDeleteQuestionIndex(null), 6000);
      return () => clearTimeout(t);
    }
  }, [pendingDeleteQuestionIndex]);

  const handleCriarComAI = () => {
    // Placeholder para ação futura
    console.log('Criar com A.I. clicado');
    alert('Em breve: criação assistida por A.I.');
  };

  // Estado "Obrigatório" passa a ser por questão (armazenado em questions)
  // Menu de categorias no sidebar direito
  const [isCategoriesOpen, setIsCategoriesOpen] = useState(false);
  // Dropdown de categorias dentro do sidebar
  const [showCategoryDropdown, setShowCategoryDropdown] = useState(false);
  const [categorySearchTerm, setCategorySearchTerm] = useState('');
  const categoryDropdownRef = useRef(null);

  // Estados e dados iguais ao QuestionBankPage
  const [categories, setCategories] = useState([
    { id: 1, name: 'Neurologia', color: '#8B5CF6', description: 'Especialidade médica que trata do sistema nervoso' },
    { id: 2, name: 'Cardiologia', color: '#EF4444', description: 'Especialidade médica que trata do coração e sistema cardiovascular' },
    { id: 3, name: 'Pediatria', color: '#10B981', description: 'Especialidade médica que cuida da saúde de crianças e adolescentes' },
    { id: 4, name: 'Ortopedia', color: '#F59E0B', description: 'Especialidade médica que trata do sistema musculoesquelético' },
    { id: 5, name: 'Dermatologia', color: '#06B6D4', description: 'Especialidade médica que trata da pele e seus anexos' }
  ]);
  const [isCreatingNewCategory, setIsCreatingNewCategory] = useState(false);
  const [newCategoryName, setNewCategoryName] = useState('');
  const [newCategoryColor, setNewCategoryColor] = useState('#8B5CF6');
  const [newCategoryDescription, setNewCategoryDescription] = useState('');
  const [editingCategoryId, setEditingCategoryId] = useState(null);
  const [editCategoryName, setEditCategoryName] = useState('');
  const [editCategoryColor, setEditCategoryColor] = useState('#8B5CF6');
  const [editCategoryDescription, setEditCategoryDescription] = useState('');
  const [pendingDeleteCategoryId, setPendingDeleteCategoryId] = useState(null);

  const filteredCategories = categories.filter(category =>
    category.name.toLowerCase().includes(categorySearchTerm.toLowerCase())
  );

  const handleStartCreatingCategory = () => {
    setIsCreatingNewCategory(true);
    setTimeout(() => {
      if (categoryDropdownRef.current) {
        categoryDropdownRef.current.scrollTop = categoryDropdownRef.current.scrollHeight;
      }
    }, 100);
  };

  const handleCreateNewCategory = () => {
    if (newCategoryName.trim() && newCategoryDescription.trim() &&
        !categories.some(cat => cat.name === newCategoryName.trim())) {
      const newCategory = {
        id: categories.length + 1,
        name: newCategoryName.trim(),
        color: newCategoryColor,
        description: newCategoryDescription.trim()
      };
      setCategories(prev => [...prev, newCategory]);
      setSelectedCategories(prev => {
        if (prev.some(c => c.id === newCategory.id)) return prev;
        return [...prev, newCategory];
      });
      setNewCategoryName('');
      setNewCategoryColor('#8B5CF6');
      setNewCategoryDescription('');
      setIsCreatingNewCategory(false);
      setShowCategoryDropdown(false);
      setCategorySearchTerm('');
    }
  };

  const handleCancelNewCategory = () => {
    setNewCategoryName('');
    setNewCategoryColor('#8B5CF6');
    setNewCategoryDescription('');
    setIsCreatingNewCategory(false);
    setCategorySearchTerm('');
  };

  const handleStartEditCategory = (category) => {
    setEditingCategoryId(category.id);
    setEditCategoryName(category.name);
    setEditCategoryColor(category.color);
    setEditCategoryDescription(category.description || '');
  };

  const handleCancelEditCategory = () => {
    setEditingCategoryId(null);
    setEditCategoryName('');
    setEditCategoryColor('#8B5CF6');
    setEditCategoryDescription('');
  };

  const handleSaveEditCategory = () => {
    if (!editCategoryName.trim() || !editCategoryDescription.trim() || !editingCategoryId) return;
    setCategories(prev => prev.map(cat => (
      cat.id === editingCategoryId
        ? { ...cat, name: editCategoryName.trim(), color: editCategoryColor, description: editCategoryDescription.trim() }
        : cat
    )));
    setEditingCategoryId(null);
    setEditCategoryName('');
    setEditCategoryColor('#8B5CF6');
    setEditCategoryDescription('');
  };

  const handleDeleteCategory = (id) => {
    setCategories(prev => prev.filter(c => c.id !== id));
    setPendingDeleteCategoryId(null);
  };

  // Utilitário simples para converter hex em rgba com alpha
  const toRgba = (hex, alpha = 0.1) => {
    try {
      if (!hex || typeof hex !== 'string' || !hex.startsWith('#')) return `rgba(0,0,0,${alpha})`;
      const h = hex.replace('#', '');
      const full = h.length === 3 ? h.split('').map(c => c + c).join('') : h;
      const num = parseInt(full, 16);
      const r = (num >> 16) & 255;
      const g = (num >> 8) & 255;
      const b = num & 255;
      return `rgba(${r}, ${g}, ${b}, ${alpha})`;
    } catch {
      return `rgba(0,0,0,${alpha})`;
    }
  };

  const handleSelectCategory = (category) => {
    setSelectedCategories(prev => {
      if (prev.some(c => c.id === category.id)) return prev; // evitar duplicatas
      return [...prev, category];
    });
    toast({ description: `Categoria adicionada: ${category.name}` });
    // Fechar dropdown e limpar busca ao selecionar
    setShowCategoryDropdown(false);
    setCategorySearchTerm('');
    setIsCreatingNewCategory(false);
    setEditingCategoryId(null);
    setPendingDeleteCategoryId(null);
  };

  const handleRemoveSelectedCategory = (id) => {
    setSelectedCategories(prev => prev.filter(c => c.id !== id));
    toast({ description: 'Categoria removida' });
  };

  // Fechar dropdowns ao clicar fora da área dos dropdown-containers
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (!event.target.closest('.dropdown-container')) {
        // Categorias
        setShowCategoryDropdown(false);
        setIsCreatingNewCategory(false);
        setCategorySearchTerm('');
        setPendingDeleteCategoryId(null);
        setEditingCategoryId(null);

        // Subcategorias
        setShowSubcategoryDropdown(false);
        setIsCreatingNewSubcategory(false);
        setSubcategorySearchTerm('');
        setPendingDeleteSubcategoryId(null);
        setEditingSubcategoryId(null);
        setNewSubcategoryName('');
        setNewSubcategoryColor('#22C55E');
        setNewSubcategoryDescription('');

        // Tags
        setShowTagsDropdown(false);
        setIsCreatingNewTag(false);
        setTagsSearchTerm('');
        setPendingDeleteTagId(null);
        setEditingTagId(null);
        setNewTagName('');
        setNewTagColor('#0EA5E9');
        setNewTagDescription('');
      }
    };
    // Usar 'click' ao invés de 'mousedown' evita conflitos com onClick dos botões
    document.addEventListener('click', handleClickOutside);
    return () => {
      document.removeEventListener('click', handleClickOutside);
    };
  }, []);

  // Subcategorias: estados, dados e handlers
  const [showSubcategoryDropdown, setShowSubcategoryDropdown] = useState(false);
  const [subcategorySearchTerm, setSubcategorySearchTerm] = useState('');
  const subcategoryDropdownRef = useRef(null);
  const [subcategories, setSubcategories] = useState([
    { id: 1, name: 'Subcategoria A', color: '#22C55E', description: 'Descrição da Subcategoria A' },
    { id: 2, name: 'Subcategoria B', color: '#10B981', description: 'Descrição da Subcategoria B' },
    { id: 3, name: 'Subcategoria C', color: '#34D399', description: 'Descrição da Subcategoria C' },
    { id: 4, name: 'Subcategoria D', color: '#059669', description: 'Descrição da Subcategoria D' },
  ]);
  const [isCreatingNewSubcategory, setIsCreatingNewSubcategory] = useState(false);
  const [newSubcategoryName, setNewSubcategoryName] = useState('');
  const [newSubcategoryColor, setNewSubcategoryColor] = useState('#22C55E');
  const [newSubcategoryDescription, setNewSubcategoryDescription] = useState('');
  const [editingSubcategoryId, setEditingSubcategoryId] = useState(null);
  const [editSubcategoryName, setEditSubcategoryName] = useState('');
  const [editSubcategoryColor, setEditSubcategoryColor] = useState('#22C55E');
  const [editSubcategoryDescription, setEditSubcategoryDescription] = useState('');
  const [pendingDeleteSubcategoryId, setPendingDeleteSubcategoryId] = useState(null);

  const filteredSubcategories = subcategories.filter(subcategory =>
    subcategory.name.toLowerCase().includes(subcategorySearchTerm.toLowerCase())
  );

  const handleStartCreatingSubcategory = () => {
    setIsCreatingNewSubcategory(true);
    setTimeout(() => {
      if (subcategoryDropdownRef.current) {
        subcategoryDropdownRef.current.scrollTop = subcategoryDropdownRef.current.scrollHeight;
      }
    }, 100);
  };

  const handleCreateNewSubcategory = () => {
    if (newSubcategoryName.trim() && newSubcategoryDescription.trim() &&
        !subcategories.some(sc => sc.name === newSubcategoryName.trim())) {
      const newSc = {
        id: subcategories.length + 1,
        name: newSubcategoryName.trim(),
        color: newSubcategoryColor,
        description: newSubcategoryDescription.trim()
      };
      setSubcategories(prev => [...prev, newSc]);
      setSelectedSubcategories(prev => {
        if (prev.some(s => s.id === newSc.id)) return prev;
        return [...prev, newSc];
      });
      setNewSubcategoryName('');
      setNewSubcategoryColor('#22C55E');
      setNewSubcategoryDescription('');
      setIsCreatingNewSubcategory(false);
      setShowSubcategoryDropdown(false);
      setSubcategorySearchTerm('');
    }
  };

  const handleCancelNewSubcategory = () => {
    setNewSubcategoryName('');
    setNewSubcategoryColor('#22C55E');
    setNewSubcategoryDescription('');
    setIsCreatingNewSubcategory(false);
    setSubcategorySearchTerm('');
  };

  const handleStartEditSubcategory = (subcategory) => {
    setEditingSubcategoryId(subcategory.id);
    setEditSubcategoryName(subcategory.name);
    setEditSubcategoryColor(subcategory.color);
    setEditSubcategoryDescription(subcategory.description || '');
  };

  const handleCancelEditSubcategory = () => {
    setEditingSubcategoryId(null);
    setEditSubcategoryName('');
    setEditSubcategoryColor('#22C55E');
    setEditSubcategoryDescription('');
  };

  const handleSaveEditSubcategory = () => {
    if (!editSubcategoryName.trim() || !editSubcategoryDescription.trim() || !editingSubcategoryId) return;
    setSubcategories(prev => prev.map(sc => (
      sc.id === editingSubcategoryId
        ? { ...sc, name: editSubcategoryName.trim(), color: editSubcategoryColor, description: editSubcategoryDescription.trim() }
        : sc
    )));
    setEditingSubcategoryId(null);
    setEditSubcategoryName('');
    setEditSubcategoryColor('#22C55E');
    setEditSubcategoryDescription('');
  };

  const handleDeleteSubcategory = (id) => {
    setSubcategories(prev => prev.filter(s => s.id !== id));
    setPendingDeleteSubcategoryId(null);
  };

  const handleSelectSubcategory = (subcategory) => {
    setSelectedSubcategories(prev => {
      if (prev.some(s => s.id === subcategory.id)) return prev; // evitar duplicatas
      return [...prev, subcategory];
    });
    toast({ description: `Subcategoria adicionada: ${subcategory.name}` });
    // Fechar dropdown e limpar busca ao selecionar
    setShowSubcategoryDropdown(false);
    setSubcategorySearchTerm('');
    setIsCreatingNewSubcategory(false);
    setEditingSubcategoryId(null);
    setPendingDeleteSubcategoryId(null);
  };

  const handleRemoveSelectedSubcategory = (id) => {
    setSelectedSubcategories(prev => prev.filter(s => s.id !== id));
    toast({ description: 'Subcategoria removida' });
  };

  // Tags: estados, dados e handlers
  const [showTagsDropdown, setShowTagsDropdown] = useState(false);
  const [tagsSearchTerm, setTagsSearchTerm] = useState('');
  const tagsDropdownRef = useRef(null);
  const [availableTags, setAvailableTags] = useState([
    { id: 1, name: 'Tag', color: '#FFC107', description: 'Marcador genérico' },
    { id: 2, name: 'Tag', color: '#2196F3', description: 'Etiqueta azul' },
    { id: 3, name: 'Tag', color: '#F44336', description: 'Etiqueta vermelha' },
    { id: 4, name: 'Tag Adicional', color: '#4CAF50', description: 'Etiqueta verde adicional' },
    { id: 5, name: 'Outra Tag', color: '#9C27B0', description: 'Outra etiqueta roxa' }
  ]);
  const [isCreatingNewTag, setIsCreatingNewTag] = useState(false);
  const [newTagName, setNewTagName] = useState('');
  const [newTagColor, setNewTagColor] = useState('#0EA5E9');
  const [newTagDescription, setNewTagDescription] = useState('');
  const [editingTagId, setEditingTagId] = useState(null);
  const [editTagName, setEditTagName] = useState('');
  const [editTagColor, setEditTagColor] = useState('#0EA5E9');
  const [editTagDescription, setEditTagDescription] = useState('');
  const [pendingDeleteTagId, setPendingDeleteTagId] = useState(null);

  const filteredTags = (availableTags || [])
    .filter(tag => !!tag && typeof tag.name === 'string')
    .filter(tag => tag.name.toLowerCase().includes(tagsSearchTerm.toLowerCase()));

  const handleStartCreatingTag = () => {
    setIsCreatingNewTag(true);
    setTimeout(() => {
      if (tagsDropdownRef.current) {
        tagsDropdownRef.current.scrollTop = tagsDropdownRef.current.scrollHeight;
      }
    }, 100);
  };

  const handleCreateNewTag = () => {
    if (newTagName.trim() && newTagDescription.trim() &&
        !availableTags.some(t => t.name === newTagName.trim())) {
      const newTag = {
        id: availableTags.length + 1,
        name: newTagName.trim(),
        color: newTagColor,
        description: newTagDescription.trim()
      };
      setAvailableTags(prev => [...prev, newTag]);
      setSelectedTags(prev => {
        if (prev.some(t => t.id === newTag.id)) return prev;
        return [...prev, newTag];
      });
      setNewTagName('');
      setNewTagColor('#0EA5E9');
      setNewTagDescription('');
      setIsCreatingNewTag(false);
      setShowTagsDropdown(false);
      setTagsSearchTerm('');
    }
  };

  const handleCancelNewTag = () => {
    setNewTagName('');
    setNewTagColor('#0EA5E9');
    setNewTagDescription('');
    setIsCreatingNewTag(false);
    setTagsSearchTerm('');
  };

  const handleStartEditTag = (tag) => {
    setEditingTagId(tag.id);
    setEditTagName(tag.name);
    setEditTagColor(tag.color);
    setEditTagDescription(tag.description || '');
  };

  const handleCancelEditTag = () => {
    setEditingTagId(null);
    setEditTagName('');
    setEditTagColor('#0EA5E9');
    setEditTagDescription('');
  };

  const handleSaveEditTag = () => {
    if (!editTagName.trim() || !editTagDescription.trim() || !editingTagId) return;
    setAvailableTags(prev => prev.map(t => (
      t.id === editingTagId
        ? { ...t, name: editTagName.trim(), color: editTagColor, description: editTagDescription.trim() }
        : t
    )));
    setEditingTagId(null);
    setEditTagName('');
    setEditTagColor('#0EA5E9');
    setEditTagDescription('');
  };

  const handleDeleteTag = (id) => {
    setAvailableTags(prev => prev.filter(t => t.id !== id));
    setPendingDeleteTagId(null);
  };

  const handleAddTag = (tag) => {
    setSelectedTags(prev => {
      if (prev.some(t => t.id === tag.id)) return prev; // evitar duplicatas
      return [...prev, tag];
    });
    toast({ description: `Tag adicionada: ${tag.name}` });
    // Fechar dropdown e limpar busca ao selecionar
    setShowTagsDropdown(false);
    setTagsSearchTerm('');
    setIsCreatingNewTag(false);
    setEditingTagId(null);
    setPendingDeleteTagId(null);
  };

  const handleRemoveSelectedTag = (id) => {
    setSelectedTags(prev => prev.filter(t => t.id !== id));
  };

  const handleCriarBanco = async () => {
    try {
      // Exigir autenticação para garantir persistência no Supabase (RLS)
      if (!user) {
        toast({ description: 'Faça login para salvar no Supabase.', variant: 'destructive' });
        return;
      }
      const navigateToQuestionBank = () => {
        const target = '/banco-de-questoes';
        // Empurra estado mesmo se já estiver na mesma rota
        window.history.pushState({}, '', target);
        window.dispatchEvent(new PopStateEvent('popstate'));
      };
      // Garantir que a questão selecionada (incluindo imagem) seja salva antes do lote
      await handleSalvarQuestao();
      // Salvar todas as questões antes de salvar/criar o banco
      const resumoQuestoes = await handleSalvarTodasQuestoes();
      if (resumoQuestoes.total > 0) {
        const offlineMsg = questionBankService.isSupabaseAvailable ? '' : ' (modo offline/memória)';
        toast({ description: `Questões salvas: ${resumoQuestoes.sucesso}/${resumoQuestoes.total}${offlineMsg}` });
      }
      // Coletar dados atuais do banco e validar obrigatórios
      const shouldActivate = bancoAtual?.status === 'draft';
      // Não aplicar fallback de nome ao salvar: respeitar o valor definido no input
      const effectiveName = (bancoAtual?.name ?? '').trim();
      const effectiveCategory = (selectedCategories[0]?.name || bancoAtual?.category || '').trim();
      const effectiveSubcategory = (selectedSubcategories[0]?.name || bancoAtual?.subcategory || '').trim();
      const effectiveDescription = (bancoAtual?.description || '').trim();
      // Montar dados; se for update e o nome estiver vazio, não enviar 'name' para não sobrescrever
      const baseData = {
        category: effectiveCategory,
        subcategory: effectiveSubcategory,
        tags: selectedTags.map(t => t.name),
        description: effectiveDescription,
        status: shouldActivate ? 'active' : undefined,
      };
      const questionBankData = currentBankId
        ? (effectiveName ? { ...baseData, name: effectiveName } : { ...baseData })
        : { ...baseData, name: effectiveName || 'Banco de questões' };
      // Validação de campos obrigatórios para ativação
      const missingFields = [];
      if (!questionBankData.name?.trim()) missingFields.push('Nome');
      if (!questionBankData.category?.trim()) missingFields.push('Categoria');
      if (!questionBankData.description?.trim()) missingFields.push('Descrição');
      if (shouldActivate && missingFields.length > 0) {
        toast({
          description: `Não foi possível ativar. Corrija: ${missingFields.join(', ')}`,
          variant: 'destructive'
        });
        return;
      }
      if (currentBankId) {
        // Atualizar banco existente
        const { data, error } = await questionBankService.updateQuestionBank(currentBankId, questionBankData);
        if (error) {
          toast({ description: 'Erro ao salvar banco de questões: ' + error, variant: 'destructive' });
        } else {
          const activatedMsg = shouldActivate ? 'Banco ativado com sucesso!' : 'Banco de questões salvo com sucesso!';
          toast({ description: activatedMsg });
          // Recarregar dados do banco atual
          const res = await questionBankService.getBankWithRelations(currentBankId);
          if (res?.data) {
            setBancoAtual(res.data);
          }
        }
        // Redirecionar sempre após salvar/ativar
        navigateToQuestionBank();
      } else {
        // Criar novo banco
        const { data, error } = await questionBankService.createQuestionBank(questionBankData);
        if (error) {
          toast({ description: 'Erro ao criar banco de questões: ' + error, variant: 'destructive' });
          return;
        }
        toast({ description: shouldActivate ? 'Banco ativado com sucesso!' : 'Banco de questões criado com sucesso!' });
        // Navegar para a página de questões do novo banco
        const bankId = data?.id;
        if (questionBankService.isSupabaseAvailable && bankId) {
          const targetUrl = `/questoes?bankId=${encodeURIComponent(bankId)}`;
          window.history.pushState({}, '', targetUrl);
          window.dispatchEvent(new PopStateEvent('popstate'));
        } else {
          toast({ description: 'Sem conexão com Supabase; banco criado localmente e pode não persistir.', variant: 'destructive' });
        }
      }
    } catch (err) {
      console.error('Error creating question bank:', err);
      toast({ description: 'Erro ao conectar com o servidor', variant: 'destructive' });
      // Em caso de erro inesperado, ainda assim voltar
      window.history.pushState({}, '', '/banco-de-questoes');
      window.dispatchEvent(new PopStateEvent('popstate'));
    }
  };

  // Voltar para a página de Banco de Questões
  const handleVoltarParaBancoDeQuestoes = () => {
    toast({ description: 'Voltando para Banco de Questões' });
    window.history.pushState({}, '', '/banco-de-questoes');
    window.dispatchEvent(new PopStateEvent('popstate'));
  };

  return (
    <div className="min-h-screen bg-white flex flex-col">
      <Helmet>
        <title>Questões – Connekt</title>
        <meta name="description" content="Gerencie suas questões dentro do banco." />
      </Helmet>

      {/* Cabeçalho */}
      <div className="h-[59px] border-b border-gray-200 px-5 flex items-center justify-between">
        <div className="flex items-center gap-2.5">
          <button
            type="button"
            aria-label="Fechar"
            className="w-8 h-8 rounded-md bg-gray-100 border border-gray-200 text-gray-600 grid place-items-center"
            onClick={handleVoltarParaBancoDeQuestoes}
          >
            <svg
              xmlns="http://www.w3.org/2000/svg"
              width="16"
              height="16"
              viewBox="0 0 16 16"
              fill="none"
              className="w-4 h-4"
              aria-hidden="true"
            >
              <g clipPath="url(#clip0_768_24326)">
                <path d="M12.5 3.5L3.5 12.5" stroke="#6B7588" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                <path d="M12.5 12.5L3.5 3.5" stroke="#6B7588" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
              </g>
              <defs>
                <clipPath id="clip0_768_24326">
                  <rect width="16" height="16" fill="white" />
                </clipPath>
              </defs>
            </svg>
          </button>

          <div className="flex items-center gap-2">
            <svg
              xmlns="http://www.w3.org/2000/svg"
              width="14"
              height="14"
              viewBox="0 0 14 14"
              fill="none"
              className="w-4 h-4"
              aria-hidden="true"
            >
              <g clipPath="url(#clip0_606_56057)">
                <path d="M7 7H11.8125" stroke="#0047BB" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" />
                <path d="M7 3.5H11.8125" stroke="#0047BB" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" />
                <path d="M7 10.5H11.8125" stroke="#0047BB" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" />
                <path d="M2.1875 3.5L3.0625 4.375L4.8125 2.625" stroke="#0047BB" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" />
                <path d="M2.1875 7L3.0625 7.875L4.8125 6.125" stroke="#0047BB" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" />
                <path d="M2.1875 10.5L3.0625 11.375L4.8125 9.625" stroke="#0047BB" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" />
              </g>
              <defs>
                <clipPath id="clip0_606_56057">
                  <rect width="14" height="14" fill="white" />
                </clipPath>
              </defs>
            </svg>
            <span className="text-sm font-semibold text-black leading-[30px] break-words" style={{ fontFamily: 'Inter' }}>Questões</span>
          </div>
        </div>

        <div className="flex items-center gap-3 h-[35px]">
          <div className="w-px h-6 bg-gray-200" aria-hidden="true" />
          <button
            type="button"
            onClick={handleCriarBanco}
            className="h-[35px] px-4 rounded-[4px] border border-[#0047BB] bg-[#0047BB] text-white hover:bg-[#003a96] font-semibold text-[14px] font-inter"
            style={{ fontSize: '14px', fontFamily: 'Inter', fontWeight: 600, lineHeight: '30px', wordWrap: 'break-word' }}
         >
            {currentBankId ? 'Salvar' : 'Criar banco'}
          </button>
        </div>
      </div>

      {/* Corpo */}
      <div className="flex flex-1 flex-col bg-gray-50">
        {/* Aviso quando nenhum banco está selecionado */}
        {!currentBankId && (
          <div className="px-5 py-4">
            <div className="bg-blue-50 border border-blue-200 rounded-md p-4 text-sm text-blue-800">
              Nenhum banco selecionado. Selecione um banco de questões para carregar.
              <button
                type="button"
                onClick={handleVoltarParaBancoDeQuestoes}
                className="ml-2 underline"
              >
                Ir para bancos
              </button>
            </div>
          </div>
        )}
      {/* Bloco de exibição do banco atual com questões e relações — removido conforme pedido */}

        {/* Área de edição abaixo */}
        <div className="flex flex-1">
          {/* Sidebar esquerda */}
          <aside className="w-72 border-r border-gray-200 bg-gray-100/60 px-5 py-6">
            <div className="flex items-center justify-between">
              <span
                className="text-sm font-semibold leading-[30px] break-words"
                style={{ color: 'var(--Miscellaneous-Window-Grabber, black)', fontFamily: 'Inter' }}
              >
                QUESTÕES
              </span>
              <button
                type="button"
                aria-label="Adicionar"
                className="w-6 h-6 rounded bg-white border border-gray-200 grid place-items-center"
                onClick={handleCriarDoZero}
              >
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  width="16"
                  height="16"
                  viewBox="0 0 16 16"
                  fill="none"
                  className="w-4 h-4"
                  aria-hidden="true"
                >
                  <g clipPath="url(#clip0_768_16604)">
                    <path d="M2.5 8H13.5" stroke="#6B7588" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" />
                    <path d="M8 2.5V13.5" stroke="#6B7588" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" />
                  </g>
                  <defs>
                    <clipPath id="clip0_768_16604">
                      <rect width="16" height="16" fill="white" />
                    </clipPath>
                  </defs>
                </svg>
              </button>
            </div>

            {/* Lista de questões */}
            <div
              className="mt-4 space-y-3"
              tabIndex={0}
              onKeyDown={(e) => {
                if (e.key === 'ArrowDown') {
                  setSelectedQuestionIndex((prev) => {
                    if (prev === null || prev === undefined) return 0;
                    const next = Math.min(prev + 1, questions.length - 1);
                    return next;
                  });
                  setIsCreating(true);
                } else if (e.key === 'ArrowUp') {
                  setSelectedQuestionIndex((prev) => {
                    if (prev === null || prev === undefined) return 0;
                    const next = Math.max(prev - 1, 0);
                    return next;
                  });
                  setIsCreating(true);
                }
              }}
            >
              {questions.map((q, idx) => (
                <div
                  key={idx}
                  className={`relative p-3 cursor-pointer border ${idx === selectedQuestionIndex ? 'rounded-[4px]' : 'rounded-[8px]'} ${idx === selectedQuestionIndex ? '' : 'bg-white border-gray-200'}`}
                  style={idx === selectedQuestionIndex ? {
                    border: '1px solid var(--Stroke-Hover, #0047BB)',
                    background: 'var(--Background-Default, #F9FAFB)',
                    borderRadius: 'var(--Corner-Radius-4px, 4px)'
                  } : undefined}
                  onClick={() => { setSelectedQuestionIndex(idx); setIsCreating(true); }}
                  role="button"
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <span
                        className="flex items-center justify-center content-center flex-wrap w-[20px] h-[20px] aspect-square rounded-[var(--Corner-Radius-4px,4px)] bg-[var(--Button-Default,#0047BB)] text-white text-[12px] font-medium font-inter"
                        style={{ padding: 'var(--Spacing-0px, 0)', gap: '12px var(--Spacing-12px, 12px)' }}
                      >
                        {idx + 1}
                      </span>
                      <span className="text-[12px] font-medium" style={{ color: q.disabled ? '#9CA3AF' : '#737780', fontFamily: 'Inter' }}>
                        {q.name || 'Nome da questão'}{q.disabled ? ' (desativada)' : ''}
                      </span>
                    </div>
                    <button
                      type="button"
                      className="w-6 h-6 rounded grid place-items-center hover:bg-gray-100"
                      onClick={(e) => handleToggleQuestionMenu(e, idx, 'list')}
                      aria-label="Ações da questão"
                    >
                      <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 16 16" fill="none"><path d="M4 8.25C4.41421 8.25 4.75 7.91421 4.75 7.5C4.75 7.08579 4.41421 6.75 4 6.75C3.58579 6.75 3.25 7.08579 3.25 7.5C3.25 7.91421 3.58579 8.25 4 8.25Z" fill="#737780"/><path d="M8 8.25C8.41421 8.25 8.75 7.91421 8.75 7.5C8.75 7.08579 8.41421 6.75 8 6.75C7.58579 6.75 7.25 7.08579 7.25 7.5C7.25 7.91421 7.58579 8.25 8 8.25Z" fill="#737780"/><path d="M12 8.25C12.4142 8.25 12.75 7.91421 12.75 7.5C12.75 7.08579 12.4142 6.75 12 6.75C11.5858 6.75 11.25 7.08579 11.25 7.5C11.25 7.91421 11.5858 8.25 12 8.25Z" fill="#737780"/></svg>
                    </button>
                  </div>
                  {openQuestionMenuIndex === idx && openQuestionMenuSource === 'list' && (
                    <div
                      className="absolute right-3 top-10 z-10 w-56 bg-white border border-gray-200 rounded shadow-sm"
                      tabIndex={0}
                      onKeyDown={(e) => {
                        if (e.key === 'Escape') {
                          e.stopPropagation();
                          setPendingDeleteQuestionIndex(null);
                          setOpenQuestionMenuIndex(null);
                          setOpenQuestionMenuSource(null);
                        }
                      }}
                    >
                      <button
                        type="button"
                        className="w-full text-left px-3 py-2 hover:bg-gray-50 text-[12px]"
                        onClick={(e) => { e.stopPropagation(); handleDuplicateQuestion(idx); }}
                      >
                        {'Duplicar questão'}
                      </button>
                      <button
                        type="button"
                        className="w-full text-left px-3 py-2 hover:bg-gray-50 text-[12px] text-red-600"
                        onClick={(e) => {
                          e.stopPropagation();
                          // Sempre apenas ativa o estado de confirmação; não executa exclusão aqui
                          setPendingDeleteQuestionIndex(idx);
                        }}
                      >
                        {pendingDeleteQuestionIndex === idx ? 'Confirmar exclusão' : 'Excluir questão'}
                      </button>
                      {pendingDeleteQuestionIndex === idx && (
                        <div className="border-t border-gray-200">
                          <div className="px-3 pt-2 text-[11px] text-gray-600">
                            Essa ação é permanente. Clique em “Confirmar” para excluir, ou “Cancelar” para voltar.
                          </div>
                          <div className="flex items-center gap-2 px-3 py-2">
                            <button
                              type="button"
                              className="px-2 py-1 text-[12px] rounded bg-red-50 text-red-600 hover:bg-red-100"
                              onClick={(e) => { e.stopPropagation(); handleDeleteQuestion(idx); }}
                              onKeyDown={(e) => { if (e.key === 'Enter') { e.stopPropagation(); handleDeleteQuestion(idx); } }}
                            >
                              Confirmar
                            </button>
                            <button
                              type="button"
                              className="px-2 py-1 text-[12px] rounded bg-gray-50 text-gray-700 hover:bg-gray-100"
                              onClick={(e) => { e.stopPropagation(); setPendingDeleteQuestionIndex(null); }}
                            >
                              Cancelar
                            </button>
                          </div>
                        </div>
                      )}
                    </div>
                  )}
                  <div className="mt-2 flex items-center gap-2">
                    <span className="inline-flex items-center justify-center w-4 h-4">
                      <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 14 14" fill="none" aria-hidden="true">
                        <g clipPath="url(#clip0_606_56476)">
                          <path d="M7 9.66895C7.09665 9.66895 7.1748 9.7471 7.1748 9.84375C7.1748 9.9404 7.09665 10.0186 7 10.0186C6.90335 10.0186 6.8252 9.9404 6.8252 9.84375C6.8252 9.7471 6.90335 9.66895 7 9.66895Z" fill="#0047BB" stroke="#0047BB" strokeWidth="1.4"/>
                          <path d="M7 12.25C9.8995 12.25 12.25 9.8995 12.25 7C12.25 4.10051 9.8995 1.75 7 1.75C4.10051 1.75 1.75 4.10051 1.75 7C1.75 9.8995 4.10051 12.25 7 12.25Z" stroke="#0047BB" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round"/>
                          <path d="M7 7.65625V7.21875C7.96633 7.21875 8.75 6.53297 8.75 5.6875C8.75 4.84203 7.96633 4.15625 7 4.15625C6.03367 4.15625 5.25 4.84203 5.25 5.6875V5.90625" stroke="#0047BB" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round"/>
                        </g>
                        <defs>
                          <clipPath id="clip0_606_56476">
                            <rect width="14" height="14" fill="white"/>
                          </clipPath>
                        </defs>
                      </svg>
                    </span>
                    <span className="text-[12px] font-medium" style={{ color: '#737780', fontFamily: 'Inter' }}>{q.text || q.body || 'Texto da questão'}</span>
                  </div>
                </div>
              ))}
            </div>
          </aside>
        

        {/* Área principal */}
        <main className="flex-1 p-6">
          {questions.length > 0 ? (
            <div className="w-[951px] mx-auto">
              <div className="bg-white border border-gray-200 rounded-[8px] shadow-sm">
                {/* Header do card */}
                <div className="flex items-center justify-between px-5 py-4 border-b border-gray-200 relative">
                  <div className="flex items-center gap-2">
                    <span className="inline-flex items-center justify-center w-4 h-4">
                      <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 14 14" fill="none" aria-hidden="true">
                        <g clipPath="url(#clip0_606_56476)">
                          <path d="M7 9.66895C7.09665 9.66895 7.1748 9.7471 7.1748 9.84375C7.1748 9.9404 7.09665 10.0186 7 10.0186C6.90335 10.0186 6.8252 9.9404 6.8252 9.84375C6.8252 9.7471 6.90335 9.66895 7 9.66895Z" fill="#0047BB" stroke="#0047BB" strokeWidth="1.4"/>
                          <path d="M7 12.25C9.8995 12.25 12.25 9.8995 12.25 7C12.25 4.10051 9.8995 1.75 7 1.75C4.10051 1.75 1.75 4.10051 1.75 7C1.75 9.8995 4.10051 12.25 7 12.25Z" stroke="#0047BB" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round"/>
                          <path d="M7 7.65625V7.21875C7.96633 7.21875 8.75 6.53297 8.75 5.6875C8.75 4.84203 7.96633 4.15625 7 4.15625C6.03367 4.15625 5.25 4.84203 5.25 5.6875V5.90625" stroke="#0047BB" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round"/>
                        </g>
                        <defs>
                          <clipPath id="clip0_606_56476">
                            <rect width="14" height="14" fill="white"/>
                          </clipPath>
                        </defs>
                      </svg>
                    </span>
                    <span className="text-[12px] font-medium font-inter" style={{ color: '#22252B' }}>Questão de múltipla escolha</span>
                  </div>
                  <div className="flex items-center gap-3">
                    <span className="text-[12px] font-inter" style={{ color: '#737780' }}>Obrigatório</span>
                    {/* Toggle real com cor ativa #0047BB */}
                    <div
                      className="w-9 h-5 rounded-full relative cursor-pointer"
                      style={{ backgroundColor: (selectedQuestionIndex !== null && questions[selectedQuestionIndex]?.required) ? '#0047BB' : '#E5E7EB' }}
                      onClick={() => {
                        if (selectedQuestionIndex !== null) {
                          const currentRequired = questions[selectedQuestionIndex]?.required || false;
                          updateSelectedQuestion({ required: !currentRequired });
                        }
                      }}
                      role="switch"
                      aria-checked={selectedQuestionIndex !== null && !!questions[selectedQuestionIndex]?.required}
                    >
                      <span
                        className="absolute top-0 w-5 h-5 rounded-full bg-white border shadow"
                        style={{
                          left: (selectedQuestionIndex !== null && questions[selectedQuestionIndex]?.required) ? 'calc(100% - 20px)' : 0,
                          borderColor: (selectedQuestionIndex !== null && questions[selectedQuestionIndex]?.required) ? '#0047BB' : '#D1D5DB'
                        }}
                      />
                    </div>
                    <button
                      type="button"
                      className="w-6 h-6 rounded grid place-items-center hover:bg-gray-100"
                      onClick={(e) => {
                        if (selectedQuestionIndex !== null) {
                          handleToggleQuestionMenu(e, selectedQuestionIndex, 'header');
                        }
                      }}
                      aria-label="Ações da questão"
                    >
                      <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 16 16" fill="none">
                        <path d="M4 8.25C4.41421 8.25 4.75 7.91421 4.75 7.5C4.75 7.08579 4.41421 6.75 4 6.75C3.58579 6.75 3.25 7.08579 3.25 7.5C3.25 7.91421 3.58579 8.25 4 8.25Z" fill="#737780"></path>
                        <path d="M8 8.25C8.41421 8.25 8.75 7.91421 8.75 7.5C8.75 7.08579 8.41421 6.75 8 6.75C7.58579 6.75 7.25 7.08579 7.25 7.5C7.25 7.91421 7.58579 8.25 8 8.25Z" fill="#737780"></path>
                        <path d="M12 8.25C12.4142 8.25 12.75 7.91421 12.75 7.5C12.75 7.08579 12.4142 6.75 12 6.75C11.5858 6.75 11.25 7.08579 11.25 7.5C11.25 7.91421 11.5858 8.25 12 8.25Z" fill="#737780"></path>
                      </svg>
                    </button>
                    {openQuestionMenuIndex === selectedQuestionIndex && openQuestionMenuSource === 'header' && selectedQuestionIndex !== null && (
                      <div
                        className="absolute right-5 top-12 z-20 w-56 bg-white border border-gray-200 rounded shadow-sm"
                        tabIndex={0}
                        onKeyDown={(e) => {
                          if (e.key === 'Escape') {
                            e.stopPropagation();
                            setPendingDeleteQuestionIndex(null);
                            setOpenQuestionMenuIndex(null);
                            setOpenQuestionMenuSource(null);
                          }
                        }}
                      >
                        <button
                          type="button"
                          className="w-full text-left px-3 py-2 hover:bg-gray-50 text-[12px]"
                          onClick={(e) => { e.stopPropagation(); handleDuplicateQuestion(selectedQuestionIndex); }}
                        >
                          {'Duplicar questão'}
                        </button>
                        <button
                          type="button"
                          className="w-full text-left px-3 py-2 hover:bg-gray-50 text-[12px] text-red-600"
                          onClick={(e) => {
                            e.stopPropagation();
                            setPendingDeleteQuestionIndex(selectedQuestionIndex);
                          }}
                        >
                          {pendingDeleteQuestionIndex === selectedQuestionIndex ? 'Confirmar exclusão' : 'Excluir questão'}
                        </button>
                        {pendingDeleteQuestionIndex === selectedQuestionIndex && (
                          <div className="border-t border-gray-200">
                            <div className="px-3 pt-2 text-[11px] text-gray-600">
                              Essa ação é permanente. Clique em “Confirmar” para excluir, ou “Cancelar” para voltar.
                            </div>
                            <div className="flex items-center gap-2 px-3 py-2">
                              <button
                                type="button"
                                className="px-2 py-1 text-[12px] rounded bg-red-50 text-red-600 hover:bg-red-100"
                                onClick={(e) => { e.stopPropagation(); handleDeleteQuestion(selectedQuestionIndex); }}
                                onKeyDown={(e) => { if (e.key === 'Enter') { e.stopPropagation(); handleDeleteQuestion(selectedQuestionIndex); } }}
                              >
                                Confirmar
                              </button>
                              <button
                                type="button"
                                className="px-2 py-1 text-[12px] rounded bg-gray-50 text-gray-700 hover:bg-gray-100"
                                onClick={(e) => { e.stopPropagation(); setPendingDeleteQuestionIndex(null); }}
                              >
                                Cancelar
                              </button>
                            </div>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                </div>

                {/* Corpo do card */}
                <div className="px-5 py-4">
                  {/* Campo título da questão */}
                  <div className="mb-4 flex items-start gap-3">
                  <div className="w-[523px] box-border">
                  <div className="flex items-center rounded-[8px] pl-0 pr-3 py-2 w-[523px] box-border">
                    <div className="flex items-center gap-2 w-[467px] shrink-0 box-border bg-[#F6F5FA] px-3 py-2 rounded-[4px]">
                      <span className="w-[20px] h-[20px] rounded bg-blue-600 text-white text-[12px] grid place-items-center">
                        {selectedQuestionIndex !== null ? (selectedQuestionIndex + 1) : ''}
                      </span>
                      <span className="text-[14px] font-semibold font-inter leading-[18px]" style={{ color: 'var(--Typography-Title, #22252B)', wordWrap: 'break-word' }}>Questão:</span>
                      <input
                        type="text"
                        placeholder="Digite aqui o nome de identificação da questão"
                        value={selectedQuestionIndex !== null && questions[selectedQuestionIndex] ? (questions[selectedQuestionIndex].name || '') : ''}
                        onChange={(e) => {
                          const val = e.target.value;
                          if (selectedQuestionIndex !== null) {
                            setQuestions(prev => {
                              const next = [...prev];
                              if (next[selectedQuestionIndex]) {
                                next[selectedQuestionIndex] = { ...next[selectedQuestionIndex], name: val };
                              }
                              return next;
                            });
                          }
                        }}
                        className="flex-1 min-w-0 h-[30px] px-3 bg-transparent outline-none text-[14px] leading-[20px] font-normal font-inter break-words placeholder:text-[var(--Typography-Placeholder,#ABADB3)]"
                      />
                    </div>
                    <div className="flex items-center gap-2">
                      {/* Botão de imagem (agora à esquerda) */}
                      <button
                        type="button"
                        className="w-6 h-6"
                        style={{
                          display: 'flex',
                          padding: 'var(--Spacing-4px, 4px)',
                          alignItems: 'center',
                          alignContent: 'center',
                          gap: '12px var(--Spacing-12px, 12px)',
                          flexWrap: 'wrap',
                          borderRadius: 'var(--Corner-Radius-4px, 4px)',
                          border: `1px solid ${(() => {
                            const current = getSelectedQuestion();
                            const meta = (current && current.metadata) || {};
                            const candidates = [
                              current?.image,
                              current?.imageUrl,
                              current?.image_url,
                              current?.cover,
                              current?.capa,
                              current?.thumbnail,
                              meta?.image,
                              meta?.imageUrl,
                              meta?.image_url,
                              meta?.cover,
                              meta?.capa,
                              meta?.thumbnail,
                            ];
                            const saved = candidates.find(v => typeof v === 'string' && v.trim().length > 0);
                            const hasImage = !!(saved || selectedImage);
                            return hasImage ? '#0047BB' : 'var(--Stroke-Default, #E3E4E5)';
                          })()}`,
                          background: 'var(--Background-Default, #F9FAFB)'
                        }}
                        onClick={handleSwitchToImageUpload}
                        aria-label="Selecionar imagem"
                      >
                        <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 16 16" fill="none" className="w-4 h-4 aspect-square" aria-hidden="true">
                          <g clipPath="url(#clip0_597_7236)">
                            <path d="M13 2.5H3C2.72386 2.5 2.5 2.72386 2.5 3V13C2.5 13.2761 2.72386 13.5 3 13.5H13C13.2761 13.5 13.5 13.2761 13.5 13V3C13.5 2.72386 13.2761 2.5 13 2.5Z" stroke="#6B7588" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round"/>
                            <path d="M6 7C6.55228 7 7 6.55228 7 6C7 5.44772 6.55228 5 6 5C5.44772 5 5 5.44772 5 6C5 6.55228 5.44772 7 6 7Z" stroke="#6B7588" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round"/>
                            <path d="M3.54297 13.5004L10.3961 6.64664C10.4425 6.60015 10.4977 6.56328 10.5584 6.53811C10.6191 6.51295 10.6841 6.5 10.7498 6.5C10.8156 6.5 10.8806 6.51295 10.9413 6.53811C11.002 6.56328 11.0572 6.60015 11.1036 6.64664L13.4998 9.04352" stroke="#6B7588" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round"/>
                          </g>
                          <defs>
                            <clipPath id="clip0_597_7236">
                              <rect width="16" height="16" fill="white"/>
                            </clipPath>
                          </defs>
                        </svg>
                      </button>
                      {/* Botão de câmera/vídeo (agora à direita) */}
                      <button
                        type="button"
                        className="w-6 h-6"
                        style={{
                          display: 'flex',
                          padding: 'var(--Spacing-4px, 4px)',
                          alignItems: 'center',
                          alignContent: 'center',
                          gap: '12px var(--Spacing-12px, 12px)',
                          flexWrap: 'wrap',
                          borderRadius: 'var(--Corner-Radius-4px, 4px)',
                          border: `1px solid ${(() => {
                            const current = getSelectedQuestion();
                            const meta = (current && current.metadata) || {};
                            const candidates = [
                              meta?.videoUrl,
                              meta?.video_url,
                              meta?.video,
                              current?.videoUrl,
                              current?.video_url,
                              current?.video,
                            ];
                            const saved = candidates.find(v => typeof v === 'string' && v.trim().length > 0);
                            const hasVideo = !!(saved || selectedVideo);
                            return hasVideo ? '#0047BB' : 'var(--Stroke-Default, #E3E4E5)';
                          })()}`,
                          background: 'var(--Background-Default, #F9FAFB)'
                        }}
                        onClick={handleSwitchToVideoUpload}
                        aria-label="Selecionar vídeo"
                      >
                        <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true">
                          <g clipPath="url(#clip0_828_24506)">
                            <path d="M12 4H2C1.72386 4 1.5 4.22386 1.5 4.5V11.5C1.5 11.7761 1.72386 12 2 12H12C12.2761 12 12.5 11.7761 12.5 11.5V4.5C12.5 4.22386 12.2761 4 12 4Z" stroke="#6B7588" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" />
                            <path d="M12.5 7L15.5 5V11L12.5 9" stroke="#6B7588" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" />
                          </g>
                          <defs>
                            <clipPath id="clip0_828_24506">
                              <rect width="16" height="16" fill="white" />
                            </clipPath>
                          </defs>
                        </svg>
                      </button>
                      {/* Input de arquivo oculto para o botão de imagem */}
                      
                    </div>
                  </div>
                    <textarea
                      placeholder="Adicione aqui a sua pergunta..."
                      className="w-[523px] h-[120px] px-3 py-2 rounded-[var(--Corner-Radius-4px,4px)] bg-[var(--Background-Content,#F6F5FA)] border border-gray-200 text-[12px] font-inter"
                      value={getSelectedQuestion()?.text || ''}
                      onChange={(e) => {
                        updateSelectedQuestion({ text: e.target.value });
                      }}
                    />
                  </div>
                  {/* Box de upload à direita do textarea (aparece ao clicar no botão) */}
                  {showUploadBox && (
                    <div className="self-end mb-[2px]">
                      {isUploading ? (
                        <div className="p-6 h-[120px] w-full max-w-[360px] rounded-md text-center text-[12px] bg-white border-2 border-dashed border-[#0047BB]">
                          <div className="flex flex-col items-center justify-center gap-2">
                            {(() => {
                              const radius = 16;
                              const circumference = 2 * Math.PI * radius;
                              const offset = circumference * (1 - uploadProgress / 100);
                              return (
                                <div className="relative w-10 h-10">
                                  <svg width="40" height="40" viewBox="0 0 40 40">
                                    <circle cx="20" cy="20" r={radius} stroke="#0047BB" strokeWidth="4" opacity="0.3" fill="none" />
                                    <circle cx="20" cy="20" r={radius} stroke="#0047BB" strokeWidth="4" fill="none" strokeDasharray={circumference} strokeDashoffset={offset} transform="rotate(-90 20 20)" />
                                  </svg>
                                  <span className="absolute inset-0 flex items-center justify-center text-[12px] text-[#22252B]">{Math.round(uploadProgress)}%</span>
                                </div>
                              );
                            })()}
                            <p className="text-[#22252B]">Carregando...</p>
                          </div>
                        </div>
                      ) : uploadMode === 'image' ? (
                        (() => {
                          // Usar preview salvo da questão mesmo sem selectedImage
                          const current = getSelectedQuestion();
                          const meta = (current && current.metadata) || {};
                          const savedUrl = [
                            // Preferir sempre URL definida em metadata (padrão novo)
                            meta?.imageUrl,
                            meta?.image_url,
                            meta?.image,
                            meta?.thumbnail,
                            meta?.cover,
                            meta?.capa,
                            // Campos antigos/alternativos do objeto raiz
                            current?.imageUrl,
                            current?.image_url,
                            current?.image,
                            current?.thumbnail,
                            current?.cover,
                            current?.capa,
                          ].find(v => typeof v === 'string' && v.trim().length > 0) || null;
                          const hasPreview = !!(selectedImage || savedUrl);
                          return hasPreview ? (
                        <div
                          className="relative p-4 h-[120px] w-full max-w-[360px] rounded-md text-[12px] bg-white border-2 border-dashed border-[#0047BB]"
                        >
                          {/* Botão de remoção (X) */}
                          <button
                            type="button"
                            aria-label="Remover imagem"
                            className="absolute top-2 right-2 w-5 h-5 rounded-full bg-red-500 text-white text-[10px] flex items-center justify-center"
                            onClick={(e) => { e.stopPropagation(); handleRemoveSelectedImage(); setShowUploadBox(false); }}
                            title="Remover imagem"
                          >
                            ×
                          </button>
                          <div className="flex items-center gap-3">
                            <img src={previewUrl || savedUrl || '/Produtos - Cores.png'} alt={selectedImage?.name || 'Imagem da questão'} className="w-[120px] h-[80px] rounded object-cover" />
                            <div>
                              {(() => {
                                // Nome do arquivo: se for File, usa file.name; se for URL, extrai basename
                                let displayName = 'Imagem';
                                if (selectedImage && selectedImage instanceof File) {
                                  displayName = selectedImage.name || 'Imagem';
                                } else {
                                  const src = previewUrl || savedUrl || '';
                                  if (typeof src === 'string' && src.trim().length > 0) {
                                    try {
                                      const u = new URL(src);
                                      const base = (u.pathname || '').split('/').pop() || '';
                                      displayName = decodeURIComponent(base) || 'Imagem';
                                    } catch {
                                      const noQuery = src.split('?')[0];
                                      const base = (noQuery || '').split('/').pop() || '';
                                      displayName = decodeURIComponent(base) || 'Imagem';
                                    }
                                  }
                                }
                                return (
                                  <p className="text-[#1E1B39] font-inter font-medium text-[14px]">{displayName}</p>
                                );
                              })()}
                              <p className="text-[#9291A5] font-inter text-[12px]">Tamanho: {selectedImage?.size ? `${(selectedImage.size / (1024 * 1024)).toFixed(1)}MB` : '—'}</p>
                              {/* Removido bloco de exibição de URL/preview do Supabase por solicitação */}
                            </div>
                          </div>
                          {/* Input de arquivo oculto para re-seleção no estado de preview */}
                          <input
                            key={imageFileInputKey}
                            ref={imageFileInputRef}
                            type="file"
                            accept="image/png,image/jpeg"
                            className="hidden"
                            onChange={handleImageFileChange}
                          />
                        </div>
                          ) : (
                        <div className="p-6 h-[120px] rounded-md text-center text-[12px] bg-white border-2 border-dashed border-[#0047BB]">
                          <button
                            type="button"
                            className="w-full h-full cursor-pointer hover:bg-gray-50 rounded-md flex flex-col items-center justify-center gap-2"
                            onClick={handleOpenImageFileDialog}
                            aria-label="Selecionar imagem"
                          >
                            <img src="/icone%20backup%20simulados.png" alt="Upload" className="w-[36px] h-[36px]" />
                            <p className="text-[#22252B]">
                              Clique para selecionar uma imagem
                            </p>
                            <p className="text-[#9AA0A6]">Max 10 MB, formato: PNG ou JPEG</p>
                          </button>
                          {/* Input de arquivo oculto */}
                          <input
                            key={imageFileInputKey}
                            ref={imageFileInputRef}
                            type="file"
                            accept="image/png,image/jpeg"
                            className="hidden"
                            onChange={handleImageFileChange}
                          />
                        </div>
                          );
                        })()
                      ) : (
                        /* uploadMode === 'video' */
                        (() => {
                          const current = getSelectedQuestion();
                          const meta = (current && current.metadata) || {};
                          const savedUrl = [
                            meta?.videoUrl,
                            meta?.video_url,
                            meta?.video,
                            current?.videoUrl,
                            current?.video_url,
                            current?.video,
                          ].find(v => typeof v === 'string' && v.trim().length > 0) || null;
                          const hasPreview = !!(selectedVideo || savedUrl);
                          return hasPreview ? (
                          <div className="relative p-4 h-[120px] rounded-md text-[12px] bg-white border-2 border-dashed border-[#0047BB]">
                            {/* Remover vídeo */}
                            <button
                              type="button"
                              aria-label="Remover vídeo"
                              className="absolute top-2 right-2 w-5 h-5 rounded-full bg-red-500 text-white text-[10px] flex items-center justify-center"
                              onClick={(e) => { e.stopPropagation(); handleRemoveSelectedVideo(); }}
                              title="Remover vídeo"
                            >
                              ×
                            </button>
                            <div className="flex items-center gap-3">
                              <video src={videoPreviewUrl || savedUrl || ''} className="w-[120px] h-[80px] rounded object-cover" controls />
                              <div>
                                <p className="text-[#1E1B39] font-inter font-medium text-[14px]">{selectedVideo?.name || 'Vídeo'}</p>
                                <p className="text-[#9291A5] font-inter text-[12px]">Tamanho: {selectedVideo?.size ? `${(selectedVideo.size / (1024 * 1024)).toFixed(1)}MB` : '—'}</p>
                              </div>
                            </div>
                            <input
                              ref={videoFileInputRef}
                              type="file"
                              accept="video/mp4,video/webm,video/ogg"
                              className="hidden"
                              onChange={handleVideoFileChange}
                            />
                          </div>
                        ) : (
                          <button
                            type="button"
                            className="p-6 h-[120px] rounded-md text-center text-[12px] bg-white border-2 border-dashed border-[#0047BB] cursor-pointer w-full"
                            onClick={handleOpenVideoFileDialog}
                            aria-label="Selecionar vídeo"
                          >
                            <div className="flex flex-col items-center justify-center gap-2">
                              <img
                                src="/icone backup simulados.png"
                                alt="Selecionar vídeo"
                                className="w-[36px] h-[36px] select-none"
                                draggable={false}
                                decoding="async"
                                loading="lazy"
                              />
                              <p className="text-[#22252B]">
                                Arraste o vídeo aqui ou
                                <span className="text-[#0047BB] underline ml-1">selecione clicando aqui</span>
                              </p>
                              <p className="text-[#9AA0A6]">Max 50 MB, formato: MP4/WebM/Ogg</p>
                              <input
                                ref={videoFileInputRef}
                                type="file"
                                accept="video/mp4,video/webm,video/ogg"
                                className="hidden"
                                onChange={handleVideoFileChange}
                              />
                            </div>
                          </button>
                          );
                        })()
                      )}
                    </div>
                  )}
                  </div>

                  {/* Escolhas */}
                  <div className="mb-4">
                    <span
                      className="block mb-2"
                      style={{
                        color: 'var(--Typography-Title, #22252B)',
                        fontFamily: 'var(--Font-Family-Family, Inter)',
                        fontSize: 'var(--Font-Size-Body-14px, 14px)',
                        fontStyle: 'normal',
                        fontWeight: 400,
                        lineHeight: '20px',
                      }}
                    >
                      Escolhas:
                    </span>

                    {(getSelectedQuestion()?.choices || []).map((value, idx) => (
                      <div key={idx} className="flex items-center gap-3 mb-2">
                        <span
                          onClick={() => {
                            const current = getSelectedQuestion();
                            if (!current) return;
                            const nextIndex = current.correctChoiceIndex === idx ? null : idx;
                            updateSelectedQuestion({ correctChoiceIndex: nextIndex });
                          }}
                          className={`inline-flex items-center justify-center h-[46px] w-[34px] rounded-[var(--Corner-Radius-4px,4px)] ${(getSelectedQuestion()?.correctChoiceIndex === idx) ? 'bg-[#06C270]' : 'bg-[var(--Background-Content,#F6F5FA)]'} cursor-pointer`}
                          style={{
                            color: (getSelectedQuestion()?.correctChoiceIndex === idx) ? '#EBEBEB' : 'var(--Typography-Title, #22252B)',
                            fontFamily: 'var(--Font-Family-Family, Inter)',
                            fontSize: 'var(--Font-Size-Body-14px, 14px)',
                            fontStyle: 'normal',
                            fontWeight: 600,
                            lineHeight: 'var(--Font-Size-Line-Height-Subtitle, 30px)'
                          }}
                          title="Marcar como correta"
                        >
                          {String.fromCharCode(65 + idx)}
                        </span>
                        <input
                          type="text"
                          value={value}
                          placeholder="Digite sua escolha aqui."
                          className="flex-1 h-[32px] px-3 rounded-[var(--Corner-Radius-4px,4px)] bg-[var(--Background-Content,#F6F5FA)] text-[12px] font-inter"
                         onChange={(e) => {
                            const val = e.target.value;
                            const current = getSelectedQuestion();
                            if (!current) return;
                            const nextChoices = Array.isArray(current.choices) ? [...current.choices] : [];
                            nextChoices[idx] = val;
                            updateSelectedQuestion({ choices: nextChoices });
                          }}
                        />
                        <button
                          type="button"
                          className="h-[32px] px-3 rounded-[var(--Corner-Radius-4px,4px)] bg-[var(--Background-Content,#F6F5FA)] text-[12px] font-inter"
                          onClick={() => {
                            setChoiceRichEditorOpen((prev) => ({ ...prev, [idx]: !prev[idx] }));
                          }}
                          title={(() => {
                            const html = (getSelectedQuestion()?.metadata?.choicesTextHtml?.[idx]) || '';
                            const hasText = typeof html === 'string' && html.replace(/<[^>]+>/g, '').trim().length > 0;
                            return hasText ? 'Editar texto da escolha' : 'Adicionar texto para esta escolha';
                          })()}
                        >
                          {(() => {
                            const html = (getSelectedQuestion()?.metadata?.choicesTextHtml?.[idx]) || '';
                            const hasText = typeof html === 'string' && html.replace(/<[^>]+>/g, '').trim().length > 0;
                            return hasText ? 'Editar texto' : 'Adicionar texto';
                          })()}
                        </button>
                        {(() => {
                          const html = (getSelectedQuestion()?.metadata?.choicesTextHtml?.[idx]) || '';
                          const hasText = typeof html === 'string' && html.replace(/<[^>]+>/g, '').trim().length > 0;
                          return hasText ? (
                            <span
                              className="ml-2 px-2 py-1 text-[11px] rounded bg-white border border-[#E6E8EB] text-[#22252B]"
                              title="Esta escolha tem texto adicional"
                            >
                              Texto adicionado
                            </span>
                          ) : null;
                        })()}
                        {choiceRichEditorOpen[idx] ? (
                          <div className="mt-2 w-full p-2 rounded-[4px] bg-[var(--Background-Content,#F6F5FA)] border border-[#E6E8EB]">
                            <div className="flex items-center gap-2 mb-2">
                              <button
                                type="button"
                                className="px-2 py-1 text-[12px] text-[#22252B] bg-white rounded border border-[#E6E8EB]"
                                onClick={(e) => {
                                  const editor = e.currentTarget.closest('div')?.querySelector('.choice-rich-editor');
                                  if (editor) { editor.focus(); document.execCommand('bold'); }
                                }}
                                title="Negrito"
                              >B</button>
                              <button
                                type="button"
                                className="px-2 py-1 text-[12px] text-[#22252B] bg-white rounded border border-[#E6E8EB] italic"
                                onClick={(e) => {
                                  const editor = e.currentTarget.closest('div')?.querySelector('.choice-rich-editor');
                                  if (editor) { editor.focus(); document.execCommand('italic'); }
                                }}
                                title="Itálico"
                              >I</button>
                              <button
                                type="button"
                                className="px-2 py-1 text-[12px] text-[#22252B] bg-white rounded border border-[#E6E8EB] underline"
                                onClick={(e) => {
                                  const editor = e.currentTarget.closest('div')?.querySelector('.choice-rich-editor');
                                  if (editor) { editor.focus(); document.execCommand('underline'); }
                                }}
                                title="Sublinhado"
                              >U</button>
                              <button
                                type="button"
                                className="px-2 py-1 text-[12px] text-[#22252B] bg-white rounded border border-[#E6E8EB]"
                                onClick={(e) => {
                                  const editor = e.currentTarget.closest('div')?.querySelector('.choice-rich-editor');
                                  if (editor) { editor.focus(); document.execCommand('insertUnorderedList'); }
                                }}
                                title="Lista"
                              >• Lista</button>
                              <button
                                type="button"
                                className="px-2 py-1 text-[12px] text-[#6B7588] bg-white rounded border border-[#E6E8EB]"
                                onClick={(e) => {
                                  const editor = e.currentTarget.closest('div')?.querySelector('.choice-rich-editor');
                                  if (editor) { editor.focus(); document.execCommand('removeFormat'); }
                                }}
                                title="Limpar formatação"
                              >Limpar</button>
                              <div className="flex-1" />
                              <button
                                type="button"
                                className="px-2 py-1 text-[12px] text-white bg-[#22252B] rounded"
                                onClick={async () => {
                                  setChoiceRichEditorOpen((prev) => ({ ...prev, [idx]: false }));
                                  try {
                                    const metaChoices = (getSelectedQuestion()?.metadata?.choicesTextHtml) || {};
                                    await persistSelectedQuestionExtras({ choicesTextHtml: metaChoices });
                                  } catch (err) {
                                    console.warn('Persistência de texto rico falhou:', err);
                                  }
                                }}
                              >Concluir</button>
                            </div>
                            <div
                              className="choice-rich-editor min-h-[80px] max-h-[220px] overflow-auto px-3 py-2 bg-white rounded border border-[#E6E8EB] text-[14px]"
                              contentEditable
                              suppressContentEditableWarning
                              dangerouslySetInnerHTML={{ __html: (getSelectedQuestion()?.metadata?.choicesTextHtml?.[idx]) || '' }}
                              onInput={(e) => {
                                const html = e.currentTarget.innerHTML;
                                const current = getSelectedQuestion();
                                if (!current) return;
                                const nextText = { ...((current.metadata && current.metadata.choicesTextHtml) || {}) };
                                nextText[idx] = html;
                                updateSelectedQuestion({ metadata: { ...(current.metadata || {}), choicesTextHtml: nextText } });
                              }}
                              placeholder="Digite o comentário rico da escolha aqui..."
                            />
                          </div>
                        ) : null}
                        {/* Imagem da escolha: upload/URL/preview */}
                        <div className="flex items-center gap-2">
                          {/* input file oculto por escolha */}
                          <input
                            type="file"
                            accept="image/*"
                            className="hidden choice-image-input"
                            onChange={async (e) => {
                              try {
                                const file = e.target.files && e.target.files[0];
                                if (!file) return;
                                const current = getSelectedQuestion();
                                if (!current) return;
                                // Mostrar preview imediato com URL local para dar feedback
                                const tempUrl = URL.createObjectURL(file);
                                {
                                  const nextChoicesMedia = { ...(current.choicesMedia || {}) };
                                  nextChoicesMedia[idx] = { ...(nextChoicesMedia[idx] || {}), imageUrl: tempUrl };
                                  updateSelectedQuestion({ choicesMedia: nextChoicesMedia, metadata: { ...(current.metadata || {}), choicesMedia: nextChoicesMedia } });
                                }
                                const bankIdFallback = currentBankId
                                  || (bancoAtual && bancoAtual.id)
                                  || current.question_bank_id
                                  || (current.metadata && current.metadata.bankId)
                                  || null;
                                const res = await questionBankService.uploadQuestionImage(file, { bankId: bankIdFallback, questionId: current.id });
                                const finalUrl = (res && res.url) || '';
                                if (finalUrl) {
                                  const nextChoicesMedia = { ...(current.choicesMedia || {}) };
                                  nextChoicesMedia[idx] = { ...(nextChoicesMedia[idx] || {}), imageUrl: finalUrl };
                                  updateSelectedQuestion({ choicesMedia: nextChoicesMedia, metadata: { ...(current.metadata || {}), choicesMedia: nextChoicesMedia } });
                                  try { await persistSelectedQuestionExtras({ choicesMedia: nextChoicesMedia }); } catch {}
                                  try { URL.revokeObjectURL(tempUrl); } catch {}
                                }
                              } catch (err) {
                                toast({ description: 'Falha ao enviar imagem da escolha.', variant: 'destructive' });
                              } finally {
                                // limpar para permitir novo upload do mesmo arquivo
                                e.target.value = '';
                              }
                            }}
                          />
                          <button
                            type="button"
                            className="h-[32px] px-3 rounded-[var(--Corner-Radius-4px,4px)] bg-[var(--Background-Content,#F6F5FA)] text-[12px] font-inter"
                            onClick={(evt) => {
                              const input = evt.currentTarget.parentElement?.querySelector('.choice-image-input');
                              if (input) input.click();
                            }}
                            title={(() => {
                              const url = (getSelectedQuestion()?.choicesMedia?.[idx]?.imageUrl) || '';
                              const hasImage = typeof url === 'string' && url.trim().length > 0;
                              return hasImage ? 'Alterar imagem da escolha' : 'Enviar imagem para esta escolha';
                            })()}
                          >
                            {(() => {
                              const url = (getSelectedQuestion()?.choicesMedia?.[idx]?.imageUrl) || '';
                              const hasImage = typeof url === 'string' && url.trim().length > 0;
                              return hasImage ? 'Alterar imagem' : 'Adicionar imagem';
                            })()}
                          </button>
                          {(() => {
                            const url = (getSelectedQuestion()?.choicesMedia?.[idx]?.imageUrl) || '';
                            const hasImage = typeof url === 'string' && url.trim().length > 0;
                            return hasImage ? (
                              <span
                                className="ml-2 px-2 py-1 text-[11px] rounded bg-white border border-[#E6E8EB] text-[#22252B]"
                                title="Esta escolha tem uma imagem adicionada"
                              >
                                Imagem adicionada
                              </span>
                            ) : null;
                          })()}
                          {/* input file oculto por escolha (vídeo) */}
                          <input
                            type="file"
                            accept="video/*"
                            className="hidden choice-video-input"
                            onChange={async (e) => {
                              try {
                                const file = e.target.files && e.target.files[0];
                                if (!file) return;
                                const current = getSelectedQuestion();
                                if (!current) return;
                                // Preview imediato com URL local
                                const tempUrl = URL.createObjectURL(file);
                                {
                                  const nextChoicesMedia = { ...(current.choicesMedia || {}) };
                                  nextChoicesMedia[idx] = { ...(nextChoicesMedia[idx] || {}), videoUrl: tempUrl };
                                  updateSelectedQuestion({ choicesMedia: nextChoicesMedia, metadata: { ...(current.metadata || {}), choicesMedia: nextChoicesMedia } });
                                }
                                const bankIdFallback = currentBankId
                                  || (bancoAtual && bancoAtual.id)
                                  || current.question_bank_id
                                  || (current.metadata && current.metadata.bankId)
                                  || null;
                                const res = await questionBankService.uploadQuestionVideo(file, { bankId: bankIdFallback, questionId: current.id });
                                const finalUrl = (res && res.url) || '';
                                if (finalUrl) {
                                  const nextChoicesMedia = { ...(current.choicesMedia || {}) };
                                  nextChoicesMedia[idx] = { ...(nextChoicesMedia[idx] || {}), videoUrl: finalUrl };
                                  updateSelectedQuestion({ choicesMedia: nextChoicesMedia, metadata: { ...(current.metadata || {}), choicesMedia: nextChoicesMedia } });
                                  try { await persistSelectedQuestionExtras({ choicesMedia: nextChoicesMedia }); } catch {}
                                  try { URL.revokeObjectURL(tempUrl); } catch {}
                                }
                              } catch (err) {
                                toast({ description: 'Falha ao enviar vídeo da escolha.', variant: 'destructive' });
                              } finally {
                                e.target.value = '';
                              }
                            }}
                          />
                          <button
                            type="button"
                            className="h-[32px] px-3 rounded-[var(--Corner-Radius-4px,4px)] bg-[var(--Background-Content,#F6F5FA)] text-[12px] font-inter"
                            onClick={(evt) => {
                              const input = evt.currentTarget.parentElement?.querySelector('.choice-video-input');
                              if (input) input.click();
                            }}
                            title={(() => {
                              const url = (getSelectedQuestion()?.choicesMedia?.[idx]?.videoUrl) || '';
                              const hasVideo = typeof url === 'string' && url.trim().length > 0;
                              return hasVideo ? 'Alterar vídeo da escolha' : 'Enviar vídeo para esta escolha';
                            })()}
                          >
                            {(() => {
                              const url = (getSelectedQuestion()?.choicesMedia?.[idx]?.videoUrl) || '';
                              const hasVideo = typeof url === 'string' && url.trim().length > 0;
                              return hasVideo ? 'Alterar vídeo' : 'Adicionar vídeo';
                            })()}
                          </button>
                          {(() => {
                            const url = (getSelectedQuestion()?.choicesMedia?.[idx]?.videoUrl) || '';
                            const hasVideo = typeof url === 'string' && url.trim().length > 0;
                            return hasVideo ? (
                              <span
                                className="ml-2 px-2 py-1 text-[11px] rounded bg-white border border-[#E6E8EB] text-[#22252B]"
                                title="Esta escolha tem um vídeo adicionada"
                              >
                                Vídeo adicionado
                              </span>
                            ) : null;
                          })()}
                          {getSelectedQuestion()?.choicesMedia?.[idx]?.imageUrl ? (
                            <div className="flex items-center gap-1">
                              <img
                                src={getSelectedQuestion()?.choicesMedia?.[idx]?.imageUrl}
                                alt={`Imagem da escolha ${String.fromCharCode(65 + idx)}`}
                                className="h-8 w-8 rounded-[4px] object-cover"
                              />
                              <button
                                type="button"
                                className="text-[12px] text-[#6B7588] hover:text-[#22252B]"
                                title="Remover imagem"
                                onClick={() => {
                                  const current = getSelectedQuestion();
                                  if (!current) return;
                                  const nextChoicesMedia = { ...(current.choicesMedia || {}) };
                                  nextChoicesMedia[idx] = { ...(nextChoicesMedia[idx] || {}), imageUrl: '' };
                                  updateSelectedQuestion({
                                    choicesMedia: nextChoicesMedia,
                                    metadata: { ...(current.metadata || {}), choicesMedia: nextChoicesMedia }
                                  });
                                  try { persistSelectedQuestionExtras({ choicesMedia: nextChoicesMedia }); } catch {}
                                }}
                              >
                                ×
                              </button>
                            </div>
                          ) : null}
                          {getSelectedQuestion()?.choicesMedia?.[idx]?.videoUrl ? (
                            <div className="flex items-center gap-1">
                              <video
                                src={getSelectedQuestion()?.choicesMedia?.[idx]?.videoUrl}
                                className="h-8 w-14 rounded-[4px]"
                                controls
                              />
                              <button
                                type="button"
                                className="text-[12px] text-[#6B7588] hover:text-[#22252B]"
                                title="Remover vídeo"
                                onClick={() => {
                                  const current = getSelectedQuestion();
                                  if (!current) return;
                                  const nextChoicesMedia = { ...(current.choicesMedia || {}) };
                                  nextChoicesMedia[idx] = { ...(nextChoicesMedia[idx] || {}), videoUrl: '' };
                                  updateSelectedQuestion({
                                    choicesMedia: nextChoicesMedia,
                                    metadata: { ...(current.metadata || {}), choicesMedia: nextChoicesMedia }
                                  });
                                  try { persistSelectedQuestionExtras({ choicesMedia: nextChoicesMedia }); } catch {}
                                }}
                              >
                                ×
                              </button>
                            </div>
                          ) : null}
                        </div>
                        <button
                          type="button"
                          className="flex flex-wrap items-center content-center p-[var(--Spacing-8px,8px)] gap-y-[12px] gap-x-[var(--Spacing-12px,12px)] rounded-[var(--Corner-Radius-4px,4px)] bg-[var(--Background-Content,#F6F5FA)]"
                          onClick={async () => {
                            const current = getSelectedQuestion();
                            if (!current) return;
                            const nextChoices = (current.choices || []).filter((_, i) => i !== idx);
                            // Se remover a correta, limpa o índice
                            const nextCorrect = current.correctChoiceIndex === idx ? null : (
                              current.correctChoiceIndex !== null && current.correctChoiceIndex > idx
                                ? current.correctChoiceIndex - 1
                                : current.correctChoiceIndex
                            );
                            // remover mídia associada, se houver
                            const nextChoicesMedia = { ...(current.choicesMedia || {}) };
                            if (nextChoicesMedia[idx]) {
                              const rebuilt = {};
                              Object.keys(nextChoicesMedia).forEach((k) => {
                                const keyNum = parseInt(k, 10);
                                if (keyNum < idx) {
                                  rebuilt[keyNum] = nextChoicesMedia[keyNum];
                                } else if (keyNum > idx) {
                                  // shift para manter alinhamento com índices
                                  rebuilt[keyNum - 1] = nextChoicesMedia[keyNum];
                                }
                              });
                              // Ajustar comentários ricos por escolha (choicesTextHtml) ao remover
                              const metaChoicesText = (current.metadata && current.metadata.choicesTextHtml) || {};
                              const textRebuilt = {};
                              Object.keys(metaChoicesText).forEach((k) => {
                                const keyNum = parseInt(k, 10);
                                if (keyNum < idx) {
                                  textRebuilt[keyNum] = metaChoicesText[keyNum];
                                } else if (keyNum > idx) {
                                  textRebuilt[keyNum - 1] = metaChoicesText[keyNum];
                                }
                              });
                              updateSelectedQuestion({ choices: nextChoices, correctChoiceIndex: nextCorrect, choicesMedia: rebuilt, metadata: { ...(current.metadata || {}), choicesMedia: rebuilt, choicesTextHtml: textRebuilt } });
                              persistSelectedQuestionExtras({ choicesMedia: rebuilt, choicesTextHtml: textRebuilt }, { choices: nextChoices, correctChoiceIndex: nextCorrect }).catch(() => {})
                              // Ajustar estado de abertura do editor rico
                              setChoiceRichEditorOpen((prev) => {
                                const next = {};
                                Object.keys(prev || {}).forEach((k) => {
                                  const keyNum = parseInt(k, 10);
                                  if (keyNum < idx) next[keyNum] = prev[keyNum];
                                  else if (keyNum > idx) next[keyNum - 1] = prev[keyNum];
                                });
                                return next;
                              });
                            } else {
                              // Mesmo sem mídia, ajustar choicesTextHtml
                              const metaChoicesText = (current.metadata && current.metadata.choicesTextHtml) || {};
                              const textRebuilt = {};
                              Object.keys(metaChoicesText).forEach((k) => {
                                const keyNum = parseInt(k, 10);
                                if (keyNum < idx) {
                                  textRebuilt[keyNum] = metaChoicesText[keyNum];
                                } else if (keyNum > idx) {
                                  textRebuilt[keyNum - 1] = metaChoicesText[keyNum];
                                }
                              });
                              updateSelectedQuestion({ choices: nextChoices, correctChoiceIndex: nextCorrect, metadata: { ...(current.metadata || {}), choicesTextHtml: textRebuilt } });
                              persistSelectedQuestionExtras({ choicesTextHtml: textRebuilt }, { choices: nextChoices, correctChoiceIndex: nextCorrect }).catch(() => {})
                              setChoiceRichEditorOpen((prev) => {
                                const next = {};
                                Object.keys(prev || {}).forEach((k) => {
                                  const keyNum = parseInt(k, 10);
                                  if (keyNum < idx) next[keyNum] = prev[keyNum];
                                  else if (keyNum > idx) next[keyNum - 1] = prev[keyNum];
                                });
                                return next;
                              });
                            }
                          }}
                        >
                          <svg
                            xmlns="http://www.w3.org/2000/svg"
                            width="16"
                            height="16"
                            viewBox="0 0 16 16"
                            fill="none"
                            className="w-4 h-4 aspect-square"
                          >
                            <g clipPath="url(#clip0_597_16648)">
                              <path d="M13.5 3.5H2.5" stroke="#6B7588" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" />
                              <path d="M6.5 6.5V10.5" stroke="#6B7588" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" />
                              <path d="M9.5 6.5V10.5" stroke="#6B7588" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" />
                              <path d="M12.5 3.5V13C12.5 13.1326 12.4473 13.2598 12.3536 13.3536C12.2598 13.4473 12.1326 13.5 12 13.5H4C3.86739 13.5 3.74021 13.4473 3.64645 13.3536C3.55268 13.2598 3.5 13.1326 3.5 13V3.5" stroke="#6B7588" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" />
                              <path d="M10.5 3.5V2.5C10.5 2.23478 10.3946 1.98043 10.2071 1.79289C10.0196 1.60536 9.76522 1.5 9.5 1.5H6.5C6.23478 1.5 5.98043 1.60536 5.79289 1.79289C5.60536 1.98043 5.5 2.23478 5.5 2.5V3.5" stroke="#6B7588" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" />
                            </g>
                            <defs>
                              <clipPath id="clip0_597_16648">
                                <rect width="16" height="16" fill="white" />
                              </clipPath>
                            </defs>
                          </svg>
                        </button>
                      </div>
                    ))}

                    <button
                      type="button"
                      className="mt-2 inline-flex items-center justify-center gap-2"
                      style={{
                        color: 'var(--Typography-Title-Color, #0047BB)',
                        textAlign: 'center',
                        fontFamily: 'var(--Font-Family-Family, Inter)',
                        fontSize: 'var(--Font-Size-Body-14px, 14px)',
                        fontStyle: 'normal',
                        fontWeight: 600,
                        lineHeight: 'var(--Font-Size-Line-Height-Subtitle, 30px)'
                      }}
                      onClick={() => {
                        const current = getSelectedQuestion();
                        if (!current) return;
                        const nextChoices = [...(current.choices || []), ''];
                        updateSelectedQuestion({ choices: nextChoices });
                      }}
                    >
                      <svg
                        xmlns="http://www.w3.org/2000/svg"
                        width="16"
                        height="16"
                        viewBox="0 0 16 16"
                        fill="none"
                        className="w-4 h-4 aspect-square"
                        aria-hidden="true"
                      >
                        <g clipPath="url(#clip0_300_24706)">
                          <path d="M2.5 8H13.5" stroke="#0047BB" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round"/>
                          <path d="M8 2.5V13.5" stroke="#0047BB" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round"/>
                        </g>
                        <defs>
                          <clipPath id="clip0_300_24706">
                            <rect width="16" height="16" fill="white"/>
                          </clipPath>
                        </defs>
                      </svg>
                      Add resposta
                    </button>
                  </div>

                  {/* Rodapé de pontos/tentativas */}
                  <div
                    className="flex items-start gap-[var(--Spacing-32px,32px)] pt-[var(--Spacing-22px,22px)]"
                    style={{ alignSelf: 'stretch', borderTop: '1px solid var(--Stroke-Default, #E3E4E5)' }}
                  >
                    <div className="flex items-center gap-3">
                      <div>
                        <span
                          className="font-inter"
                          style={{
                            color: 'var(--Typography-Title, #22252B)',
                            fontFamily: 'var(--Font-Family-Family, Inter)',
                            fontSize: 'var(--Font-Size-Body-14px, 14px)',
                            fontStyle: 'normal',
                            fontWeight: 400,
                            lineHeight: '20px'
                          }}
                        >
                          Pontos
                        </span>
                        <div className="mt-1 flex items-center h-[40px] py-[var(--Spacing-12px,12px)] px-[var(--Spacing-18px,18px)] gap-[var(--Spacing-16px,16px)] rounded-[var(--Corner-Radius-4px,4px)] bg-[var(--Background-Content,#F6F5FA)]">
                          <input
                            type="number"
                            value={getSelectedQuestion()?.points ?? 0}
                            onChange={(e) => {
                              const val = parseInt(e.target.value || '0', 10);
                              updateSelectedQuestion({ points: isNaN(val) ? 0 : val });
                            }}
                            className="w-[40px] h-[30px] px-2 rounded-[4px] bg-transparent"
                            style={{
                              color: 'var(--Typography-Title, #22252B)',
                              fontFamily: 'var(--Font-Family-Family, Inter)',
                              fontSize: 'var(--Font-Size-Body-12px, 12px)',
                              fontStyle: 'normal',
                              fontWeight: 500,
                              lineHeight: 'var(--Font-Size-Line-Height-Caption, 18px)'
                            }}
                          />
                          <span className="w-px h-[20px] bg-gray-200" aria-hidden="true"></span>
                          <div className="flex items-center gap-[var(--Spacing-0px,0)]">
                            <span
                              className="font-inter"
                              style={{
                                color: 'var(--Typography-Title, #22252B)',
                                fontFamily: 'var(--Font-Family-Family, Inter)',
                                fontSize: 'var(--Font-Size-Body-14px, 14px)',
                                fontStyle: 'normal',
                                fontWeight: 400,
                                lineHeight: '20px'
                              }}
                            >
                              Pontos
                            </span>
                            <svg
                              xmlns="http://www.w3.org/2000/svg"
                              width="14"
                              height="14"
                              viewBox="0 0 14 14"
                              fill="none"
                              className="w-[14px] h-[14px] aspect-square"
                              aria-hidden="true"
                            >
                              <rect width="14" height="14" rx="7" fill="#FFCC00" />
                              <g clipPath="url(#clip0_300_24719)">
                                <path d="M9.49165 6.69153L8.43696 7.60161L8.75829 8.96262C8.77602 9.03651 8.77145 9.11399 8.74517 9.18528C8.71888 9.25657 8.67206 9.31847 8.61062 9.36316C8.54917 9.40785 8.47586 9.43333 8.39994 9.43638C8.32402 9.43943 8.2489 9.4199 8.18407 9.38028L7.00047 8.65184L5.81618 9.38028C5.75136 9.41968 5.67633 9.43901 5.60054 9.43585C5.52475 9.43269 5.45159 9.40718 5.39027 9.36253C5.32895 9.31787 5.28222 9.25607 5.25595 9.18491C5.22968 9.11375 5.22506 9.03641 5.24266 8.96262L5.56516 7.60161L4.51047 6.69153C4.45312 6.64196 4.41164 6.5766 4.39122 6.5036C4.3708 6.43059 4.37233 6.35319 4.39563 6.28106C4.41894 6.20893 4.46297 6.14526 4.52225 6.098C4.58152 6.05075 4.6534 6.022 4.72891 6.01536L6.11172 5.9038L6.64516 4.61286C6.67403 4.5425 6.72318 4.48232 6.78634 4.43997C6.84951 4.39761 6.92384 4.375 6.99989 4.375C7.07594 4.375 7.15027 4.39761 7.21343 4.43997C7.2766 4.48232 7.32574 4.5425 7.35461 4.61286L7.88782 5.9038L9.27063 6.01536C9.34629 6.02176 9.41838 6.05034 9.47787 6.09753C9.53736 6.14472 9.5816 6.20842 9.60505 6.28064C9.62849 6.35286 9.63011 6.43039 9.60968 6.50353C9.58926 6.57666 9.54771 6.64214 9.49024 6.69176L9.49165 6.69153Z" fill="#22252B" />
                              </g>
                              <defs>
                                <clipPath id="clip0_300_24719">
                                  <rect width="6" height="6" fill="white" transform="translate(4 4)" />
                                </clipPath>
                              </defs>
                            </svg>
                          </div>
                        </div>
                      </div>
                    </div>
                    <div>
                      <span
                        className="font-inter"
                        style={{
                          color: 'var(--Typography-Title, #22252B)',
                          fontFamily: 'var(--Font-Family-Family, Inter)',
                          fontSize: 'var(--Font-Size-Body-14px, 14px)',
                          fontStyle: 'normal',
                          fontWeight: 400,
                          lineHeight: '20px'
                        }}
                      >
                        Tentativas
                      </span>
                      <div className="mt-1 flex items-center h-[40px] py-[var(--Spacing-12px,12px)] px-[var(--Spacing-18px,18px)] gap-[var(--Spacing-16px,16px)] rounded-[var(--Corner-Radius-4px,4px)] bg-[var(--Background-Content,#F6F5FA)]">
                        <input
                          type="number"
                          value={getSelectedQuestion()?.attempts ?? 0}
                          onChange={(e) => {
                            const val = parseInt(e.target.value || '0', 10);
                            updateSelectedQuestion({ attempts: isNaN(val) ? 0 : val });
                          }}
                          className="w-[40px] h-[30px] px-2 rounded-[4px] bg-transparent"
                          style={{
                            color: 'var(--Typography-Title, #22252B)',
                            fontFamily: 'var(--Font-Family-Family, Inter)',
                            fontSize: 'var(--Font-Size-Body-12px, 12px)',
                            fontStyle: 'normal',
                            fontWeight: 500,
                            lineHeight: 'var(--Font-Size-Line-Height-Caption, 18px)'
                          }}
                        />
                        <span className="w-px h-[20px] bg-gray-200" aria-hidden="true"></span>
                        <svg
                          xmlns="http://www.w3.org/2000/svg"
                          width="12"
                          height="12"
                          viewBox="0 0 12 12"
                          fill="none"
                          className="w-[12px] h-[12px] aspect-square"
                          aria-hidden="true"
                        >
                          <g clipPath="url(#clip0_300_24727)">
                            <path d="M7.875 4.5H10.125V2.25" stroke="#0047BB" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round"/>
                            <path d="M10.125 4.4986L8.79938 3.17297C8.03167 2.4053 6.99228 1.97123 5.90662 1.96491C4.82096 1.9586 3.77659 2.38054 3 3.13922" stroke="#0047BB" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round"/>
                            <path d="M4.125 7.5H1.875V9.75" stroke="#0047BB" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round"/>
                            <path d="M1.875 7.5L3.20062 8.82562C3.96833 9.5933 5.00772 10.0274 6.09338 10.0337C7.17904 10.04 8.22341 9.61806 9 8.85937" stroke="#0047BB" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round"/>
                          </g>
                          <defs>
                            <clipPath id="clip0_300_24727">
                              <rect width="12" height="12" fill="white"/>
                            </clipPath>
                          </defs>
                        </svg>
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              {/* Ações abaixo do card */}
              <div className="flex items-center justify-center px-5 py-4">
                <button
                  type="button"
                  className="flex items-center justify-center h-[35px] py-[10px] px-[var(--Spacing-18px,18px)] gap-[6px] rounded-[var(--Corner-Radius-4px,4px)] bg-[var(--Background-Content,#F6F5FA)] text-[12px] text-[#22252B] font-inter"
                  onClick={handleCriarDoZero}
                >
                  <svg
                    xmlns="http://www.w3.org/2000/svg"
                    width="16"
                    height="16"
                    viewBox="0 0 16 16"
                    fill="none"
                    className="w-[16px] h-[16px] aspect-square"
                    aria-hidden="true"
                  >
                    <g clipPath="url(#clip0_300_26333)">
                      <path d="M2.5 8H13.5" stroke="#0047BB" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round"/>
                      <path d="M8 2.5V13.5" stroke="#0047BB" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round"/>
                    </g>
                    <defs>
                      <clipPath id="clip0_300_26333">
                        <rect width="16" height="16" fill="white"/>
                      </clipPath>
                    </defs>
                  </svg>
                  <span
                    className="font-inter text-center"
                    style={{
                      color: 'var(--Typography-Title-Color, #0047BB)',
                      fontFamily: 'var(--Font-Family-Family, Inter)',
                      fontSize: 'var(--Font-Size-Body-14px, 14px)',
                      fontStyle: 'normal',
                      fontWeight: 600,
                      lineHeight: 'var(--Font-Size-Line-Height-Subtitle, 30px)',
                      textAlign: 'center'
                    }}
                  >
                    Add nova questão
                  </span>
                </button>
                {/* Botão Salvar recolocado nesta área */}
              </div>
            </div>
          ) : (
            <div className="h-full grid place-items-center">
              <div className="text-center max-w-md flex flex-col justify-start gap-[22px]">
                <img
                  src="/1.svg"
                  alt="Ilustração banco vazio"
                  className="mx-auto w-[160px] h-[160px] opacity-80"
                />
                <div className="flex flex-col gap-[22px]">
                  <h2
                    className="text-base font-semibold"
                    style={{ color: 'var(--Typography-Title, #22252B)', fontSize: '16px', fontFamily: 'Inter', fontWeight: 600, lineHeight: '30px', wordWrap: 'break-word' }}
                  >
                    Banco vazio!
                  </h2>
                  <p
                    className="text-sm"
                    style={{ color: 'var(--Typography-Subtitle, #737780)', fontSize: '14px', fontFamily: 'Inter', fontWeight: 500, lineHeight: '18px', wordWrap: 'break-word' }}
                  >
                    Você não possui nenhuma questão neste banco de questões, adicione agora sua primeira questão
                  </p>
                </div>

                <div className="flex items-center justify-center gap-3">
                  <button
                    type="button"
                    onClick={handleCriarDoZero}
                    className="inline-flex items-center justify-center gap-2 px-4 rounded border border-blue-600 hover:bg-blue-50"
                    style={{ width: '146px', height: '35px', color: 'var(--Typography-Title-Color, #0047BB)', fontSize: '14px', fontFamily: 'Inter', fontWeight: 600, lineHeight: '30px', wordWrap: 'break-word' }}
                  >
                    <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true">
                      <g clipPath="url(#clip0_606_56106)">
                        <path d="M5.79313 13.5001H3C2.86739 13.5001 2.74021 13.4474 2.64645 13.3536C2.55268 13.2599 2.5 13.1327 2.5 13.0001V10.207C2.50006 10.0745 2.55266 9.94753 2.64625 9.85383L10.3538 2.14633C10.4475 2.05263 10.5746 2 10.7072 2C10.8397 2 10.9669 2.05263 11.0606 2.14633L13.8538 4.93758C13.9474 5.03134 14.0001 5.15847 14.0001 5.29102C14.0001 5.42357 13.9474 5.5507 13.8538 5.64446L6.14625 13.3538C6.05255 13.4474 5.92556 13.5 5.79313 13.5001Z" stroke="#0047BB" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"/>
                        <path d="M8.5 4L12 7.5" stroke="#0047BB" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"/>
                      </g>
                      <defs>
                        <clipPath id="clip0_606_56106">
                          <rect width="16" height="16" fill="white"/>
                        </clipPath>
                      </defs>
                    </svg>
                    {' '}Criar do zero
                  </button>
                </div>
              </div>
            </div>
          )}
        </main>

        {/* Sidebar direita com menu de categorias */}
        <aside
          className={`${isCategoriesOpen ? 'w-[300px] px-4 pt-4' : 'w-14 px-0 pt-[22px]'} bg-white`}
          style={{ borderLeft: '1px solid #E3E4E5' }}
        >
          {!isCategoriesOpen && (
            <div className="flex items-center justify-center">
              <button
                type="button"
                aria-label="Abrir menu de categorias"
                className="w-8 h-8 rounded grid place-items-center"
                style={{ backgroundColor: '#F6F5FA' }}
                onClick={() => setIsCategoriesOpen(true)}
              >
                <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 16 16" fill="none" className="w-4 h-4" aria-hidden="true">
                  <g clipPath="url(#clip0_768_18957)">
                    <path d="M12.1481 12.2775L15 8L12.1481 3.7225C12.1025 3.65409 12.0407 3.598 11.9682 3.55919C11.8957 3.52038 11.8147 3.50005 11.7325 3.5H2.5C2.36739 3.5 2.24021 3.55268 2.14645 3.64645C2.05268 3.74021 2 3.86739 2 4V12C2 12.1326 2.05268 12.2598 2.14645 12.3536C2.24021 12.4473 2.36739 12.5 2.5 12.5H11.7325C11.8147 12.5 11.8957 12.4796 11.9682 12.4408C12.0407 12.402 12.1025 12.3459 12.1481 12.2775Z" stroke="#22252B" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round"/>
                  </g>
                  <defs>
                    <clipPath id="clip0_768_18957">
                      <rect width="16" height="16" fill="white" />
                    </clipPath>
                  </defs>
                </svg>
              </button>
            </div>
          )}

          {isCategoriesOpen && (
            <div className="flex flex-col h-full">
              <div className="flex items-center justify-between mb-4">
                <span className="text-sm font-semibold" style={{ color: '#22252B', fontFamily: 'Inter' }}>
                  Classificação do banco de questões
                </span>
                <button
                  type="button"
                  aria-label="Fechar menu de categorias"
                  className="w-7 h-7 rounded grid place-items-center hover:bg-gray-100"
                  onClick={() => setIsCategoriesOpen(false)}
                >
                  <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 16 16" fill="none" className="w-4 h-4" aria-hidden="true">
                    <path d="M12 4L4 12" stroke="#6B7588" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"/>
                    <path d="M4 4L12 12" stroke="#6B7588" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"/>
                  </svg>
                </button>
              </div>

              <div className="space-y-6 overflow-visible">
                {/* Categorias */}
                <div className="relative dropdown-container">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-sm font-medium" style={{ color: '#737780', fontFamily: 'Inter' }}>Categorias</span>
                    <button
                      type="button"
                      className="w-7 h-7 rounded-full flex items-center justify-center hover:bg-gray-200 transition-colors"
                      style={{ background: 'none' }}
                      aria-label="Adicionar categoria"
                      onClick={() => setShowCategoryDropdown(prev => !prev)}
                    >
                      <Plus className="w-4 h-4 text-gray-600" />
                    </button>
                  </div>

                  {showCategoryDropdown && (
                    <div 
                      ref={categoryDropdownRef}
                      className="absolute top-8 left-0 bg-white border border-gray-200 rounded-lg shadow-lg z-10 min-w-[280px] dropdown-container"
                    >
                      <div className="p-3">
                        {/* Botão para fechar dropdown */}
                        <div className="flex items-center justify-end mb-2">
                          <button
                            type="button"
                            aria-label="Fechar dropdown"
                            className="w-6 h-6 rounded flex items-center justify-center hover:bg-gray-100"
                            onClick={() => {
                              setShowCategoryDropdown(false);
                              setIsCreatingNewCategory(false);
                              setCategorySearchTerm('');
                            }}
                          >
                            <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 16 16" fill="none" className="w-4 h-4" aria-hidden="true">
                              <path d="M12 4L4 12" stroke="#6B7588" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"/>
                              <path d="M4 4L12 12" stroke="#6B7588" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"/>
                            </svg>
                          </button>
                        </div>
                        {/* Campo de pesquisa */}
                        <div className="mb-3">
                          <input
                            type="text"
                            placeholder="Pesquisar categorias..."
                            value={categorySearchTerm}
                            onChange={(e) => setCategorySearchTerm(e.target.value)}
                            className="w-full px-3 py-2 text-sm border border-gray-200 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                            style={{ fontFamily: 'Inter', fontSize: '14px' }}
                          />
                        </div>

                        {/* Lista de categorias filtradas (apenas esta parte scrolla) */}
                        <div className="max-h-80 overflow-y-auto overflow-x-hidden">
                          {filteredCategories.map((category) => (
                            <div key={category.id} className="px-3 py-2 rounded-md transition-colors">
                              {editingCategoryId === category.id ? (
                                <div className="space-y-2">
                                  <input
                                    type="text"
                                    placeholder="Nome da categoria"
                                    value={editCategoryName}
                                    onChange={(e) => setEditCategoryName(e.target.value)}
                                    className="w-full px-3 py-2 text-sm border border-gray-200 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                                    style={{ fontFamily: 'Inter', fontSize: '14px' }}
                                  />
                                  <div className="flex items-center gap-2">
                                    <input
                                      type="text"
                                      placeholder="Descrição"
                                      value={editCategoryDescription}
                                      onChange={(e) => setEditCategoryDescription(e.target.value)}
                                      className="flex-1 px-3 py-2 text-sm border border-gray-200 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                                      style={{ fontFamily: 'Inter', fontSize: '14px' }}
                                    />
                                    <input
                                      type="color"
                                      value={editCategoryColor}
                                      onChange={(e) => setEditCategoryColor(e.target.value)}
                                      className="w-10 h-10 rounded-md border border-gray-200"
                                    />
                                  </div>
                                  <div className="flex items-center gap-2">
                                    <button onClick={handleSaveEditCategory} className="px-3 py-2 text-sm bg-blue-600 text-white rounded-md hover:bg-blue-700">Salvar</button>
                                    <button onClick={handleCancelEditCategory} className="px-3 py-2 text-sm rounded-md hover:bg-gray-100">Cancelar</button>
                                  </div>
                                </div>
                              ) : (
                                <div
                                  className="flex items-center gap-2 hover:bg-gray-50 rounded-md cursor-pointer"
                                  onClick={() => handleSelectCategory(category)}
                                >
                                  <div
                                    className="w-3 h-3 rounded-full flex-shrink-0"
                                    style={{ backgroundColor: category.color }}
                                  ></div>
                                  <div className="flex-1">
                                    <div className="font-medium" style={{ fontFamily: 'Inter', fontSize: '14px', color: '#374151' }}>{category.name}</div>
                                    <div className="text-xs text-gray-500 mt-0.5">{category.description}</div>
                                  </div>
                                  <div className="flex items-center gap-1 pr-2">
                                    <button
                                      onClick={(e) => { e.stopPropagation(); setPendingDeleteCategoryId(category.id); }}
                                      className="w-6 h-6 rounded flex items-center justify-center hover:bg-gray-100"
                                      aria-label="Excluir"
                                    >
                                      <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="w-4 h-4" aria-hidden="true" style={{ color: '#EF4444' }}>
                                        <polyline points="3 6 5 6 21 6"/>
                                        <path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/>
                                        <path d="M10 11v6"/>
                                        <path d="M14 11v6"/>
                                        <path d="M9 6V4a2 2 0 0 1 2-2h2a2 2 0 0 1 2 2v2"/>
                                      </svg>
                                    </button>
                                    <button
                                      onClick={(e) => { e.stopPropagation(); handleStartEditCategory(category); }}
                                      className="w-6 h-6 rounded flex items-center justify-center hover:bg-gray-100"
                                      aria-label="Editar"
                                    >
                                      <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="w-4 h-4" aria-hidden="true">
                                        <path d="M12 20h9"/>
                                        <path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4 12.5-12.5z"/>
                                      </svg>
                                    </button>
                                  </div>
                                </div>
                              )}

                              {pendingDeleteCategoryId === category.id && (
                                <div className="flex items-center justify-end gap-2 mt-2 pr-2">
                                  <button onClick={() => setPendingDeleteCategoryId(null)} className="text-xs px-2 py-1 rounded hover:bg-gray-100">Cancelar</button>
                                  <button onClick={() => handleDeleteCategory(category.id)} className="text-xs px-2 py-1 rounded bg-red-50 text-red-600 hover:bg-red-100">Excluir</button>
                                </div>
                              )}
                            </div>
                          ))}

                          {/* Mensagem quando não há categorias */}
                          {filteredCategories.length === 0 && categorySearchTerm && (
                            <div className="px-3 py-2 text-sm text-gray-500 text-center">
                              Nenhuma categoria encontrada
                            </div>
                          )}
                        </div>

                        {/* Separador */}
                        {filteredCategories.length > 0 && (
                          <div className="border-t border-gray-200 my-2"></div>
                        )}

                        {/* Opção para criar nova categoria */}
                        {!isCreatingNewCategory ? (
                          <button
                            onClick={(e) => { e.stopPropagation(); handleStartCreatingCategory(); }}
                            className="w-full text-left px-3 py-2 text-sm hover:bg-blue-50 rounded-md transition-colors flex items-center gap-2"
                            style={{ fontFamily: 'Inter', fontSize: '14px', color: '#2563eb' }}
                          >
                            <Plus className="w-4 h-4" />
                            Criar nova categoria
                          </button>
                        ) : (
                          <div className="space-y-3">
                            <input
                              type="text"
                              placeholder="Nome da nova categoria"
                              value={newCategoryName}
                              onChange={(e) => setNewCategoryName(e.target.value)}
                              className="w-full px-3 py-2 text-sm border border-gray-200 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                              style={{ fontFamily: 'Inter', fontSize: '14px' }}
                              autoFocus
                            />

                            <div className="flex items-center gap-2">
                              <input
                                type="text"
                                placeholder="Descrição"
                                value={newCategoryDescription}
                                onChange={(e) => setNewCategoryDescription(e.target.value)}
                                className="flex-1 px-3 py-2 text-sm border border-gray-200 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                                style={{ fontFamily: 'Inter', fontSize: '14px' }}
                              />
                              <input
                                type="color"
                                value={newCategoryColor}
                                onChange={(e) => setNewCategoryColor(e.target.value)}
                                className="w-10 h-10 rounded-md border border-gray-200"
                              />
                            </div>

                            <div className="flex items-center gap-2">
                              <button
                                onClick={handleCreateNewCategory}
                                className="px-3 py-2 text-sm bg-blue-600 text-white rounded-md hover:bg-blue-700"
                              >
                                Salvar
                              </button>
                              <button
                                onClick={handleCancelNewCategory}
                                className="px-3 py-2 text-sm rounded-md hover:bg-gray-100"
                              >
                                Cancelar
                              </button>
                            </div>
                          </div>
                        )}
                      </div>
                    </div>
                  )}
                  <div className="flex flex-wrap gap-2">
                    {selectedCategories.map(cat => (
                      <span
                        key={cat.id}
                        className="px-2 py-1 text-xs font-medium rounded flex items-center gap-1"
                        style={{ backgroundColor: toRgba(cat.color || '#AD89F7', 0.1), color: cat.color || '#AD89F7', fontFamily: 'Inter', fontSize: '12px', fontWeight: 500 }}
                      >
                        <div className="w-[10px] h-[10px] rounded" style={{ backgroundColor: cat.color || '#AD89F7' }}></div>
                        {cat.name}
                        <button
                          onClick={() => handleRemoveSelectedCategory(cat.id)}
                          className="w-4 h-4 rounded-full flex items-center justify-center hover:bg-black hover:bg-opacity-10 transition-colors ml-1"
                          style={{ color: cat.color || '#AD89F7' }}
                          aria-label="Remover"
                        >
                          <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="w-3 h-3" aria-hidden="true">
                            <path d="M18 6 6 18"></path>
                            <path d="m6 6 12 12"></path>
                          </svg>
                        </button>
                      </span>
                    ))}
                  </div>
                </div>

                {/* Subcategorias */}
                <div className="relative dropdown-container">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-sm font-medium" style={{ color: '#737780', fontFamily: 'Inter' }}>Subcategorias</span>
                    <button
                      type="button"
                      className="w-7 h-7 rounded-full flex items-center justify-center hover:bg-gray-200 transition-colors"
                      style={{ background: 'none' }}
                      aria-label="Adicionar subcategoria"
                      onClick={() => setShowSubcategoryDropdown(prev => !prev)}
                    >
                      <Plus className="w-4 h-4 text-gray-600" />
                    </button>
                  </div>

                  {showSubcategoryDropdown && (
                    <div 
                      ref={subcategoryDropdownRef}
                      className="absolute top-8 left-0 bg-white border border-gray-200 rounded-lg shadow-lg z-10 min-w-[280px] dropdown-container"
                    >
                      <div className="p-3">
                        {/* Botão para fechar dropdown */}
                        <div className="flex items-center justify-end mb-2">
                          <button
                            type="button"
                            aria-label="Fechar dropdown"
                            className="w-6 h-6 rounded flex items-center justify-center hover:bg-gray-100"
                            onClick={() => {
                              setShowSubcategoryDropdown(false);
                              setIsCreatingNewSubcategory(false);
                              setSubcategorySearchTerm('');
                            }}
                          >
                            <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 16 16" fill="none" className="w-4 h-4" aria-hidden="true">
                              <path d="M12 4L4 12" stroke="#6B7588" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"/>
                              <path d="M4 4L12 12" stroke="#6B7588" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"/>
                            </svg>
                          </button>
                        </div>
                        {/* Campo de pesquisa */}
                        <div className="mb-3">
                          <input
                            type="text"
                            placeholder="Buscar subcategoria"
                            value={subcategorySearchTerm}
                            onChange={(e) => setSubcategorySearchTerm(e.target.value)}
                            className="w-full px-3 py-2 text-sm border border-gray-200 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                            style={{ fontFamily: 'Inter', fontSize: '14px' }}
                          />
                        </div>

                        {/* Lista de subcategorias filtradas (apenas esta parte scrolla) */}
                        <div className="max-h-80 overflow-y-auto overflow-x-hidden">
                          {filteredSubcategories.map((subcategory) => (
                            <div key={subcategory.id} className="px-3 py-2 rounded-md transition-colors">
                              {editingSubcategoryId === subcategory.id ? (
                                <div className="space-y-2">
                                  <input
                                    type="text"
                                    placeholder="Nome da subcategoria"
                                    value={editSubcategoryName}
                                    onChange={(e) => setEditSubcategoryName(e.target.value)}
                                    className="w-full px-3 py-2 text-sm border border-gray-200 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                                    style={{ fontFamily: 'Inter', fontSize: '14px' }}
                                  />
                                  <div className="flex items-center gap-2">
                                    <input
                                      type="text"
                                      placeholder="Descrição"
                                      value={editSubcategoryDescription}
                                      onChange={(e) => setEditSubcategoryDescription(e.target.value)}
                                      className="flex-1 px-3 py-2 text-sm border border-gray-200 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                                      style={{ fontFamily: 'Inter', fontSize: '14px' }}
                                    />
                                    <input
                                      type="color"
                                      value={editSubcategoryColor}
                                      onChange={(e) => setEditSubcategoryColor(e.target.value)}
                                      className="w-10 h-10 rounded-md border border-gray-200"
                                    />
                                  </div>
                                  <div className="flex items-center gap-2">
                                    <button onClick={handleSaveEditSubcategory} className="px-3 py-2 text-sm bg-blue-600 text-white rounded-md hover:bg-blue-700">Salvar</button>
                                    <button onClick={handleCancelEditSubcategory} className="px-3 py-2 text-sm rounded-md hover:bg-gray-100">Cancelar</button>
                                  </div>
                                </div>
                              ) : (
                                <div
                                  className="flex items-center gap-2 hover:bg-gray-50 rounded-md cursor-pointer"
                                  onClick={() => handleSelectSubcategory(subcategory)}
                                >
                                  <div
                                    className="w-3 h-3 rounded-full flex-shrink-0"
                                    style={{ backgroundColor: subcategory.color }}
                                  ></div>
                                  <div className="flex-1">
                                    <div className="font-medium" style={{ fontFamily: 'Inter', fontSize: '14px', color: '#374151' }}>{subcategory.name}</div>
                                    <div className="text-xs text-gray-500 mt-0.5">{subcategory.description}</div>
                                  </div>
                                  <div className="flex items-center gap-1 pr-2">
                                    <button
                                      onClick={(e) => { e.stopPropagation(); setPendingDeleteSubcategoryId(subcategory.id); }}
                                      className="w-6 h-6 rounded flex items-center justify-center hover:bg-gray-100"
                                      aria-label="Excluir"
                                    >
                                      <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="w-4 h-4" aria-hidden="true" style={{ color: '#EF4444' }}>
                                        <polyline points="3 6 5 6 21 6"/>
                                        <path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/>
                                        <path d="M10 11v6"/>
                                        <path d="M14 11v6"/>
                                        <path d="M9 6V4a2 2 0 0 1 2-2h2a2 2 0 0 1 2 2v2"/>
                                      </svg>
                                    </button>
                                    <button
                                      onClick={(e) => { e.stopPropagation(); handleStartEditSubcategory(subcategory); }}
                                      className="w-6 h-6 rounded flex items-center justify-center hover:bg-gray-100"
                                      aria-label="Editar"
                                    >
                                      <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="w-4 h-4" aria-hidden="true">
                                        <path d="M12 20h9"/>
                                        <path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4 12.5-12.5z"/>
                                      </svg>
                                    </button>
                                  </div>
                                </div>
                              )}

                              {pendingDeleteSubcategoryId === subcategory.id && (
                                <div className="flex items-center justify-end gap-2 mt-2 pr-2">
                                  <button onClick={() => setPendingDeleteSubcategoryId(null)} className="text-xs px-2 py-1 rounded hover:bg-gray-100">Cancelar</button>
                                  <button onClick={() => handleDeleteSubcategory(subcategory.id)} className="text-xs px-2 py-1 rounded bg-red-50 text-red-600 hover:bg-red-100">Excluir</button>
                                </div>
                              )}
                            </div>
                          ))}

                          {/* Mensagem quando não há subcategorias */}
                          {filteredSubcategories.length === 0 && subcategorySearchTerm && (
                            <div className="px-3 py-2 text-sm text-gray-500 text-center">
                              Nenhuma subcategoria encontrada
                            </div>
                          )}
                        </div>

                        {/* Separador */}
                        {filteredSubcategories.length > 0 && (
                          <div className="border-t border-gray-200 my-2"></div>
                        )}

                        {/* Opção para criar nova subcategoria */}
                        {!isCreatingNewSubcategory ? (
                          <button
                            onClick={(e) => { e.stopPropagation(); handleStartCreatingSubcategory(); }}
                            className="w-full text-left px-3 py-2 text-sm hover:bg-blue-50 rounded-md transition-colors flex items-center gap-2"
                            style={{ fontFamily: 'Inter', fontSize: '14px', color: '#2563eb' }}
                          >
                            <Plus className="w-4 h-4" />
                            Criar nova subcategoria
                          </button>
                        ) : (
                          <div className="space-y-3">
                            <input
                              type="text"
                              placeholder="Nome da nova subcategoria"
                              value={newSubcategoryName}
                              onChange={(e) => setNewSubcategoryName(e.target.value)}
                              className="w-full px-3 py-2 text-sm border border-gray-200 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                              style={{ fontFamily: 'Inter', fontSize: '14px' }}
                              autoFocus
                            />

                            <div className="flex items-center gap-2">
                              <input
                                type="text"
                                placeholder="Descrição"
                                value={newSubcategoryDescription}
                                onChange={(e) => setNewSubcategoryDescription(e.target.value)}
                                className="flex-1 px-3 py-2 text-sm border border-gray-200 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                                style={{ fontFamily: 'Inter', fontSize: '14px' }}
                              />
                              <input
                                type="color"
                                value={newSubcategoryColor}
                                onChange={(e) => setNewSubcategoryColor(e.target.value)}
                                className="w-10 h-10 rounded-md border border-gray-200"
                              />
                            </div>

                            <div className="flex items-center gap-2">
                              <button
                                onClick={handleCreateNewSubcategory}
                                className="px-3 py-2 text-sm bg-blue-600 text-white rounded-md hover:bg-blue-700"
                              >
                                Salvar
                              </button>
                              <button
                                onClick={handleCancelNewSubcategory}
                                className="px-3 py-2 text-sm rounded-md hover:bg-gray-100"
                              >
                                Cancelar
                              </button>
                            </div>
                          </div>
                        )}
                      </div>
                    </div>
                  )}

                  <div className="flex flex-wrap gap-2">
                    {selectedSubcategories.map(sc => (
                      <span
                        key={sc.id}
                        className="px-2 py-1 text-xs font-medium rounded flex items-center gap-1"
                        style={{ backgroundColor: toRgba(sc.color || '#22C55E', 0.1), color: sc.color || '#22C55E', fontFamily: 'Inter', fontSize: '12px', fontWeight: 500 }}
                      >
                        <div className="w-[10px] h-[10px] rounded" style={{ backgroundColor: sc.color || '#22C55E' }}></div>
                        {sc.name}
                        <button
                          onClick={() => handleRemoveSelectedSubcategory(sc.id)}
                          className="w-4 h-4 rounded-full flex items-center justify-center hover:bg-black hover:bg-opacity-10 transition-colors ml-1"
                          style={{ color: sc.color || '#22C55E' }}
                          aria-label="Remover"
                        >
                          <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="w-3 h-3" aria-hidden="true">
                            <path d="M18 6 6 18"></path>
                            <path d="m6 6 12 12"></path>
                          </svg>
                        </button>
                      </span>
                    ))}
                  </div>
                </div>

                {/* Tags */}
                <div className="relative dropdown-container">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-sm font-medium" style={{ color: '#737780', fontFamily: 'Inter' }}>Tags</span>
                    <button
                      type="button"
                      className="w-7 h-7 rounded-full flex items-center justify-center hover:bg-gray-200 transition-colors"
                      style={{ background: 'none' }}
                      aria-label="Adicionar tag"
                      onClick={() => setShowTagsDropdown(prev => !prev)}
                    >
                      <Plus className="w-4 h-4 text-gray-600" />
                    </button>
                  </div>

                  {showTagsDropdown && (
                    <div 
                      ref={tagsDropdownRef}
                      className="absolute top-8 left-0 bg-white border border-gray-200 rounded-lg shadow-lg z-10 min-w-[280px] dropdown-container"
                    >
                      <div className="p-3">
                        {/* Botão para fechar dropdown */}
                        <div className="flex items-center justify-end mb-2">
                          <button
                            type="button"
                            aria-label="Fechar dropdown"
                            className="w-6 h-6 rounded flex items-center justify-center hover:bg-gray-100"
                            onClick={() => {
                              setShowTagsDropdown(false);
                              setIsCreatingNewTag(false);
                              setTagsSearchTerm('');
                            }}
                          >
                            <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 16 16" fill="none" className="w-4 h-4" aria-hidden="true">
                              <path d="M12 4L4 12" stroke="#6B7588" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"/>
                              <path d="M4 4L12 12" stroke="#6B7588" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"/>
                            </svg>
                          </button>
                        </div>
                        {/* Campo de pesquisa */}
                        <div className="mb-3">
                          <input
                            type="text"
                            placeholder="Buscar tag"
                            value={tagsSearchTerm}
                            onChange={(e) => setTagsSearchTerm(e.target.value)}
                            className="w-full px-3 py-2 text-sm border border-gray-200 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                            style={{ fontFamily: 'Inter', fontSize: '14px' }}
                          />
                        </div>

                        {/* Lista de tags filtradas (apenas esta parte scrolla) */}
                        <div className="max-h-80 overflow-y-auto overflow-x-hidden">
                          {filteredTags.map((tag) => (
                            <div key={tag.id} className="px-3 py-2 rounded-md transition-colors">
                              {editingTagId === tag.id ? (
                                <div className="space-y-2">
                                  <input
                                    type="text"
                                    placeholder="Nome da tag"
                                    value={editTagName}
                                    onChange={(e) => setEditTagName(e.target.value)}
                                    className="w-full px-3 py-2 text-sm border border-gray-200 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                                    style={{ fontFamily: 'Inter', fontSize: '14px' }}
                                  />
                                  <div className="flex items-center gap-2">
                                    <input
                                      type="text"
                                      placeholder="Descrição"
                                      value={editTagDescription}
                                      onChange={(e) => setEditTagDescription(e.target.value)}
                                      className="flex-1 px-3 py-2 text-sm border border-gray-200 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                                      style={{ fontFamily: 'Inter', fontSize: '14px' }}
                                    />
                                    <input
                                      type="color"
                                      value={editTagColor}
                                      onChange={(e) => setEditTagColor(e.target.value)}
                                      className="w-10 h-10 rounded-md border border-gray-200"
                                    />
                                  </div>
                                  <div className="flex items-center gap-2">
                                    <button onClick={handleSaveEditTag} className="px-3 py-2 text-sm bg-blue-600 text-white rounded-md hover:bg-blue-700">Salvar</button>
                                    <button onClick={handleCancelEditTag} className="px-3 py-2 text-sm rounded-md hover:bg-gray-100">Cancelar</button>
                                  </div>
                                </div>
                              ) : (
                                <div
                                  className="flex items-center gap-2 hover:bg-gray-50 rounded-md cursor-pointer"
                                  onClick={() => handleAddTag(tag)}
                                >
                                  <div
                                    className="w-3 h-3 rounded-full flex-shrink-0"
                                    style={{ backgroundColor: (tag && tag.color) || '#AD89F7' }}
                                  ></div>
                                  <div className="flex-1">
                                    <div className="font-medium" style={{ fontFamily: 'Inter', fontSize: '14px', color: '#374151' }}>{tag.name}</div>
                                    <div className="text-xs text-gray-500 mt-0.5">{tag.description}</div>
                                  </div>
                                  <div className="flex items-center gap-1 pr-2">
                                    <button
                                      onClick={(e) => { e.stopPropagation(); setPendingDeleteTagId(tag.id); }}
                                      className="w-6 h-6 rounded flex items-center justify-center hover:bg-gray-100"
                                      aria-label="Excluir"
                                    >
                                      <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="w-4 h-4" aria-hidden="true" style={{ color: '#EF4444' }}>
                                        <polyline points="3 6 5 6 21 6"/>
                                        <path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/>
                                        <path d="M10 11v6"/>
                                        <path d="M14 11v6"/>
                                        <path d="M9 6V4a2 2 0 0 1 2-2h2a2 2 0 0 1 2 2v2"/>
                                      </svg>
                                    </button>
                                    <button
                                      onClick={(e) => { e.stopPropagation(); handleStartEditTag(tag); }}
                                      className="w-6 h-6 rounded flex items-center justify-center hover:bg-gray-100"
                                      aria-label="Editar"
                                    >
                                      <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="w-4 h-4" aria-hidden="true">
                                        <path d="M12 20h9"/>
                                        <path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4 12.5-12.5z"/>
                                      </svg>
                                    </button>
                                  </div>
                                </div>
                              )}

                              {pendingDeleteTagId === tag.id && (
                                <div className="flex items-center justify-end gap-2 mt-2 pr-2">
                                  <button onClick={() => setPendingDeleteTagId(null)} className="text-xs px-2 py-1 rounded hover:bg-gray-100">Cancelar</button>
                                  <button onClick={() => handleDeleteTag(tag.id)} className="text-xs px-2 py-1 rounded bg-red-50 text-red-600 hover:bg-red-100">Excluir</button>
                                </div>
                              )}
                            </div>
                          ))}

                          {/* Mensagem quando não há tags */}
                          {filteredTags.length === 0 && tagsSearchTerm && (
                            <div className="px-3 py-2 text-sm text-gray-500 text-center">
                              Nenhuma tag encontrada
                            </div>
                          )}
                        </div>

                        {/* Separador */}
                        {filteredTags.length > 0 && (
                          <div className="border-t border-gray-200 my-2"></div>
                        )}

                        {/* Opção para criar nova tag */}
                        {!isCreatingNewTag ? (
                          <button
                            onClick={(e) => { e.stopPropagation(); handleStartCreatingTag(); }}
                            className="w-full text-left px-3 py-2 text-sm hover:bg-blue-50 rounded-md transition-colors flex items-center gap-2"
                            style={{ fontFamily: 'Inter', fontSize: '14px', color: '#2563eb' }}
                          >
                            <Plus className="w-4 h-4" />
                            Criar nova tag
                          </button>
                        ) : (
                          <div className="space-y-3">
                            <input
                              type="text"
                              placeholder="Nome da nova tag"
                              value={newTagName}
                              onChange={(e) => setNewTagName(e.target.value)}
                              className="w-full px-3 py-2 text-sm border border-gray-200 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                              style={{ fontFamily: 'Inter', fontSize: '14px' }}
                              autoFocus
                            />

                            <div className="flex items-center gap-2">
                              <input
                                type="text"
                                placeholder="Descrição"
                                value={newTagDescription}
                                onChange={(e) => setNewTagDescription(e.target.value)}
                                className="flex-1 px-3 py-2 text-sm border border-gray-200 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                                style={{ fontFamily: 'Inter', fontSize: '14px' }}
                              />
                              <input
                                type="color"
                                value={newTagColor}
                                onChange={(e) => setNewTagColor(e.target.value)}
                                className="w-10 h-10 rounded-md border border-gray-200"
                              />
                            </div>

                            <div className="flex items-center gap-2">
                              <button
                                onClick={handleCreateNewTag}
                                className="px-3 py-2 text-sm bg-blue-600 text-white rounded-md hover:bg-blue-700"
                              >
                                Salvar
                              </button>
                              <button
                                onClick={handleCancelNewTag}
                                className="px-3 py-2 text-sm rounded-md hover:bg-gray-100"
                              >
                                Cancelar
                              </button>
                            </div>
                          </div>
                        )}
                      </div>
                    </div>
                  )}

                  <div className="flex flex-wrap gap-2">
                    {selectedTags.map(tag => (
                      <span
                        key={tag.id}
                        className="px-3 py-1 text-sm flex items-center gap-2 rounded"
                        style={{ backgroundColor: toRgba(tag.color || '#FFC107', 0.125), color: tag.color || '#FFC107', fontFamily: 'Inter', fontSize: '12px', fontWeight: 500 }}
                      >
                        <div className="w-[10px] h-[10px] rounded" style={{ backgroundColor: tag.color || '#FFC107' }}></div>
                        {tag.name}
                        <button type="button" className="ml-1 hover:bg-black hover:bg-opacity-10 rounded-full p-0.5 transition-colors" style={{ color: tag.color || '#FFC107' }} aria-label="Remover" onClick={() => handleRemoveSelectedTag(tag.id)}>
                          <svg xmlns="http://www.w3.org/2000/svg" width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                            <line x1="18" y1="6" x2="6" y2="18"></line>
                            <line x1="6" y1="6" x2="18" y2="18"></line>
                          </svg>
                        </button>
                      </span>
                    ))}
                  </div>
                </div>
              </div>

              {/* Barra de ações removida conforme solicitação */}
            </div>
          )}
        </aside>
      </div>
    </div>
    </div>
  );
};

export default QuestoesPage;