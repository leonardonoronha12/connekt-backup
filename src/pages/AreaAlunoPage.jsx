import React, { useEffect, useMemo, useState } from 'react'
import { supabase } from '@/lib/supabaseClient'
import { useAuth } from '@/contexts/SupabaseAuthContext'

export default function AreaAlunoPage() {
  const { user, signOut } = useAuth()
  const [loading, setLoading] = useState(true)
  const [student, setStudent] = useState(null)
  const [error, setError] = useState(null)

  const email = useMemo(() => String(user?.email || '').trim().toLowerCase(), [user?.email])

  useEffect(() => {
    let cancelled = false
    const run = async () => {
      if (!user?.id) return
      setLoading(true)
      setError(null)
      setStudent(null)
      try {
        const attempts = [
          () =>
            supabase
              .from('students')
              .select('id,name,email,avatar_url,whatsapp,courses:student_courses(course_name,progress,tag)')
              .eq('email', email)
              .maybeSingle(),
          () =>
            supabase
              .from('students')
              .select('id,name,email,avatar_url,whatsapp,courses:student_courses(course_name,progress,tag)')
              .eq('user_id', user.id)
              .maybeSingle(),
          () =>
            supabase
              .from('students')
              .select('id,name,email,avatar_url,whatsapp,courses:student_courses(course_name,progress,tag)')
              .eq('external_id', user.id)
              .maybeSingle(),
        ]

        let lastErr = null
        let found = null
        for (const fn of attempts) {
          try {
            const { data, error: qErr } = await fn()
            if (qErr) {
              lastErr = qErr
              continue
            }
            if (data) {
              found = data
              break
            }
          } catch (e) {
            lastErr = e
          }
        }

        if (cancelled) return
        if (!found) {
          setStudent(null)
          setError(lastErr?.message || 'Aluno não encontrado para esta conta.')
          return
        }
        setStudent(found)
      } finally {
        if (!cancelled) setLoading(false)
      }
    }
    run()
    return () => {
      cancelled = true
    }
  }, [user?.id, email])

  const courses = Array.isArray(student?.courses) ? student.courses : []

  return (
    <div className="min-h-screen bg-[#F5F6FA]">
      <header className="bg-white border-b border-[#E3E4E5]">
        <div className="max-w-[1200px] mx-auto px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <img src="/logo-expanded.svg" alt="Connekt" className="h-7 w-auto" />
            <div className="text-[12px] text-[#737780]">Área do aluno</div>
          </div>
          <button
            type="button"
            className="h-9 px-4 rounded-[6px] border border-[#E3E4E5] bg-white text-[13px] font-medium text-[#1E1B39] hover:bg-[#F8FAFC]"
            onClick={async () => {
              await signOut()
              const host = String(window.location.hostname || '').toLowerCase()
              const isWhitelabelHost = host.endsWith('.app.connektco.com') && host !== 'app.connektco.com'
              window.history.replaceState({}, '', isWhitelabelHost ? '/login-aluno-wl' : '/login-aluno')
              window.dispatchEvent(new PopStateEvent('popstate'))
            }}
          >
            Sair
          </button>
        </div>
      </header>

      <main className="max-w-[1200px] mx-auto px-6 py-8">
        {loading ? (
          <div className="rounded-[12px] border border-[#E3E4E5] bg-white p-6">
            <div className="w-10 h-10 rounded-full border-4 border-[#E3E4E5] border-t-[#0047BB] animate-spin" />
          </div>
        ) : error ? (
          <div className="rounded-[12px] border border-[#FECACA] bg-[#FEF2F2] p-6 text-[#B91C1C]">
            {error}
          </div>
        ) : (
          <>
            <div className="rounded-[12px] border border-[#E3E4E5] bg-white p-6 flex items-center gap-4">
              <div className="w-14 h-14 rounded-full overflow-hidden border border-[#E3E4E5] bg-[#F8FAFC]">
                {student?.avatar_url ? (
                  <img src={student.avatar_url} alt={student?.name || 'Aluno'} className="w-full h-full object-cover" />
                ) : (
                  <div className="w-full h-full flex items-center justify-center text-[#0047BB] font-bold">
                    {(student?.name || student?.email || 'A').slice(0, 1).toUpperCase()}
                  </div>
                )}
              </div>
              <div className="min-w-0">
                <div className="text-[16px] font-semibold text-[#1E1B39] truncate">{student?.name || 'Aluno'}</div>
                <div className="text-[12px] text-[#737780] truncate">{student?.email || user?.email}</div>
              </div>
            </div>

            <div className="mt-6">
              <div className="text-[14px] font-semibold text-[#1E1B39] mb-3">Meus cursos</div>
              {courses.length === 0 ? (
                <div className="rounded-[12px] border border-[#E3E4E5] bg-white p-6 text-[13px] text-[#737780]">
                  Nenhum curso disponível para este aluno.
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {courses.map((c, idx) => {
                    const name = c?.course_name || c?.name || `Curso ${idx + 1}`
                    const progress = Math.max(0, Math.min(100, Number(c?.progress || 0)))
                    return (
                      <div key={`${name}-${idx}`} className="rounded-[12px] border border-[#E3E4E5] bg-white p-5">
                        <div className="text-[14px] font-semibold text-[#1E1B39]">{name}</div>
                        <div className="mt-3">
                          <div className="h-2 w-full rounded-full bg-[#EEF2FF] overflow-hidden">
                            <div className="h-full bg-[#0047BB]" style={{ width: `${progress}%` }} />
                          </div>
                          <div className="mt-2 text-[12px] text-[#737780]">{progress}% concluído</div>
                        </div>
                      </div>
                    )
                  })}
                </div>
              )}
            </div>
          </>
        )}
      </main>
    </div>
  )
}
