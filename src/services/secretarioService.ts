/**
 * Serviço do Secretário
 * Funções para gerir atribuição de triagens e estatísticas
 */

import { supabase } from '../config/supabase';
import { withTimeout } from '../utils/withTimeout';
import { handleError } from '../utils/errorHandler';
import { DentistaProfile } from './dentistaService';

// ═══════════════════════════════════════════════
// Motor de Triagem Inteligente
// ═══════════════════════════════════════════════

export interface SugestaoEspecialidade {
  especialidade: string;
  justificativa: string;
  cor: string;
  icone: string;
  prioridade: 'normal' | 'alta' | 'urgente';
}

const ESPECIALIDADES_INFO: Record<string, { cor: string; icone: string }> = {
  'Endodontia':      { cor: '#E91E63', icone: 'git-commit-outline' },
  'Ortodontia':      { cor: '#3F51B5', icone: 'construct-outline' },
  'Cirurgia Oral':   { cor: '#FF5722', icone: 'cut-outline' },
  'Odontopediatria': { cor: '#4CAF50', icone: 'happy-outline' },
  'Periodontia':     { cor: '#FF9800', icone: 'leaf-outline' },
  'Clínica Geral':   { cor: '#2196F3', icone: 'medkit-outline' },
  'Implantologia':   { cor: '#9C27B0', icone: 'hardware-chip-outline' },
  'Estética':        { cor: '#00BCD4', icone: 'sparkles-outline' },
};

/**
 * Sugere a especialidade mais indicada com base nos sintomas descritos
 */
export const sugerirEspecialidadePorSintoma = (
  sintoma: string,
  intensidadeDor: number = 0,
  descricao: string = '',
  pacienteIdade?: number
): SugestaoEspecialidade => {
  const s = (sintoma + ' ' + descricao).toLowerCase();
  const dor = Number(intensidadeDor || 0);
  const prioridade: 'urgente' | 'alta' | 'normal' = dor >= 8 ? 'urgente' : dor >= 5 ? 'alta' : 'normal';

  // Crianças → Odontopediatria
  if (pacienteIdade !== undefined && pacienteIdade < 13) {
    return {
      especialidade: 'Odontopediatria',
      justificativa: 'Paciente menor de 13 anos. Recomenda-se atendimento pediátrico.',
      ...ESPECIALIDADES_INFO['Odontopediatria'],
      prioridade,
    };
  }

  // Endodontia — canal, dor espontânea intensa, dor pulpar
  if (
    s.includes('canal') ||
    s.includes('pulp') ||
    s.includes('espontân') ||
    (s.includes('dor') && dor >= 7) ||
    s.includes('necros') ||
    s.includes('abcesso') ||
    s.includes('abscesso')
  ) {
    return {
      especialidade: 'Endodontia',
      justificativa: 'Dor intensa ou espontânea sugere comprometimento pulpar. Indicado tratamento de canal.',
      ...ESPECIALIDADES_INFO['Endodontia'],
      prioridade: dor >= 7 ? 'urgente' : prioridade,
    };
  }

  // Cirurgia Oral — extração, inchaço, impactado, siso
  if (
    s.includes('extra') ||
    s.includes('incha') ||
    s.includes('siso') ||
    s.includes('impactado') ||
    s.includes('cisto') ||
    s.includes('tumor') ||
    s.includes('mandib')
  ) {
    return {
      especialidade: 'Cirurgia Oral',
      justificativa: 'Caso indica necessidade de procedimento cirúrgico — extração, drenagem ou biópsia.',
      ...ESPECIALIDADES_INFO['Cirurgia Oral'],
      prioridade: s.includes('incha') ? 'urgente' : prioridade,
    };
  }

  // Ortodontia — aparelho, desalinhamento, mordida
  if (
    s.includes('aparelho') ||
    s.includes('ortod') ||
    s.includes('desalinha') ||
    s.includes('mordida') ||
    s.includes('diastema') ||
    s.includes('apinhamento') ||
    s.includes('bracket')
  ) {
    return {
      especialidade: 'Ortodontia',
      justificativa: 'Sintomas de desalinhamento ou uso de aparelho ortodôntico.',
      ...ESPECIALIDADES_INFO['Ortodontia'],
      prioridade: 'normal',
    };
  }

  // Periodontia — gengiva, sangramento, mobilidade
  if (
    s.includes('gengiv') ||
    s.includes('sangr') ||
    s.includes('mobilidade') ||
    s.includes('periodont') ||
    s.includes('tártaro') ||
    s.includes('tartaro') ||
    s.includes('bolsa') ||
    s.includes('halitose')
  ) {
    return {
      especialidade: 'Periodontia',
      justificativa: 'Sintomas gengivais — sangramento ou mobilidade sugerem doença periodontal.',
      ...ESPECIALIDADES_INFO['Periodontia'],
      prioridade,
    };
  }

  // Implantologia
  if (s.includes('implante') || s.includes('osseointegr') || s.includes('dente faltando') || s.includes('edêntulo')) {
    return {
      especialidade: 'Implantologia',
      justificativa: 'Caso indica necessidade de implante dental.',
      ...ESPECIALIDADES_INFO['Implantologia'],
      prioridade: 'normal',
    };
  }

  // Estética
  if (s.includes('estétic') ||s.includes('estetica') || s.includes('clareamento') || s.includes('branqueamento') || s.includes('faceta') || s.includes('lente')) {
    return {
      especialidade: 'Estética',
      justificativa: 'Caso estético — clareamento, facetas ou lentes de contacto.',
      ...ESPECIALIDADES_INFO['Estética'],
      prioridade: 'normal',
    };
  }

  // Padrão — Clínica Geral
  return {
    especialidade: 'Clínica Geral',
    justificativa: 'Caso de rotina — cárie, limpeza ou avaliação geral.',
    ...ESPECIALIDADES_INFO['Clínica Geral'],
    prioridade,
  };
};


