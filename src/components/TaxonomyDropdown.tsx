import React, { useEffect, useMemo, useRef, useState } from 'react'
import { Check, Pencil, Plus, Trash, X } from 'lucide-react'

export type TaxonomyItem = {
  id: string | number
  name: string
  color?: string
  description?: string
}

type UpsertPayload = {
  name: string
  color: string
  description: string
}

type Props = {
  open: boolean
  onOpenChange: (open: boolean) => void
  items: TaxonomyItem[]
  onSelect: (item: TaxonomyItem) => void
  align?: 'start' | 'end' | 'auto'
  isSelected?: (item: TaxonomyItem) => boolean
  canEdit?: (item: TaxonomyItem) => boolean
  canDelete?: (item: TaxonomyItem) => boolean
  onCreate?: (payload: UpsertPayload) => void | Promise<void>
  onUpdate?: (itemId: TaxonomyItem['id'], payload: UpsertPayload) => void | Promise<void>
  onDelete?: (itemId: TaxonomyItem['id']) => void | Promise<void>
  searchPlaceholder: string
  createLabel: string
  defaultColor: string
}

export function TaxonomyDropdown({
  open,
  onOpenChange,
  items,
  onSelect,
  align = 'auto',
  isSelected,
  canEdit,
  canDelete,
  onCreate,
  onUpdate,
  onDelete,
  searchPlaceholder,
  createLabel,
  defaultColor,
}: Props) {
  const containerRef = useRef<HTMLDivElement | null>(null)
  const [searchTerm, setSearchTerm] = useState('')
  const [resolvedAlign, setResolvedAlign] = useState<'start' | 'end'>('start')
  const [isCreatingNew, setIsCreatingNew] = useState(false)
  const [newName, setNewName] = useState('')
  const [newColor, setNewColor] = useState(defaultColor)
  const [newDescription, setNewDescription] = useState('')
  const [editingId, setEditingId] = useState<TaxonomyItem['id'] | null>(null)
  const [editName, setEditName] = useState('')
  const [editColor, setEditColor] = useState(defaultColor)
  const [editDescription, setEditDescription] = useState('')
  const [pendingDeleteId, setPendingDeleteId] = useState<TaxonomyItem['id'] | null>(null)

  const filteredItems = useMemo(() => {
    const q = searchTerm.trim().toLowerCase()
    return items
      .filter((it) => (q ? (it.name || '').toLowerCase().includes(q) : true))
      .filter((it) => (isSelected ? !isSelected(it) : true))
  }, [items, isSelected, searchTerm])

  useEffect(() => {
    if (!open) return
    if (align !== 'auto') {
      setResolvedAlign(align)
      return
    }
    const el = containerRef.current
    if (!el) return

    const measure = () => {
      const rect = el.getBoundingClientRect()
      if (rect.right > window.innerWidth - 12) {
        setResolvedAlign('end')
      } else if (rect.left < 12) {
        setResolvedAlign('start')
      } else {
        setResolvedAlign('start')
      }
    }

    const raf = requestAnimationFrame(measure)
    window.addEventListener('resize', measure)
    return () => {
      cancelAnimationFrame(raf)
      window.removeEventListener('resize', measure)
    }
  }, [align, open])

  useEffect(() => {
    if (!open) return
    const onMouseDown = (e: MouseEvent) => {
      const el = containerRef.current
      if (!el) return
      if (!el.contains(e.target as Node)) {
        onOpenChange(false)
      }
    }
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onOpenChange(false)
    }
    document.addEventListener('mousedown', onMouseDown)
    document.addEventListener('keydown', onKeyDown)
    return () => {
      document.removeEventListener('mousedown', onMouseDown)
      document.removeEventListener('keydown', onKeyDown)
    }
  }, [onOpenChange, open])

  useEffect(() => {
    if (!open) {
      setSearchTerm('')
      setIsCreatingNew(false)
      setNewName('')
      setNewColor(defaultColor)
      setNewDescription('')
      setEditingId(null)
      setEditName('')
      setEditColor(defaultColor)
      setEditDescription('')
      setPendingDeleteId(null)
    }
  }, [defaultColor, open])

  const startEdit = (item: TaxonomyItem) => {
    setPendingDeleteId(null)
    setIsCreatingNew(false)
    setEditingId(item.id)
    setEditName(item.name || '')
    setEditColor(item.color || defaultColor)
    setEditDescription(item.description || '')
  }

  const cancelEdit = () => {
    setEditingId(null)
    setEditName('')
    setEditColor(defaultColor)
    setEditDescription('')
  }

  const saveEdit = async () => {
    if (!onUpdate || editingId === null) return
    const payload = {
      name: editName.trim(),
      color: editColor || defaultColor,
      description: editDescription.trim(),
    }
    if (!payload.name || !payload.description) return
    await onUpdate(editingId, payload)
    cancelEdit()
  }

  const createNew = async () => {
    if (!onCreate) return
    const payload = {
      name: newName.trim(),
      color: newColor || defaultColor,
      description: newDescription.trim(),
    }
    if (!payload.name) return
    await onCreate(payload)
    setIsCreatingNew(false)
    setNewName('')
    setNewColor(defaultColor)
    setNewDescription('')
    setSearchTerm('')
    onOpenChange(false)
  }

  const confirmDelete = async (id: TaxonomyItem['id']) => {
    if (!onDelete) return
    await onDelete(id)
    setPendingDeleteId(null)
  }

  if (!open) return null

  return (
    <div
      ref={containerRef}
      className={`absolute top-8 ${resolvedAlign === 'end' ? 'right-0' : 'left-0'} bg-white border border-gray-200 rounded-lg shadow-lg z-50 w-[320px]`}
      style={{ maxWidth: 'calc(100vw - 24px)' }}
      role="menu"
    >
      <div className="p-3 border-b border-[#E3E4E5]">
        <div className="flex items-center gap-2 rounded-[6px] border border-[#E3E4E5] bg-[#F9FAFB] px-2">
          <input
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder={searchPlaceholder}
            className="h-8 w-full bg-transparent text-[12px] outline-none"
            aria-label={searchPlaceholder}
            autoFocus
          />
        </div>
      </div>

      <div className="max-h-[220px] overflow-y-auto p-2 space-y-1">
        {filteredItems.map((item) => {
          const color = item.color || defaultColor
          const allowEdit = canEdit ? canEdit(item) : !!onUpdate
          const allowDelete = canDelete ? canDelete(item) : !!onDelete

          if (editingId === item.id) {
            return (
              <div key={String(item.id)} className="p-2 border border-gray-200 rounded-md bg-gray-50">
                <div className="flex items-center gap-2 mb-2">
                  <input
                    type="text"
                    placeholder="Nome"
                    value={editName}
                    onChange={(e) => setEditName(e.target.value)}
                    className="flex-1 px-3 py-1.5 text-sm border border-gray-200 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    style={{ fontFamily: 'Inter', fontSize: '14px' }}
                  />
                  <div className="w-4 h-4 rounded-full border border-gray-200" style={{ backgroundColor: editColor }} />
                </div>
                <textarea
                  placeholder="Descrição"
                  value={editDescription}
                  onChange={(e) => setEditDescription(e.target.value)}
                  className="w-full px-3 py-2 text-sm border border-gray-200 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent resize-none"
                  style={{ fontFamily: 'Inter', fontSize: '14px' }}
                  rows={2}
                />
                <div className="flex gap-2 mt-2">
                  <button
                    type="button"
                    onClick={saveEdit}
                    disabled={!editName.trim() || !editDescription.trim()}
                    className="flex-1 px-3 py-1.5 text-sm bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:bg-gray-300 disabled:cursor-not-allowed transition-colors"
                    style={{ fontFamily: 'Inter', fontSize: '12px' }}
                  >
                    Salvar
                  </button>
                  <button
                    type="button"
                    onClick={cancelEdit}
                    className="flex-1 px-3 py-1.5 text-sm bg-gray-200 text-gray-700 rounded-md hover:bg-gray-300 transition-colors"
                    style={{ fontFamily: 'Inter', fontSize: '12px' }}
                  >
                    Cancelar
                  </button>
                </div>
              </div>
            )
          }

          if (pendingDeleteId === item.id) {
            return (
              <div key={String(item.id)} className="flex items-center gap-2 rounded-md">
                <button
                  type="button"
                  onClick={() => onSelect(item)}
                  className="flex items-center gap-2 flex-1 text-left px-3 py-2 text-sm"
                  style={{ fontFamily: 'Inter', fontSize: '14px', color: '#374151' }}
                >
                  <div className="w-3 h-3 rounded-full flex-shrink-0" style={{ backgroundColor: color }} />
                  <div className="flex-1">
                    <div className="font-medium">{item.name}</div>
                    <div className="text-xs text-gray-500 mt-0.5">{item.description}</div>
                  </div>
                </button>
                <div className="flex items-center gap-1 pr-2">
                  <span className="text-xs text-gray-500 mr-1" style={{ fontFamily: 'Inter' }}>
                    Remover?
                  </span>
                  <button
                    type="button"
                    onClick={() => confirmDelete(item.id)}
                    className="w-6 h-6 rounded-full flex items-center justify-center hover:bg-black hover:bg-opacity-10 transition-colors"
                    title="Confirmar remoção"
                    aria-label="Confirmar remoção"
                  >
                    <Check className="w-3 h-3 text-red-600" />
                  </button>
                  <button
                    type="button"
                    onClick={() => setPendingDeleteId(null)}
                    className="w-6 h-6 rounded-full flex items-center justify-center hover:bg-black hover:bg-opacity-10 transition-colors"
                    title="Cancelar"
                    aria-label="Cancelar"
                  >
                    <X className="w-3 h-3 text-gray-600" />
                  </button>
                </div>
              </div>
            )
          }

          return (
            <div key={String(item.id)} className="flex items-center gap-2 hover:bg-gray-100 rounded-md">
              <button
                type="button"
                onClick={() => onSelect(item)}
                className="flex items-center gap-2 flex-1 text-left px-3 py-2 text-sm"
                style={{ fontFamily: 'Inter', fontSize: '14px', color: '#374151' }}
              >
                <div className="w-3 h-3 rounded-full flex-shrink-0" style={{ backgroundColor: color }} />
                <div className="flex-1">
                  <div className="font-medium">{item.name}</div>
                  <div className="text-xs text-gray-500 mt-0.5">{item.description}</div>
                </div>
              </button>
              <div className="flex items-center gap-1 pr-2">
                {allowEdit && (
                  <button
                    type="button"
                    onClick={() => startEdit(item)}
                    className="w-6 h-6 rounded-full flex items-center justify-center hover:bg-black hover:bg-opacity-10 transition-colors"
                    title="Editar"
                  >
                    <Pencil className="w-3 h-3 text-gray-600" />
                  </button>
                )}
                {allowDelete && (
                  <button
                    type="button"
                    onClick={() => setPendingDeleteId(item.id)}
                    className="w-6 h-6 rounded-full flex items-center justify-center hover:bg-black hover:bg-opacity-10 transition-colors"
                    title="Remover"
                  >
                    <Trash className="w-3 h-3 text-red-600" />
                  </button>
                )}
              </div>
            </div>
          )
        })}

        {filteredItems.length === 0 && searchTerm.trim() && (
          <div className="px-3 py-2 text-sm text-gray-500 text-center">Nenhum resultado</div>
        )}
      </div>

      <div className="border-t border-gray-200 p-3">
        {onCreate ? (
          isCreatingNew ? (
            <div className="space-y-2">
              <div className="flex items-center gap-2">
                <input
                  value={newName}
                  onChange={(e) => setNewName(e.target.value)}
                  placeholder="Nome"
                  className="flex-1 rounded-[8px] border border-[#E3E4E5] bg-white px-2 py-1 text-[12px] outline-none"
                  autoFocus
                />
                <input
                  type="color"
                  value={newColor}
                  onChange={(e) => setNewColor(e.target.value)}
                  title="Cor"
                  className="h-7 w-10 rounded-[8px] border border-[#E3E4E5] p-0"
                />
              </div>
              <textarea
                value={newDescription}
                onChange={(e) => setNewDescription(e.target.value)}
                placeholder="Descrição"
                className="w-full rounded-[8px] border border-[#E3E4E5] bg-white px-2 py-1 text-[12px] outline-none resize-none"
                rows={2}
              />
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={createNew}
                  disabled={!newName.trim()}
                  className="h-7 px-3 rounded-[6px] bg-blue-600 text-white text-[12px] font-medium disabled:bg-gray-300 disabled:cursor-not-allowed"
                >
                  Criar
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setIsCreatingNew(false)
                    setNewName('')
                    setNewColor(defaultColor)
                    setNewDescription('')
                  }}
                  className="h-7 px-3 rounded-[6px] border border-[#E3E4E5] bg-white text-[12px] font-medium hover:bg-[#F8FAFC]"
                >
                  Cancelar
                </button>
              </div>
            </div>
          ) : (
            <button
              type="button"
              onClick={() => {
                setNewName(searchTerm.trim())
                setIsCreatingNew(true)
              }}
              className="flex items-center gap-2 text-[12px] text-[#0047BB] hover:underline"
            >
              <Plus className="h-4 w-4" /> {createLabel}
            </button>
          )
        ) : null}
      </div>
    </div>
  )
}
