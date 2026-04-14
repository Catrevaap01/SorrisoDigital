/**
 * Serviço de exportação PDF
 * Gera PDFs para: relatório geral, relatório de dentista, histórico médico do paciente, e ficha
 * Funciona tanto em web (print dialog) quanto mobile (expo-print + sharing)
 */

import { Platform } from 'react-native';
import { gerarRelatorioDentista, gerarRelatorioGeral } from './relatorioService';
import { exportHtmlAsPdf } from '../utils/pdfExportUtils';
import { supabase, SUPABASE_SERVICE_ROLE_KEY } from '../config/supabase';

type PdfResult = { success: boolean; error?: string };

const formatDate = (d: string | null | undefined) => {
  if (!d) return '-';
  try {
    return new Date(d).toLocaleDateString('pt-AO', { day: '2-digit', month: '2-digit', year: 'numeric' });
  } catch {
    return d;
  }
};

const formatMoney = (value: number | string | undefined) => {
  const amount = Number(value || 0);
  return amount.toLocaleString('pt-AO', { minimumFractionDigits: 0 }).replace(/,/g, '.') + ' Kz';
};

const CSS_BASE = `
  @page { size: A4; margin: 20mm; }
  * { margin: 0; padding: 0; box-sizing: border-box; }
  body { font-family: 'Segoe UI', Arial, sans-serif; padding: 32px; color: #222; line-height: 1.5; background: white; }
  .header { text-align: center; border-bottom: 3px solid #1E88E5; padding-bottom: 16px; margin-bottom: 24px; }
  .header h1 { color: #1E88E5; font-size: 24px; margin: 0; }
  .header .sub { color: #666; font-size: 13px; margin-top: 4px; }
  .header .badge { display: inline-block; background: #E3F2FD; color: #1565C0; padding: 4px 14px; border-radius: 20px; font-size: 12px; font-weight: 600; margin-top: 8px; }
  .kpis { display: grid; grid-template-columns: repeat(auto-fill, minmax(140px, 1fr)); gap: 12px; margin: 20px 0; }
  .kpi { background: #f8f9fa; border: 1px solid #e0e0e0; border-radius: 10px; padding: 14px; text-align: center; }
  .kpi-value { font-size: 28px; font-weight: 700; color: #1E88E5; }
  .kpi-label { font-size: 11px; color: #888; text-transform: uppercase; letter-spacing: 0.5px; margin-top: 4px; }
  table { width: 100%; border-collapse: collapse; margin-top: 20px; font-size: 13px; }
  th { background: #1E88E5; color: white; padding: 10px 12px; text-align: left; font-weight: 600; }
  td { padding: 10px 12px; border-bottom: 1px solid #eee; }
  tr:nth-child(even) { background: #fafafa; }
  .section { margin: 24px 0; }
  .section h2 { color: #1E88E5; font-size: 18px; border-bottom: 2px solid #E3F2FD; padding-bottom: 6px; margin-bottom: 12px; }
  .info-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 8px; }
  .info-item .label { font-size: 11px; color: #888; text-transform: uppercase; letter-spacing: 0.5px; }
  .info-item .value { font-size: 14px; color: #333; font-weight: 500; }
  .footer { text-align: center; margin-top: 40px; color: #bbb; font-size: 10px; border-top: 1px solid #eee; padding-top: 12px; }
  .alert { background: #FFF3E0; border-left: 4px solid #E65100; padding: 10px 14px; border-radius: 6px; margin: 12px 0; font-size: 13px; }
  @media print { body { padding: 16px; } }
`;

// ─── Relatório Geral ──────────────────────────────────────────

