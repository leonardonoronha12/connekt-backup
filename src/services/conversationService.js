import { supabase } from '@/lib/supabaseClient'

export async function fetchConversationFeed(conversationId, { limit = 50, offset = 0 } = {}) {
  const { data, error } = await supabase
    .from('v_posts_with_replies')
    .select(`
      post_id,
      conversation_id,
      content,
      created_at,
      likes,
      liked,
      replies_json
    `)
    .eq('conversation_id', conversationId)
    .order('created_at', { ascending: true })
    .range(offset, offset + limit - 1)
  
  if (error) {
    console.error('fetchConversationFeed error', error)
    throw error
  }
  
  return (data || []).map(row => ({
    id: row.post_id,
    conversation_id: row.conversation_id,
    content: row.content,
    created_at: row.created_at,
    likes: row.likes,
    liked: row.liked,
    replies: (row.replies_json || []).map(reply => ({ ...reply, liked_by: reply.liked_by || [] })),
  }))
}