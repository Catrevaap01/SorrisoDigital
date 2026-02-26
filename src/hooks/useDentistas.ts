/**
 * Hook para gerenciar dados de dentistas
 * Simplifica o acesso aos serviços de dentista
 */

import { useState, useCallback } from 'react';
import Toast from 'react-native-toast-message';
import {
  listarDentistas,
  criarDentista,
  deletarDentista,
  atualizarDentista,
  procurarDentistas,
  DentistaProfile,
} from '../services/dentistaService';

export const useDentistas = () => {
  const [dentistas, setDentistas] = useState<DentistaProfile[]>([]);
  const [loading, setLoading] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  const carregar = useCallback(async () => {
    setLoading(true);
    setErro(null);
    try {
      const resultado = await listarDentistas();
      if (resultado.success && resultado.data) {
        setDentistas(resultado.data);
      } else {
        setErro(resultado.error || 'Erro ao carregar dentistas');
        Toast.show({
          type: 'error',
          text1: 'Erro',
          text2: resultado.error || 'Erro ao carregar dentistas',
        });
      }
    } catch (error: any) {
      setErro(error.message);
      Toast.show({
        type: 'error',
        text1: 'Erro',
        text2: error.message || 'Erro ao carregar dentistas',
      });
    } finally {
      setLoading(false);
    }
  }, []);

  const procurar = useCallback(async (termo: string) => {
    setLoading(true);
    setErro(null);
    try {
      const resultado = await procurarDentistas(termo);
      if (resultado.success && resultado.data) {
        setDentistas(resultado.data);
      } else {
        setErro(resultado.error || 'Erro ao procurar');
      }
    } catch (error: any) {
      setErro(error.message);
    } finally {
      setLoading(false);
    }
  }, []);

  const criar = useCallback(
    async (
      email: string,
      senha: string,
      nome: string,
      especialidade: string,
      crm: string,
      telefone?: string,
      provincia?: string
    ) => {
      setLoading(true);
      setErro(null);
      try {
        const resultado = await criarDentista(
          email,
          senha,
          nome,
          especialidade,
          crm,
          telefone,
          provincia
        );
        if (resultado.success) {
          await carregar();
          Toast.show({
            type: 'success',
            text1: 'Sucesso',
            text2: 'Dentista criado com sucesso',
          });
          return resultado.data;
        } else {
          setErro(resultado.error);
          Toast.show({
            type: 'error',
            text1: 'Erro',
            text2: resultado.error || 'Erro ao criar dentista',
          });
        }
      } catch (error: any) {
        setErro(error.message);
      } finally {
        setLoading(false);
      }
    },
    [carregar]
  );

  const deletar = useCallback(
    async (id: string) => {
      setLoading(true);
      setErro(null);
      try {
        const resultado = await deletarDentista(id);
        if (resultado.success) {
          await carregar();
          Toast.show({
            type: 'success',
            text1: 'Deletado',
            text2: 'Dentista removido com sucesso',
          });
        } else {
          setErro(resultado.error);
          Toast.show({
            type: 'error',
            text1: 'Erro',
            text2: resultado.error || 'Erro ao deletar dentista',
          });
        }
      } catch (error: any) {
        setErro(error.message);
      } finally {
        setLoading(false);
      }
    },
    [carregar]
  );

  const atualizar = useCallback(
    async (id: string, updates: Partial<DentistaProfile>) => {
      setLoading(true);
      setErro(null);
      try {
        const resultado = await atualizarDentista(id, updates);
        if (resultado.success) {
          await carregar();
          Toast.show({
            type: 'success',
            text1: 'Atualizado',
            text2: 'Dados do dentista atualizados',
          });
          return resultado.data;
        } else {
          setErro(resultado.error);
          Toast.show({
            type: 'error',
            text1: 'Erro',
            text2: resultado.error || 'Erro ao atualizar dentista',
          });
        }
      } catch (error: any) {
        setErro(error.message);
      } finally {
        setLoading(false);
      }
    },
    [carregar]
  );

  return {
    dentistas,
    loading,
    erro,
    carregar,
    procurar,
    criar,
    deletar,
    atualizar,
  };
};
