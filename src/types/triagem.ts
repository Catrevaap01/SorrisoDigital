import { Agendamento } from '../services/agendamentoService';

export interface RespostaTriagem {
  id: string;
  triagem_id: string;
  dentista_id: string;
  orientacao: string;
  recomendacao: string;
  observacoes?: string;
  created_at?: string;
  dentista?: {
    id: string;
    nome?: string;
    foto_url?: string;
  };
}

export type TriagemStatus =
  | 'triagem_pendente_secretaria'
  | 'pendente'
  | 'em_triagem'
  | 'respondida'
  | 'recusada'
  | 'cancelada';

export interface TriagemData {
  paciente_id?: string;
  patient_id?: string; // Aliás para compatibilidade com o padrão appointments
  dentista_id?: string;
  dentist_id?: string; // Aliás
  secretario_id?: string;
  secretary_id?: string; // Aliás
  sintoma_principal?: string;
  descricao?: string;
  duracao?: string;
  localizacao?: string;
  intensidade_dor?: number | string;
  imagens?: string[];
  prioridade?: string;
  status?: TriagemStatus;
  data_agendamento?: string;
  appointment_date?: string; // Aliás
  observacoes?: string;
  notes?: string; // Aliás
  motivo_recusa?: string;
}

export interface Triagem extends TriagemData {
  id: string;
  created_at?: string;
  updated_at?: string;
  paciente?: {
    id: string;
    nome?: string;
    telefone?: string | number;
    foto_url?: string;
  } | null;
  respostas?: RespostaTriagem[];
  agendamentos?: Agendamento[];
}

