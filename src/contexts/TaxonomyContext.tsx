import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react'
import { useAuth } from '@/contexts/SupabaseAuthContext'
import { taxonomyService } from '@/services/taxonomyService'

export type TaxonomyCategory = {
  id: string
  name: string
  color: string
  description: string
  tagIds: string[]
}

export type TaxonomySubcategory = {
  id: string
  name: string
  color: string
  description: string
  categoryIds: string[]
  tagIds: string[]
  productsCount: number
}

export type TaxonomyTag = {
  id: string
  name: string
  color: string
  description: string
}

type TaxonomySnapshot = {
  version: 1
  categories: TaxonomyCategory[]
  subcategories: TaxonomySubcategory[]
  tags: TaxonomyTag[]
}

type TaxonomyContextValue = {
  categories: TaxonomyCategory[]
  subcategories: TaxonomySubcategory[]
  tags: TaxonomyTag[]
  createCategory: (input: Omit<TaxonomyCategory, 'id'> & { id?: string }) => TaxonomyCategory
  updateCategory: (id: string, updates: Partial<Omit<TaxonomyCategory, 'id'>>) => void
  deleteCategory: (id: string) => void
  createSubcategory: (input: Omit<TaxonomySubcategory, 'id' | 'categoryIds' | 'tagIds' | 'productsCount'> & { id?: string; categoryIds?: string[]; tagIds?: string[]; productsCount?: number }) => TaxonomySubcategory
  updateSubcategory: (id: string, updates: Partial<Omit<TaxonomySubcategory, 'id'>>) => void
  deleteSubcategory: (id: string) => void
  createTag: (input: Omit<TaxonomyTag, 'id'> & { id?: string }) => TaxonomyTag
  updateTag: (id: string, updates: Partial<Omit<TaxonomyTag, 'id'>>) => void
  deleteTag: (id: string) => void
}

const TaxonomyContext = createContext<TaxonomyContextValue | null>(null)

function createId(prefix: string) {
  const uuid = typeof crypto !== 'undefined' && 'randomUUID' in crypto ? crypto.randomUUID() : null
  if (uuid) return `${prefix}_${uuid}`
  return `${prefix}_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 10)}`
}

function normalizeName(name: string) {
  return (name || '').trim()
}

function storageKeyForUser(userId: string) {
  return `connekt_taxonomy_v1:${userId || 'anon'}`
}