export interface EstatisticasSecretario {
  semDentista: number;
  recusados: number;
  urgentes: number;
  respondidos: number;
  novasTriagens: number;      // status = 'triagem_pendente_secretaria'
  novosAgendamentos: number;  // status = 'agendamento_pendente_secretaria'
  total: number;
}

export type StatusFinanceiroProcedimento =
  | 'sem_factura'
  | 'aguardando_factura'
  | 'pago'
  | 'pendente'
  | 'parcial';

export interface TratamentoFinanceiroItem {
  id: string;
  plano_id: string;
  paciente_id?: string;
  paciente_nome: string;
  paciente_telefone?: string;
  dentista_id?: string;
  dentista_nome: string;
  especialidade: string;
  procedimento: string;
  sessao_numero: number;
  valor: number;
  data_hora: string;
  status_clinico: string;
  status_financeiro: StatusFinanceiroProcedimento;
  numero_factura?: string | null;
  factura_emitida_em?: string | null;
  pago_em?: string | null;
  observacoes?: string | null;
}

const nomeOuFallback = (...values: Array<any>) => {
  for (const value of values) {
    if (typeof value === 'string' && value.trim()) {
      return value.trim();
    }
  }

  return 'Paciente';
};

const COLUNAS_BASE_PROCEDIMENTOS = [
  'id',
  'plano_id',
  'descricao',
  'status',
  'valor',
  'created_at',
  'observacoes',
];

const COLUNAS_OPCIONAIS_PROCEDIMENTOS = [
  'sessao_numero',
  'status_financeiro',
  'numero_factura',
  'factura_emitida_em',
  'pago_em',
];

const isMissingColumnError = (error: any) =>
  typeof error?.message === 'string' &&
  error.message.toLowerCase().includes('could not find') &&
  error.message.toLowerCase().includes('column');

const extractMissingColumn = (error: any): string | null => {
  const message = String(error?.message || '');
  const match = message.match(/'([^']+)'/);
  return match?.[1] || null;
};

const carregarProcedimentosTratamento = async () => {
  const colunas = [...COLUNAS_BASE_PROCEDIMENTOS, ...COLUNAS_OPCIONAIS_PROCEDIMENTOS];

  while (colunas.length > 0) {
    const res = await withTimeout(
      supabase
        .from('procedimentos_tratamento')
        .select(colunas.join(', '))
        .order('created_at', { ascending: false })
        .limit(300) as any,
      8000
    );

    if (!res.error) {
      return { data: res.data || [], colunas };
    }

    if (!isMissingColumnError(res.error)) {
      throw res.error;
    }

    const colunaAusente = extractMissingColumn(res.error);
    if (!colunaAusente || !colunas.includes(colunaAusente)) {
      throw res.error;
    }

    colunas.splice(colunas.indexOf(colunaAusente), 1);
  }

  return { data: [], colunas: [...COLUNAS_BASE_PROCEDIMENTOS] };
};

/**
 * Listar dentistas disponíveis, opcionalmente filtrados por especialidade
 */
