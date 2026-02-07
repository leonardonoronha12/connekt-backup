import React, { useEffect, useMemo, useRef, useState } from 'react'
import { Edit2, Heart, Trash2 } from 'lucide-react'
import { supabase } from '@/lib/supabaseClient'
import { fetchConversationFeed } from '@/services/conversationService'
import { toast } from '@/components/ui/use-toast'

export default function AlunoInboxThread({ user, studentName, threadKey, title, lessonTitle, itemLabel, placeholder, submitLabel = 'Enviar', successTitle = 'Mensagem enviada', courseId, producerId }) {
  const [loading, setLoading] = useState(false)
  const [conversationId, setConversationId] = useState(null)
  const [posts, setPosts] = useState([])
  const [composer, setComposer] = useState('')
  const [loadError, setLoadError] = useState('')
  const [sendError, setSendError] = useState('')
  const [openRepliesById, setOpenRepliesById] = useState({})
  const [inlineEditingPostId, setInlineEditingPostId] = useState(null)
  const [inlineEditingText, setInlineEditingText] = useState('')
  const [postToDeleteId, setPostToDeleteId] = useState(null)
  const composerRef = useRef(null)
  const lastLoadErrorRef = useRef({ at: 0, message: '' })

  const headerTitle = String(title || 'Inbox')
  const unitLabel = String(itemLabel || 'Mensagens')
  const subjectPrefix = headerTitle
  const singularLabel = useMemo(() => {
    const t = headerTitle.trim().toLowerCase()
    if (t.includes('coment')) return 'Comentário'
    return 'Mensagem'
  }, [headerTitle])

  const demoKey = useMemo(() => `connekt_aluno_inbox_${String(threadKey || '')}`, [threadKey])

  const loadDemo = () => {
    try {
      const raw = localStorage.getItem(demoKey)
      const parsed = raw ? JSON.parse(raw) : null
      const list = Array.isArray(parsed) ? parsed : []
      setPosts(list)
    } catch (_) {
      setPosts([])
    }
  }

  const saveDemo = (list) => {
    try {
      localStorage.setItem(demoKey, JSON.stringify(list))
    } catch (_) {}
  }

  const getAccessToken = async () => {
    try {
      const sess = (await supabase.auth.getSession().catch(() => ({ data: null })))?.data?.session || null
      const token = sess?.access_token || ''
      if (token) return token
    } catch (_) {}
    try {
      if (supabase?.auth?.refreshSession) await supabase.auth.refreshSession()
    } catch (_) {}
    try {
      const sess = (await supabase.auth.getSession().catch(() => ({ data: null })))?.data?.session || null
      return sess?.access_token || ''
    } catch (_) {
      return ''
    }
  }

  const insertWithColumnPrune = async (table, initialPayload, maxAttempts = 10) => {
    let payload = { ...(initialPayload || {}) }
    for (let i = 0; i < maxAttempts; i += 1) {
      const { data, error } = await supabase.from(table).insert(payload).select('id').single()
      if (!error) return { data, error: null }
      const msg = String(error?.message || '')
      const isMissingColumn = msg.toLowerCase().includes('does not exist') && msg.toLowerCase().includes('column')
      if (!isMissingColumn) return { data: null, error }
      const m = msg.match(/column \"([^\"]+)\"/i)
      const col = m?.[1]
      if (!col || !(col in payload)) return { data: null, error }
      delete payload[col]
    }
    return { data: null, error: new Error('Insert failed after pruning columns') }
  }

  const resolveStudentId = async () => {
    const email = String(user?.email || '').trim().toLowerCase()
    if (!email) return null

    const attempts = [
      () => supabase.from('students').select('id').eq('user_id', user.id).maybeSingle(),
      () => supabase.from('students').select('id').eq('email', email).maybeSingle(),
      () => supabase.from('students').select('id').eq('external_id', user.id).maybeSingle(),
    ]

    for (const fn of attempts) {
      try {
        const { data, error } = await fn()
        if (!error && data?.id) return data.id
      } catch (_) {}
    }

    const payload = {
      user_id: user.id,
      external_id: user.id,
      name: String(studentName || 'Aluno'),
      email,
      avatar_url: null,
    }
    const { data } = await insertWithColumnPrune('students', payload, 8)
    return data?.id || null
  }

  const resolveProducerId = async () => {
    const directProducerId = String(producerId || '').trim()
    if (directProducerId) {
      try {
        const { data } = await supabase
          .from('producers')
          .select('id')
          .or(`user_id.eq.${directProducerId},id.eq.${directProducerId},external_id.eq.${directProducerId}`)
          .maybeSingle()
        if (data?.id) return data.id
      } catch (_) {}
    }

    const params = new URLSearchParams(window.location.search || '')
    const producerUserId = params.get('producer_uid') || params.get('producerUserId') || ''
    if (producerUserId) {
      try {
        const { data } = await supabase
          .from('producers')
          .select('id')
          .or(`user_id.eq.${producerUserId},id.eq.${producerUserId},external_id.eq.${producerUserId}`)
          .maybeSingle()
        if (data?.id) return data.id
      } catch (_) {}
    }

    const courseIdFromProp = String(courseId || '').trim()
    if (courseIdFromProp) {
      try {
        const { data } = await supabase.from('courses').select('user_id').eq('id', courseIdFromProp).maybeSingle()
        const userId = data?.user_id
        if (userId) {
          const { data: prod } = await supabase
            .from('producers')
            .select('id')
            .or(`user_id.eq.${userId},id.eq.${userId},external_id.eq.${userId}`)
            .maybeSingle()
          if (prod?.id) return prod.id
        }
      } catch (_) {}
    }

    const courseIdFromQuery = params.get('courseId') || params.get('cursoId') || ''
    if (courseIdFromQuery) {
      try {
        const { data } = await supabase.from('courses').select('user_id').eq('id', courseIdFromQuery).maybeSingle()
        const userId = data?.user_id
        if (userId) {
          const { data: prod } = await supabase
            .from('producers')
            .select('id')
            .or(`user_id.eq.${userId},id.eq.${userId},external_id.eq.${userId}`)
            .maybeSingle()
          if (prod?.id) return prod.id
        }
      } catch (_) {}
    }

    const producerExternalId = params.get('producer_id') || params.get('producerId') || ''
    if (producerExternalId) {
      try {
        const { data } = await supabase.from('producers').select('id').eq('external_id', producerExternalId).maybeSingle()
        if (data?.id) return data.id
      } catch (_) {}
    }

    try {
      const { data } = await supabase.from('producers').select('id').limit(1)
      const first = Array.isArray(data) ? data[0] : null
      return first?.id || null
    } catch (_) {
      return null
    }
  }

  const ensureConversation = async () => {
    const studentId = await resolveStudentId()
    const producerId = await resolveProducerId()
    if (!studentId || !producerId) return null

    const subject = `${subjectPrefix} - ${String(threadKey || '')}`
    try {
      const { data: existing } = await supabase
        .from('conversations')
        .select('id')
        .eq('producer_id', producerId)
        .eq('student_id', studentId)
        .eq('subject', subject)
        .maybeSingle()

      if (existing?.id) return existing.id
    } catch (_) {}

    const payload = {
      producer_id: producerId,
      student_id: studentId,
      subject,
      tag: 'Curso',
      unread: 0,
      date: new Date().toISOString(),
    }
    const { data } = await insertWithColumnPrune('conversations', payload, 10)
    return data?.id || null
  }

  const refresh = async ({ silent = false } = {}) => {
    if (!silent) setLoading(true)
    try {
      if (!silent) setLoadError('')
      if (!user?.id) {
        loadDemo()
        setInlineEditingPostId(null)
        setInlineEditingText('')
        setPostToDeleteId(null)
        return
      }

      const courseIdText = String(courseId || '').trim()
      if (courseIdText) {
        const conversationStorageKey = `connekt_aluno_inbox_conversation_${courseIdText}_${String(threadKey || '')}`
        let storedConversationId = ''
        try { storedConversationId = String(localStorage.getItem(conversationStorageKey) || '').trim() } catch (_) {}
        const token = await getAccessToken()
        if (!token) throw new Error('missing_token')
        const url = `/api/producer?type=lesson_comments_thread&courseId=${encodeURIComponent(courseIdText)}&threadKey=${encodeURIComponent(String(threadKey || ''))}&title=${encodeURIComponent(String(title || 'Comentários'))}&lessonTitle=${encodeURIComponent(String(lessonTitle || ''))}`
        const r = await fetch(url, { headers: { Authorization: `Bearer ${token}` } })
        const body = await r.json().catch(() => ({}))
        if (!r.ok) throw new Error(String(body?.error || body?.message || 'load_failed'))
        const serverConversationId = String(body?.conversationId || '').trim()
        if (serverConversationId) setConversationId(serverConversationId)
        if (serverConversationId) {
          try { localStorage.setItem(conversationStorageKey, serverConversationId) } catch (_) {}
        } else if (storedConversationId) {
          setConversationId(storedConversationId)
        }
        const list = Array.isArray(body?.data) ? body.data : []
        const mapped = list.map((p) => ({
          id: p.id,
          text: p.content,
          created_at: p.created_at,
          likes: Number(p.likes || 0),
          liked: !!p.liked,
          replies: Array.isArray(p.replies) ? p.replies : [],
          author: (p.author && typeof p.author === 'object') ? p.author : null,
        }))
        setPosts(mapped)
        setInlineEditingPostId(null)
        setInlineEditingText('')
        setPostToDeleteId(null)
        return
      }

      let id = conversationId
      if (!id) {
        id = await ensureConversation()
        setConversationId(id)
      }
      if (!id) {
        loadDemo()
        setInlineEditingPostId(null)
        setInlineEditingText('')
        setPostToDeleteId(null)
        return
      }
      const feed = await fetchConversationFeed(id, { limit: 50, offset: 0 })
      const mapped = (feed || []).map((p) => ({
        id: p.id,
        text: p.content,
        created_at: p.created_at,
        likes: Number(p.likes || 0),
        liked: !!p.liked,
        replies: Array.isArray(p.replies) ? p.replies : [],
      }))
      setPosts(mapped)
      setInlineEditingPostId(null)
      setInlineEditingText('')
      setPostToDeleteId(null)
    } catch (e) {
      const msg = String(e?.message || e || '').toLowerCase()
      if (msg.includes('abort')) return
      const courseIdText = String(courseId || '').trim()
      if (courseIdText) {
        const now = Date.now()
        const last = lastLoadErrorRef.current || { at: 0, message: '' }
        const nextMessage = String(e?.message || 'Não foi possível carregar os comentários.')
        if (!silent) setLoadError(nextMessage)
        const shouldToast = !silent && (now - Number(last.at || 0) > 7000 || String(last.message || '') !== nextMessage)
        if (shouldToast) {
          lastLoadErrorRef.current = { at: now, message: nextMessage }
          toast({ title: 'Erro ao carregar', description: nextMessage })
        }
        return
      }
      loadDemo()
    } finally {
      if (!silent) setLoading(false)
    }
  }

  useEffect(() => {
    refresh()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  useEffect(() => {
    if (!user?.id) return
    let cancelled = false
    let timer = null
    const tick = async () => {
      if (cancelled) return
      try {
        if (document?.hidden) return
      } catch (_) {}
      await refresh({ silent: true })
    }
    tick()
    timer = setInterval(tick, 2500)
    const onFocus = () => tick()
    try { window.addEventListener('focus', onFocus) } catch (_) {}
    return () => {
      cancelled = true
      try { if (timer) clearInterval(timer) } catch (_) {}
      try { window.removeEventListener('focus', onFocus) } catch (_) {}
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.id, courseId, threadKey, title, studentName, conversationId])

  useEffect(() => {
    const cid = String(conversationId || '').trim()
    if (!user?.id || !cid) return
    let channel = null
    const tick = async () => refresh({ silent: true })
    try {
      channel = supabase
        .channel(`aluno_inbox_${cid}`)
        .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'posts', filter: `conversation_id=eq.${cid}` }, () => tick())
        .subscribe()
    } catch (_) {
      channel = null
    }
    return () => {
      try { if (channel) channel.unsubscribe() } catch (_) {}
      try { if (channel) supabase.removeChannel(channel) } catch (_) {}
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.id, conversationId])

  const handleLikePost = async (postId) => {
    const post = posts.find((p) => p.id === postId)
    if (!post) return
    const nextLiked = !post.liked
    const nextLikes = nextLiked ? post.likes + 1 : Math.max(0, post.likes - 1)
    setPosts((prev) => prev.map((p) => (p.id === postId ? { ...p, liked: nextLiked, likes: nextLikes } : p)))

    if (!user?.id || !conversationId) {
      const next = posts.map((p) => (p.id === postId ? { ...p, liked: nextLiked, likes: nextLikes } : p))
      saveDemo(next)
      return
    }

    try {
      await supabase.from('posts').update({ likes: nextLikes, liked: nextLiked }).eq('id', postId)
    } catch (_) {}
  }

  const handleSubmit = async () => {
    const text = composer.trim()
    if (!text) return
    setSendError('')
    if (!user?.id) {
      const next = [
        {
          id: `demo-${Date.now()}`,
          text,
          created_at: new Date().toISOString(),
          likes: 0,
          liked: false,
          replies: [],
        },
        ...posts,
      ]
      setPosts(next)
      saveDemo(next)
      setComposer('')
      toast({ title: successTitle })
      return
    }

    const courseIdText = String(courseId || '').trim()
    if (courseIdText) {
      const conversationStorageKey = `connekt_aluno_inbox_conversation_${courseIdText}_${String(threadKey || '')}`
      try {
        const token = await getAccessToken()
        if (!token) throw new Error('missing_token')
        const r = await fetch('/api/producer?type=lesson_comment_post', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
          body: JSON.stringify({
            courseId: courseIdText,
            threadKey: String(threadKey || ''),
            title: String(title || ''),
            lessonTitle: String(lessonTitle || ''),
            content: text,
            studentName: String(studentName || 'Aluno'),
            tag: 'Curso',
          }),
        })
        const body = await r.json().catch(() => ({}))
        const errText = body?.message ? `${String(body?.error || 'send_failed')}: ${String(body.message)}` : String(body?.error || body?.message || 'send_failed')
        if (!r.ok || !body?.conversationId || !body?.post?.id) throw new Error(errText)
        setConversationId(String(body.conversationId))
        try { localStorage.setItem(conversationStorageKey, String(body.conversationId)) } catch (_) {}
        setPosts((prev) => [
          {
            id: body.post.id,
            text: body.post.content,
            created_at: body.post.created_at,
            likes: Number(body.post.likes || 0),
            liked: !!body.post.liked,
            replies: [],
            author: (body.post.author && typeof body.post.author === 'object') ? body.post.author : null,
          },
          ...(prev || []),
        ])
        setComposer('')
        toast({ title: successTitle })
        return
      } catch (e) {
        const msg = String(e?.message || 'Não foi possível enviar para o inbox do produtor.')
        setSendError(msg)
        toast({ title: 'Erro ao enviar', description: msg })
        return
      }
    }

    let id = conversationId
    if (!id) {
      id = await ensureConversation()
      setConversationId(id)
    }
    if (!id) {
      try {
        const token = await getAccessToken()
        if (!token) throw new Error('missing_token')
        const r = await fetch('/api/producer?type=aluno_inbox_post', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
          body: JSON.stringify({
            courseId: String(courseId || ''),
            threadKey: String(threadKey || ''),
            title: String(title || ''),
            content: text,
            studentName: String(studentName || 'Aluno'),
            tag: 'Curso',
          }),
        })
        const body = await r.json().catch(() => ({}))
        const errText = body?.message ? `${String(body?.error || 'send_failed')}: ${String(body.message)}` : String(body?.error || body?.message || 'send_failed')
        if (!r.ok || !body?.conversationId || !body?.post?.id) throw new Error(errText)
        setConversationId(String(body.conversationId))
        setPosts((prev) => [
          {
            id: body.post.id,
            text: body.post.content,
            created_at: body.post.created_at,
            likes: Number(body.post.likes || 0),
            liked: !!body.post.liked,
            replies: [],
          },
          ...(prev || []),
        ])
        setComposer('')
        toast({ title: successTitle })
        return
      } catch (_) {
        const next = [
          {
            id: `demo-${Date.now()}`,
            text,
            created_at: new Date().toISOString(),
            likes: 0,
            liked: false,
            replies: [],
          },
          ...posts,
        ]
        setPosts(next)
        saveDemo(next)
        setComposer('')
        toast({ title: successTitle })
        return
      }
    }

    try {
      const { data, error } = await supabase
        .from('posts')
        .insert([{ conversation_id: id, content: text, likes: 0, liked: false }])
        .select('id,content,created_at,likes,liked')
        .single()
      if (error) throw error
      try {
        await supabase.from('conversations').update({ date: new Date().toISOString(), unread: 1 }).eq('id', id)
      } catch (_) {}
      setPosts((prev) => [
        {
          id: data.id,
          text: data.content,
          created_at: data.created_at,
          likes: Number(data.likes || 0),
          liked: !!data.liked,
          replies: [],
        },
        ...prev,
      ])
      setComposer('')
      toast({ title: successTitle })
    } catch (_) {
      toast({ title: 'Erro ao enviar', description: 'Tente novamente.' })
    }
  }

  const handleStartInlineEdit = (post) => {
    if (!post) return
    setInlineEditingPostId(post.id)
    setInlineEditingText(String(post.text || ''))
    setPostToDeleteId(null)
  }

  const handleCancelInlineEdit = () => {
    setInlineEditingPostId(null)
    setInlineEditingText('')
  }

  const handleSaveInlineEdit = async (postId) => {
    const text = String(inlineEditingText || '').trim()
    if (!postId || !text) return

    if (!user?.id || String(postId).startsWith('demo-')) {
      const next = posts.map((p) => (p.id === postId ? { ...p, text } : p))
      setPosts(next)
      saveDemo(next)
      handleCancelInlineEdit()
      toast({ title: `${singularLabel} atualizado` })
      return
    }

    try {
      const { data, error } = await supabase
        .from('posts')
        .update({ content: text })
        .eq('id', postId)
        .select('id,content')
        .single()
      if (error) throw error
      try {
        if (conversationId) await supabase.from('conversations').update({ date: new Date().toISOString() }).eq('id', conversationId)
      } catch (_) {}
      setPosts((prev) => prev.map((p) => (p.id === postId ? { ...p, text: String(data?.content ?? text) } : p)))
      handleCancelInlineEdit()
      toast({ title: `${singularLabel} atualizado` })
    } catch (_) {
      toast({ title: 'Erro ao atualizar', description: 'Tente novamente.' })
    }
  }

  const handleCancelComposer = () => {
    setComposer('')
  }

  const handleDeletePost = async (postId) => {
    if (!postId) return
    setPostToDeleteId(null)
    if (!user?.id || String(postId).startsWith('demo-')) {
      const next = posts.filter((p) => p.id !== postId)
      setPosts(next)
      saveDemo(next)
      if (inlineEditingPostId === postId) handleCancelInlineEdit()
      toast({ title: `${singularLabel} excluído` })
      return
    }
    try {
      await supabase.from('posts').delete().eq('id', postId)
      setPosts((prev) => prev.filter((p) => p.id !== postId))
      if (inlineEditingPostId === postId) handleCancelInlineEdit()
      toast({ title: `${singularLabel} excluído` })
    } catch (_) {
      toast({ title: 'Erro ao excluir', description: 'Tente novamente.' })
    }
  }

  const countText = posts.length

  return (
    <div className="mt-6">
      <div className="flex items-center justify-between">
        <div className="text-[12px] font-semibold text-[#22252B]">{headerTitle}</div>
        <div className="text-[11px] text-[#737780]">{countText} {unitLabel}</div>
      </div>

      <div className="mt-3 rounded-[10px] border border-[#E3E4E5] bg-white p-4">
        <textarea
          ref={composerRef}
          value={composer}
          onChange={(e) => setComposer(e.target.value)}
          className="w-full min-h-[96px] rounded-[10px] border border-[#E3E4E5] bg-white px-3 py-2 text-[12px] outline-none focus:border-[#0047BB]"
          placeholder={placeholder || 'Digite aqui sua pergunta ou comentário'}
          maxLength={600}
        />
        {loadError ? <div className="mt-2 text-[11px] text-[#B91C1C]">{loadError}</div> : null}
        {sendError ? <div className="mt-2 text-[11px] text-[#B91C1C]">{sendError}</div> : null}
        <div className="mt-3 flex items-center justify-end gap-2">
          <button
            type="button"
            className="h-9 px-4 rounded-[8px] border border-[#E3E4E5] bg-white text-[12px] font-semibold text-[#22252B]"
            onClick={handleCancelComposer}
          >
            Cancelar
          </button>
          <button
            type="button"
            className="h-9 px-4 rounded-[8px] bg-[#0047BB] text-white text-[12px] font-semibold disabled:opacity-50 disabled:cursor-not-allowed"
            disabled={!composer.trim() || loading}
            onClick={handleSubmit}
          >
            {submitLabel}
          </button>
        </div>
      </div>

      <div className="mt-4 space-y-4">
        {loading ? <div className="text-[12px] text-[#737780]">Carregando...</div> : null}
        {posts.map((p) => {
          const replies = Array.isArray(p.replies) ? p.replies : []
          const open = !!openRepliesById[p.id]
          const isInlineEditing = inlineEditingPostId === p.id
          const authorName = String(p?.author?.name || studentName || 'Aluno')
          return (
            <div key={p.id} className="rounded-[10px] border border-[#E3E4E5] bg-white p-4">
              <div className="flex items-start gap-3">
                <div className="w-8 h-8 rounded-full bg-[#F3F4F5] border border-[#E3E4E5] flex items-center justify-center text-[#0047BB] font-bold text-[12px]">
                  {authorName.slice(0, 1).toUpperCase()}
                </div>
                <div className="flex-1">
                  <div className="text-[12px] font-semibold text-[#22252B]">{authorName}</div>
                  {isInlineEditing ? (
                    <div className="mt-2">
                      <textarea
                        value={inlineEditingText}
                        onChange={(e) => setInlineEditingText(e.target.value)}
                        className="w-full min-h-[80px] rounded-[10px] border border-[#E3E4E5] bg-white px-3 py-2 text-[12px] outline-none focus:border-[#0047BB]"
                        maxLength={600}
                      />
                      <div className="mt-2 flex items-center justify-end gap-2">
                        <button
                          type="button"
                          className="h-8 px-3 rounded-[8px] border border-[#E3E4E5] bg-white text-[12px] font-semibold text-[#22252B]"
                          onClick={handleCancelInlineEdit}
                        >
                          Cancelar
                        </button>
                        <button
                          type="button"
                          className="h-8 px-3 rounded-[8px] bg-[#0047BB] text-white text-[12px] font-semibold disabled:opacity-50 disabled:cursor-not-allowed"
                          disabled={!String(inlineEditingText || '').trim()}
                          onClick={() => handleSaveInlineEdit(p.id)}
                        >
                          Salvar
                        </button>
                      </div>
                    </div>
                  ) : (
                    <div className="mt-1 text-[12px] text-[#737780] leading-[18px]">{p.text}</div>
                  )}
                  <div className="mt-3 flex items-center gap-3 text-[11px] text-[#737780]">
                    {isInlineEditing ? null : postToDeleteId === p.id ? (
                      <div className="flex items-center gap-2 text-[11px]">
                        <span className="text-[#B91C1C] font-semibold">Excluir?</span>
                        <button type="button" className="text-[#B91C1C] font-semibold hover:underline" onClick={() => handleDeletePost(p.id)}>Sim</button>
                        <button type="button" className="text-[#737780] font-semibold hover:underline" onClick={() => setPostToDeleteId(null)}>Não</button>
                      </div>
                    ) : (
                      <>
                        <button type="button" className="inline-flex items-center gap-1 hover:text-[#22252B]" onClick={() => handleLikePost(p.id)}>
                          <Heart className={`w-4 h-4 ${p.liked ? 'text-[#EF4444]' : 'text-[#737780]'}`} />
                          Curtir {p.likes ? `(${p.likes})` : ''}
                        </button>
                        <button type="button" className="inline-flex items-center gap-1 hover:text-[#22252B]" onClick={() => handleStartInlineEdit(p)}>
                          <Edit2 className="w-4 h-4 text-[#737780]" />
                          Editar
                        </button>
                        <button type="button" className="inline-flex items-center gap-1 hover:text-[#B91C1C]" onClick={() => setPostToDeleteId(p.id)}>
                          <Trash2 className="w-4 h-4 text-[#737780]" />
                          Excluir
                        </button>
                      </>
                    )}
                    {replies.length ? (
                      <button
                        type="button"
                        className="hover:text-[#22252B]"
                        onClick={() => setOpenRepliesById((s) => ({ ...s, [p.id]: !open }))}
                      >
                        {open ? 'Ocultar' : 'Ver'} {replies.length} respostas
                      </button>
                    ) : null}
                  </div>

                  {replies.length && open ? (
                    <div className="mt-3 pl-5 border-l border-[#E3E4E5] space-y-3">
                      {replies.map((r) => (
                        <div key={r.id} className="flex items-start gap-3">
                          <div className="w-7 h-7 rounded-full bg-[#F3F4F5] border border-[#E3E4E5] flex items-center justify-center text-[#22252B] font-bold text-[11px]">
                            {String(r?.author?.name || 'P').slice(0, 1).toUpperCase()}
                          </div>
                          <div className="flex-1">
                            <div className="text-[12px] font-semibold text-[#22252B]">{r?.author?.name || 'Professor'}</div>
                            <div className="mt-1 text-[12px] text-[#737780] leading-[18px]">{r.content}</div>
                          </div>
                        </div>
                      ))}
                      <button
                        type="button"
                        className="mt-2 text-[11px] font-semibold text-[#0047BB]"
                        onClick={() => {
                          setComposer((prev) => prev || '@Professor ')
                          window.setTimeout(() => composerRef.current?.focus?.(), 0)
                        }}
                      >
                        Responder
                      </button>
                    </div>
                  ) : null}
                </div>
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