const buildGeneralHtml = (relatorio: any): string => {
  const rows = (relatorio.dentistas || [])
    .map(
      (d: any) => `
      <tr>
        <td>${d.dentista?.nome || '-'}</td>
        <td>${d.dentista?.especialidade || '-'}</td>
        <td>${d.dentista?.crm || '-'}</td>
        <td style="text-align:center">${d.totalTriagens || 0}</td>
        <td style="text-align:center">${d.triagensRespondidas || 0}</td>
        <td style="text-align:right">${formatMoney(d.totalFaturado || 0)}</td>
        <td style="text-align:right">${formatMoney(d.totalRecebido || 0)}</td>
        <td style="text-align:right; color: #b91c1c">${formatMoney(d.pendenteReceber || 0)}</td>
        <td style="text-align:center;font-weight:700">${d.percentualResposta || 0}%</td>
      </tr>`
    )
    .join('');

  return `<!DOCTYPE html><html lang="pt-AO"><head><meta charset="utf-8"><title>Relatório Geral</title><style>${CSS_BASE}</style></head><body>
    <div class="header">
      <h1>🦷 Odontologia de Angola</h1>
      <div class="sub">Relatório Geral do Sistema</div>
      <div class="badge">📋 ${formatDate(relatorio.dataGeracao)}</div>
    </div>
    <div class="kpis">
      <div class="kpi"><div class="kpi-value">${relatorio.totalDentistas}</div><div class="kpi-label">Dentistas</div></div>
      <div class="kpi"><div class="kpi-value">${relatorio.totalPacientes}</div><div class="kpi-label">Pacientes</div></div>
      <div class="kpi"><div class="kpi-value">${relatorio.dentistasAtivos}</div><div class="kpi-label">Ativos</div></div>
      <div class="kpi"><div class="kpi-value">${relatorio.totalTriagens}</div><div class="kpi-label">Triagens</div></div>
      <div class="kpi"><div class="kpi-value">${formatMoney(relatorio.totalFaturado)}</div><div class="kpi-label">Faturado</div></div>
      <div class="kpi"><div class="kpi-value">${formatMoney(relatorio.totalRecebido)}</div><div class="kpi-label">Recebido</div></div>
      <div class="kpi"><div class="kpi-value" style="color:#b91c1c">${formatMoney(relatorio.totalPendente)}</div><div class="kpi-label">Pendente</div></div>
    </div>
    <div class="section"><h2>Dentistas</h2>
    <table>
      <thead><tr>
        <th>Nome</th><th>Especialidade</th><th>Triagens</th><th>Resp.</th><th>Faturado</th><th>Recebido</th><th>Pendente</th><th>Taxa</th>
      </tr></thead>
      <tbody>${rows}</tbody>
    </table></div>
    <div class="footer">Relatório gerado automaticamente pelo sistema TeOdonto Angola</div>
  </body></html>`;
};

// ─── Relatório do Dentista ──────────────────────────────────────

const buildDentistaHtml = (data: any): string => {
  const d = data.dentista;
  const e = data.estatisticas;
  const rows = (data.triagens || [])
    .slice(0, 100)
    .map(
      (t: any) => `
      <tr>
        <td>${formatDate(t.created_at)}</td>
        <td>${t.sintoma_principal || '-'}</td>
        <td>${t.localizacao || '-'}</td>
        <td><span style="font-weight:600">${t.status || '-'}</span></td>
        <td>${t.prioridade || '-'}</td>
      </tr>`
    )
    .join('');

  return `<!DOCTYPE html><html lang="pt-AO"><head><meta charset="utf-8"><title>Relatório Dentista</title><style>${CSS_BASE}</style></head><body>
    <div class="header">
      <h1>🦷 Relatório do Dentista</h1>
      <div class="sub">Dr(a). ${d?.nome || '-'} — ${d?.especialidade || 'Clínica Geral'}</div>
      <div class="badge">CRM: ${d?.crm || '-'} | ${d?.email || '-'}</div>
    </div>
    <div class="kpis">
      <div class="kpi"><div class="kpi-value">${e.totalTriagens}</div><div class="kpi-label">Total Triagens</div></div>
      <div class="kpi"><div class="kpi-value">${e.triagensRespondidas}</div><div class="kpi-label">Respondidas</div></div>
      <div class="kpi"><div class="kpi-value">${e.triagensPendentes}</div><div class="kpi-label">Pendentes</div></div>
      <div class="kpi"><div class="kpi-value">${e.percentualResposta}%</div><div class="kpi-label">Taxa Resposta</div></div>
      <div class="kpi"><div class="kpi-value">${formatMoney(e.totalFaturado)}</div><div class="kpi-label">Faturado</div></div>
      <div class="kpi"><div class="kpi-value">${formatMoney(e.totalRecebido)}</div><div class="kpi-label">Recebido</div></div>
      <div class="kpi"><div class="kpi-value" style="color:#b91c1c">${formatMoney(e.pendenteReceber)}</div><div class="kpi-label">Pendente</div></div>
    </div>
    <div class="section"><h2>Triagens</h2>
    <table>
      <thead><tr><th>Data</th><th>Sintoma</th><th>Localização</th><th>Status</th><th>Prioridade</th></tr></thead>
      <tbody>${rows}</tbody>
    </table></div>
    <div class="footer">Relatório gerado automaticamente pelo sistema TeOdonto Angola</div>
  </body></html>`;
};

