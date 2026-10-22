/**
 * Serviço orquestrador de lembretes de consulta.
 *
 * Dispara simultaneamente por 3 canais:
 *  1. Notificação in-app   → tabela "notificacoes" (Supabase)
 *  2. Email                → Edge Function send-email / SendGrid
 *  3. WhatsApp deep-link   → wa.me (abre na app ou browser)
 *  4. Push local           → expo-notifications (native) / Web Notifications (web/PWA)
 *
 * Falha de um canal NÃO bloqueia os outros.
 * Compatible: Web, PWA, Android, iOS.
 */

import { supabase, getAdminClient } from '../config/supabase';
import { logger } from '../utils/logger';
import { notificarAgendamentoPaciente } from './notificacoesService';
import { sendAppointmentReminderEmail } from './emailService';
import {
  scheduleAppointmentReminder,
  openWhatsAppReminder,
} from './localNotificationService';
import type { Agendamento } from './agendamentoService';

// ─── Tipos ────────────────────────────────────────────────────────────────────

export interface PacienteReminderProfile {
  id: string;
  nome: string;
  email?: string | null;
  telefone?: string | null;
}

export interface ReminderContext {
  agendamento: Agendamento;
  /** Se fornecido, evita uma query extra ao Supabase */
  paciente?: PacienteReminderProfile;
  /** Nome do dentista (opcional, para mensagens mais ricas) */
  nomeDentista?: string;
  /** Tipo da consulta (ex: sintoma, especialidade) */
  tipoConsulta?: string;
  /**
   * Modo do lembrete:
   * - 'agendado'   → consulta pré-agendada (atribuido_dentista)
   * - 'confirmado' → consulta confirmada definitivamente (confirmado_dentista)
   */
  modo?: 'agendado' | 'confirmado';
}

