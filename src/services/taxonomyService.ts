import { supabase } from '@/lib/supabaseClient'
import type { TaxonomyCategory, TaxonomySubcategory, TaxonomyTag } from '@/contexts/TaxonomyContext'

type DbTag = {
  id: string
  name: string
  description: string
  color: string
  created_at?: string
  updated_at?: string
}

type DbCategory = {
  id: string
  name: string
  description: string
  color: string
  tag_ids: string[]
  created_at?: string
  updated_at?: string
}

type DbSubcategory = {
  id: string
  name: string
  description: string
  color: string
  category_ids: string[]
  tag_ids: string[]
  products_count: number
  created_at?: string
  updated_at?: string
}

function mapTag(row: DbTag): TaxonomyTag {
  return {
    id: row.id,
    name: row.name || '',
    description: row.description || '',
    color: row.color || '#94A3B8',
  }
}

function mapCategory(row: DbCategory): TaxonomyCategory {
  return {
    id: row.id,
    name: row.name || '',
    description: row.description || '',
    color: row.color || '#3B82F6',
    tagIds: Array.isArray(row.tag_ids) ? row.tag_ids : [],
  }
}

function mapSubcategory(row: DbSubcategory): TaxonomySubcategory {
  return {
    id: row.id,
    name: row.name || '',
    description: row.description || '',
    color: row.color || '#3B82F6',
    categoryIds: Array.isArray(row.category_ids) ? row.category_ids : [],
    tagIds: Array.isArray(row.tag_ids) ? row.tag_ids : [],
    productsCount: typeof row.products_count === 'number' ? row.products_count : 0,
  }
}

export const taxonomyService = {
  async fetchAll() {
    const [tagsRes, categoriesRes, subcategoriesRes] = await Promise.all([
      supabase.from('taxonomy_tags').select('id,name,description,color,created_at,updated_at').order('created_at', { ascending: true }),
      supabase.from('taxonomy_categories').select('id,name,description,color,tag_ids,created_at,updated_at').order('created_at', { ascending: true }),
      supabase.from('taxonomy_subcategories').select('id,name,description,color,category_ids,tag_ids,products_count,created_at,updated_at').order('created_at', { ascending: true }),
    ])

    if (tagsRes.error) throw tagsRes.error
    if (categoriesRes.error) throw categoriesRes.error
    if (subcategoriesRes.error) throw subcategoriesRes.error

    return {
      tags: (tagsRes.data || []).map(mapTag),
      categories: (categoriesRes.data || []).map(mapCategory),
      subcategories: (subcategoriesRes.data || []).map(mapSubcategory),
    }
  },

  async upsertTag(tag: TaxonomyTag) {
    const { error } = await supabase
      .from('taxonomy_tags')
      .upsert({ id: tag.id, name: tag.name, description: tag.description || '', color: tag.color || '#94A3B8' }, { onConflict: 'id' })
    if (error) throw error
  },

  async deleteTag(id: string) {
    const { error } = await supabase.from('taxonomy_tags').delete().eq('id', id)
    if (error) throw error
  },

  async upsertCategory(category: TaxonomyCategory) {
    const { error } = await supabase
      .from('taxonomy_categories')
      .upsert(
        { id: category.id, name: category.name, description: category.description || '', color: category.color || '#3B82F6', tag_ids: category.tagIds || [] },
        { onConflict: 'id' },
      )
    if (error) throw error
  },

  async deleteCategory(id: string) {
    const { error } = await supabase.from('taxonomy_categories').delete().eq('id', id)
    if (error) throw error
  },

  async upsertSubcategory(subcategory: TaxonomySubcategory) {
    const { error } = await supabase
      .from('taxonomy_subcategories')
      .upsert(
        {
          id: subcategory.id,
          name: subcategory.name,
          description: subcategory.description || '',
          color: subcategory.color || '#3B82F6',
          category_ids: subcategory.categoryIds || [],
          tag_ids: subcategory.tagIds || [],
          products_count: typeof subcategory.productsCount === 'number' ? subcategory.productsCount : 0,
        },
        { onConflict: 'id' },
      )
    if (error) throw error
  },

  async deleteSubcategory(id: string) {
    const { error } = await supabase.from('taxonomy_subcategories').delete().eq('id', id)
    if (error) throw error
  },

  async seedAll(payload: { tags: TaxonomyTag[]; categories: TaxonomyCategory[]; subcategories: TaxonomySubcategory[] }) {
    const tagsRows = payload.tags.map(t => ({ id: t.id, name: t.name, description: t.description || '', color: t.color || '#94A3B8' }))
    const catRows = payload.categories.map(c => ({ id: c.id, name: c.name, description: c.description || '', color: c.color || '#3B82F6', tag_ids: c.tagIds || [] }))
    const subRows = payload.subcategories.map(s => ({
      id: s.id,
      name: s.name,
      description: s.description || '',
      color: s.color || '#3B82F6',
      category_ids: s.categoryIds || [],
      tag_ids: s.tagIds || [],
      products_count: typeof s.productsCount === 'number' ? s.productsCount : 0,
    }))

    if (tagsRows.length) {
      const { error } = await supabase.from('taxonomy_tags').upsert(tagsRows, { onConflict: 'id' })
      if (error) throw error
    }
    if (catRows.length) {
      const { error } = await supabase.from('taxonomy_categories').upsert(catRows, { onConflict: 'id' })
      if (error) throw error
    }
    if (subRows.length) {
      const { error } = await supabase.from('taxonomy_subcategories').upsert(subRows, { onConflict: 'id' })
      if (error) throw error
    }
  },
}