// ─── Histórico Médico do Paciente ──────────────────────────────

const buildHistoricoPacienteHtml = (
  paciente: any,
  triagens: any[],
  agendamentos: any[]
): string => {
  const triagemRows = triagens
    .slice(0, 50)
    .map(
      (t: any) => `
      <tr>
        <td>${formatDate(t.created_at)}</td>
        <td>${t.sintoma_principal || '-'}</td>
        <td>${t.localizacao || '-'}</td>
        <td>${t.intensidade_dor ?? '-'}/10</td>
        <td>${t.status || '-'}</td>
        <td>${t.dentista?.nome || 'Pendente'}</td>
        <td>${t.descricao ? t.descricao.substring(0, 60) + (t.descricao.length > 60 ? '...' : '') : '-'}</td>
      </tr>`
    )
    .join('');

  const agendRows = agendamentos
    .slice(0, 50)
    .map(
      (a: any) => `
      <tr>
        <td>${formatDate(a.data_agendamento)}</td>
        <td>${a.tipo || '-'}</td>
        <td>${a.status || '-'}</td>
        <td>${a.dentista?.nome || '-'}</td>
        <td>${a.observacoes ? a.observacoes.substring(0, 60) : '-'}</td>
      </tr>`
    )
    .join('');

  const idade = paciente.data_nascimento
    ? Math.floor((Date.now() - new Date(paciente.data_nascimento).getTime()) / (365.25 * 24 * 60 * 60 * 1000))
    : null;

  return `<!DOCTYPE html><html lang="pt-AO"><head><meta charset="utf-8"><title>Histórico do Paciente</title><style>${CSS_BASE}</style></head><body>
    <div class="header">
      <h1>🦷 Histórico Médico do Paciente</h1>
      <div class="sub">${paciente.nome || '-'}</div>
      <div class="badge">📋 Gerado em ${formatDate(new Date().toISOString())}</div>
    </div>

    <div class="section"><h2>👤 Dados Pessoais</h2>
      <div class="info-grid">
        <div class="info-item"><span class="label">Nome</span><span class="value">${paciente.nome || '-'}</span></div>
        <div class="info-item"><span class="label">Email</span><span class="value">${paciente.email || '-'}</span></div>
        <div class="info-item"><span class="label">Telefone</span><span class="value">${paciente.telefone || '-'}</span></div>
        <div class="info-item"><span class="label">Data Nascimento</span><span class="value">${formatDate(paciente.data_nascimento)}${idade ? ` (${idade} anos)` : ''}</span></div>
        <div class="info-item"><span class="label">Género</span><span class="value">${paciente.genero || '-'}</span></div>
        <div class="info-item"><span class="label">Província</span><span class="value">${paciente.provincia || paciente.provincias?.nome || '-'}</span></div>
      </div>
    </div>

    ${paciente.historico_medico || paciente.alergias || paciente.medicamentos_atuais ? `
    <div class="section"><h2>🏥 Informações Médicas</h2>
      ${paciente.historico_medico ? `<div class="info-item" style="margin-bottom:8px"><span class="label">Histórico Médico</span><span class="value">${paciente.historico_medico}</span></div>` : ''}
      ${paciente.alergias ? `<div class="alert">⚠️ <strong>Alergias:</strong> ${paciente.alergias}</div>` : ''}
      ${paciente.medicamentos_atuais ? `<div class="info-item"><span class="label">Medicamentos Atuais</span><span class="value">${paciente.medicamentos_atuais}</span></div>` : ''}
    </div>` : ''}

    <div class="section"><h2>📋 Triagens (${triagens.length})</h2>
    ${triagens.length === 0 ? '<p style="color:#888">Nenhuma triagem registrada.</p>' : `
    <table>
      <thead><tr><th>Data</th><th>Sintoma</th><th>Localização</th><th>Dor</th><th>Status</th><th>Dentista</th><th>Descrição</th></tr></thead>
      <tbody>${triagemRows}</tbody>
    </table>`}
    </div>

    <div class="section"><h2>📅 Agendamentos (${agendamentos.length})</h2>
    ${agendamentos.length === 0 ? '<p style="color:#888">Nenhum agendamento registrado.</p>' : `
    <table>
      <thead><tr><th>Data</th><th>Tipo</th><th>Status</th><th>Dentista</th><th>Obs.</th></tr></thead>
      <tbody>${agendRows}</tbody>
    </table>`}
    </div>

    <div class="footer">
      <p>TeOdonto Angola — Sistema Digital de Odontologia</p>
      <p>ID do Paciente: ${paciente.id} | Documento confidencial</p>
    </div>
  </body></html>`;
};

