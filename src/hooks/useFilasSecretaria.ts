/**
 * Hook para gerenciar filas de triagens e agendamentos da secretária
 * Centraliza a lógica de busca, filtragem e monitoramento
 */

import { useState, useCallback, useEffect, useRef } from 'react';
import { realtimeBus } from '../realtime/realtime';
import type { DbChangeEvent } from '../realtime/realtimeEvents';
import {
  buscarTriagensPendentesSecretaria,
  buscarAgendamentosPendentesSecretaria,
  buscarProcedimentosPendentesSecretaria,
} from '../services/secretarioService';

export interface FilasSecretaria {
  triagensNovas: any[];
  agendamentosNovos: any[];
  contadores: {
    triagensNovas: number;
    agendamentosNovos: number;
    total: number;
  };
  loading: boolean;
  error?: string;
}

const REVALIDATE_INTERVAL_MS = 30000; // 30s (fallback se algum evento realtime falhar)

export const useFilasSecretaria = () => {
  const [filas, setFilas] = useState<FilasSecretaria>({
    triagensNovas: [],
    agendamentosNovos: [],
    contadores: {
      triagensNovas: 0,
      agendamentosNovos: 0,
      total: 0,
    },
    loading: false,
  });

  const revalidateTimerRef = useRef<NodeJS.Timeout | null>(null);
  const debounceTimerRef = useRef<NodeJS.Timeout | null>(null);

  const carregarFilas = useCallback(async () => {
    setFilas((prev) => ({ ...prev, loading: true }));
    try {
      const [triagensRes, agendamentosRes, procedimentosRes] = await Promise.all([
        buscarTriagensPendentesSecretaria(),
        buscarAgendamentosPendentesSecretaria(),
        buscarProcedimentosPendentesSecretaria(),
      ]);

      const triagensNovas = triagensRes.success ? triagensRes.data ?? [] : [];
      const agendamentosBase = agendamentosRes.success ? agendamentosRes.data ?? [] : [];
      const procedimentosNovos = procedimentosRes.success ? procedimentosRes.data ?? [] : [];
      
      // Combinar agendamentos tradicionais com procedimentos que precisam de agendamento
      const agendamentosNovos = [...agendamentosBase, ...procedimentosNovos].sort(
        (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
      );

      // Calcular contadores apenas para itens QUE NÃO FORAM ATRIBUÍDOS AINDA
      const triagensNaoAtribuidas = triagensNovas.filter(
        (t: any) => t.status === 'triagem_pendente_secretaria'
      ).length;
      const agendamentosNaoAtribuidos = agendamentosNovos.filter(
        (a: any) => a.status === 'agendamento_pendente_secretaria' || a.status === 'solicitado' || a.status === 'pendente'
      ).length;

      setFilas({
        triagensNovas,
        agendamentosNovos,
        contadores: {
          triagensNovas: triagensNaoAtribuidas,
          agendamentosNovos: agendamentosNaoAtribuidos,
          total: triagensNaoAtribuidas + agendamentosNaoAtribuidos,
        },
        loading: false,
      });
    } catch (err: any) {
      setFilas((prev) => ({
        ...prev,
        loading: false,
        error: err.message || 'Erro ao carregar filas',
      }));
    }
  }, []);

  // Realtime: revalidar instantaneamente quando dados mudarem
  useEffect(() => {
    const shouldRefresh = (event: DbChangeEvent) => {
      return (
        event.table === 'triagens' ||
        event.table === 'appointments' ||
        event.table === 'procedimentos_tratamento' ||
        event.table === 'planos_tratamento' ||
        event.table === 'profiles'
      );
    };

    const unsub = realtimeBus.on('db:change', (event) => {
      if (!shouldRefresh(event)) return;
      if (debounceTimerRef.current) clearTimeout(debounceTimerRef.current);
      debounceTimerRef.current = setTimeout(() => {
        debounceTimerRef.current = null;
        carregarFilas();
      }, 700);
    });

    return () => {
      unsub();
      if (debounceTimerRef.current) {
        clearTimeout(debounceTimerRef.current);
        debounceTimerRef.current = null;
      }
    };
  }, [carregarFilas]);

  // Auto-revalidate a cada 10 segundos
  const iniciarAutoRevalidate = useCallback(() => {
    if (revalidateTimerRef.current) clearInterval(revalidateTimerRef.current);

    revalidateTimerRef.current = setInterval(() => {
      carregarFilas();
    }, REVALIDATE_INTERVAL_MS);
  }, [carregarFilas]);

  const pararAutoRevalidate = useCallback(() => {
    if (revalidateTimerRef.current) {
      clearInterval(revalidateTimerRef.current);
      revalidateTimerRef.current = null;
    }
  }, []);

  // Limpar timer ao desmontar
  useEffect(() => {
    return () => {
      pararAutoRevalidate();
    };
  }, [pararAutoRevalidate]);

  return {
    filas,
    carregarFilas,
    iniciarAutoRevalidate,
    pararAutoRevalidate,
  };
};

export default useFilasSecretaria;
