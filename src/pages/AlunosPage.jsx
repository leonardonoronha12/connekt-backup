import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Helmet } from 'react-helmet-async'
import { Download, Loader2, Search, Users, X } from 'lucide-react'
import { useAuth } from '@/contexts/SupabaseAuthContext'
import { toast } from '@/hooks/use-toast.ts'

function formatPhone(raw) {
  const digits = String(raw || '').replace(/\D/g, '')
  if (!digits) return ''
  if (digits.length === 10) return `(${digits.slice(0, 2)}) ${digits.slice(2, 6)}-${digits.slice(6)}`
  if (digits.length === 11) return `(${digits.slice(0, 2)}) ${digits.slice(2, 7)}-${digits.slice(7)}`
  return String(raw || '').trim()
}

function formatProductCell(row) {
  const products = Array.isArray(row?.products) ? row.products.map((p) => String(p || '').trim()).filter(Boolean) : []
  const primary = String(row?.product || '').trim() || (products[0] ? String(products[0]) : '')
  if (!primary) return '—'
  const extra = products.filter((p) => p && p !== primary)
  return extra.length ? `${primary} (+${extra.length})` : primary
}

export default function AlunosPage() {
  const { session, user } = useAuth()
  const tokenRef = useRef('')
  useEffect(() => {
    tokenRef.current = String(session?.access_token || '')
  }, [session?.access_token])

  const authHeaders = useMemo(() => {
    const t = String(session?.access_token || '').trim()
    return t ? { Authorization: `Bearer ${t}` } : {}
  }, [session?.access_token])

  const [query, setQuery] = useState('')
  const [courseFilter, setCourseFilter] = useState('')
  const [courses, setCourses] = useState([])

  const [loading, setLoading] = useState(true)
  const [rows, setRows] = useState([])
  const [error, setError] = useState('')

  const fetchStudents = useCallback(async () => {
    const producerId = String(user?.id || '').trim()
    if (!producerId) return { ok: true, students: [], courses: [] }
    const qs = new URLSearchParams()
    qs.set('type', 'students_manage_list')
    qs.set('producerId', producerId)
    if (query.trim()) qs.set('q', query.trim())
    if (courseFilter) qs.set('course_id', courseFilter)
    qs.set('per_page', '5000')
    const r = await fetch(`/api/producer?${qs.toString()}`, { headers: authHeaders })
    const body = await r.json().catch(() => ({}))
    if (!r.ok) throw new Error(body?.error || 'Falha ao carregar alunos')
    return body || {}
  }, [authHeaders, courseFilter, query, user?.id])

  useEffect(() => {
    let active = true
    const run = async () => {
      setLoading(true)
      setError('')
      try {
        const body = await fetchStudents()
        if (!active) return
        setRows(Array.isArray(body?.students) ? body.students : [])
        setCourses(Array.isArray(body?.courses) ? body.courses : [])
      } catch (e) {
        if (!active) return
        const msg = String(e?.message || 'Erro ao carregar alunos')
        setRows([])
        setCourses([])
        setError(msg)
        toast({ title: 'Erro', description: msg, variant: 'destructive' })
      } finally {
        if (active) setLoading(false)
      }
    }
    run()
    return () => { active = false }
  }, [fetchStudents])

  const sortedCourses = useMemo(() => {
    const list = Array.isArray(courses) ? courses : []
    const out = list
      .map((c) => ({ id: String(c?.id || '').trim(), title: String(c?.title || '').trim() }))
      .filter((c) => c.id && c.title)
    out.sort((a, b) => a.title.localeCompare(b.title, 'pt-BR'))
    return out
  }, [courses])

  const exportXlsx = useCallback(async () => {
    try {
      const students = Array.isArray(rows) ? rows : []
      const XLSX = await import('xlsx')
      const sheetRows = students.map((s) => ({
        nome: String(s?.name || ''),
        email: String(s?.email || ''),
        telefone: String(s?.phone || ''),
        produto: formatProductCell(s) === '—' ? '' : formatProductCell(s),
        cursos: Array.isArray(s?.courses) ? s.courses.map((c) => String(c?.course_name || '')).filter(Boolean).join(', ') : '',
      }))
      const ws = XLSX.utils.json_to_sheet(sheetRows)
      const wb = XLSX.utils.book_new()
      XLSX.utils.book_append_sheet(wb, ws, 'Alunos')
      const buf = XLSX.write(wb, { type: 'array', bookType: 'xlsx' })
      const blob = new Blob([buf], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' })
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = 'gerenciar-alunos.xlsx'
      document.body.appendChild(a)
      a.click()
      a.remove()
      URL.revokeObjectURL(url)
    } catch (e) {
      toast({ title: 'Erro', description: e?.message || 'Erro ao exportar', variant: 'destructive' })
    }
  }, [rows])

  return (
    <>
      <Helmet>
        <title>Connekt - Gerenciar alunos</title>
      </Helmet>

      <div className="w-full">
        <div className="rounded-[14px] border border-[#E3E4E5] bg-white p-6">
          <div className="flex items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-[12px] bg-[#EEF2FF] flex items-center justify-center">
                <Users className="w-5 h-5 text-[#0047BB]" />
              </div>
              <div>
                <div className="text-[16px] font-semibold text-[#1E1B39]">Gerenciar alunos</div>
                <div className="text-[12px] text-[#737780]">Lista de alunos vinculados aos seus cursos</div>
              </div>
            </div>
            <button
              type="button"
              className="h-9 px-3 rounded-[10px] border border-[#E3E4E5] bg-white text-[12px] font-semibold text-[#1E1B39] hover:bg-[#F8FAFC]"
              onClick={exportXlsx}
              disabled={loading}
            >
              <Download className="w-4 h-4 inline-block mr-2" />
              Exportar
            </button>
          </div>

          <div className="mt-5 flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
            <div className="relative w-full sm:w-[380px]">
              <Search className="w-4 h-4 text-[#9291A5] absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Filtrar por nome, email ou telefone"
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

            <div className="flex items-center gap-2">
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
            </div>
          </div>
        </div>

        <div className="mt-4 rounded-[14px] border border-[#E3E4E5] bg-white overflow-hidden">
          <div className="overflow-x-auto">
            <table className="min-w-full">
              <thead>
                <tr className="bg-white">
                  <th className="px-6 py-4 text-left text-[12px] font-semibold text-[#737780]">Aluno</th>
                  <th className="px-6 py-4 text-left text-[12px] font-semibold text-[#737780]">Email</th>
                  <th className="px-6 py-4 text-left text-[12px] font-semibold text-[#737780]">Telefone</th>
                  <th className="px-6 py-4 text-left text-[12px] font-semibold text-[#737780]">Produto</th>
                  <th className="px-6 py-4 text-left text-[12px] font-semibold text-[#737780]">Cursos</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#EDEEF0]">
                {loading ? (
                  <tr>
                    <td colSpan={5} className="px-6 py-8 text-center text-[14px] text-[#737780]">
                      <Loader2 className="w-4 h-4 inline-block mr-2 animate-spin" />
                      Carregando…
                    </td>
                  </tr>
                ) : error ? (
                  <tr>
                    <td colSpan={5} className="px-6 py-8 text-center text-[14px] text-[#737780]">{error}</td>
                  </tr>
                ) : rows.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="px-6 py-8 text-center text-[14px] text-[#737780]">Nenhum aluno encontrado.</td>
                  </tr>
                ) : (
                  rows.slice(0, 500).map((s) => (
                    <tr key={String(s?.id || Math.random())}>
                      <td className="px-6 py-4 text-[13px] text-[#1E1B39]">{String(s?.name || '').trim() || 'Aluno'}</td>
                      <td className="px-6 py-4 text-[13px] text-[#1E1B39]">{String(s?.email || '').trim() || '—'}</td>
                      <td className="px-6 py-4 text-[13px] text-[#1E1B39]">{formatPhone(s?.phone || '') || '—'}</td>
                      <td className="px-6 py-4 text-[13px] text-[#1E1B39]">{formatProductCell(s)}</td>
                      <td className="px-6 py-4 text-[13px] text-[#1E1B39]">{Array.isArray(s?.courses) ? s.courses.length : 0}</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </>
  )
}
