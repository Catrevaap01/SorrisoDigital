/**
 * Hook para gerenciar filas de triagens e agendamentos da secretária
 * Centraliza a lógica de busca, filtragem e monitoramento
 */

import { useState, useCallback, useEffect, useRef } from 'react';
import {
  buscarTriagensPendentesSecretaria,
  buscarAgendamentosPendentesSecretaria,
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

const REVALIDATE_INTERVAL_MS = 10000; // 10 segundos

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

  const carregarFilas = useCallback(async () => {
    setFilas((prev) => ({ ...prev, loading: true }));
    try {
      const [triagensRes, agendamentosRes] = await Promise.all([
        buscarTriagensPendentesSecretaria(),
        buscarAgendamentosPendentesSecretaria(),
      ]);

      const triagensNovas = triagensRes.success ? triagensRes.data ?? [] : [];
      const agendamentosNovos = agendamentosRes.success ? agendamentosRes.data ?? [] : [];

      setFilas({
        triagensNovas,
        agendamentosNovos,
        contadores: {
          triagensNovas: triagensNovas.length,
          agendamentosNovos: agendamentosNovos.length,
          total: triagensNovas.length + agendamentosNovos.length,
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
