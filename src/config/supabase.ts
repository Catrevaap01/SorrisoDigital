import { createClient, SupabaseClient } from '@supabase/supabase-js'
import Constants from 'expo-constants'
import { Platform } from 'react-native'

const getAppExtra = (): Record<string, any> =>
  Constants.expoConfig?.extra ||
  (Constants as any).manifest2?.extra ||
  (Constants as any).manifest?.extra ||
  {}

const extra = getAppExtra()

export const SUPABASE_URL =
  extra?.SUPABASE_URL ||
  (typeof process !== 'undefined'
    ? process.env?.SUPABASE_URL || process.env?.EXPO_PUBLIC_SUPABASE_URL
    : undefined)
export const SUPABASE_ANON_KEY =
  extra?.SUPABASE_ANON_KEY ||
  (typeof process !== 'undefined'
    ? process.env?.SUPABASE_ANON_KEY || process.env?.EXPO_PUBLIC_SUPABASE_ANON_KEY
    : undefined)
export const SUPABASE_SERVICE_ROLE_KEY =
  extra?.SUPABASE_SERVICE_ROLE_KEY ||
  extra?.SUPABASE_SERVICE_KEY ||
  (typeof process !== 'undefined'
    ? process.env?.SUPABASE_SERVICE_ROLE_KEY || process.env?.SUPABASE_SERVICE_KEY
    : undefined)

if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
  throw new Error(
    'Supabase não configurado. Verifique SUPABASE_URL e SUPABASE_ANON_KEY no app.json.'
  )
}

export const getExpoExtra = getAppExtra

export const supabase: SupabaseClient = createClient(
  SUPABASE_URL,
  SUPABASE_ANON_KEY,
  {
    auth: {
      persistSession: true,
      detectSessionInUrl: Platform.OS === 'web', // Web fix: handle hash for auth
      autoRefreshToken: true,
    }
  }
)

export const adminSupabase: SupabaseClient | null =
  SUPABASE_URL && SUPABASE_SERVICE_ROLE_KEY
    ? createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
        auth: {
          persistSession: false,
          autoRefreshToken: false,
          detectSessionInUrl: false,
        },
      })
    : null;

export const getAdminClient = (): SupabaseClient | null => adminSupabase;

// Ajuste conforme o schema real do projeto no Supabase.
export const PROFILE_SCHEMA_FEATURES = {
  hasProvincia: false,
  usesProvinciaId: true,
  hasSenhaAlterada: false,
} as const