// ─── Helpers para obter credenciais de admin ──────────────────

const getAdminCredentials = async (): Promise<{ url: string; key: string } | null> => {
  try {
    if (Platform.OS !== 'web') {
      // Em mobile/expo, usa expo-constants
      const Constants = (await import('expo-constants')).default;
      const extra = Constants.expoConfig?.extra
        || (Constants as any).manifest2?.extra
        || (Constants as any).manifest?.extra;
      const url = extra?.SUPABASE_URL;
      const key = extra?.SUPABASE_SERVICE_ROLE_KEY || SUPABASE_SERVICE_ROLE_KEY;
      if (url && key) return { url, key };
    }

    // Em web (ou fallback), usa process.env
    const url = (typeof process !== 'undefined' && process.env?.EXPO_PUBLIC_SUPABASE_URL)
      || (typeof process !== 'undefined' && process.env?.SUPABASE_URL)
      || '';
    const key = (typeof process !== 'undefined' && process.env?.SUPABASE_SERVICE_ROLE_KEY)
      || '';
    if (url && key) return { url, key };

    return null;
  } catch {
    return null;
  }
};

// ─── Public API ──────────────────────────────────────────────────

export const exportarRelatorioGeralPdf = async (): Promise<PdfResult> => {
  const result = await gerarRelatorioGeral();
  if (!result.success || !result.data) {
    return { success: false, error: result.error || 'Erro ao gerar relatório geral' };
  }
  return exportHtmlAsPdf(buildGeneralHtml(result.data), 'relatorio-geral.pdf');
};

export const exportarRelatorioDentistaPdf = async (
  dentistaId: string
): Promise<PdfResult> => {
  const result = await gerarRelatorioDentista(dentistaId);
  if (!result.success || !result.data) {
    return { success: false, error: result.error || 'Erro ao gerar relatório do dentista' };
  }
  return exportHtmlAsPdf(buildDentistaHtml(result.data), 'relatorio-dentista.pdf');
};