export const listarDentistasPorEspecialidade = async (
  especialidade?: string
): Promise<{ success: boolean; data?: DentistaProfile[]; error?: string }> => {
  try {
    let query = supabase
      .from('profiles')
      .select(
        'id, nome, email, tipo, telefone, provincia, crm, numero_registro, especialidade, foto_url'
      )
      .in('tipo', ['dentista', 'medico'])
      .order('nome', { ascending: true })
      .limit(200);

    const { data, error } = await withTimeout(query as any, 8000);
    if (error) throw error;

    let dentistas: DentistaProfile[] = (data || []).map((d: any) => ({
      ...d,
      crm: d.crm || d.numero_registro,
    }));

    if (especialidade) {
      const espLower = especialidade.toLowerCase();
      dentistas = dentistas.filter(
        (d) =>
          !d.especialidade || // dentista generalista sempre aparece
          d.especialidade.toLowerCase().includes(espLower)
      );
    }

    return { success: true, data: dentistas };
  } catch (err: any) {
    return {
      success: false,
      error: err.message || 'Erro ao listar dentistas',
    };
  }
};

/**
 * Obter estatísticas para o painel do Secretário
 */
export const obterEstatisticasSecretario =
  async (): Promise<{ success: boolean; data?: EstatisticasSecretario; error?: string }> => {
    try {
      // Buscar triagens e agendamentos em paralelo
      const [triagensRes, agendamentosRes] = await Promise.all([
        withTimeout(
          supabase.from('triagens').select('id, status, dentista_id, prioridade, intensidade_dor') as any,
          8000
        ),
        withTimeout(
          supabase
            .from('agendamentos')
            .select('id, status')
            .eq('status', 'agendamento_pendente_secretaria') as any,
          8000
        ),
      ]);

      if (triagensRes.error) throw triagensRes.error;

      const rows: any[] = triagensRes.data || [];
      const stats: EstatisticasSecretario = {
        semDentista: 0,
        recusados: 0,
        urgentes: 0,
        respondidos: 0,
        novasTriagens: 0,
        novosAgendamentos: !agendamentosRes.error
          ? (agendamentosRes.data || []).length
          : 0,
        total: rows.length,
      };

      rows.forEach((t) => {
        const status = (t.status || '').toLowerCase();
        const prio = (t.prioridade || '').toLowerCase();
        const dor = Number(t.intensidade_dor || 0);

        if (status === 'triagem_pendente_secretaria') stats.novasTriagens++;
        if (!t.dentista_id) stats.semDentista++;
        if (status === 'recusado' || status === 'recusada') stats.recusados++;
        if (status === 'respondido' || status === 'completo') stats.respondidos++;
        if (status === 'urgente' || prio === 'urgente' || prio === 'alta' || dor > 6)
          stats.urgentes++;
      });

      return { success: true, data: stats };
    } catch (err) {
      const handled = handleError(err, 'secretarioService.obterEstatisticasSecretario');
      return {
        success: false,
        error: typeof handled === 'string' ? handled : handled.message,
      };
    }
  };

/**
 * Obter carga de trabalho de um dentista (triagens pendentes atribuídas)
 */
export const obterCargaDentista = async (
  dentistaId: string
): Promise<{ success: boolean; count?: number; error?: string }> => {
  try {
    const { count, error } = await (supabase
      .from('triagens')
      .select('id', { count: 'exact', head: true })
      .eq('dentista_id', dentistaId)
      .not('status', 'in', '("respondido","realizado","completo")') as any);

    if (error) throw error;
    return { success: true, count: count ?? 0 };
  } catch (err: any) {
    return { success: false, error: err.message };
  }
};

/**
 * Atribuir triagem a um dentista (aprovação do secretário)
 */
export const atribuirTriagemAoDentista = async (
  triagemId: string,
  dentistaId: string,
  secretarioId: string,
  observacoes?: string
): Promise<{ success: boolean; error?: string }> => {
  try {
    const { error } = await supabase
      .from('triagens')
      .update({
        dentista_id: dentistaId,
        secretario_id: secretarioId,
        status: 'pendente',
        observacoes: observacoes || null,
        updated_at: new Date().toISOString(),
      })
      .eq('id', triagemId);

    if (error) throw error;

    console.log(`✅ Triagem ${triagemId} atribuída ao dentista ${dentistaId}`);
    return { success: true };
  } catch (err: any) {
    return {
      success: false,
      error: err.message || 'Erro ao atribuir triagem',
    };
  }
};

/**
 * Recusar triagem (secretário rejeita por validação)
 */
