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
  dentista_id?: string;
  secretario_id?: string;
  sintoma_principal?: string;
  descricao?: string;
  duracao?: string;
  localizacao?: string;
  intensidade_dor?: number | string;
  imagens?: string[];
  prioridade?: string;
  status?: TriagemStatus;
  data_agendamento?: string;
  observacoes?: string;
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

