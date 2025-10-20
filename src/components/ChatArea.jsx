import React, { useState, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Heart, Edit2, Trash2, ChevronDown, Wand2, Check } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useToast } from "@/components/ui/use-toast";

const ChatArea = ({ conversation, onAddReply, onLikePost, onLikeReply, onEditReply, onDeleteReply, onToggleStudentInfo, activeFilterData, currentUser, error, onRetry }) => {
  const { toast } = useToast();
  const [message, setMessage] = useState('');
  const [showReplies, setShowReplies] = useState(false);
  const [isComposerVisible, setComposerVisible] = useState(false);
  const [editingReply, setEditingReply] = useState(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitSuccess, setSubmitSuccess] = useState(false);
  const [replyToDeleteId, setReplyToDeleteId] = useState(null);

  const threadRef = useRef(null);
  const textareaRef = useRef(null);

  useEffect(() => {
    if (threadRef.current) {
      threadRef.current.scrollTop = threadRef.current.scrollHeight;
    }
  }, [conversation, showReplies, isComposerVisible, editingReply]);
  
  useEffect(() => {
    if (conversation?.id) {
        setShowReplies(false);
        setComposerVisible(false);
        setEditingReply(null);
        setMessage('');
        setIsSubmitting(false);
        setSubmitSuccess(false);
        setReplyToDeleteId(null);
    }
  }, [conversation?.id]);

  useEffect(() => {
    if ((isComposerVisible || editingReply) && textareaRef.current) {
      textareaRef.current.focus();
    }
  }, [isComposerVisible, editingReply]);

  if (error) {
    return (
      <section className="flex flex-col h-full" aria-label="Área do chat">
        <div className="flex-1 rounded-[14px] p-5 grid place-content-center text-center">
          <h2 className="text-xl font-bold text-gray-800 mb-2">{error}</h2>
          <Button onClick={onRetry}>Tentar novamente</Button>
        </div>
      </section>
    );
  }

  if (!conversation) {
    return (
      <section className="flex flex-col h-full" aria-label="Área do chat">
        <div className="flex-1 rounded-[14px] p-5 grid place-items-center text-[#6b7280]">
           Selecione uma conversa para começar
        </div>
      </section>
    );
  }
  
  const post = conversation.posts ? conversation.posts[0] : null;

  if (!post) {
      return (
      <section className="flex flex-col h-full" aria-label="Área do chat">
         <div className="flex-1 rounded-[14px] p-5 grid place-items-center text-[#6b7280]">
           Carregando detalhes da conversa...
        </div>
      </section>
      )
  }

  const headerData = activeFilterData || {
      courseName: conversation.subject || 'Curso',
      professor: conversation.producer?.name || 'Professor',
      imageUrl: `data:image/svg+xml;base64,${btoa('<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 20 20" fill="none"><path d="M0 4C0 1.79086 1.79086 0 4 0H16C18.2091 0 20 1.79086 20 4V16C20 18.2091 18.2091 20 16 20H4C1.79086 20 0 18.2091 0 16V4Z" fill="#5B4DEA"/><g clip-path="url(#clip0_580_12066)"><path d="M14.875 13.75C14.875 13.8495 14.8355 13.9448 14.7652 14.0152C14.6948 14.0855 14.5995 14.125 14.5 14.125H5.5C5.40054 14.125 5.30516 14.0855 5.23483 14.0152C5.16451 13.9448 5.125 13.8495 5.125 13.75C5.125 13.6505 5.16451 13.5552 5.23483 13.4848C5.30516 13.4145 5.40054 13.375 5.5 13.375H14.5C14.5995 13.375 14.6948 13.4145 14.7652 13.4848C14.8355 13.5552 14.875 13.6505 14.875 13.75ZM14.875 6.625V11.875C14.875 12.0739 14.796 12.2647 14.6553 12.4053C14.5147 12.546 14.3239 12.625 14.125 12.625H5.875C5.67609 12.625 5.48532 12.546 5.34467 12.4053C5.20402 12.2647 5.125 12.0739 5.125 11.875V6.625C5.125 6.42609 5.20402 6.23532 5.34467 6.09467C5.48532 5.95402 5.67609 5.875 5.875 5.875H14.125C14.3239 5.875 14.5147 5.95402 14.6553 6.09467C14.796 6.23532 14.875 6.42609 14.875 6.625ZM11.6875 9.25C11.6875 9.18975 11.6729 9.13038 11.6451 9.07694C11.6173 9.02349 11.577 8.97754 11.5277 8.94297L9.65266 7.63047C9.59647 7.59111 9.53056 7.56792 9.46211 7.56341C9.39366 7.55891 9.32528 7.57327 9.26443 7.60493C9.20357 7.63659 9.15256 7.68434 9.11696 7.74298C9.08136 7.80162 9.06252 7.8689 9.0625 7.9375V10.5625C9.06252 10.6311 9.08136 10.6984 9.11696 10.757C9.15256 10.8157 9.20357 10.8634 9.26443 10.8951C9.32528 10.9267 9.39366 10.9411 9.46211 10.9366C9.53056 10.9321 9.59647 10.9089 9.65266 10.8695L11.5277 9.55703C11.577 9.52246 11.6173 9.47651 11.6451 9.42306C11.6729 9.36962 11.6875 9.31025 11.6875 9.25Z" fill="#F9FAFB"/></g><defs><clipPath id="clip0_580_12066"><rect width="12" height="12" fill="white" transform="translate(4 4)"/></clipPath></defs></svg>')}`
  };

  const handleAction = async () => {
    const msg = message.trim();
    if (!msg || isSubmitting || submitSuccess || !currentUser) return;
  
    setIsSubmitting(true);
  
    try {
      if (editingReply) {
        await onEditReply(editingReply.id, msg);
      } else {
        await onAddReply(msg);
      }
      setSubmitSuccess(true);
    } catch (error) {
        // Error toast is handled in App.jsx
    } finally {
        setIsSubmitting(false);
    }
    
    setTimeout(() => {
        setMessage('');
        setShowReplies(true);
        setComposerVisible(false);
        setEditingReply(null);
        setSubmitSuccess(false);
    }, 1500);
  };
  
  const handleEditClick = (reply) => {
    setEditingReply(reply);
    setMessage(reply.content);
    setComposerVisible(false);
  };

  const handleCancel = () => {
    setMessage('');
    setComposerVisible(false);
    setEditingReply(null);
  };
  
  const confirmDeleteReply = (replyId) => {
    onDeleteReply(replyId);
    setReplyToDeleteId(null);
  };


  const composerOpen = isComposerVisible || editingReply;
  const replies = post.replies || [];

  return (
    <section className="flex flex-col h-full" aria-label="Área do chat">
      <motion.div
        initial={{ opacity: 0, y: -10 }}
        animate={{ opacity: 1, y: 0 }}
        className="bg-white flex items-center justify-between gap-3 h-[82px] border-b border-[#E3E4E5] px-4"
      >
        <div className="flex items-center gap-3">
            <img src={headerData.imageUrl} alt="" className="w-9 h-9" />
            <div>
              <div className="font-bold">{headerData.courseName}</div>
              <div className="text-[#6b7280] text-[13px]">
                Professor/Mentor: {headerData.professor}
              </div>
            </div>
        </div>
        <button
            onClick={onToggleStudentInfo}
            className="border border-[#ebecef] bg-white w-[34px] h-[34px] rounded-[10px] grid place-items-center hover:bg-[#fafbff] transition-colors"
            title="Informações do aluno"
        >
            <img src={`data:image/svg+xml;base64,${btoa('<svg width="16" height="16" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg"><g clip-path="url(#clip0_182_5391)"><path d="M5 9C6.38071 9 7.5 7.88071 7.5 6.5C7.5 5.11929 6.38071 4 5 4C3.61929 4 2.5 5.11929 2.5 6.5C2.5 7.88071 3.61929 9 5 9Z" stroke="#6B7588" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/><path d="M10.25 5H15.25" stroke="#6B7588" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/><path d="M10.25 8H15.25" stroke="#6B7588" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/><path d="M11.75 11H15.25" stroke="#6B7588" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/><path d="M1 12C1.44375 10.275 3.13625 9 5 9C6.86375 9 8.55625 10.275 9 12" stroke="#6B7588" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/></g><defs><clipPath id="clip0_182_5391"><rect width="16" height="16" fill="white"/></clipPath></defs></svg>')}`} alt="Informações do Aluno" className="w-4 h-4" />
        </button>
      </motion.div>

      <div
        ref={threadRef}
        className="flex-1 rounded-[14px] p-5 flex flex-col min-h-0 overflow-auto"
      >
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          className="bg-[#F9FAFB] rounded-[8px] p-4"
        >
          <div className="flex items-start gap-4">
            <img className="w-8 h-8 rounded-full object-cover" alt={post.author.name} src={conversation.student.avatar_url} />
            <div className="flex-1">
              <span className="font-semibold text-sm text-[#0f172a]">{post.author.name}</span>
              <p className="my-2 text-[#737780] font-normal text-[14px] leading-relaxed">{post.text}</p>
              <div className="flex items-center gap-2 text-gray-500 text-xs mt-3">
                <button
                  className="flex items-center gap-1.5 hover:text-red-500 transition-colors"
                  onClick={() => onLikePost(post.id)}
                >
                  <Heart size={14} className={post.liked ? 'text-red-500 fill-current' : ''}/>
                  Curtir {post.likes > 0 && `(${post.likes})`}
                </button>
                <span className="text-gray-300">•</span>
                <button
                  className="flex items-center gap-1.5 hover:text-indigo-600 transition-colors"
                  onClick={() => { setComposerVisible(!isComposerVisible); setEditingReply(null); setMessage(''); }}
                >
                  <img src={`data:image/svg+xml;base64,${btoa('<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 16 16" fill="none"><path fill-rule="evenodd" clip-rule="evenodd" d="M10 12.6668H7.33333C6.59667 12.6668 6 12.0702 6 11.3335V7.66683C6 6.93016 6.59667 6.3335 7.33333 6.3335H12.6667C13.4033 6.3335 14 6.93016 14 7.66683V11.3335C14 12.0702 13.4033 12.6668 12.6667 12.6668H12V14.0002L10 12.6668Z" stroke="#6B7588" stroke-width="1.2" stroke-linecap="round" stroke-linejoin="round"/><path d="M11.7393 6.33333V3.62333C11.7393 2.72667 11.0127 2 10.116 2H3.62333C2.72667 2 2 2.72667 2 3.62333V8.08733C2 8.984 2.72667 9.71067 3.62333 9.71067H4.43467V11.3333L6 10.29" stroke="#6B7588" stroke-width="1.2" stroke-linecap="round" stroke-linejoin="round"/></svg>')}`} alt="Responder" className="w-4 h-4" />
                  Responder
                </button>
              </div>

               {replies.length > 0 && (
                <div 
                  className="flex items-center gap-2 text-xs text-indigo-600 font-semibold mt-4 cursor-pointer hover:underline"
                  onClick={() => setShowReplies(!showReplies)}
                >
                  <span>{showReplies ? 'Ocultar' : 'Ver'} {replies.length} respostas</span>
                  <motion.div animate={{ rotate: showReplies ? 180 : 0 }}>
                    <ChevronDown size={14} />
                  </motion.div>
                </div>
              )}
            </div>
          </div>
          
          <AnimatePresence>
            {showReplies && (
                <motion.div
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: 'auto' }}
                  exit={{ opacity: 0, height: 0 }}
                  transition={{ duration: 0.3 }}
                  className="mt-4 pl-12 flex flex-col gap-4 overflow-hidden"
                >
                {replies.map((reply, idx) => (
                  <motion.div
                    key={reply.id}
                    initial={{ opacity: 0, x: -10 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: idx * 0.05 }}
                    className="p-0"
                  >
                  {editingReply?.id === reply.id ? (
                    <div className="w-full"></div>
                  ) : (
                    <div className="flex items-start gap-3">
                        <img className="w-8 h-8 rounded-full object-cover" alt={reply.author.name} src="https://images.unsplash.com/photo-1644424235476-295f24d503d9" />
                        <div className="flex-1">
                          <span className="font-semibold text-sm text-[#0f172a]">{reply.author.name}</span>
                          <div className="mt-1.5 mb-2 text-[#737780] font-normal text-[14px] leading-relaxed">{reply.content}</div>
                          <div className="flex items-center gap-2 text-gray-500 text-xs">
                            {replyToDeleteId === reply.id ? (
                                <div className="flex items-center gap-2 text-xs">
                                    <span className="text-red-500 font-semibold">Excluir?</span>
                                    <button
                                        className="font-semibold text-red-500 hover:underline"
                                        onClick={() => confirmDeleteReply(reply.id)}
                                    >
                                        Sim
                                    </button>
                                    <span className="text-gray-300">•</span>
                                    <button
                                        className="font-semibold text-gray-500 hover:underline"
                                        onClick={() => setReplyToDeleteId(null)}
                                    >
                                        Não
                                    </button>
                                </div>
                            ) : (
                            <>
                              <button
                                className="flex items-center gap-1.5 hover:text-red-500 transition-colors"
                                onClick={() => onLikeReply(reply.id)}
                              >
                                <Heart size={14} className={reply.liked_by_user ? "text-red-500 fill-current" : ""} />
                                {reply.likes || 0} curtidas
                              </button>
                              <span className="text-gray-300">•</span>
                              <button
                                className="flex items-center gap-1.5 hover:text-indigo-600 transition-colors"
                                onClick={() => handleEditClick(reply)}
                              >
                                <Edit2 size={14} />
                                Editar
                              </button>
                              <span className="text-gray-300">•</span>
                              <button 
                                className="flex items-center gap-1.5 hover:text-red-500 transition-colors"
                                onClick={() => setReplyToDeleteId(reply.id)}
                              >
                                <Trash2 size={14} />
                                Excluir
                              </button>
                            </>
                            )}
                          </div>
                        </div>
                    </div>
                  )}
                  </motion.div>
                ))}
              </motion.div>
            )}
          </AnimatePresence>

          <AnimatePresence>
            {composerOpen && (
              <motion.div
                initial={{ opacity: 0, y: 10, height: 0 }}
                animate={{ opacity: 1, y: 0, height: 'auto' }}
                exit={{ opacity: 0, y: 10, height: 0 }}
                transition={{ duration: 0.3 }}
                className="mt-4 pl-12 overflow-hidden"
              >
                <div className="bg-white border border-[#ebecef] rounded-[4px]">
                  <div className="relative">
                    <textarea
                      id="message-textarea"
                      ref={textareaRef}
                      value={message}
                      onChange={(e) => setMessage(e.target.value)}
                      placeholder="Digite aqui sua resposta para o aluno"
                      className="w-full min-h-[88px] resize-y border-0 rounded-t-[14px] p-4 pr-10 outline-none focus:outline-none text-sm bg-white placeholder:text-gray-400"
                      onKeyDown={(e) => {
                        if (e.key === 'Enter' && e.ctrlKey) {
                          handleAction();
                        }
                      }}
                    />
                    <button className="absolute top-3 right-3 text-blue-600 hover:text-blue-800"
                      onClick={() => toast({ title: "Funcionalidade em desenvolvimento", description: "🚧 This feature isn't implemented yet—but don't worry! You can request it in your next prompt! 🚀"})}
                    >
                      <Wand2 size={16} />
                    </button>
                  </div>
                  <div className="flex justify-end items-center p-2.5 bg-white rounded-b-[14px]">
                    <div className="flex gap-2">
                        <Button
                          variant="ghost"
                          onClick={handleCancel}
                          className="w-[92px] h-[28px] rounded-[10px] text-[#0047BB] font-open-sans font-normal text-[12px]"
                        >
                          Cancelar
                        </Button>
                        <Button
                          onClick={handleAction}
                          disabled={isSubmitting || submitSuccess}
                          className={`w-[103px] h-[28px] text-white font-open-sans font-normal text-[12px] rounded-[4px] transition-all duration-300 ${submitSuccess ? 'bg-green-500' : 'bg-[#0047BB] hover:bg-[#003893]'}`}
                        >
                          {isSubmitting ? 'Enviando...' : submitSuccess ? (
                            <div className="flex items-center gap-1.5">
                                <Check size={14}/>
                                Enviado!
                            </div>
                           ) : (editingReply ? 'Salvar' : 'Responder')}
                        </Button>
                    </div>
                  </div>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </motion.div>
      </div>
    </section>
  );
};

export default ChatArea;