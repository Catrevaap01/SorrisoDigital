/**
 * Paciente Service
 * Gerencia dados e operações relacionadas aos pacientes
 */

import { supabase } from '../config/supabase';
import { UserProfile } from '../contexts/AuthContext';

export interface PacienteProfile extends UserProfile {
  data_nascimento?: string;
  genero?: 'Masculino' | 'Feminino' | 'Outro';
  historico_medico?: string;
  alergias?: string;
  medicamentos_atuais?: string;
}

/**
 * Buscar perfil completo de um paciente
 */
export const buscarPaciente = async (
  pacienteId: string
): Promise<{ success: boolean; data?: PacienteProfile; error?: string }> => {
  try {
    const { data, error } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', pacienteId)
      .eq('tipo', 'paciente')
      .single();

    if (error) {
      return { success: false, error: error.message };
    }

    return { success: true, data: data as PacienteProfile };
  } catch (error: any) {
    return { success: false, error: error.message || 'Erro ao buscar paciente' };
  }
};

/**
 * Atualizar perfil completo do paciente
 */
export const atualizarPerfil = async (
  pacienteId: string,
  updates: Partial<PacienteProfile>
): Promise<{ success: boolean; data?: PacienteProfile; error?: string }> => {
  try {
    const { data, error } = await supabase
      .from('profiles')
      .update({
        ...updates,
        updated_at: new Date().toISOString(),
      })
      .eq('id', pacienteId)
      .select()
      .single();

    if (error) {
      return { success: false, error: error.message };
    }

    return { success: true, data: data as PacienteProfile };
  } catch (error: any) {
    return { success: false, error: error.message || 'Erro ao atualizar perfil' };
  }
};

/**
 * Validar formato de email
 */
export const validarEmail = (email: string): boolean => {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email);
};

/**
 * Validar telefone
 */
export const validarTelefone = (telefone: string): boolean => {
  if (!telefone) return true; // Campo opcional
  const telefoneRegex = /^[0-9\s\-\+\(\)]+$/;
  return telefoneRegex.test(telefone) && telefone.replace(/\D/g, '').length >= 9;
};

/**
 * Validar data (YYYY-MM-DD)
 */
export const validarData = (data: string): boolean => {
  if (!data) return true; // Campo opcional
  const dataRegex = /^\d{4}-\d{2}-\d{2}$/;
  if (!dataRegex.test(data)) return false;

  const [ano, mes, dia] = data.split('-').map(Number);
  const date = new Date(ano, mes - 1, dia);

  return (
    date.getFullYear() === ano &&
    date.getMonth() === mes - 1 &&
    date.getDate() === dia &&
    date < new Date() // Data não pode ser no futuro
  );
};

/**
 * Calcular idade baseado em data de nascimento
 */
export const calcularIdade = (dataNascimento: string): number | null => {
  if (!dataNascimento) return null;

  const [ano, mes, dia] = dataNascimento.split('-').map(Number);
  const hoje = new Date();
  const idade = hoje.getFullYear() - ano;

  if (
    hoje.getMonth() < mes - 1 ||
    (hoje.getMonth() === mes - 1 && hoje.getDate() < dia)
  ) {
    return idade - 1;
  }

  return idade;
};

/**
 * Listar pacientes (apenas para admin/dentista)
 */
export const listarPacientes = async (
  filtro?: {
    nome?: string;
    provincia?: string;
    limit?: number;
  }
): Promise<{ success: boolean; data?: PacienteProfile[]; error?: string }> => {
  try {
    let query = supabase
      .from('profiles')
      .select('*')
      .eq('tipo', 'paciente')
      .order('nome', { ascending: true });

    if (filtro?.nome) {
      query = query.ilike('nome', `%${filtro.nome}%`);
    }

    if (filtro?.provincia) {
      query = query.eq('provincia', filtro.provincia);
    }

    if (filtro?.limit) {
      query = query.limit(filtro.limit);
    }

    const { data, error } = await query;

    if (error) {
      return { success: false, error: error.message };
    }

    return { success: true, data: (data || []) as PacienteProfile[] };
  } catch (error: any) {
    return { success: false, error: error.message || 'Erro ao listar pacientes' };
  }
};
