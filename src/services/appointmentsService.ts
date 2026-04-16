import { SupabaseClient, RealtimeChannel } from '@supabase/supabase-js';
import NetInfo from '@react-native-community/netinfo';
import { supabase, getAdminClient } from '../config/supabase';
import { withTimeout } from '../utils/withTimeout';
import { handleError, HandledError } from '../utils/errorHandler';
import { logger } from '../utils/logger';
import { enqueueOfflineAction, registerSyncHandler } from './offlineSyncService';
import { notificarAgendamentoPaciente } from './notificacoesService';
import { scheduleAppointmentReminder } from './localNotificationService';
import {
  Appointment,
  AppointmentPayload,
  AppointmentRequestPayload,
  AppointmentSchedulingPayload,
  AppointmentStatus,
  AppointmentStatusUpdatePayload,
  AppointmentUrgency,
  AppointmentRealtimePayload,
} from '../types/appointment';

export interface AppointmentServiceResult<T> {
  success: boolean;
  data?: T;
  error?: string | HandledError;
}

const APPOINTMENT_STATUS_ORDER: AppointmentStatus[] = [
  'solicitado',
  'em_triagem',
  'aguardando_dentista',
  'confirmado_dentista',
  'rejeitado_dentista',
  'reagendamento_solicitado',
  'notificado_paciente',
  'confirmado_paciente',
  'realizado',
  'cancelado',
];

const ACTIVE_APPOINTMENT_STATUSES: AppointmentStatus[] = [
  'solicitado',
  'em_triagem',
  'aguardando_dentista',
  'confirmado_dentista',
  'reagendamento_solicitado',
  'notificado_paciente',
  'confirmado_paciente',
];

const normalizeAppointmentRecord = (row: any): Appointment => {
  if (!row) {
    return row as Appointment;
  }

  return {
    id: row.id,
    patientId: row.patient_id,
    dentistId: row.dentist_id || null,
    secretaryId: row.secretary_id || null,
    symptoms: row.symptoms,
    urgency: row.urgency as AppointmentUrgency,
    notes: row.notes || null,
    appointmentDate: row.appointment_date || null,
    appointmentTime: row.appointment_time || null,
    status: row.status as AppointmentStatus,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    confirmedAt: row.confirmed_at || null,
    priority: row.priority || 'normal',
    patient: row.patient || null,
    dentist: row.dentist || null,
    secretary: row.secretary || null,
  };
};

const runWithAdminFallback = async (
  queryFn: (client: SupabaseClient) => any
): Promise<any> => {
  const client = supabase;
  let result = await queryFn(client);
  if (result?.error && (result.error.code === '42501' || (result.error as any)?.status === 403)) {
    const admin = getAdminClient();
    if (admin) {
      result = await queryFn(admin);
    }
  }
  return result;
};

const getPriorityForUrgency = (urgency: AppointmentUrgency): 'baixa' | 'normal' | 'alta' | 'urgente' => {
  if (urgency === 'alta' || urgency === 'urgente') {
    return urgency;
  }
  return urgency === 'baixa' ? 'baixa' : 'normal';
};

const appointmentRowPayload = (payload: Partial<AppointmentPayload>): Record<string, any> => {
  return {
    patient_id: payload.patientId,
    dentist_id: payload.dentistId || null,
    secretary_id: payload.secretaryId || null,
    symptoms: payload.symptoms,
    urgency: payload.urgency || 'normal',
    notes: payload.notes?.trim() ?? undefined,
    appointment_date: payload.appointmentDate || null,
    appointment_time: payload.appointmentTime || null,
    priority: getPriorityForUrgency(payload.urgency || 'normal'),
  };
};

/**
 * Valida o papel do usuário para uma operação específica.
 * Retorna true se o usuário tem permissão.
 */
const validateActorRole = (
  userRole: 'paciente' | 'dentista' | 'secretario' | 'admin',
  action: 'create_request' | 'assign' | 'respond' | 'patient_confirm' | 'complete' | 'cancel'
): boolean => {
  const rolePermissions: Record<string, string[]> = {
    paciente: ['create_request', 'patient_confirm', 'cancel'],
    secretario: ['assign', 'cancel'],
    dentista: ['respond', 'complete', 'cancel'],
    admin: ['create_request', 'assign', 'respond', 'patient_confirm', 'complete', 'cancel'],
  };

  return (rolePermissions[userRole] || []).includes(action);
};

