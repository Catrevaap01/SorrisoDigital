import { createClient, SupabaseClient } from '@supabase/supabase-js'
import Constants from 'expo-constants'

// Pegando variÃ¡veis exatamente como estÃ£o no app.json
const extra = Constants.expoConfig?.extra

const SUPABASE_URL = extra?.SUPABASE_URL
const SUPABASE_ANON_KEY = extra?.SUPABASE_ANON_KEY

if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
  throw new Error(
    'Supabase não configurado. Verifique SUPABASE_URL e SUPABASE_ANON_KEY no app.json.'
  )
}

export const supabase: SupabaseClient = createClient(
  SUPABASE_URL,
  SUPABASE_ANON_KEY
)

// Ajuste conforme o schema real do projeto no Supabase.
export const PROFILE_SCHEMA_FEATURES = {
  hasProvincia: false,
  usesProvinciaId: true,
  hasSenhaAlterada: false,
} as const