function seedSnapshot(): TaxonomySnapshot {
  const cardio = createId('cat')
  const neuro = createId('cat')
  const pedia = createId('cat')
  const clin = createId('cat')

  const tags: TaxonomyTag[] = [
    { id: createId('tag'), name: 'ECG', color: '#94A3B8', description: 'Tag existente' },
    { id: createId('tag'), name: 'Arritmias', color: '#94A3B8', description: 'Tag existente' },
    { id: createId('tag'), name: 'Exames', color: '#94A3B8', description: 'Tag existente' },
    { id: createId('tag'), name: 'Emergência', color: '#94A3B8', description: 'Tag existente' },
    { id: createId('tag'), name: 'Neuro', color: '#94A3B8', description: 'Tag existente' },
    { id: createId('tag'), name: 'Infantil', color: '#94A3B8', description: 'Tag existente' },
    { id: createId('tag'), name: 'Prevenção', color: '#94A3B8', description: 'Tag existente' },
    { id: createId('tag'), name: 'Crônico', color: '#94A3B8', description: 'Tag existente' },
    { id: createId('tag'), name: 'Cardio', color: '#94A3B8', description: 'Tag existente' },
    { id: createId('tag'), name: 'Urgência', color: '#94A3B8', description: 'Tag existente' },
    { id: createId('tag'), name: 'Hospitalar', color: '#94A3B8', description: 'Tag existente' },
    { id: createId('tag'), name: 'Clínica', color: '#94A3B8', description: 'Tag existente' },
    { id: createId('tag'), name: 'Cirurgia', color: '#94A3B8', description: 'Tag existente' },
    { id: createId('tag'), name: 'Medicina', color: '#94A3B8', description: 'Tag existente' },
    { id: createId('tag'), name: 'Saúde', color: '#94A3B8', description: 'Tag existente' },
    { id: createId('tag'), name: 'Cérebro', color: '#94A3B8', description: 'Tag existente' },
    { id: createId('tag'), name: 'Nervos', color: '#94A3B8', description: 'Tag existente' },
    { id: createId('tag'), name: 'Criança', color: '#94A3B8', description: 'Tag existente' },
  ]

  const tagByName = new Map(tags.map(t => [t.name.toLowerCase(), t.id]))

  const categories: TaxonomyCategory[] = [
    { id: cardio, name: 'Cardiologia', color: '#EC4899', description: 'Doenças do coração e sistema cardiovascular.', tagIds: [tagByName.get('medicina')!, tagByName.get('saúde')!].filter(Boolean) },
    { id: neuro, name: 'Neurologia', color: '#8B5CF6', description: 'Condições do sistema nervoso central e periférico.', tagIds: [tagByName.get('cérebro')!, tagByName.get('nervos')!].filter(Boolean) },
    { id: pedia, name: 'Pediatria', color: '#10B981', description: 'Saúde e desenvolvimento de crianças e adolescentes.', tagIds: [tagByName.get('criança')!, tagByName.get('infantil')!].filter(Boolean) },
    { id: clin, name: 'Clínica', color: '#F59E0B', description: 'Medicina geral e atendimento clínico.', tagIds: [] },
  ]

  const subcategories: TaxonomySubcategory[] = [
    {
      id: createId('sub'),
      name: 'Eletrocardiograma',
      color: '#3B82F6',
      description: 'Básico e avançado sobre ECG e arritmias.',
      categoryIds: [cardio],
      tagIds: [tagByName.get('ecg')!, tagByName.get('arritmias')!, tagByName.get('exames')!].filter(Boolean),
      productsCount: 12,
    },
    {
      id: createId('sub'),
      name: 'AVC Agudo',
      color: '#EF4444',
      description: 'Protocolos de atendimento ao AVC isquêmico e hemorrágico.',
      categoryIds: [neuro],
      tagIds: [tagByName.get('emergência')!, tagByName.get('neuro')!].filter(Boolean),
      productsCount: 8,
    },
    {
      id: createId('sub'),
      name: 'Puericultura',
      color: '#10B981',
      description: 'Acompanhamento do desenvolvimento infantil.',
      categoryIds: [pedia],
      tagIds: [tagByName.get('infantil')!, tagByName.get('prevenção')!].filter(Boolean),
      productsCount: 15,
    },
    {
      id: createId('sub'),
      name: 'Insuficiência Cardíaca',
      color: '#A855F7',
      description: 'Manejo da IC crônica e aguda.',
      categoryIds: [cardio],
      tagIds: [tagByName.get('crônico')!, tagByName.get('cardio')!].filter(Boolean),
      productsCount: 5,
    },
  ]

  return { version: 1, categories, subcategories, tags }
}

function parseSnapshot(raw: string | null): TaxonomySnapshot | null {
  if (!raw) return null
  try {
    const parsed = JSON.parse(raw)
    if (!parsed || parsed.version !== 1) return null
    if (!Array.isArray(parsed.categories) || !Array.isArray(parsed.subcategories) || !Array.isArray(parsed.tags)) return null
    return parsed as TaxonomySnapshot
  } catch {
    return null
  }
}