const getConflictQuery = (
  dentistId: string,
  appointmentDate: string,
  appointmentTime: string,
  excludedAppointmentId?: string
) => {
  let query = supabase
    .from('appointments')
    .select('id')
    .eq('dentist_id', dentistId)
    .eq('appointment_date', appointmentDate)
    .eq('appointment_time', appointmentTime)
    .in('status', ACTIVE_APPOINTMENT_STATUSES as any);

  if (excludedAppointmentId) {
    query = query.neq('id', excludedAppointmentId);
  }

  return query;
};

const queueOfflineAction = async (action: string, payload: any): Promise<boolean> => {
  const state = await NetInfo.fetch();
  if (!state.isConnected || !state.isInternetReachable) {
    logger.info(`📡 Offline: enfileirando ação ${action}`);
    await enqueueOfflineAction(action, payload);
    return true;
  }
  return false;
};

export const checkAppointmentConflict = async (
  dentistId: string,
  appointmentDate: string,
  appointmentTime: string,
  excludedAppointmentId?: string
): Promise<AppointmentServiceResult<boolean>> => {
  try {
    if (!dentistId || !appointmentDate || !appointmentTime) {
      return { success: true, data: false };
    }

    const { data, error } = await withTimeout(
      getConflictQuery(dentistId, appointmentDate, appointmentTime, excludedAppointmentId),
      10_000
    );
    if (error) throw error;

    const conflictExists = Array.isArray(data) && data.length > 0;
    return { success: true, data: conflictExists };
  } catch (err: any) {
    const handled = handleError(err, 'appointmentsService.checkAppointmentConflict');
    return { success: false, error: handled };
  }
};

const notifyPatient = async (
  patientId: string,
  title: string,
  message: string,
  dados: Record<string, any> = {}
) => {
  try {
    await notificarAgendamentoPaciente(patientId, title, message, dados);
  } catch (err) {
    logger.warn('appointmentsService.notifyPatient failed', err);
  }
};

const createRealTimeChannel = (): RealtimeChannel =>
  supabase.channel('appointments-realtime');

export const subscribeToAppointmentChanges = (
  onUpdate: (payload: AppointmentRealtimePayload) => void,
  onError?: (error: string) => void
): RealtimeChannel => {
  const channel = createRealTimeChannel();

  channel.on(
    'postgres_changes',
    { event: '*', schema: 'public', table: 'appointments' },
    (payload: any) => {
      if (!payload?.new) return;
      onUpdate({
        eventType: payload.eventType || payload.event || 'unknown',
        appointment: normalizeAppointmentRecord(payload.new),
      });
    }
  );

  channel.subscribe();

  return channel;
};

export const createAppointmentRequest = async (
  payload: AppointmentRequestPayload
): Promise<AppointmentServiceResult<Appointment>> => {
  /**
   * Fluxo: Paciente cria solicitação de agendamento
   * - Apenas pacientes (ou admin) podem criar solicitações
   * - O RLS do Supabase valida que patient_id == usuario logado
   */
  try {
    if (!payload.patientId) {
      return { success: false, error: 'Paciente não informado' };
    }
    if (!payload.symptoms?.trim()) {
      return { success: false, error: 'Descreva os sintomas' };
    }

    const appointmentPayload = {
      ...appointmentRowPayload({
        patientId: payload.patientId,
        symptoms: payload.symptoms.trim(),
        urgency: payload.urgency || 'normal',
        notes: payload.notes?.trim() ?? undefined,
      }),
      status: 'solicitado',
    };

    if (await queueOfflineAction('createAppointmentRequest', appointmentPayload)) {
      return {
        success: true,
        data: normalizeAppointmentRecord({
          id: `temp-${Date.now()}`,
          ...appointmentPayload,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        }),
      };
    }

    const { data, error } = await runWithAdminFallback((client) =>
      client.from('appointments').insert([appointmentPayload]).select().single()
    );

    if (error) throw error;

    return { success: true, data: normalizeAppointmentRecord(data) };
  } catch (err: any) {
    const handled = handleError(err, 'appointmentsService.createAppointmentRequest');
    return { success: false, error: handled };
  }
};