export const recusarTriagem = async (
  triagemId: string,
  secretarioId: string,
  motivo: string
): Promise<{ success: boolean; error?: string }> => {
  try {
    const { error } = await supabase
      .from('triagens')
      .update({
        status: 'recusada',
        secretario_id: secretarioId,
        motivo_recusa: motivo,
        updated_at: new Date().toISOString(),
      })
      .eq('id', triagemId);

    if (error) throw error;

    console.log(`❌ Triagem ${triagemId} recusada pelo secretário`);
    return { success: true };
  } catch (err: any) {
    return {
      success: false,
      error: err.message || 'Erro ao recusar triagem',
    };
  }
};

/**
 * Atribuir agendamento a um dentista (aprovação do secretário)
 */
export const atribuirAgendamentoAoDentista = async (
  agendamentoId: string,
  dentistaId: string,
  secretarioId: string,
  dataAgendamento?: string,
  horaAgendamento?: string,
  observacoes?: string
): Promise<{ success: boolean; error?: string }> => {
  try {
    const updateData: any = {
      dentista_id: dentistaId,
      secretario_id: secretarioId,
      status: 'atribuido_dentista',
      updated_at: new Date().toISOString(),
    };

    if (dataAgendamento) updateData.data_agendamento = dataAgendamento;
    if (horaAgendamento) updateData.hora_agendamento = horaAgendamento;
    if (observacoes) updateData.observacoes = observacoes;

    const { error } = await supabase
      .from('agendamentos')
      .update(updateData)
      .eq('id', agendamentoId);

    if (error) throw error;

    console.log(`✅ Agendamento ${agendamentoId} atribuído ao dentista ${dentistaId}`);
    return { success: true };
  } catch (err: any) {
    return {
      success: false,
      error: err.message || 'Erro ao atribuir agendamento',
    };
  }
};

/**
 * Rejeitar agendamento (secretário rejeita)
 */
export const rejeitarAgendamento = async (
  agendamentoId: string,
  secretarioId: string,
  motivo: string
): Promise<{ success: boolean; error?: string }> => {
  try {
    const { error } = await supabase
      .from('agendamentos')
      .update({
        status: 'cancelado',
        secretario_id: secretarioId,
        observacoes: `Rejeitado: ${motivo}`,
        updated_at: new Date().toISOString(),
      })
      .eq('id', agendamentoId);

    if (error) throw error;

    console.log(`❌ Agendamento ${agendamentoId} rejeitado pelo secretário`);
    return { success: true };
  } catch (err: any) {
    return {
      success: false,
      error: err.message || 'Erro ao rejeitar agendamento',
    };
  }
};

/**
 * Buscar triagens pendentes de atribuição (status = triagem_pendente_secretaria)
 */
export const buscarTriagensPendentesSecretaria = async (): Promise<{
  success: boolean;
  data?: any[];
  error?: string;
}> => {
  try {
    const { data, error } = await withTimeout(
      supabase
        .from('triagens')
        .select(
          `
          id, paciente_id, sintoma_principal, descricao, intensidade_dor,
          prioridade, status, created_at, updated_at,
          paciente:profiles!paciente_id(id, nome, email, telefone, foto_url)
        `
        )
        .eq('status', 'triagem_pendente_secretaria')
        .order('created_at', { ascending: false }) as any,
      8000
    );

    if (error) throw error;
    return { success: true, data: data || [] };
  } catch (err: any) {
    return {
      success: false,
      error: err.message || 'Erro ao buscar triagens pendentes',
    };
  }
};

/**
 * Buscar agendamentos pendentes de atribuição (status = agendamento_pendente_secretaria)
 */
export const buscarAgendamentosPendentesSecretaria = async (): Promise<{
  success: boolean;
  data?: any[];
  error?: string;
}> => {
  try {
    const { data, error } = await withTimeout(
      supabase
        .from('agendamentos')
        .select(
          `
          id, paciente_id, symptoms, urgency, status, created_at, updated_at,
          paciente:profiles!paciente_id(id, nome, email, telefone, foto_url)
        `
        )
        .eq('status', 'agendamento_pendente_secretaria')
        .order('created_at', { ascending: false }) as any,
      8000
    );

    if (error) throw error;
    return { success: true, data: data || [] };
  } catch (err: any) {
    return {
      success: false,
      error: err.message || 'Erro ao buscar agendamentos pendentes',
    };
  }
};

