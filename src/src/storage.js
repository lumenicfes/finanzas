import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  import.meta.env.VITE_SUPABASE_URL,
  import.meta.env.VITE_SUPABASE_ANON_KEY
)

export const storage = {
  async get(key, _shared = false) {
    const { data, error } = await supabase
      .from('lumen_storage')
      .select('value')
      .eq('key', key)
      .single()
    if (error || !data) throw new Error('Not found: ' + key)
    return { key, value: data.value, shared: _shared }
  },

  async set(key, value, _shared = false) {
    const v = typeof value === 'string' ? value : JSON.stringify(value)
    const { error } = await supabase
      .from('lumen_storage')
      .upsert({ key, value: v }, { onConflict: 'key' })
    if (error) return null
    return { key, value: v, shared: _shared }
  },

  async delete(key, _shared = false) {
    const { error } = await supabase
      .from('lumen_storage')
      .delete()
      .eq('key', key)
    if (error) return null
    return { key, deleted: true, shared: _shared }
  },

  async list(prefix = '', _shared = false) {
    let q = supabase.from('lumen_storage').select('key')
    if (prefix) q = q.like('key', `${prefix}%`)
    const { data, error } = await q
    if (error) return null
    return { keys: (data || []).map(r => r.key), prefix, shared: _shared }
  }
}