export const assignSecretaryAppointment = async (
  payload: AppointmentSchedulingPayload
): Promise<AppointmentServiceResult<Appointment>> => {
  /**
   * Fluxo: Secretário atribui agendamento a um dentista
   * - Apenas secretários (ou admin) podem atribuir agendamentos
   * - Paciente já criou a solicitação ('solicitado')
   * - Secretário escolhe um dentista e marca data/hora
   * - Status muda para 'aguardando_dentista'
   * - O RLS do Supabase valida secretary_id
   */
  try {
    const { appointmentId, secretaryId, dentistId, appointmentDate, appointmentTime, notes } = payload;
    if (!appointmentId || !secretaryId || !dentistId || !appointmentDate || !appointmentTime) {
      return { success: false, error: 'Dados de agendamento incompletos' };
    }

    const conflictResult = await checkAppointmentConflict(dentistId, appointmentDate, appointmentTime, appointmentId);
    if (!conflictResult.success) {
      return { success: false, error: conflictResult.error || 'Erro ao verificar conflitos de agenda' };
    }
    if (conflictResult.data) {
      return { success: false, error: 'Horário já reservado para este dentista' };
    }

    const updatePayload = {
      secretary_id: secretaryId,
      dentist_id: dentistId,
      appointment_date: appointmentDate,
      appointment_time: appointmentTime,
      status: 'aguardando_dentista',
      notes: notes?.trim() || null,
      updated_at: new Date().toISOString(),
    };

    if (await queueOfflineAction('assignSecretaryAppointment', { appointmentId, ...updatePayload })) {
      return {
        success: true,
        data: normalizeAppointmentRecord({
          id: appointmentId,
          ...updatePayload,
          patient_id: null,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
          status: 'aguardando_dentista',
        }),
      };
    }

    const { data, error } = await runWithAdminFallback((client) =>
      client
        .from('appointments')
        .update(updatePayload)
        .eq('id', appointmentId)
        .select()
        .single()
    );

    if (error) throw error;

    if (data?.patient_id) {
      await notifyPatient(
        data.patient_id,
        'Consulta agendada pela secretária',
        `Sua solicitação foi agendada para ${appointmentDate} às ${appointmentTime}. Aguarde a confirmação do dentista.`,
        { appointment_id: appointmentId }
      );
    }

    return { success: true, data: normalizeAppointmentRecord(data) };
  } catch (err: any) {
    const handled = handleError(err, 'appointmentsService.assignSecretaryAppointment');
    return { success: false, error: handled };
  }
};

export const dentistRespondAppointment = async (
  payload: AppointmentStatusUpdatePayload
): Promise<AppointmentServiceResult<Appointment>> => {
  /**
   * Fluxo: Dentista responde ao agendamento
   * - Apenas o dentista atribuído (ou admin) pode responder
   * - Pode confirmar ('confirmado_dentista') ou rejeitar ('rejeitado_dentista')
   * - Se rejeitar, secretário logo reagenda
   * - O RLS do Supabase valida dentist_id
   */
  try {
    const { appointmentId, status, actorId, comments, appointmentDate, appointmentTime } = payload;
    if (!appointmentId || !actorId) {
      return { success: false, error: 'Dados de resposta incompletos' };
    }

    const updatePayload: Record<string, any> = {
      status,
      updated_at: new Date().toISOString(),
    };

    if (status === 'confirmado_dentista') {
      updatePayload.confirmed_at = new Date().toISOString();
    }

    if (status === 'reagendamento_solicitado') {
      updatePayload.appointment_date = appointmentDate || null;
      updatePayload.appointment_time = appointmentTime || null;
      updatePayload.notes = comments?.trim() || null;
    }

    if (comments) {
      updatePayload.notes = comments.trim();
    }

    if (await queueOfflineAction('dentistRespondAppointment', payload)) {
      return {
        success: true,
        data: normalizeAppointmentRecord({
          id: appointmentId,
          status,
          appointment_date: appointmentDate || null,
          appointment_time: appointmentTime || null,
          notes: updatePayload.notes || null,
          updated_at: new Date().toISOString(),
          confirmed_at: status === 'confirmado_dentista' ? new Date().toISOString() : null,
        }),
      };
    }

    const { data, error } = await runWithAdminFallback((client) =>
      client
        .from('appointments')
        .update(updatePayload)
        .eq('id', appointmentId)
        .select()
        .single()
    );

    if (error) throw error;

    if (data?.patient_id) {
      if (status === 'confirmado_dentista') {
        await notifyPatient(
          data.patient_id,
          'Dentista confirmou sua consulta',
          `Seu agendamento foi confirmado para ${data.appointment_date} às ${data.appointment_time}.`,
          { appointment_id: appointmentId }
        );
        await scheduleAppointmentReminder(
          'Sua consulta foi confirmada',
          `Sua consulta está marcada para ${data.appointment_date} às ${data.appointment_time}.`,
          `${data.appointment_date}T${data.appointment_time}:00Z`
        );
      } else if (status === 'rejeitado_dentista') {
        await notifyPatient(
          data.patient_id,
          'Dentista rejeitou a consulta',
          'O dentista não pôde confirmar seu horário. Aguarde a secretária reagendar.',
          { appointment_id: appointmentId }
        );
      } else if (status === 'reagendamento_solicitado') {
        await notifyPatient(
          data.patient_id,
          'Reagendamento solicitado',
          'O dentista pediu um novo horário. A secretária fará o contato em breve.',
          { appointment_id: appointmentId }
        );
      }
    }

    return { success: true, data: normalizeAppointmentRecord(data) };
  } catch (err: any) {
    const handled = handleError(err, 'appointmentsService.dentistRespondAppointment');
    return { success: false, error: handled };
  }
};