export interface ReminderResult {
  inApp: boolean;
  email: boolean;
  whatsapp: boolean;
  pushLocal: boolean;
  errors: string[];
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

/** Formata uma string de data/hora para PT legível */
const formatDataHora = (
  appointmentDate?: string,
  appointmentTime?: string
): { data: string; hora: string } => {
  if (!appointmentDate) return { data: '—', hora: appointmentTime || '—' };

  try {
    // appointmentDate pode ser "YYYY-MM-DD" ou ISO completo
    const [y, m, d] = appointmentDate.split('T')[0].split('-');
    const data = `${d}/${m}/${y}`;
    const hora = appointmentTime
      ? appointmentTime.slice(0, 5)
      : appointmentDate.includes('T')
      ? appointmentDate.split('T')[1].slice(0, 5)
      : '—';
    return { data, hora };
  } catch {
    return { data: appointmentDate, hora: appointmentTime || '—' };
  }
};

/** Busca o perfil do paciente se não foi fornecido */
const fetchPacienteProfile = async (
  patientId: string
): Promise<PacienteReminderProfile | null> => {
  try {
    const client = getAdminClient() || supabase;
    const { data, error } = await client
      .from('profiles')
      .select('id, nome, email, telefone')
      .eq('id', patientId)
      .single();

    if (error || !data) return null;
    return data as PacienteReminderProfile;
  } catch {
    return null;
  }
};

// ─── Função principal ─────────────────────────────────────────────────────────

/**
 * Envia lembretes de consulta por todos os canais disponíveis.
 * Deve ser chamada em:
 *  - agendarAgendamento()   → modo: 'agendado'
 *  - confirmarAgendamento() → modo: 'confirmado'
 */
export const enviarLembretesConsulta = async (
  ctx: ReminderContext
): Promise<ReminderResult> => {
  const result: ReminderResult = {
    inApp: false,
    email: false,
    whatsapp: false,
    pushLocal: false,
    errors: [],
  };

  const { agendamento, nomeDentista, tipoConsulta, modo = 'confirmado' } = ctx;

  if (!agendamento.patient_id) {
    result.errors.push('patient_id em falta — lembretes não enviados');
    logger.warn('enviarLembretesConsulta: patient_id ausente', agendamento);
    return result;
  }

  // ── Buscar perfil do paciente ──────────────────────────────────────────────
  let paciente = ctx.paciente || null;
  if (!paciente) {
    paciente = await fetchPacienteProfile(agendamento.patient_id);
  }

  if (!paciente) {
    result.errors.push('Perfil do paciente não encontrado');
    logger.warn('enviarLembretesConsulta: perfil não encontrado', {
      patientId: agendamento.patient_id,
    });
    return result;
  }

  const { data: dataFormatada, hora: horaFormatada } = formatDataHora(
    agendamento.appointment_date,
    agendamento.appointment_time
  );

  const dentistaNome = nomeDentista || 'o seu dentista';
  const tipo = tipoConsulta || agendamento.symptoms || 'Consulta Odontológica';

  const tituloInApp =
    modo === 'confirmado'
      ? '✅ Consulta confirmada!'
      : '📅 Consulta agendada!';

  const mensagemInApp =
    modo === 'confirmado'
      ? `A sua consulta foi confirmada para ${dataFormatada} às ${horaFormatada} com ${dentistaNome}.`
      : `A sua consulta está pré-agendada para ${dataFormatada} às ${horaFormatada}. Aguarde confirmação.`;

  // ── Canal 1: In-App (Supabase notificacoes) ───────────────────────────────
  try {
    const inAppRes = await notificarAgendamentoPaciente(
      agendamento.patient_id,
      tituloInApp,
      mensagemInApp,
      {
        agendamento_id: agendamento.id,
        appointment_date: agendamento.appointment_date,
        appointment_time: agendamento.appointment_time,
        modo,
      }
    );
    result.inApp = inAppRes.success;
    if (!inAppRes.success) {
      result.errors.push(`In-App: ${String(inAppRes.error || 'falha desconhecida')}`);
    }
  } catch (e: any) {
    result.errors.push(`In-App exception: ${e?.message}`);
    logger.warn('enviarLembretesConsulta: erro in-app', e);
  }

  // ── Canal 2: Email ─────────────────────────────────────────────────────────
  if (paciente.email) {
    try {
      const emailRes = await sendAppointmentReminderEmail(
        paciente.email,
        paciente.nome,
        dataFormatada,
        horaFormatada,
        dentistaNome,
        tipo
      );
      result.email = emailRes.success;
      if (!emailRes.success) {
        result.errors.push(`Email: ${emailRes.error || 'falha desconhecida'}`);
      }
    } catch (e: any) {
      result.errors.push(`Email exception: ${e?.message}`);
      logger.warn('enviarLembretesConsulta: erro email', e);
    }
  } else {
    result.errors.push('Email: paciente sem email registado');
  }

  // ── Canal 3: WhatsApp deep-link ────────────────────────────────────────────
  if (paciente.telefone) {
    try {
      const waRes = await openWhatsAppReminder({
        telefonePaciente: paciente.telefone,
        nomePaciente: paciente.nome,
        dataConsulta: dataFormatada,
        horaConsulta: horaFormatada,
        nomeDentista: dentistaNome,
        tipoConsulta: tipo,
      });
      result.whatsapp = waRes.success;
      if (!waRes.success) {
        result.errors.push(`WhatsApp: ${waRes.error || 'falha desconhecida'}`);
      }
    } catch (e: any) {
      result.errors.push(`WhatsApp exception: ${e?.message}`);
      logger.warn('enviarLembretesConsulta: erro whatsapp', e);
    }
  } else {
    result.errors.push('WhatsApp: paciente sem telefone registado');
  }

  // ── Canal 4: Push local (24h antes) ───────────────────────────────────────
  // Só faz sentido para modo 'confirmado' (datas definitivas)
  if (agendamento.appointment_date) {
    try {
      // Combinar data + hora para criar o datetime completo
      const dateTimeStr = agendamento.appointment_time
        ? `${agendamento.appointment_date.split('T')[0]}T${agendamento.appointment_time}:00`
        : agendamento.appointment_date;

      await scheduleAppointmentReminder(
        '🦷 Lembrete: consulta amanhã',
        `${paciente.nome}, tem consulta amanhã às ${horaFormatada} com ${dentistaNome}.`,
        dateTimeStr
      );
      result.pushLocal = true;
    } catch (e: any) {
      result.errors.push(`Push local exception: ${e?.message}`);
      logger.warn('enviarLembretesConsulta: erro push local', e);
    }
  }

  // ── Log resumo ─────────────────────────────────────────────────────────────
  logger.info('enviarLembretesConsulta concluído', {
    agendamentoId: agendamento.id,
    patientId: agendamento.patient_id,
    modo,
    canais: result,
  });

  return result;
};