export function TaxonomyProvider({ children }: { children: React.ReactNode }) {
  const { user } = useAuth()
  const userId = user?.id || 'anon'
  const storageKey = useMemo(() => storageKeyForUser(userId), [userId])
  const isAuthenticated = !!user?.id

  const [snapshot, setSnapshot] = useState<TaxonomySnapshot>(() => {
    const fromStorage = parseSnapshot(typeof window !== 'undefined' ? window.localStorage.getItem(storageKey) : null)
    return fromStorage || seedSnapshot()
  })

  useEffect(() => {
    const fromStorage = parseSnapshot(window.localStorage.getItem(storageKey))
    setSnapshot(fromStorage || seedSnapshot())

    if (!isAuthenticated) return

    let cancelled = false
    ;(async () => {
      try {
        const remote = await taxonomyService.fetchAll()
        if (cancelled) return
        const remoteSnapshot: TaxonomySnapshot = { version: 1, ...remote }

        const hasRemoteData = remoteSnapshot.categories.length > 0 || remoteSnapshot.subcategories.length > 0 || remoteSnapshot.tags.length > 0
        if (hasRemoteData) {
          setSnapshot(remoteSnapshot)
          try { window.localStorage.setItem(storageKey, JSON.stringify(remoteSnapshot)) } catch {}
          return
        }

        const seed = fromStorage || seedSnapshot()
        await taxonomyService.seedAll(seed)
        if (cancelled) return
        setSnapshot(seed)
        try { window.localStorage.setItem(storageKey, JSON.stringify(seed)) } catch {}
      } catch (e) {
        console.warn('taxonomy: failed to load from supabase, falling back to cache', e)
      }
    })()

    return () => {
      cancelled = true
    }
  }, [isAuthenticated, storageKey])

  useEffect(() => {
    window.localStorage.setItem(storageKey, JSON.stringify(snapshot))
  }, [snapshot, storageKey])

  useEffect(() => {
    const onStorage = (e: StorageEvent) => {
      if (e.key !== storageKey) return
      const next = parseSnapshot(e.newValue)
      if (next) setSnapshot(next)
    }
    window.addEventListener('storage', onStorage)
    return () => window.removeEventListener('storage', onStorage)
  }, [storageKey])

  const createCategory = useCallback((input: Omit<TaxonomyCategory, 'id'> & { id?: string }) => {
    const name = normalizeName(input.name)
    const description = String(input.description || '').trim()
    const color = String(input.color || '#3B82F6')
    const id = input.id || createId('cat')
    const tagIds = Array.isArray(input.tagIds) ? input.tagIds.map(String) : []
    const next: TaxonomyCategory = { id, name, description, color, tagIds }

    setSnapshot(prev => {
      const exists = prev.categories.some(c => c.name.toLowerCase() === name.toLowerCase())
      if (exists) return prev
      return { ...prev, categories: [...prev.categories, next] }
    })

    if (isAuthenticated) {
      void taxonomyService.upsertCategory(next).catch((e) => console.warn('taxonomy: upsertCategory failed', e))
    }

    return next
  }, [isAuthenticated])

  const updateCategory = useCallback((id: string, updates: Partial<Omit<TaxonomyCategory, 'id'>>) => {
    let updated: TaxonomyCategory | null = null
    setSnapshot(prev => {
      const name = updates.name !== undefined ? normalizeName(updates.name) : undefined
      if (name) {
        const duplicate = prev.categories.some(c => c.id !== id && c.name.toLowerCase() === name.toLowerCase())
        if (duplicate) return prev
      }
      const next = {
        ...prev,
        categories: prev.categories.map(c => c.id === id ? ({
          ...c,
          ...(updates.name !== undefined ? { name: normalizeName(updates.name) } : null),
          ...(updates.description !== undefined ? { description: String(updates.description || '').trim() } : null),
          ...(updates.color !== undefined ? { color: String(updates.color || c.color) } : null),
          ...(updates.tagIds !== undefined ? { tagIds: Array.isArray(updates.tagIds) ? updates.tagIds.map(String) : [] } : null),
        }) : c),
      }
      updated = next.categories.find(c => c.id === id) || null
      return next
    })
    if (isAuthenticated && updated) {
      void taxonomyService.upsertCategory(updated).catch((e) => console.warn('taxonomy: upsertCategory failed', e))
    }
  }, [isAuthenticated])

  const deleteCategory = useCallback((id: string) => {
    let affectedSubcategories: TaxonomySubcategory[] = []
    setSnapshot(prev => ({
      ...prev,
      categories: prev.categories.filter(c => c.id !== id),
      subcategories: prev.subcategories.map(s => {
        const nextIds = (s.categoryIds || []).filter(cid => cid !== id)
        const next = { ...s, categoryIds: nextIds }
        if ((s.categoryIds || []).length !== nextIds.length) affectedSubcategories.push(next)
        return next
      }),
    }))
    if (isAuthenticated) {
      void taxonomyService.deleteCategory(id).catch((e) => console.warn('taxonomy: deleteCategory failed', e))
      affectedSubcategories.forEach((s) => {
        void taxonomyService.upsertSubcategory(s).catch((e) => console.warn('taxonomy: upsertSubcategory failed', e))
      })
    }
  }, [isAuthenticated])

  const createSubcategory = useCallback((input: Omit<TaxonomySubcategory, 'id' | 'categoryIds' | 'tagIds' | 'productsCount'> & { id?: string; categoryIds?: string[]; tagIds?: string[]; productsCount?: number }) => {
    const name = normalizeName(input.name)
    const description = String(input.description || '').trim()
    const color = String(input.color || '#3B82F6')
    const id = input.id || createId('sub')
    const categoryIds = Array.isArray(input.categoryIds) ? input.categoryIds.map(String) : []
    const tagIds = Array.isArray(input.tagIds) ? input.tagIds.map(String) : []
    const productsCount = typeof input.productsCount === 'number' ? input.productsCount : 0
    const next: TaxonomySubcategory = { id, name, description, color, categoryIds, tagIds, productsCount }

    setSnapshot(prev => {
      const exists = prev.subcategories.some(s => s.name.toLowerCase() === name.toLowerCase())
      if (exists) return prev
      return { ...prev, subcategories: [...prev.subcategories, next] }
    })

    if (isAuthenticated) {
      void taxonomyService.upsertSubcategory(next).catch((e) => console.warn('taxonomy: upsertSubcategory failed', e))
    }

    return next
  }, [isAuthenticated])

  const updateSubcategory = useCallback((id: string, updates: Partial<Omit<TaxonomySubcategory, 'id'>>) => {
    let updated: TaxonomySubcategory | null = null
    setSnapshot(prev => {
      const name = updates.name !== undefined ? normalizeName(updates.name) : undefined
      if (name) {
        const duplicate = prev.subcategories.some(s => s.id !== id && s.name.toLowerCase() === name.toLowerCase())
        if (duplicate) return prev
      }
      const next = {
        ...prev,
        subcategories: prev.subcategories.map(s => s.id === id ? ({
          ...s,
          ...(updates.name !== undefined ? { name: normalizeName(updates.name) } : null),
          ...(updates.description !== undefined ? { description: String(updates.description || '').trim() } : null),
          ...(updates.color !== undefined ? { color: String(updates.color || s.color) } : null),
          ...(updates.categoryIds !== undefined ? { categoryIds: Array.isArray(updates.categoryIds) ? updates.categoryIds.map(String) : [] } : null),
          ...(updates.tagIds !== undefined ? { tagIds: Array.isArray(updates.tagIds) ? updates.tagIds.map(String) : [] } : null),
          ...(updates.productsCount !== undefined ? { productsCount: typeof updates.productsCount === 'number' ? updates.productsCount : s.productsCount } : null),
        }) : s),
      }
      updated = next.subcategories.find(s => s.id === id) || null
      return next
    })
    if (isAuthenticated && updated) {
      void taxonomyService.upsertSubcategory(updated).catch((e) => console.warn('taxonomy: upsertSubcategory failed', e))
    }
  }, [isAuthenticated])

  const deleteSubcategory = useCallback((id: string) => {
    setSnapshot(prev => ({ ...prev, subcategories: prev.subcategories.filter(s => s.id !== id) }))
    if (isAuthenticated) {
      void taxonomyService.deleteSubcategory(id).catch((e) => console.warn('taxonomy: deleteSubcategory failed', e))
    }
  }, [isAuthenticated])

  const createTag = useCallback((input: Omit<TaxonomyTag, 'id'> & { id?: string }) => {
    const name = normalizeName(input.name)
    const description = String(input.description || '').trim()
    const color = String(input.color || '#94A3B8')
    const id = input.id || createId('tag')
    const next: TaxonomyTag = { id, name, description, color }

    setSnapshot(prev => {
      const exists = prev.tags.some(t => t.name.toLowerCase() === name.toLowerCase())
      if (exists) return prev
      return { ...prev, tags: [...prev.tags, next] }
    })

    if (isAuthenticated) {
      void taxonomyService.upsertTag(next).catch((e) => console.warn('taxonomy: upsertTag failed', e))
    }

    return next
  }, [isAuthenticated])

  const updateTag = useCallback((id: string, updates: Partial<Omit<TaxonomyTag, 'id'>>) => {
    let updated: TaxonomyTag | null = null
    setSnapshot(prev => {
      const name = updates.name !== undefined ? normalizeName(updates.name) : undefined
      if (name) {
        const duplicate = prev.tags.some(t => t.id !== id && t.name.toLowerCase() === name.toLowerCase())
        if (duplicate) return prev
      }
      const next = {
        ...prev,
        tags: prev.tags.map(t => t.id === id ? ({
          ...t,
          ...(updates.name !== undefined ? { name: normalizeName(updates.name) } : null),
          ...(updates.description !== undefined ? { description: String(updates.description || '').trim() } : null),
          ...(updates.color !== undefined ? { color: String(updates.color || t.color) } : null),
        }) : t),
      }
      updated = next.tags.find(t => t.id === id) || null
      return next
    })
    if (isAuthenticated && updated) {
      void taxonomyService.upsertTag(updated).catch((e) => console.warn('taxonomy: upsertTag failed', e))
    }
  }, [isAuthenticated])

  const deleteTag = useCallback((id: string) => {
    let affectedCategories: TaxonomyCategory[] = []
    let affectedSubcategories: TaxonomySubcategory[] = []
    setSnapshot(prev => ({
      ...prev,
      tags: prev.tags.filter(t => t.id !== id),
      categories: prev.categories.map(c => {
        const nextIds = (c.tagIds || []).filter(tid => tid !== id)
        const next = { ...c, tagIds: nextIds }
        if ((c.tagIds || []).length !== nextIds.length) affectedCategories.push(next)
        return next
      }),
      subcategories: prev.subcategories.map(s => {
        const nextIds = (s.tagIds || []).filter(tid => tid !== id)
        const next = { ...s, tagIds: nextIds }
        if ((s.tagIds || []).length !== nextIds.length) affectedSubcategories.push(next)
        return next
      }),
    }))
    if (isAuthenticated) {
      void taxonomyService.deleteTag(id).catch((e) => console.warn('taxonomy: deleteTag failed', e))
      affectedCategories.forEach((c) => {
        void taxonomyService.upsertCategory(c).catch((e) => console.warn('taxonomy: upsertCategory failed', e))
      })
      affectedSubcategories.forEach((s) => {
        void taxonomyService.upsertSubcategory(s).catch((e) => console.warn('taxonomy: upsertSubcategory failed', e))
      })
    }
  }, [isAuthenticated])

  const value = useMemo<TaxonomyContextValue>(() => ({
    categories: snapshot.categories,
    subcategories: snapshot.subcategories,
    tags: snapshot.tags,
    createCategory,
    updateCategory,
    deleteCategory,
    createSubcategory,
    updateSubcategory,
    deleteSubcategory,
    createTag,
    updateTag,
    deleteTag,
  }), [createCategory, createSubcategory, createTag, deleteCategory, deleteSubcategory, deleteTag, snapshot, updateCategory, updateSubcategory, updateTag])

  return <TaxonomyContext.Provider value={value}>{children}</TaxonomyContext.Provider>
}

export function useTaxonomy() {
  const ctx = useContext(TaxonomyContext)
  if (!ctx) throw new Error('useTaxonomy must be used within TaxonomyProvider')
  return ctx
}