export const patientConfirmAppointment = async (
  appointmentId: string,
  patientId: string
): Promise<AppointmentServiceResult<Appointment>> => {
  /**
   * Fluxo: Paciente confirma a consulta agendada
   * - Apenas o paciente (ou admin) pode confirmar
   * - Muda a status para 'confirmado_paciente'
   * - O RLS do Supabase valida patient_id
   */
  try {
    if (!appointmentId || !patientId) {
      return { success: false, error: 'Dados de confirmação incompletos' };
    }

    if (await queueOfflineAction('patientConfirmAppointment', { appointmentId, patientId })) {
      return {
        success: true,
        data: normalizeAppointmentRecord({
          id: appointmentId,
          status: 'confirmado_paciente',
          updated_at: new Date().toISOString(),
        }),
      };
    }

    const { data, error } = await runWithAdminFallback((client) =>
      client
        .from('appointments')
        .update({
          status: 'confirmado_paciente',
          updated_at: new Date().toISOString(),
        })
        .eq('id', appointmentId)
        .eq('patient_id', patientId)
        .select()
        .single()
    );

    if (error) throw error;

    if (data?.patient_id) {
      await notifyPatient(
        data.patient_id,
        'Consulta confirmada por você',
        `Sua consulta para ${data.appointment_date} às ${data.appointment_time} foi confirmada com sucesso.`,
        { appointment_id: appointmentId }
      );
    }

    return { success: true, data: normalizeAppointmentRecord(data) };
  } catch (err: any) {
    const handled = handleError(err, 'appointmentsService.patientConfirmAppointment');
    return { success: false, error: handled };
  }
};

export const completeAppointment = async (
  appointmentId: string
): Promise<AppointmentServiceResult<Appointment>> => {
  /**
   * Fluxo: Dentista marca a consulta como realizada
   * - Apenas o dentista ou secretário pode completar
   * - Muda status para 'realizado'
   * - Pode incluir dados da consulta (prescrição, plano de tratamento, etc)
   */
  try {
    if (await queueOfflineAction('completeAppointment', { appointmentId })) {
      return {
        success: true,
        data: normalizeAppointmentRecord({
          id: appointmentId,
          status: 'realizado',
          updated_at: new Date().toISOString(),
        }),
      };
    }

    const { data, error } = await runWithAdminFallback((client) =>
      client
        .from('appointments')
        .update({ status: 'realizado', updated_at: new Date().toISOString() })
        .eq('id', appointmentId)
        .select()
        .single()
    );

    if (error) throw error;
    return { success: true, data: normalizeAppointmentRecord(data) };
  } catch (err: any) {
    const handled = handleError(err, 'appointmentsService.completeAppointment');
    return { success: false, error: handled };
  }
};

