// ─────────────────────────────────────────────────────────────────────────────
// src/config/supabase.ts
// Configuração e inicialização do cliente Supabase (base de dados e autenticação)
// ─────────────────────────────────────────────────────────────────────────────

// Importa a função de criação do cliente Supabase e o tipo SupabaseClient
import { createClient, SupabaseClient } from '@supabase/supabase-js'

// Importa Constants do Expo para aceder a variáveis do app.json/app.config.js
import Constants from 'expo-constants'

// Importa Platform para verificar se está a correr no web, android ou ios
import { Platform } from 'react-native'

// ── Função auxiliar para obter as variáveis extra do app.json ─────────────────
// Suporta múltiplos formatos de Constants (Expo SDK 46, 47, 48+)
const getAppExtra = (): Record<string, any> =>
  Constants.expoConfig?.extra ||         // SDK 46+ (expoConfig)
  (Constants as any).manifest2?.extra || // SDK 45 (manifest2)
  (Constants as any).manifest?.extra ||  // SDK <= 44 (manifest)
  {}                                     // Fallback: objecto vazio

// Obtém as variáveis extra (definidas em app.json → "extra": {...})
const extra = getAppExtra()

// ── URL do servidor Supabase ──────────────────────────────────────────────────
// Tenta obter a URL de múltiplas fontes por ordem de prioridade:
// 1. Variável de ambiente EXPO_PUBLIC_SUPABASE_URL (web/metro)
// 2. Variável de ambiente SUPABASE_URL (servidor/scripts)
// 3. Variável extra do app.json
export const SUPABASE_URL =
  (typeof process !== 'undefined'
    ? process.env?.EXPO_PUBLIC_SUPABASE_URL || process.env?.SUPABASE_URL
    : undefined) ||
  extra?.EXPO_PUBLIC_SUPABASE_URL ||
  extra?.SUPABASE_URL

// ── Chave anónima pública do Supabase ─────────────────────────────────────────
// Usada para operações de cliente (leitura/escrita com RLS activo)
export const SUPABASE_ANON_KEY =
  (typeof process !== 'undefined'
    ? process.env?.EXPO_PUBLIC_SUPABASE_ANON_KEY || process.env?.SUPABASE_ANON_KEY
    : undefined) ||
  extra?.EXPO_PUBLIC_SUPABASE_ANON_KEY ||
  extra?.SUPABASE_ANON_KEY

// ── Chave de serviço/admin do Supabase ────────────────────────────────────────
// Permite bypass das políticas RLS — NUNCA deve ser exposta no cliente
export const SUPABASE_SERVICE_ROLE_KEY =
  extra?.SUPABASE_SERVICE_ROLE_KEY ||
  extra?.SUPABASE_SERVICE_KEY ||
  (typeof process !== 'undefined'
    ? process.env?.SUPABASE_SERVICE_ROLE_KEY || process.env?.SUPABASE_SERVICE_KEY
    : undefined)

// ── Validação obrigatória das variáveis de ambiente ───────────────────────────
// Se URL ou chave anónima não estiverem definidas, a aplicação não pode funcionar
if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
  throw new Error(
    'Supabase não configurado. Verifique SUPABASE_URL e SUPABASE_ANON_KEY no app.json.'
  )
}

// Exporta a função auxiliar para uso noutros módulos se necessário
export const getExpoExtra = getAppExtra

// ── Cliente principal do Supabase (modo utilizador, com RLS activo) ──────────
export const supabase: SupabaseClient = createClient(
  SUPABASE_URL,     // URL do projecto Supabase
  SUPABASE_ANON_KEY, // Chave pública anónima
  {
    auth: {
      persistSession: true,                       // Guarda a sessão no armazenamento local
      detectSessionInUrl: Platform.OS === 'web', // No web, detecta token auth no URL (hash)
      autoRefreshToken: true,                    // Renova automaticamente o token de sessão
    },
    realtime: {
      params: {
        eventsPerSecond: 20, // Máximo de eventos real-time por segundo
      },
      heartbeatIntervalMs: 15_000, // Envia heartbeat a cada 15 segundos para manter ligação
      // Função de reconexão: espera N*1000ms entre tentativas, máximo 10 segundos
      reconnectAfterMs: (tries: number) => Math.min(tries * 1_000, 10_000),
    },
  }
)

// ── Cliente admin do Supabase (ignora RLS — apenas para operações administrativas) ──
// Só é criado se a chave de serviço estiver disponível; caso contrário é null
export const adminSupabase: SupabaseClient | null =
  SUPABASE_URL && SUPABASE_SERVICE_ROLE_KEY
    ? createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
        auth: {
          persistSession: false,     // Não guarda sessão (cliente de servidor)
          autoRefreshToken: false,   // Sem renovação automática de token
          detectSessionInUrl: false, // Não detecta sessão no URL
        },
      })
    : null; // Retorna null se a chave de serviço não estiver disponível

// Função auxiliar para obter o cliente admin (retorna null se não configurado)
export const getAdminClient = (): SupabaseClient | null => adminSupabase;

// ── Flags de funcionalidades do schema de perfil ─────────────────────────────
// Ajustar conforme o schema real das tabelas no Supabase
export const PROFILE_SCHEMA_FEATURES = {
  hasProvincia: false,       // A tabela de perfil tem coluna "provincia" (texto)?
  usesProvinciaId: true,     // A tabela usa "provincia_id" (referência a outra tabela)?
  hasSenhaAlterada: false,   // A tabela tem coluna "senha_alterada" (booleano)?
} as const