export const buscarTratamentosFinanceirosSecretaria = async (): Promise<{
  success: boolean;
  data?: TratamentoFinanceiroItem[];
  error?: string;
}> => {
  try {
    const procedimentosRes = await carregarProcedimentosTratamento();
    const procedimentos = procedimentosRes.data || [];
    if (procedimentos.length === 0) {
      return { success: true, data: [] };
    }

    const planoIds = [...new Set(procedimentos.map((item: any) => item.plano_id).filter(Boolean))];
    const planosRes = await withTimeout(
      supabase
        .from('planos_tratamento')
        .select('id, paciente_id, dentista_id, triagem_id')
        .in('id', planoIds) as any,
      8000
    );

    if (planosRes.error) throw planosRes.error;

    const planos = planosRes.data || [];
    const triagemIds = [...new Set(planos.map((item: any) => item.triagem_id).filter(Boolean))];
    const profileIds = [...new Set(
      planos.flatMap((item: any) => [item.paciente_id, item.dentista_id]).filter(Boolean)
    )];

    const profilesRes = await withTimeout(
      supabase
        .from('profiles')
        .select('id, nome, telefone, especialidade')
        .in('id', profileIds) as any,
      8000
    );

    if (profilesRes.error) throw profilesRes.error;

    const triagensRes = triagemIds.length > 0
      ? await withTimeout(
          supabase
            .from('triagens')
            .select('id, paciente_id, paciente:profiles!paciente_id(id, nome, telefone)')
            .in('id', triagemIds) as any,
          8000
        )
      : { data: [], error: null };

    if (triagensRes.error) throw triagensRes.error;

    const planosById = Object.fromEntries(planos.map((item: any) => [item.id, item]));
    const profilesById = Object.fromEntries((profilesRes.data || []).map((item: any) => [item.id, item]));
    const triagensById = Object.fromEntries((triagensRes.data || []).map((item: any) => [item.id, item]));

    const sessoesPorPlano: Record<string, number> = {};

    const data: TratamentoFinanceiroItem[] = procedimentos.map((item: any) => {
      const plano = planosById[item.plano_id] || {};
      const paciente = profilesById[plano.paciente_id] || {};
      const dentista = profilesById[plano.dentista_id] || {};
      const triagem = triagensById[plano.triagem_id] || {};
      const pacienteTriagem = triagem.paciente || {};
      const sessaoFallback = (sessoesPorPlano[item.plano_id] || 0) + 1;

      sessoesPorPlano[item.plano_id] = sessaoFallback;

      return {
        id: item.id,
        plano_id: item.plano_id,
        paciente_id: plano.paciente_id,
        paciente_nome: nomeOuFallback(
          paciente.nome,
          pacienteTriagem.nome
        ),
        paciente_telefone: paciente.telefone || pacienteTriagem.telefone || '',
        dentista_id: plano.dentista_id,
        dentista_nome: dentista.nome || 'Dentista',
        especialidade: dentista.especialidade || 'Clínica Geral',
        procedimento: item.descricao || 'Procedimento',
        sessao_numero: Number(item.sessao_numero || sessaoFallback),
        valor: Number(item.valor || 0),
        data_hora: item.created_at,
        status_clinico: String(item.status || 'pendente'),
        status_financeiro: (item.status_financeiro || 'sem_factura') as StatusFinanceiroProcedimento,
        numero_factura: item.numero_factura || null,
        factura_emitida_em: item.factura_emitida_em || null,
        pago_em: item.pago_em || null,
        observacoes: item.observacoes || null,
      };
    });

    return { success: true, data };
  } catch (err: any) {
    return {
      success: false,
      error: err.message || 'Erro ao buscar tratamentos e facturas',
    };
  }
};

export const atualizarFinanceiroProcedimento = async (
  procedimentoId: string,
  payload: Partial<{
    status_financeiro: StatusFinanceiroProcedimento;
    numero_factura: string | null;
    factura_emitida_em: string | null;
    pago_em: string | null;
  }>
): Promise<{ success: boolean; error?: string }> => {
  try {
    let campos = Object.entries(payload).filter(([, value]) => value !== undefined);

    while (campos.length > 0) {
      const updatePayload = Object.fromEntries(campos);
      const { error } = await supabase
        .from('procedimentos_tratamento')
        .update(updatePayload)
        .eq('id', procedimentoId);

      if (!error) {
        return { success: true };
      }

      if (!isMissingColumnError(error)) {
        throw error;
      }

      const colunaAusente = extractMissingColumn(error);
      if (!colunaAusente) {
        throw error;
      }

      campos = campos.filter(([key]) => key !== colunaAusente);
    }

    return { success: true };
  } catch (err: any) {
    return {
      success: false,
      error: err.message || 'Erro ao atualizar financeiro do procedimento',
    };
  }
};