export const exportarHistoricoPacientePdf = async (
  pacienteId: string
): Promise<PdfResult> => {
  try {
    // Buscar dados do paciente, triagens e agendamentos em paralelo
    const [pacienteRes, triagensRes, agendamentosRes] = await Promise.all([
      supabase
        .from('profiles')
        .select('id, nome, email, telefone, data_nascimento, genero, provincia, provincia_id, historico_medico, alergias, medicamentos_atuais, provincias(nome)')
        .eq('id', pacienteId)
        .single(),
      supabase
        .from('triagens')
        .select('*, dentista:dentista_id(nome)')
        .eq('paciente_id', pacienteId)
        .order('created_at', { ascending: false })
        .limit(50),
      supabase
        .from('agendamentos')
        .select('*, dentista:dentista_id(nome)')
        .eq('paciente_id', pacienteId)
        .order('data_agendamento', { ascending: false })
        .limit(50),
    ]);

    let pacienteData = pacienteRes.data;
    let triagensData = triagensRes.data;
    let agendamentosData = agendamentosRes.data;

    // Fallback com admin client se dados ausentes (tenta obter credenciais de forma segura)
    if (!pacienteData || pacienteRes.error) {
      const creds = await getAdminCredentials();
      if (creds) {
        const { createClient } = await import('@supabase/supabase-js');
        const admin = createClient(creds.url, creds.key, { auth: { persistSession: false } });
        const [pAdmin, tAdmin, aAdmin] = await Promise.all([
          admin.from('profiles').select('id, nome, email, telefone, data_nascimento, genero, provincia, provincia_id, historico_medico, alergias, medicamentos_atuais, provincias(nome)').eq('id', pacienteId).single(),
          admin.from('triagens').select('*, dentista:dentista_id(nome)').eq('paciente_id', pacienteId).order('created_at', { ascending: false }).limit(50),
          admin.from('agendamentos').select('*, dentista:dentista_id(nome)').eq('paciente_id', pacienteId).order('data_agendamento', { ascending: false }).limit(50),
        ]);

        if (pAdmin.data) {
          pacienteData = pAdmin.data;
          triagensData = tAdmin.data || [];
          agendamentosData = aAdmin.data || [];
        }
      }
    }

    if (!pacienteData) {
      return { success: false, error: 'Paciente não encontrado' };
    }

    const paciente = {
      ...pacienteData,
      provincia: pacienteData.provincia || (pacienteData as any).provincias?.nome || '-',
    };

    const triagens = triagensData || [];
    const agendamentos = (agendamentosData || []).map((a: any) => ({
      ...a,
      dentista: a.dentista || undefined,
    }));

    const html = buildHistoricoPacienteHtml(paciente, triagens, agendamentos);
    return exportHtmlAsPdf(html, `historico-${paciente.nome?.replace(/[^a-z0-9]/gi, '_') || 'paciente'}.pdf`);
  } catch (err: any) {
    return { success: false, error: err.message || 'Erro ao gerar histórico do paciente' };
  }
};

/**
 * Exporta a ficha de cadastro como PDF (reutiliza HTML da fichaService)
 */
export const exportarFichaPdf = async (html: string, nomeP?: string): Promise<PdfResult> => {
  return exportHtmlAsPdf(html, `ficha-${nomeP?.replace(/[^a-z0-9]/gi, '_') || 'paciente'}.pdf`);
};

const safeFileName = (value?: string) =>
  (value || 'paciente').replace(/[^a-z0-9]/gi, '_');

