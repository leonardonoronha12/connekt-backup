import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Helmet } from 'react-helmet-async'
import { Plus, Search, X, Download, Upload, Copy, ShieldBan, ShieldCheck, RefreshCcw, Settings } from 'lucide-react'
import { useAuth } from '@/contexts/SupabaseAuthContext'
import { toast } from '@/hooks/use-toast.ts'

function navigateTo(path) {
  window.history.pushState({}, '', path)
  window.dispatchEvent(new PopStateEvent('popstate'))
}

function normalizeType(v) {
  const t = String(v || '').trim().toLowerCase()
  if (t === 'administrador' || t === 'admin') return 'admin'
  if (t === 'produtor' || t === 'producer') return 'produtor'
  if (t === 'aluno' || t === 'student') return 'aluno'
  return 'aluno'
}

function isValidIsoDate(value) {
  return /^\d{4}-\d{2}-\d{2}$/.test(String(value || '').trim())
}

function parseCsv(text) {
  const raw = String(text || '').replace(/\r\n/g, '\n').replace(/\r/g, '\n')
  const lines = raw.split('\n').map((l) => l.trim()).filter(Boolean)
  if (!lines.length) return []
  const count = (s, ch) => (String(s || '').match(new RegExp(`\\${ch}`, 'g')) || []).length
  const detectSep = (line) => {
    const l = String(line || '')
    const semi = count(l, ';')
    const comma = count(l, ',')
    const tab = count(l, '\t')
    if (tab >= semi && tab >= comma && tab > 0) return '\t'
    if (semi >= comma && semi > 0) return ';'
    return ','
  }
  const sep = detectSep(lines[0])
  const splitLine = (line) => String(line || '').split(sep).map((s) => s.trim().replace(/^"|"$/g, ''))
  const normalizeKey = (k) => String(k || '')
    .replace(/^\uFEFF/, '')
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '')
  const header = splitLine(lines[0]).map((h) => normalizeKey(h))
  const idx = (candidates) => {
    for (const c of candidates) {
      const i = header.findIndex((h) => h === c)
      if (i >= 0) return i
    }
    return -1
  }
  const idxName = idx(['nome', 'name', 'full_name'])
  const idxEmail = idx(['email', 'e_mail', 'e-mail', 'mail'])
  const idxType = idx(['tipo', 'type', 'account_type', 'role'])
  const idxCourseId = idx(['course_id', 'curso_id', 'courseid'])
  const idxExpires = idx(['expires_at', 'expiresat', 'expira_em', 'expiracao', 'validade'])

  const out = []
  for (let i = 1; i < lines.length; i += 1) {
    const cols = splitLine(lines[i])
    const email = String(cols[idxEmail] || '').trim()
    if (!email) continue
    out.push({
      name: String(cols[idxName] || '').trim(),
      email,
      accountType: normalizeType(cols[idxType] || 'aluno'),
      courseId: String(cols[idxCourseId] || '').trim(),
      expiresAt: String(cols[idxExpires] || '').trim(),
    })
  }
  return out
}

function formatDt(value) {
  const v = String(value || '').trim()
  if (!v) return ''
  const d = new Date(v)
  if (!Number.isFinite(d.getTime())) return v
  try { return new Intl.DateTimeFormat('pt-BR', { dateStyle: 'short', timeStyle: 'short' }).format(d) } catch (_) { return v }
}

