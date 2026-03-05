import React, { useEffect, useMemo, useRef } from 'react'

type OutputData = {
  time?: number
  blocks?: any[]
  version?: string
}

type Props = {
  value: OutputData | null | undefined
  onChange: (next: OutputData) => void
  placeholder?: string
  minHeight?: number
}

export default function RichTextNotionEditor({ value, onChange, placeholder, minHeight = 180 }: Props) {
  const holderId = useMemo(
    () => `rt-${Math.random().toString(36).slice(2)}-${Date.now().toString(36)}`,
    [],
  )
  const editorRef = useRef<any>(null)
  const latestValueRef = useRef<OutputData | null>(null)

  useEffect(() => {
    latestValueRef.current = value || null
  }, [value])

  useEffect(() => {
    let destroyed = false
    let mounted = true

    const init = async () => {
      const [{ default: EditorJS }, { default: Header }, { default: List }, { default: Checklist }, { default: Quote }, { default: Code }, { default: Table }, { default: Delimiter }, { default: Warning }, { default: InlineCode }, { default: Marker }, { default: Embed }, { default: ImageTool }] =
        await Promise.all([
          import('@editorjs/editorjs'),
          import('@editorjs/header'),
          import('@editorjs/list'),
          import('@editorjs/checklist'),
          import('@editorjs/quote'),
          import('@editorjs/code'),
          import('@editorjs/table'),
          import('@editorjs/delimiter'),
          import('@editorjs/warning'),
          import('@editorjs/inline-code'),
          import('@editorjs/marker'),
          import('@editorjs/embed'),
          import('@editorjs/image'),
        ])

      if (!mounted || destroyed) return

      const instance = new EditorJS({
        holder: holderId,
        placeholder: placeholder || 'Comece a escrever...',
        minHeight,
        autofocus: false,
        data: latestValueRef.current || undefined,
        tools: {
          header: { class: Header, inlineToolbar: ['marker', 'link'] },
          list: { class: List, inlineToolbar: true },
          checklist: { class: Checklist, inlineToolbar: true },
          quote: { class: Quote, inlineToolbar: true, config: { quotePlaceholder: 'Citação', captionPlaceholder: 'Autor' } },
          code: { class: Code },
          table: { class: Table, inlineToolbar: true },
          delimiter: Delimiter,
          warning: { class: Warning, inlineToolbar: true },
          inlineCode: InlineCode,
          marker: Marker,
          embed: { class: Embed, config: { services: { youtube: true, vimeo: true, instagram: true, twitter: true } } },
          image: {
            class: ImageTool,
            config: {
              uploader: {
                uploadByFile: async (file: File) => {
                  const url = await new Promise<string>((resolve, reject) => {
                    const reader = new FileReader()
                    reader.onload = () => resolve(String(reader.result || ''))
                    reader.onerror = () => reject(new Error('Falha ao ler imagem'))
                    reader.readAsDataURL(file)
                  })
                  return { success: 1, file: { url } }
                },
              },
            },
          },
        },
        onChange: async () => {
          if (!editorRef.current) return
          const data = await editorRef.current.save().catch(() => null)
          if (!data) return
          onChange(data)
        },
      })

      editorRef.current = instance
    }

    void init()

    return () => {
      mounted = false
      destroyed = true
      const inst = editorRef.current
      editorRef.current = null
      if (inst && typeof inst.destroy === 'function') {
        try { inst.destroy() } catch (_) {}
      }
    }
  }, [holderId, minHeight, onChange, placeholder])

  useEffect(() => {
    const inst = editorRef.current
    if (!inst) return
    const next = value || null
    const current = latestValueRef.current
    if (!next || !current) return
    if (JSON.stringify(next) === JSON.stringify(current)) return
    void inst.render(next).catch(() => {})
  }, [value])

  return <div id={holderId} className="w-full rounded-[8px] border border-[#E3E4E5] bg-white p-3" />
}