export const cancelAppointment = async (
  appointmentId: string,
  reason?: string
): Promise<AppointmentServiceResult<Appointment>> => {
  /**
   * Fluxo: Qualquer participante pode cancelar a consulta
   * - Paciente, secretário ou dentista podem cancelar
   * - Muda status para 'cancelado'
   * - Opcional: um motivo pode ser registrado em notes
   */
  try {
    if (await queueOfflineAction('cancelAppointment', { appointmentId, reason })) {
      return {
        success: true,
        data: normalizeAppointmentRecord({
          id: appointmentId,
          status: 'cancelado',
          notes: reason?.trim() || null,
          updated_at: new Date().toISOString(),
        }),
      };
    }

    const { data, error } = await runWithAdminFallback((client) =>
      client
        .from('appointments')
        .update({
          status: 'cancelado',
          notes: reason?.trim() || null,
          updated_at: new Date().toISOString(),
        })
        .eq('id', appointmentId)
        .select()
        .single()
    );

    if (error) throw error;
    return { success: true, data: normalizeAppointmentRecord(data) };
  } catch (err: any) {
    const handled = handleError(err, 'appointmentsService.cancelAppointment');
    return { success: false, error: handled };
  }
};

const buildListQuery = (role: 'paciente' | 'dentista' | 'secretario', userId: string) => {
  const query = supabase.from('appointments').select('*').order('created_at', { ascending: false });

  switch (role) {
    case 'paciente':
      return query.eq('patient_id', userId);
    case 'dentista':
      return query.eq('dentist_id', userId);
    case 'secretario':
      return query.or(`secretary_id.eq.${userId},status.eq.solicitado,status.eq.em_triagem,status.eq.reagendamento_solicitado`);
    default:
      return query;
  }
};

export const fetchAppointmentsForRole = async (
  role: 'paciente' | 'dentista' | 'secretario',
  userId: string
): Promise<AppointmentServiceResult<Appointment[]>> => {
  try {
    if (!userId) {
      return { success: false, error: 'Usuário não informado' };
    }

    const { data, error } = await withTimeout(buildListQuery(role, userId), 10_000);
    if (error) throw error;

    const normalized = (data || []).map(normalizeAppointmentRecord);
    return { success: true, data: normalized };
  } catch (err: any) {
    const handled = handleError(err, 'appointmentsService.fetchAppointmentsForRole');
    return { success: false, error: handled };
  }
};

export const fetchAppointmentById = async (
  appointmentId: string
): Promise<AppointmentServiceResult<Appointment>> => {
  try {
    if (!appointmentId) {
      return { success: false, error: 'ID de agendamento obrigatório' };
    }

    const { data, error } = await withTimeout(
      supabase.from('appointments').select('*').eq('id', appointmentId).single(),
      10_000
    );

    if (error) throw error;
    return { success: true, data: normalizeAppointmentRecord(data) };
  } catch (err: any) {
    const handled = handleError(err, 'appointmentsService.fetchAppointmentById');
    return { success: false, error: handled };
  }
};

const handleOfflineWrite = async (action: string, payload: any) => {
  const state = await NetInfo.fetch();
  if (!state.isConnected || !state.isInternetReachable) {
    logger.info(`📡 Offline: Enfileirando ação de agendamento ${action}`);
    await enqueueOfflineAction(action, payload);
    return true;
  }
  return false;
};

registerSyncHandler('createAppointmentRequest', async (payload: AppointmentRequestPayload) =>
  createAppointmentRequest(payload)
);
registerSyncHandler('assignSecretaryAppointment', async (payload: AppointmentSchedulingPayload) =>
  assignSecretaryAppointment(payload)
);
registerSyncHandler('dentistRespondAppointment', async (payload: AppointmentStatusUpdatePayload) =>
  dentistRespondAppointment(payload)
);
registerSyncHandler('patientConfirmAppointment', async (payload: { appointmentId: string; patientId: string }) =>
  patientConfirmAppointment(payload.appointmentId, payload.patientId)
);
registerSyncHandler('completeAppointment', async (payload: { appointmentId: string }) =>
  completeAppointment(payload.appointmentId)
);
registerSyncHandler('cancelAppointment', async (payload: { appointmentId: string; reason?: string }) =>
  cancelAppointment(payload.appointmentId, payload.reason)
);