const buildAnamneseHtml = (paciente: any, anamnese: any) => `
<!DOCTYPE html><html lang="pt-AO"><head><meta charset="utf-8"><title>Anamnese</title><style>${CSS_BASE}</style></head><body>
  <div class="header">
    <h1>Anamnese Clínica</h1>
    <div class="sub">${paciente?.nome || 'Paciente'}</div>
    <div class="badge">${formatDate(anamnese?.updated_at || anamnese?.created_at || new Date().toISOString())}</div>
  </div>
  <div class="section"><h2>Resumo</h2>
    <div class="info-grid">
      <div class="info-item"><span class="label">Paciente</span><span class="value">${paciente?.nome || '-'}</span></div>
      <div class="info-item"><span class="label">Telefone</span><span class="value">${paciente?.telefone || '-'}</span></div>
      <div class="info-item"><span class="label">Queixa principal</span><span class="value">${anamnese?.queixa_principal || '-'}</span></div>
      <div class="info-item"><span class="label">Medicamentos</span><span class="value">${anamnese?.medicamentos || '-'}</span></div>
    </div>
  </div>
  <div class="section"><h2>História clínica</h2>
    <p><strong>HDA:</strong> ${anamnese?.hda || '-'}</p>
    <p><strong>Alergias:</strong> ${anamnese?.alergias_desc || (anamnese?.alergico ? 'Sim' : 'Não informado')}</p>
    <p><strong>Doenças crônicas:</strong> ${[
      anamnese?.hipertensao ? 'Hipertensão' : '',
      anamnese?.diabetes ? 'Diabetes' : '',
      anamnese?.cardiopatia ? 'Cardiopatia' : '',
      anamnese?.coagulopatia ? 'Coagulopatia' : '',
      anamnese?.hepatite ? 'Hepatite' : '',
      anamnese?.hiv ? 'HIV' : '',
      anamnese?.outras_doencas || '',
    ].filter(Boolean).join(', ') || '-'}</p>
    <p><strong>Observações:</strong> ${anamnese?.observacoes || '-'}</p>
  </div>
  <div class="footer">Documento clínico gerado automaticamente pelo sistema</div>
</body></html>`;

const buildPlanoHtml = (paciente: any, procedimentos: any[]) => {
  const total = (procedimentos || []).reduce((sum: number, item: any) => sum + Number(item.valor || 0), 0);
  const rows = (procedimentos || []).map((item: any) => `
    <tr>
      <td>${item.descricao || '-'}</td>
      <td>${item.dente || '-'}</td>
      <td>${item.status || '-'}</td>
      <td>${Number(item.valor || 0).toLocaleString('pt-AO')} Kz</td>
      <td>${item.observacoes || '-'}</td>
    </tr>
  `).join('');

  return `<!DOCTYPE html><html lang="pt-AO"><head><meta charset="utf-8"><title>Plano</title><style>${CSS_BASE}</style></head><body>
    <div class="header">
      <h1>Plano de Tratamento</h1>
      <div class="sub">${paciente?.nome || 'Paciente'}</div>
      <div class="badge">Total estimado: ${total.toLocaleString('pt-AO')} Kz</div>
    </div>
    <div class="section"><h2>Procedimentos</h2>
      <table>
        <thead><tr><th>Procedimento</th><th>Dente</th><th>Estado</th><th>Valor</th><th>Observações</th></tr></thead>
        <tbody>${rows || '<tr><td colspan="5">Nenhum procedimento registado.</td></tr>'}</tbody>
      </table>
    </div>
    <div class="footer">Quando o paciente é o mesmo, o plano consolida os valores dos serviços.</div>
  </body></html>`;
};