export default function PlatformAdminPanelPage() {
  const { session, signOut } = useAuth()
  const tokenRef = useRef('')
  useEffect(() => {
    tokenRef.current = String(session?.access_token || '')
  }, [session?.access_token])

  const [me, setMe] = useState(null)
  const [courses, setCourses] = useState([])

  const [query, setQuery] = useState('')
  const [typeFilter, setTypeFilter] = useState('all')
  const [courseFilter, setCourseFilter] = useState('')
  const [showDisabled, setShowDisabled] = useState(false)

  const [loading, setLoading] = useState(true)
  const [rows, setRows] = useState([])
  const [usersMeta, setUsersMeta] = useState(null)
  const [usersError, setUsersError] = useState('')
  const [selectedIds, setSelectedIds] = useState(new Set())
  const [refreshTick, setRefreshTick] = useState(0)

  const [createOpen, setCreateOpen] = useState(false)
  const [createForm, setCreateForm] = useState({ name: '', email: '', accountType: 'aluno', courseId: '', expiresAt: '' })
  const [createLoading, setCreateLoading] = useState(false)

  const [editOpen, setEditOpen] = useState(false)
  const [editLoading, setEditLoading] = useState(false)
  const [editUser, setEditUser] = useState(null)
  const [editForm, setEditForm] = useState({ name: '', phone: '', accountType: 'aluno', disabled: false, courses: [] })

  const [bulkCsvOpen, setBulkCsvOpen] = useState(false)
  const [bulkCsvText, setBulkCsvText] = useState('')
  const [bulkCsvParsed, setBulkCsvParsed] = useState([])
  const [bulkCsvLoading, setBulkCsvLoading] = useState(false)
  const [bulkCsvParsing, setBulkCsvParsing] = useState(false)
  const [bulkCsvSource, setBulkCsvSource] = useState('text')
  const [bulkCsvFileName, setBulkCsvFileName] = useState('')

  const authHeaders = useMemo(() => {
    const t = String(session?.access_token || '')
    return t ? { Authorization: `Bearer ${t}` } : {}
  }, [session?.access_token])

  const ensureAdmin = useCallback(async () => {
    const r = await fetch('/api/admin/me', { headers: authHeaders })
    if (!r.ok) return null
    const body = await r.json().catch(() => ({}))
    return body || null
  }, [authHeaders])

  useEffect(() => {
    let active = true
    const run = async () => {
      setLoading(true)
      try {
        const who = await ensureAdmin()
        if (!active) return
        if (!who?.ok) {
          try { await signOut() } catch (_) {}
          navigateTo('/admin/login')
          return
        }
        setMe(who?.me || null)
        const rc = await fetch('/api/admin/courses/list', { headers: authHeaders })
        const bc = await rc.json().catch(() => ({}))
        if (active) setCourses(Array.isArray(bc?.courses) ? bc.courses : [])
      } catch (_) {
      } finally {
        if (active) setLoading(false)
      }
    }
    run()
    return () => { active = false }
  }, [ensureAdmin, authHeaders, signOut])

  const fetchUsers = useCallback(async () => {
    const qs = new URLSearchParams()
    if (query.trim()) qs.set('q', query.trim())
    if (typeFilter && typeFilter !== 'all') qs.set('type', typeFilter)
    if (showDisabled) qs.set('show_disabled', '1')
    if (courseFilter && (typeFilter === 'aluno' || typeFilter === 'all')) qs.set('course_id', courseFilter)
    qs.set('per_page', 'all')
    const r = await fetch(`/api/admin/users/list?${qs.toString()}`, { headers: authHeaders })
    const body = await r.json().catch(() => ({}))
    if (!r.ok) throw new Error(body?.message || body?.details || body?.error || 'Falha ao listar usuários')
    return body || {}
  }, [authHeaders, courseFilter, query, showDisabled, typeFilter])

  useEffect(() => {
    let active = true
    const run = async () => {
      setLoading(true)
      setUsersError('')
      try {
        const body = await fetchUsers()
        if (!active) return
        const list = Array.isArray(body?.users) ? body.users : []
        setRows(list)
        setUsersMeta(body?.meta || null)
        setSelectedIds(new Set())
      } catch (e) {
        if (!active) return
        setRows([])
        setUsersMeta(null)
        setUsersError(String(e?.message || 'Erro ao carregar usuários'))
        toast({ title: 'Erro', description: e?.message || 'Erro ao carregar usuários', variant: 'destructive' })
      } finally {
        if (active) setLoading(false)
      }
    }
    run()
    return () => { active = false }
  }, [fetchUsers, refreshTick])

  const toggleSelected = (userId) => {
    const id = String(userId || '').trim()
    if (!id) return
    setSelectedIds((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  const selectedCount = selectedIds.size

  const openEdit = async (userId) => {
    const id = String(userId || '').trim()
    if (!id) return
    setEditOpen(true)
    setEditLoading(true)
    setEditUser(null)
    try {
      const r = await fetch(`/api/admin/users/get?user_id=${encodeURIComponent(id)}`, { headers: authHeaders })
      const body = await r.json().catch(() => ({}))
      if (!r.ok) throw new Error(body?.error || 'Falha ao carregar usuário')
      setEditUser(body?.user || null)
      setEditForm({
        name: String(body?.user?.name || '').trim(),
        phone: String(body?.user?.phone || '').trim(),
        accountType: normalizeType(body?.user?.accountType || 'aluno'),
        disabled: Boolean(body?.user?.disabled),
        courses: Array.isArray(body?.user?.courses) ? body.user.courses : [],
      })
    } catch (e) {
      toast({ title: 'Erro', description: e?.message || 'Erro ao carregar usuário', variant: 'destructive' })
      setEditOpen(false)
    } finally {
      setEditLoading(false)
    }
  }

  const saveEdit = async () => {
    if (!editUser?.id) return
    setEditLoading(true)
    try {
      const payload = {
        userId: String(editUser.id),
        name: String(editForm.name || '').trim(),
        phone: String(editForm.phone || '').trim(),
        accountType: normalizeType(editForm.accountType),
        disabled: Boolean(editForm.disabled),
        courses: (Array.isArray(editForm.courses) ? editForm.courses : []).map((c) => ({
          courseId: String(c?.courseId || '').trim(),
          expiresAt: String(c?.expiresAt || '').trim() || null,
        })).filter((c) => c.courseId),
      }
      const r = await fetch('/api/admin/users/update', {
        method: 'POST',
        headers: { ...authHeaders, 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })
      const body = await r.json().catch(() => ({}))
      if (!r.ok) throw new Error(body?.error || 'Falha ao salvar')
      toast({ title: 'Salvo', description: 'Usuário atualizado.' })
      setEditOpen(false)
      setRefreshTick((v) => v + 1)
    } catch (e) {
      toast({ title: 'Erro', description: e?.message || 'Erro ao salvar', variant: 'destructive' })
    } finally {
      setEditLoading(false)
    }
  }

  const createUser = async () => {
    const name = String(createForm.name || '').trim()
    const email = String(createForm.email || '').trim()
    const accountType = normalizeType(createForm.accountType)
    if (!email) return
    setCreateLoading(true)
    try {
      const payload = {
        name,
        email,
        accountType,
        courses: accountType === 'aluno' && createForm.courseId
          ? [{ courseId: String(createForm.courseId), expiresAt: String(createForm.expiresAt || '').trim() || null }]
          : [],
      }
      const r = await fetch('/api/admin/users/create', {
        method: 'POST',
        headers: { ...authHeaders, 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })
      const body = await r.json().catch(() => ({}))
      if (!r.ok) throw new Error(body?.error || 'Falha ao criar usuário')
      const link = String(body?.firstAccessLink || '').trim()
      toast({ title: 'Usuário criado', description: link ? 'Link de primeiro acesso copiado.' : 'Usuário criado.' })
      if (link) {
        try { await navigator.clipboard.writeText(link) } catch (_) {}
      }
      setCreateOpen(false)
      setCreateForm({ name: '', email: '', accountType: 'aluno', courseId: '', expiresAt: '' })
      setRefreshTick((v) => v + 1)
    } catch (e) {
      toast({ title: 'Erro', description: e?.message || 'Erro ao criar usuário', variant: 'destructive' })
    } finally {
      setCreateLoading(false)
    }
  }

  const bulkDisable = async () => {
    if (!selectedCount) return
    try {
      const r = await fetch('/api/admin/users/bulk-disable', {
        method: 'POST',
        headers: { ...authHeaders, 'Content-Type': 'application/json' },
        body: JSON.stringify({ userIds: Array.from(selectedIds) }),
      })
      const body = await r.json().catch(() => ({}))
      if (!r.ok) throw new Error(body?.error || 'Falha ao desativar')
      toast({ title: 'Concluído', description: 'Usuários desativados.' })
      setRefreshTick((v) => v + 1)
    } catch (e) {
      toast({ title: 'Erro', description: e?.message || 'Erro ao desativar', variant: 'destructive' })
    }
  }

  const bulkEnable = async () => {
    if (!selectedCount) return
    try {
      const r = await fetch('/api/admin/users/bulk-enable', {
        method: 'POST',
        headers: { ...authHeaders, 'Content-Type': 'application/json' },
        body: JSON.stringify({ userIds: Array.from(selectedIds) }),
      })
      const body = await r.json().catch(() => ({}))
      if (!r.ok) throw new Error(body?.error || 'Falha ao ativar')
      toast({ title: 'Concluído', description: 'Usuários ativados.' })
      setRefreshTick((v) => v + 1)
    } catch (e) {
      toast({ title: 'Erro', description: e?.message || 'Erro ao ativar', variant: 'destructive' })
    }
  }

  const exportXlsx = async () => {
    try {
      const qs = new URLSearchParams()
      if (query.trim()) qs.set('q', query.trim())
      if (typeFilter && typeFilter !== 'all') qs.set('type', typeFilter)
      if (showDisabled) qs.set('show_disabled', '1')
      if (courseFilter && (typeFilter === 'aluno' || typeFilter === 'all')) qs.set('course_id', courseFilter)
      qs.set('per_page', '500')
      const r = await fetch(`/api/admin/users/list?${qs.toString()}`, { headers: authHeaders })
      const body = await r.json().catch(() => ({}))
      if (!r.ok) throw new Error(body?.error || 'Falha ao exportar')
      const users = Array.isArray(body?.users) ? body.users : []
      const XLSX = await import('xlsx')
      const rowsForSheet = users.map((u) => ({
        nome: String(u?.name || ''),
        email: String(u?.email || ''),
        tipo: String(u?.accountType || ''),
        status: u?.disabled ? 'desativado' : 'ativo',
        criado_em: String(u?.createdAt || ''),
        ultimo_login: String(u?.lastSignInAt || ''),
      }))
      const ws = XLSX.utils.json_to_sheet(rowsForSheet)
      const wb = XLSX.utils.book_new()
      XLSX.utils.book_append_sheet(wb, ws, 'Usuários')
      const buf = XLSX.write(wb, { type: 'array', bookType: 'xlsx' })
      const blob = new Blob([buf], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' })
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = 'usuarios-connekt.xlsx'
      document.body.appendChild(a)
      a.click()
      a.remove()
      URL.revokeObjectURL(url)
    } catch (e) {
      toast({ title: 'Erro', description: e?.message || 'Erro ao exportar', variant: 'destructive' })
    }
  }

  useEffect(() => {
    if (bulkCsvSource !== 'text') return
    try {
      const parsed = parseCsv(bulkCsvText)
      setBulkCsvParsed(parsed)
    } catch (_) {
      setBulkCsvParsed([])
    }
  }, [bulkCsvSource, bulkCsvText])

  const parseExpiresFromSpreadsheetValue = (value, XLSX) => {
    if (typeof value === 'number' && Number.isFinite(value) && XLSX?.SSF?.parse_date_code) {
      try {
        const d = XLSX.SSF.parse_date_code(value)
        const y = Number(d?.y || 0)
        const m = Number(d?.m || 0)
        const day = Number(d?.d || 0)
        if (y > 0 && m > 0 && day > 0) {
          return `${String(y).padStart(4, '0')}-${String(m).padStart(2, '0')}-${String(day).padStart(2, '0')}`
        }
      } catch (_) {}
    }
    const s = String(value || '').trim()
    if (!s) return ''
    if (isValidIsoDate(s)) return s
    const m = s.match(/^(\d{2})\/(\d{2})\/(\d{4})$/)
    if (m) return `${m[3]}-${m[2]}-${m[1]}`
    const dt = new Date(s)
    if (Number.isFinite(dt.getTime())) return dt.toISOString().slice(0, 10)
    return s
  }

  const handleBulkFile = useCallback(async (file) => {
    const f = file || null
    if (!f) return
    const name = String(f.name || '').trim()
    const lower = name.toLowerCase()
    setBulkCsvParsing(true)
    try {
      setBulkCsvFileName(name)
      if (lower.endsWith('.csv') || String(f.type || '').toLowerCase().includes('csv')) {
        const text = await f.text()
        setBulkCsvSource('text')
        setBulkCsvText(text)
        return
      }

      if (lower.endsWith('.xlsx') || lower.endsWith('.xls')) {
        const XLSX = await import('xlsx')
        const buf = await f.arrayBuffer()
        const wb = XLSX.read(buf, { type: 'array' })
        const sheetName = String(wb.SheetNames?.[0] || '')
        const ws = sheetName ? wb.Sheets?.[sheetName] : null
        if (!ws) throw new Error('Planilha inválida')
        const rawRows = XLSX.utils.sheet_to_json(ws, { defval: '', raw: true })

        const normalizeKey = (k) => String(k || '')
          .trim()
          .toLowerCase()
          .normalize('NFD')
          .replace(/[\u0300-\u036f]/g, '')
          .replace(/[^a-z0-9]+/g, '_')
          .replace(/^_+|_+$/g, '')

        const pick = (obj, keys) => {
          for (const k of keys) {
            const v = obj?.[k]
            if (v === null || v === undefined) continue
            const s = String(v).trim()
            if (!s) continue
            return v
          }
          return ''
        }

        const users = []
        for (const row of Array.isArray(rawRows) ? rawRows : []) {
          const normalized = {}
          for (const [k, v] of Object.entries(row || {})) normalized[normalizeKey(k)] = v
          const email = String(pick(normalized, ['email', 'e_mail', 'e-mail', 'mail', 'user_email'])).trim().toLowerCase()
          if (!email) continue
          const nameValue = pick(normalized, ['nome', 'name', 'full_name', 'profile_full_name', 'display_name'])
          const typeValue = pick(normalized, ['tipo', 'type', 'account_type', 'role', 'platform_role'])
          const courseValue = pick(normalized, ['course_id', 'curso_id', 'curso', 'courseid'])
          const expiresValue = pick(normalized, ['expires_at', 'expiresat', 'expira_em', 'expiracao', 'validade', 'expires'])

          users.push({
            name: String(nameValue || '').trim(),
            email,
            accountType: normalizeType(typeValue || 'aluno'),
            courseId: String(courseValue || '').trim(),
            expiresAt: parseExpiresFromSpreadsheetValue(expiresValue, XLSX),
          })
        }

        setBulkCsvSource('file')
        setBulkCsvText('')
        setBulkCsvParsed(users)
        return
      }

      throw new Error('Formato não suportado (use .csv, .xlsx ou .xls)')
    } catch (e) {
      setBulkCsvFileName('')
      setBulkCsvSource('text')
      setBulkCsvText('')
      setBulkCsvParsed([])
      toast({ title: 'Erro', description: e?.message || 'Erro ao ler planilha', variant: 'destructive' })
    } finally {
      setBulkCsvParsing(false)
    }
  }, [])

  const runBulkCreate = async () => {
    const items = Array.isArray(bulkCsvParsed) ? bulkCsvParsed : []
    if (!items.length) return
    setBulkCsvLoading(true)
    try {
      const payload = {
        users: items.map((u) => ({
          name: String(u?.name || '').trim(),
          email: String(u?.email || '').trim(),
          accountType: normalizeType(u?.accountType || 'aluno'),
          courses: (String(u?.courseId || '').trim() && normalizeType(u?.accountType || 'aluno') === 'aluno')
            ? [{ courseId: String(u.courseId).trim(), expiresAt: isValidIsoDate(u?.expiresAt) ? String(u.expiresAt).trim() : null }]
            : [],
        })),
      }
      const r = await fetch('/api/admin/users/bulk-create', {
        method: 'POST',
        headers: { ...authHeaders, 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })
      const body = await r.json().catch(() => ({}))
      if (!r.ok) throw new Error(body?.error || 'Falha ao importar')
      const okCount = Number(body?.okCount || 0)
      const failCount = Number(body?.failCount || 0)
      toast({ title: 'Importação concluída', description: `Sucesso: ${okCount}. Falhas: ${failCount}.` })
      setBulkCsvOpen(false)
      setBulkCsvSource('text')
      setBulkCsvText('')
      setBulkCsvParsed([])
      setBulkCsvFileName('')
      setRefreshTick((v) => v + 1)
    } catch (e) {
      toast({ title: 'Erro', description: e?.message || 'Erro ao importar', variant: 'destructive' })
    } finally {
      setBulkCsvLoading(false)
    }
  }

  const getFirstAccessLink = async (userId) => {
    const id = String(userId || '').trim()
    if (!id) return
    try {
      const r = await fetch(`/api/admin/users/first-access-link?user_id=${encodeURIComponent(id)}`, { headers: authHeaders })
      const body = await r.json().catch(() => ({}))
      if (!r.ok) throw new Error(body?.error || 'Falha ao gerar link')
      const link = String(body?.firstAccessLink || '').trim()
      if (!link) throw new Error('Link indisponível')
      try { await navigator.clipboard.writeText(link) } catch (_) {}
      toast({ title: 'Copiado', description: 'Link de primeiro acesso copiado.' })
    } catch (e) {
      toast({ title: 'Erro', description: e?.message || 'Erro ao gerar link', variant: 'destructive' })
    }
  }

  const sortedCourses = useMemo(() => {
    const base = Array.isArray(courses) ? courses : []
    return base.slice().sort((a, b) => String(a?.title || '').localeCompare(String(b?.title || ''), 'pt-BR'))
  }, [courses])

  return (
    <>
      <Helmet>
        <title>Connekt - Painel administrativo</title>
      </Helmet>
      <div className="min-h-screen bg-[#F5F6FA]">
        <div className="border-b border-[#E3E4E5] bg-white">
          <div className="max-w-[1200px] mx-auto px-6 py-5 flex items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-[12px] bg-[#EEF2FF] flex items-center justify-center">
                <Settings className="w-5 h-5 text-[#0047BB]" />
              </div>
              <div>
                <div className="text-[14px] font-semibold text-[#1E1B39]">Admin Connekt</div>
                <div className="text-[12px] text-[#737780] truncate">{me?.email || ''}</div>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <button
                type="button"
                className="h-9 px-3 rounded-[10px] border border-[#E3E4E5] bg-white text-[12px] font-semibold text-[#1E1B39] hover:bg-[#F8FAFC]"
                onClick={async () => {
                  try { await signOut() } catch (_) {}
                  navigateTo('/admin/login')
                }}
              >
                Sair
              </button>
            </div>
          </div>
        </div>

        <div className="max-w-[1200px] mx-auto px-6 py-7">
          <div className="rounded-[12px] border border-[#E3E4E5] bg-white p-4">
            <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
              <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
                <div className="relative w-full sm:w-[340px]">
                  <Search className="w-4 h-4 text-[#9291A5] absolute left-3 top-1/2 -translate-y-1/2" />
                  <input
                    value={query}
                    onChange={(e) => setQuery(e.target.value)}
                    placeholder="Filtrar por nome ou email"
                    className="w-full h-[40px] rounded-[10px] border border-[#E3E4E5] pl-10 pr-9 text-[13px] outline-none focus:border-[#0047BB]"
                  />
                  {query ? (
                    <button
                      type="button"
                      className="absolute right-2 top-1/2 -translate-y-1/2 w-7 h-7 rounded-[8px] hover:bg-[#F3F4F6] flex items-center justify-center"
                      onClick={() => setQuery('')}
                    >
                      <X className="w-4 h-4 text-[#737780]" />
                    </button>
                  ) : null}
                </div>
                <select
                  value={typeFilter}
                  onChange={(e) => setTypeFilter(e.target.value)}
                  className="h-[40px] rounded-[10px] border border-[#E3E4E5] px-3 text-[13px] bg-white outline-none focus:border-[#0047BB]"
                >
                  <option value="all">Todos</option>
                  <option value="aluno">Aluno</option>
                  <option value="produtor">Produtor</option>
                  <option value="admin">Administrador</option>
                </select>
                {(typeFilter === 'aluno' || typeFilter === 'all') ? (
                  <select
                    value={courseFilter}
                    onChange={(e) => setCourseFilter(e.target.value)}
                    className="h-[40px] rounded-[10px] border border-[#E3E4E5] px-3 text-[13px] bg-white outline-none focus:border-[#0047BB]"
                  >
                    <option value="">Curso (todos)</option>
                    {sortedCourses.map((c) => (
                      <option key={c.id} value={c.id}>{c.title}</option>
                    ))}
                  </select>
                ) : null}
                <label className="inline-flex items-center gap-2 text-[12px] text-[#1E1B39]">
                  <input
                    type="checkbox"
                    checked={showDisabled}
                    onChange={(e) => setShowDisabled(e.target.checked)}
                  />
                  Mostrar desativados
                </label>
              </div>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  className="h-9 px-3 rounded-[10px] border border-[#E3E4E5] bg-white text-[12px] font-semibold text-[#1E1B39] hover:bg-[#F8FAFC]"
                  onClick={exportXlsx}
                >
                  <Download className="w-4 h-4 inline-block mr-2" />
                  Exportar
                </button>
                <button
                  type="button"
                  className="h-9 px-3 rounded-[10px] border border-[#E3E4E5] bg-white text-[12px] font-semibold text-[#1E1B39] hover:bg-[#F8FAFC]"
                  onClick={() => setBulkCsvOpen(true)}
                >
                  <Upload className="w-4 h-4 inline-block mr-2" />
                  Importar planilha
                </button>
                <button
                  type="button"
                  className="h-9 px-3 rounded-[10px] bg-[#0047BB] text-white text-[12px] font-semibold hover:bg-[#003da0]"
                  onClick={() => setCreateOpen(true)}
                >
                  <Plus className="w-4 h-4 inline-block mr-2" />
                  Adicionar
                </button>
              </div>
            </div>
          </div>

          {usersMeta?.warning ? (
            <div className="mt-4 rounded-[12px] border border-[#FCA5A5] bg-[#FEF2F2] p-4 text-[12px] text-[#991B1B]">
              {String(usersMeta.warning)}
            </div>
          ) : null}

          {selectedCount ? (
            <div className="mt-4 rounded-[12px] border border-[#E3E4E5] bg-white p-4 flex items-center justify-between gap-3">
              <div className="text-[13px] text-[#1E1B39]">{selectedCount} selecionado(s)</div>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  className="h-9 px-3 rounded-[10px] border border-[#E3E4E5] bg-white text-[12px] font-semibold text-[#1E1B39] hover:bg-[#F8FAFC]"
                  onClick={bulkEnable}
                >
                  <ShieldCheck className="w-4 h-4 inline-block mr-2" />
                  Ativar
                </button>
                <button
                  type="button"
                  className="h-9 px-3 rounded-[10px] bg-[#DC2626] text-white text-[12px] font-semibold hover:bg-[#B91C1C]"
                  onClick={bulkDisable}
                >
                  <ShieldBan className="w-4 h-4 inline-block mr-2" />
                  Desativar
                </button>
              </div>
            </div>
          ) : null}

          <div className="mt-4 rounded-[12px] border border-[#E3E4E5] bg-white overflow-hidden">
            <div className="grid grid-cols-12 gap-3 px-4 py-3 bg-[#F8FAFC] border-b border-[#E3E4E5] text-[11px] font-semibold text-[#737780]">
              <div className="col-span-1">
                <input
                  type="checkbox"
                  checked={rows.length > 0 && selectedIds.size === rows.length}
                  onChange={(e) => {
                    const next = new Set()
                    if (e.target.checked) {
                      for (const r of rows) next.add(String(r?.id || ''))
                    }
                    setSelectedIds(next)
                  }}
                />
              </div>
              <div className="col-span-3">Nome</div>
              <div className="col-span-3">Email</div>
              <div className="col-span-2">Tipo</div>
              <div className="col-span-2">Status</div>
              <div className="col-span-1 text-right">Ações</div>
            </div>
            {loading ? (
              <div className="p-6 text-[13px] text-[#737780]">Carregando...</div>
            ) : rows.length === 0 ? (
              <div className="p-6 text-[13px] text-[#737780]">
                {usersError ? `Erro: ${usersError}` : 'Nenhum usuário encontrado.'}
              </div>
            ) : (
              rows.map((u) => {
                const id = String(u?.id || '')
                const disabled = Boolean(u?.disabled)
                return (
                  <div key={id} className="grid grid-cols-12 gap-3 px-4 py-3 border-b border-[#E3E4E5] last:border-b-0 items-center">
                    <div className="col-span-1">
                      <input type="checkbox" checked={selectedIds.has(id)} onChange={() => toggleSelected(id)} />
                    </div>
                    <div className="col-span-3">
                      <div className="text-[13px] font-semibold text-[#1E1B39] truncate">{u?.name || '-'}</div>
                      <div className="text-[11px] text-[#9291A5] truncate">Criado: {formatDt(u?.createdAt)}</div>
                    </div>
                    <div className="col-span-3">
                      <div className="text-[13px] text-[#1E1B39] truncate">{u?.email || '-'}</div>
                      <div className="text-[11px] text-[#9291A5] truncate">Último login: {formatDt(u?.lastSignInAt)}</div>
                    </div>
                    <div className="col-span-2">
                      <span className="inline-flex items-center px-2 py-1 rounded-full bg-[#EEF2FF] text-[#1E1B39] text-[11px] font-semibold">
                        {u?.accountType || 'aluno'}
                      </span>
                    </div>
                    <div className="col-span-2">
                      <span className={`inline-flex items-center px-2 py-1 rounded-full text-[11px] font-semibold ${disabled ? 'bg-[#FEE2E2] text-[#991B1B]' : 'bg-[#DCFCE7] text-[#166534]'}`}>
                        {disabled ? 'desativado' : 'ativo'}
                      </span>
                    </div>
                    <div className="col-span-1 flex justify-end gap-2">
                      <button
                        type="button"
                        className="h-8 px-2 rounded-[10px] border border-[#E3E4E5] bg-white text-[12px] font-semibold text-[#1E1B39] hover:bg-[#F8FAFC]"
                        onClick={() => openEdit(id)}
                      >
                        Editar
                      </button>
                    </div>
                  </div>
                )
              })
            )}
          </div>
        </div>

        {createOpen ? (
          <div className="fixed inset-0 z-[90] bg-black/40 flex items-center justify-center p-6">
            <div className="w-full max-w-[560px] rounded-[14px] border border-[#E3E4E5] bg-white overflow-hidden">
              <div className="px-5 py-4 border-b border-[#E3E4E5] flex items-center justify-between">
                <div className="text-[14px] font-semibold text-[#1E1B39]">Adicionar usuário</div>
                <button className="w-9 h-9 rounded-[10px] hover:bg-[#F3F4F6] flex items-center justify-center" onClick={() => setCreateOpen(false)}>
                  <X className="w-4 h-4 text-[#737780]" />
                </button>
              </div>
              <div className="p-5 grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="md:col-span-2">
                  <label className="text-[12px] text-[#737780]">Nome</label>
                  <input value={createForm.name} onChange={(e) => setCreateForm((p) => ({ ...p, name: e.target.value }))} className="mt-2 w-full h-[40px] rounded-[10px] border border-[#E3E4E5] px-3 text-[13px] outline-none focus:border-[#0047BB]" />
                </div>
                <div className="md:col-span-2">
                  <label className="text-[12px] text-[#737780]">Email</label>
                  <input value={createForm.email} onChange={(e) => setCreateForm((p) => ({ ...p, email: e.target.value }))} type="email" className="mt-2 w-full h-[40px] rounded-[10px] border border-[#E3E4E5] px-3 text-[13px] outline-none focus:border-[#0047BB]" />
                </div>
                <div>
                  <label className="text-[12px] text-[#737780]">Tipo</label>
                  <select value={createForm.accountType} onChange={(e) => setCreateForm((p) => ({ ...p, accountType: e.target.value }))} className="mt-2 w-full h-[40px] rounded-[10px] border border-[#E3E4E5] px-3 text-[13px] bg-white outline-none focus:border-[#0047BB]">
                    <option value="aluno">Aluno</option>
                    <option value="produtor">Produtor</option>
                    <option value="admin">Administrador</option>
                  </select>
                </div>
                {normalizeType(createForm.accountType) === 'aluno' ? (
                  <div>
                    <label className="text-[12px] text-[#737780]">Curso</label>
                    <select value={createForm.courseId} onChange={(e) => setCreateForm((p) => ({ ...p, courseId: e.target.value }))} className="mt-2 w-full h-[40px] rounded-[10px] border border-[#E3E4E5] px-3 text-[13px] bg-white outline-none focus:border-[#0047BB]">
                      <option value="">(nenhum)</option>
                      {sortedCourses.map((c) => (
                        <option key={c.id} value={c.id}>{c.title}</option>
                      ))}
                    </select>
                  </div>
                ) : null}
                {normalizeType(createForm.accountType) === 'aluno' ? (
                  <div className="md:col-span-2">
                    <label className="text-[12px] text-[#737780]">Expiração (opcional)</label>
                    <input value={createForm.expiresAt} onChange={(e) => setCreateForm((p) => ({ ...p, expiresAt: e.target.value }))} placeholder="YYYY-MM-DD" className="mt-2 w-full h-[40px] rounded-[10px] border border-[#E3E4E5] px-3 text-[13px] outline-none focus:border-[#0047BB]" />
                  </div>
                ) : null}
              </div>
              <div className="px-5 py-4 border-t border-[#E3E4E5] flex items-center justify-end gap-2">
                <button type="button" className="h-9 px-3 rounded-[10px] border border-[#E3E4E5] bg-white text-[12px] font-semibold text-[#1E1B39] hover:bg-[#F8FAFC]" onClick={() => setCreateOpen(false)}>Cancelar</button>
                <button type="button" disabled={createLoading} className="h-9 px-3 rounded-[10px] bg-[#0047BB] text-white text-[12px] font-semibold hover:bg-[#003da0] disabled:opacity-50" onClick={createUser}>
                  {createLoading ? 'Salvando...' : 'Criar'}
                </button>
              </div>
            </div>
          </div>
        ) : null}

        {editOpen ? (
          <div className="fixed inset-0 z-[90] bg-black/40 flex items-center justify-center p-6">
            <div className="w-full max-w-[760px] rounded-[14px] border border-[#E3E4E5] bg-white overflow-hidden">
              <div className="px-5 py-4 border-b border-[#E3E4E5] flex items-center justify-between">
                <div className="text-[14px] font-semibold text-[#1E1B39]">Usuário</div>
                <button className="w-9 h-9 rounded-[10px] hover:bg-[#F3F4F6] flex items-center justify-center" onClick={() => setEditOpen(false)}>
                  <X className="w-4 h-4 text-[#737780]" />
                </button>
              </div>
              {editLoading ? (
                <div className="p-6 text-[13px] text-[#737780]">Carregando...</div>
              ) : !editUser ? (
                <div className="p-6 text-[13px] text-[#737780]">Usuário não encontrado.</div>
              ) : (
                <>
                  <div className="p-5 grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="md:col-span-2 flex items-center justify-between gap-3">
                      <div className="min-w-0">
                        <div className="text-[14px] font-semibold text-[#1E1B39] truncate">{editUser.email}</div>
                        <div className="text-[12px] text-[#737780]">Criado: {formatDt(editUser.createdAt)} • Último login: {formatDt(editUser.lastSignInAt)}</div>
                      </div>
                      <div className="flex items-center gap-2">
                        <button type="button" className="h-9 px-3 rounded-[10px] border border-[#E3E4E5] bg-white text-[12px] font-semibold text-[#1E1B39] hover:bg-[#F8FAFC]" onClick={() => getFirstAccessLink(editUser.id)}>
                          <Copy className="w-4 h-4 inline-block mr-2" />
                          1º acesso
                        </button>
                        <button
                          type="button"
                          className={`h-9 px-3 rounded-[10px] text-[12px] font-semibold ${editForm.disabled ? 'bg-[#16A34A] text-white hover:bg-[#15803D]' : 'bg-[#DC2626] text-white hover:bg-[#B91C1C]'}`}
                          onClick={() => setEditForm((p) => ({ ...p, disabled: !p.disabled }))}
                        >
                          {editForm.disabled ? <ShieldCheck className="w-4 h-4 inline-block mr-2" /> : <ShieldBan className="w-4 h-4 inline-block mr-2" />}
                          {editForm.disabled ? 'Desbloquear' : 'Bloquear'}
                        </button>
                      </div>
                    </div>

                    <div className="md:col-span-2">
                      <label className="text-[12px] text-[#737780]">Nome</label>
                      <input value={editForm.name} onChange={(e) => setEditForm((p) => ({ ...p, name: e.target.value }))} className="mt-2 w-full h-[40px] rounded-[10px] border border-[#E3E4E5] px-3 text-[13px] outline-none focus:border-[#0047BB]" />
                    </div>
                    <div>
                      <label className="text-[12px] text-[#737780]">Telefone</label>
                      <input value={editForm.phone} onChange={(e) => setEditForm((p) => ({ ...p, phone: e.target.value }))} className="mt-2 w-full h-[40px] rounded-[10px] border border-[#E3E4E5] px-3 text-[13px] outline-none focus:border-[#0047BB]" />
                    </div>
                    <div>
                      <label className="text-[12px] text-[#737780]">Tipo</label>
                      <select value={editForm.accountType} onChange={(e) => setEditForm((p) => ({ ...p, accountType: e.target.value }))} className="mt-2 w-full h-[40px] rounded-[10px] border border-[#E3E4E5] px-3 text-[13px] bg-white outline-none focus:border-[#0047BB]">
                        <option value="aluno">Aluno</option>
                        <option value="produtor">Produtor</option>
                        <option value="admin">Administrador</option>
                      </select>
                    </div>

                    {normalizeType(editForm.accountType) === 'aluno' ? (
                      <div className="md:col-span-2 rounded-[12px] border border-[#E3E4E5] bg-[#F8FAFC] p-4">
                        <div className="text-[12px] font-semibold text-[#1E1B39]">Cursos e expiração</div>
                        <div className="mt-3 space-y-2">
                          {(Array.isArray(editForm.courses) ? editForm.courses : []).map((c, idx) => (
                            <div key={`${c?.courseId || ''}-${idx}`} className="grid grid-cols-1 md:grid-cols-12 gap-2 items-center">
                              <div className="md:col-span-7">
                                <select
                                  value={String(c?.courseId || '')}
                                  onChange={(e) => {
                                    const v = e.target.value
                                    setEditForm((p) => {
                                      const next = Array.isArray(p.courses) ? p.courses.slice() : []
                                      next[idx] = { ...next[idx], courseId: v }
                                      return { ...p, courses: next }
                                    })
                                  }}
                                  className="w-full h-[40px] rounded-[10px] border border-[#E3E4E5] px-3 text-[13px] bg-white outline-none focus:border-[#0047BB]"
                                >
                                  <option value="">Selecione um curso</option>
                                  {sortedCourses.map((cc) => (
                                    <option key={cc.id} value={cc.id}>{cc.title}</option>
                                  ))}
                                </select>
                              </div>
                              <div className="md:col-span-4">
                                <input
                                  value={String(c?.expiresAt || '')}
                                  onChange={(e) => {
                                    const v = e.target.value
                                    setEditForm((p) => {
                                      const next = Array.isArray(p.courses) ? p.courses.slice() : []
                                      next[idx] = { ...next[idx], expiresAt: v }
                                      return { ...p, courses: next }
                                    })
                                  }}
                                  placeholder="YYYY-MM-DD"
                                  className="w-full h-[40px] rounded-[10px] border border-[#E3E4E5] px-3 text-[13px] outline-none focus:border-[#0047BB]"
                                />
                              </div>
                              <div className="md:col-span-1 flex justify-end">
                                <button
                                  type="button"
                                  className="w-9 h-9 rounded-[10px] hover:bg-white flex items-center justify-center"
                                  onClick={() => {
                                    setEditForm((p) => {
                                      const next = Array.isArray(p.courses) ? p.courses.slice() : []
                                      next.splice(idx, 1)
                                      return { ...p, courses: next }
                                    })
                                  }}
                                >
                                  <X className="w-4 h-4 text-[#737780]" />
                                </button>
                              </div>
                            </div>
                          ))}
                          <button
                            type="button"
                            className="h-9 px-3 rounded-[10px] border border-[#E3E4E5] bg-white text-[12px] font-semibold text-[#1E1B39] hover:bg-[#F8FAFC]"
                            onClick={() => setEditForm((p) => ({ ...p, courses: [...(Array.isArray(p.courses) ? p.courses : []), { courseId: '', expiresAt: '' }] }))}
                          >
                            <Plus className="w-4 h-4 inline-block mr-2" />
                            Adicionar curso
                          </button>
                        </div>
                      </div>
                    ) : null}
                  </div>

                  <div className="px-5 py-4 border-t border-[#E3E4E5] flex items-center justify-between gap-2">
                    <button
                      type="button"
                      className="h-9 px-3 rounded-[10px] border border-[#E3E4E5] bg-white text-[12px] font-semibold text-[#1E1B39] hover:bg-[#F8FAFC]"
                      onClick={async () => {
                        try { await navigator.clipboard.writeText(String(editUser.email || '')) } catch (_) {}
                        toast({ title: 'Copiado', description: 'Email copiado.' })
                      }}
                    >
                      <Copy className="w-4 h-4 inline-block mr-2" />
                      Copiar email
                    </button>
                    <div className="flex items-center gap-2">
                      <button type="button" className="h-9 px-3 rounded-[10px] border border-[#E3E4E5] bg-white text-[12px] font-semibold text-[#1E1B39] hover:bg-[#F8FAFC]" onClick={() => setEditOpen(false)}>Cancelar</button>
                      <button type="button" disabled={editLoading} className="h-9 px-3 rounded-[10px] bg-[#0047BB] text-white text-[12px] font-semibold hover:bg-[#003da0] disabled:opacity-50" onClick={saveEdit}>
                        {editLoading ? 'Salvando...' : 'Salvar'}
                      </button>
                    </div>
                  </div>
                </>
              )}
            </div>
          </div>
        ) : null}

        {bulkCsvOpen ? (
          <div className="fixed inset-0 z-[90] bg-black/40 flex items-center justify-center p-6">
            <div className="w-full max-w-[760px] rounded-[14px] border border-[#E3E4E5] bg-white overflow-hidden">
              <div className="px-5 py-4 border-b border-[#E3E4E5] flex items-center justify-between">
                <div className="text-[14px] font-semibold text-[#1E1B39]">Importar alunos em massa (planilha)</div>
                <button
                  className="w-9 h-9 rounded-[10px] hover:bg-[#F3F4F6] flex items-center justify-center"
                  onClick={() => {
                    setBulkCsvOpen(false)
                    setBulkCsvSource('text')
                    setBulkCsvText('')
                    setBulkCsvParsed([])
                    setBulkCsvFileName('')
                  }}
                >
                  <X className="w-4 h-4 text-[#737780]" />
                </button>
              </div>
              <div className="p-5 space-y-3">
                <div className="text-[12px] text-[#737780]">
                  Cabeçalho esperado: <span className="font-mono">nome;email;tipo;course_id;expires_at</span> (separador ; ou ,)
                </div>
                <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                  <label className="inline-flex items-center gap-2 text-[12px] text-[#1E1B39] font-semibold cursor-pointer">
                    <input
                      type="file"
                      accept=".csv,.xlsx,.xls"
                      className="hidden"
                      onChange={(e) => {
                        const f = e.target.files?.[0] || null
                        if (!f) return
                        handleBulkFile(f)
                        e.target.value = ''
                      }}
                    />
                    <span className="h-9 px-3 rounded-[10px] border border-[#E3E4E5] bg-white hover:bg-[#F8FAFC] inline-flex items-center">
                      <Upload className="w-4 h-4 inline-block mr-2" />
                      Selecionar arquivo
                    </span>
                  </label>
                  <div className="text-[12px] text-[#737780] truncate">
                    {bulkCsvFileName ? `Arquivo: ${bulkCsvFileName}` : 'Nenhum arquivo selecionado'}
                  </div>
                </div>
                <textarea
                  value={bulkCsvText}
                  onChange={(e) => {
                    setBulkCsvSource('text')
                    setBulkCsvText(e.target.value)
                  }}
                  className="w-full h-[220px] rounded-[12px] border border-[#E3E4E5] p-3 text-[12px] font-mono outline-none focus:border-[#0047BB]"
                  placeholder={'nome;email;tipo;course_id;expires_at\nMaria;teste@exemplo.com;aluno;00000000-0000-0000-0000-000000000000;2026-12-31'}
                />
                <div className="text-[12px] text-[#1E1B39] font-semibold">
                  {bulkCsvParsing ? 'Lendo arquivo...' : `${bulkCsvParsed.length} linha(s) válida(s)`}
                </div>
              </div>
              <div className="px-5 py-4 border-t border-[#E3E4E5] flex items-center justify-end gap-2">
                <button
                  type="button"
                  className="h-9 px-3 rounded-[10px] border border-[#E3E4E5] bg-white text-[12px] font-semibold text-[#1E1B39] hover:bg-[#F8FAFC]"
                  onClick={() => {
                    setBulkCsvOpen(false)
                    setBulkCsvSource('text')
                    setBulkCsvText('')
                    setBulkCsvParsed([])
                    setBulkCsvFileName('')
                  }}
                >
                  Cancelar
                </button>
                <button
                  type="button"
                  disabled={bulkCsvLoading || bulkCsvParsing || !bulkCsvParsed.length}
                  className="h-9 px-3 rounded-[10px] bg-[#0047BB] text-white text-[12px] font-semibold hover:bg-[#003da0] disabled:opacity-50"
                  onClick={runBulkCreate}
                >
                  {bulkCsvLoading ? 'Importando...' : 'Importar'}
                </button>
              </div>
            </div>
          </div>
        ) : null}
      </div>
    </>
  )
}
