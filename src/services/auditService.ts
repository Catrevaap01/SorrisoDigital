/**
 * auditService.ts
 * Serviço centralizado para escrita e leitura do Audit Log.
 *
 * Uso:
 *   auditService.log({ acao: 'LOGIN', descricao: 'Utilizador autenticado' });
 *   auditService.listar({ acao: 'DELETE', tabela: 'profiles', limit: 50 });
 */

import { supabase, getAdminClient } from '../config/supabase';
import { logger } from '../utils/logger';

// ─────────────────────────────────────────────
// Tipos
// ─────────────────────────────────────────────

export type AuditAcao =
  | 'LOGIN'
  | 'LOGOUT'
  | 'LOGIN_FAIL'
  | 'RESET_PASSWORD'
  | 'CRIAR_UTILIZADOR'
  | 'APAGAR_UTILIZADOR'
  | 'ATRIBUIR_DENTISTA'
  | 'RECUSAR_TRIAGEM'
  | 'REJEITAR_AGENDAMENTO'
  | 'ALTERAR_SENHA'
  | 'INSERT'
  | 'UPDATE'
  | 'DELETE'
  | string; // extensível

export interface AuditEntry {
  id: string;
  created_at: string;
  user_id: string | null;
  user_email: string | null;
  user_tipo: string | null;
  acao: AuditAcao;
  tabela: string | null;
  registo_id: string | null;
  dados_antes: Record<string, any> | null;
  dados_depois: Record<string, any> | null;
  descricao: string | null;
  ip: string | null;
  user_agent: string | null;
}

export interface LogParams {
  acao: AuditAcao;
  tabela?: string;
  registo_id?: string;
  dados_antes?: Record<string, any>;
  dados_depois?: Record<string, any>;
  descricao?: string;
  ip?: string;
  user_agent?: string;
  /** Forçar user_id/email (útil p/ login fail antes de ter sessão) */
  override_user_id?: string;
  override_user_email?: string;
  override_user_tipo?: string;
}

export interface ListarParams {
  acao?: AuditAcao;
  tabela?: string;
  user_id?: string;
  /** Data início ISO */
  desde?: string;
  /** Data fim ISO */
  ate?: string;
  limit?: number;
  offset?: number;
}

export interface AuditServiceResult<T> {
  success: boolean;
  data?: T;
  error?: string;
}

// ─────────────────────────────────────────────
// Helpers internos
// ─────────────────────────────────────────────

/** Obtém userId/email/tipo do utilizador actual sem falhar */
const resolveCurrentUser = async (): Promise<{
  userId: string | null;
  email: string | null;
  tipo: string | null;
}> => {
  try {
    const { data: { session } } = await supabase.auth.getSession();
    const userId = session?.user?.id ?? null;
    if (!userId) return { userId: null, email: null, tipo: null };

    const { data: profile } = await supabase
      .from('profiles')
      .select('email, tipo')
      .eq('id', userId)
      .maybeSingle();

    return {
      userId,
      email: profile?.email ?? session?.user?.email ?? null,
      tipo: profile?.tipo ?? null,
    };
  } catch {
    return { userId: null, email: null, tipo: null };
  }
};

// ─────────────────────────────────────────────
// Serviço
// ─────────────────────────────────────────────

export const auditService = {
  /**
   * Registar uma acção manual no audit log.
   * Os triggers SQL já tratam INSERT/UPDATE/DELETE automáticos nas tabelas;
   * este método serve para acções de auth e fluxos de negócio.
   *
   * Falha silenciosamente — nunca deve interromper o fluxo principal.
   */
  log: async (params: LogParams): Promise<void> => {
    try {
      // Tentar usar admin client para contornar RLS
      const client = getAdminClient() ?? supabase;

      let userId = params.override_user_id ?? null;
      let userEmail = params.override_user_email ?? null;
      let userTipo = params.override_user_tipo ?? null;

      if (!userId) {
        const current = await resolveCurrentUser();
        userId = current.userId;
        userEmail = current.email;
        userTipo = current.tipo;
      }

      const entry = {
        user_id: userId,
        user_email: userEmail,
        user_tipo: userTipo,
        acao: params.acao,
        tabela: params.tabela ?? null,
        registo_id: params.registo_id ?? null,
        dados_antes: params.dados_antes ?? null,
        dados_depois: params.dados_depois ?? null,
        descricao: params.descricao ?? null,
        ip: params.ip ?? null,
        user_agent: params.user_agent ?? null,
      };

      const { error } = await client.from('audit_log').insert([entry]);

      if (error) {
        // Não relançar — apenas registar no logger de desenvolvimento
        logger.warn('auditService.log: falha ao inserir entrada', error?.message);
      }
    } catch (err: any) {
      logger.warn('auditService.log: excepção inesperada', err?.message);
    }
  },

  /**
   * Listar entradas do audit log (apenas admins via RLS).
   */
  listar: async (
    params: ListarParams = {}
  ): Promise<AuditServiceResult<AuditEntry[]>> => {
    try {
      const client = getAdminClient() ?? supabase;

      let query = client
        .from('audit_log')
        .select('*')
        .order('created_at', { ascending: false });

      if (params.acao)    query = query.eq('acao', params.acao);
      if (params.tabela)  query = query.eq('tabela', params.tabela);
      if (params.user_id) query = query.eq('user_id', params.user_id);
      if (params.desde)   query = query.gte('created_at', params.desde);
      if (params.ate)     query = query.lte('created_at', params.ate);

      query = query.range(
        params.offset ?? 0,
        (params.offset ?? 0) + (params.limit ?? 100) - 1
      );

      const { data, error } = await query;

      if (error) {
        logger.error('auditService.listar: erro', error.message);
        return { success: false, error: error.message };
      }

      return { success: true, data: (data as AuditEntry[]) ?? [] };
    } catch (err: any) {
      logger.error('auditService.listar: excepção', err?.message);
      return { success: false, error: err?.message ?? 'Erro desconhecido' };
    }
  },

  /**
   * Contar entradas por tipo de acção (para dashboard).
   */
  contarPorAcao: async (): Promise<
    AuditServiceResult<{ acao: string; total: number }[]>
  > => {
    try {
      const client = getAdminClient() ?? supabase;

      const { data, error } = await client
        .from('audit_log')
        .select('acao')
        .order('created_at', { ascending: false })
        .limit(5000);

      if (error) return { success: false, error: error.message };

      // Agrupar no cliente (Supabase free não suporta GROUP BY via PostgREST)
      const counts: Record<string, number> = {};
      (data ?? []).forEach((row: any) => {
        counts[row.acao] = (counts[row.acao] ?? 0) + 1;
      });

      const result = Object.entries(counts)
        .map(([acao, total]) => ({ acao, total }))
        .sort((a, b) => b.total - a.total);

      return { success: true, data: result };
    } catch (err: any) {
      return { success: false, error: err?.message };
    }
  },

  /**
   * Limpar entradas antigas (mais de N dias).
   * Chamar apenas via service role.
   */
  limparAntigos: async (diasAntesDeHoje: number = 90): Promise<AuditServiceResult<number>> => {
    try {
      const client = getAdminClient();
      if (!client) return { success: false, error: 'Service role não configurado' };

      const corte = new Date();
      corte.setDate(corte.getDate() - diasAntesDeHoje);

      const { error, count } = await client
        .from('audit_log')
        .delete()
        .lt('created_at', corte.toISOString())
        .select('id');

      if (error) return { success: false, error: error.message };

      return { success: true, data: count ?? 0 };
    } catch (err: any) {
      return { success: false, error: err?.message };
    }
  },
};