const buildPrescricaoHtml = (paciente: any, prescricao: any) => {
  const medicamentos = Array.isArray(prescricao?.medicamentos) ? prescricao.medicamentos : [];
  const meds = medicamentos.map((m: any) => `
    <tr>
      <td>${m.nome || '-'}</td>
      <td>${m.dose || '-'}</td>
      <td>${m.frequencia || '-'}</td>
      <td>${m.duracao || '-'}</td>
      <td>${m.observacoes || '-'}</td>
    </tr>
  `).join('');

  return `<!DOCTYPE html><html lang="pt-AO"><head><meta charset="utf-8"><title>Prescrição</title><style>${CSS_BASE}</style></head><body>
    <div class="header">
      <h1>Prescrição</h1>
      <div class="sub">${paciente?.nome || 'Paciente'}</div>
      <div class="badge">${formatDate(prescricao?.created_at || new Date().toISOString())}</div>
    </div>
    <div class="section"><h2>Medicamentos</h2>
      <table>
        <thead><tr><th>Medicamento</th><th>Dose</th><th>Frequência</th><th>Duração</th><th>Observações</th></tr></thead>
        <tbody>${meds || '<tr><td colspan="5">Nenhum medicamento registado.</td></tr>'}</tbody>
      </table>
    </div>
    <div class="section"><h2>Assinatura clínica</h2>
      <p><strong>Dentista:</strong> ${prescricao?.dentista_nome || '-'}</p>
      <p><strong>CRM:</strong> ${prescricao?.dentista_crm || '-'}</p>
      <p><strong>Observações:</strong> ${prescricao?.observacoes || '-'}</p>
    </div>
  </body></html>`;
};

export const exportarAnamnesePdf = async (pacienteId: string): Promise<PdfResult> => {
  try {
    const [pacienteRes, anamneseRes] = await Promise.all([
      supabase.from('profiles').select('id, nome, telefone').eq('id', pacienteId).single(),
      supabase.from('anamneses').select('*').eq('paciente_id', pacienteId).order('updated_at', { ascending: false }).limit(1).maybeSingle(),
    ]);

    if (!pacienteRes.data) return { success: false, error: 'Paciente não encontrado' };
    if (!anamneseRes.data) return { success: false, error: 'Nenhuma anamnese encontrada para este paciente' };

    return exportHtmlAsPdf(buildAnamneseHtml(pacienteRes.data, anamneseRes.data), `anamnese-${safeFileName(pacienteRes.data.nome)}.pdf`);
  } catch (err: any) {
    return { success: false, error: err.message || 'Erro ao gerar PDF da anamnese' };
  }
};

export const exportarPlanoTratamentoPdf = async (pacienteId: string): Promise<PdfResult> => {
  try {
    const [pacienteRes, planoRes] = await Promise.all([
      supabase.from('profiles').select('id, nome, telefone').eq('id', pacienteId).single(),
      supabase.from('planos_tratamento').select('id').eq('paciente_id', pacienteId).order('created_at', { ascending: false }).limit(1).maybeSingle(),
    ]);

    if (!pacienteRes.data) return { success: false, error: 'Paciente não encontrado' };
    if (!planoRes.data?.id) return { success: false, error: 'Nenhum plano encontrado para este paciente' };

    const procedimentosRes = await supabase
      .from('procedimentos_tratamento')
      .select('*')
      .eq('plano_id', planoRes.data.id)
      .order('created_at', { ascending: true });

    return exportHtmlAsPdf(
      buildPlanoHtml(pacienteRes.data, procedimentosRes.data || []),
      `plano-${safeFileName(pacienteRes.data.nome)}.pdf`
    );
  } catch (err: any) {
    return { success: false, error: err.message || 'Erro ao gerar PDF do plano de tratamento' };
  }
};

export const exportarPrescricaoPdf = async (pacienteId: string): Promise<PdfResult> => {
  try {
    const [pacienteRes, prescricaoRes] = await Promise.all([
      supabase.from('profiles').select('id, nome, telefone').eq('id', pacienteId).single(),
      supabase.from('prescricoes').select('*').eq('paciente_id', pacienteId).order('created_at', { ascending: false }).limit(1).maybeSingle(),
    ]);

    if (!pacienteRes.data) return { success: false, error: 'Paciente não encontrado' };
    if (!prescricaoRes.data) return { success: false, error: 'Nenhuma prescrição encontrada para este paciente' };

    return exportHtmlAsPdf(
      buildPrescricaoHtml(pacienteRes.data, prescricaoRes.data),
      `prescricao-${safeFileName(pacienteRes.data.nome)}.pdf`
    );
  } catch (err: any) {
    return { success: false, error: err.message || 'Erro ao gerar PDF da prescrição' };
  }
};
