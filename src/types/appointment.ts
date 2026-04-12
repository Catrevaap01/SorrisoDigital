export type AppointmentStatus =
  | 'solicitado'
  | 'agendamento_pendente_secretaria'
  | 'em_triagem'
  | 'aguardando_dentista'
  | 'atribuido_dentista'
  | 'confirmado_dentista'
  | 'rejeitado_dentista'
  | 'reagendamento_solicitado'
  | 'notificado_paciente'
  | 'confirmado_paciente'
  | 'realizado'
  | 'cancelado';

export type AppointmentUrgency = 'baixa' | 'normal' | 'alta' | 'urgente';

export interface AppointmentPayload {
  patientId: string;
  dentistId?: string;
  secretaryId?: string;
  symptoms: string;
  urgency: AppointmentUrgency;
  notes?: string;
  appointmentDate?: string;
  appointmentTime?: string;
  reason?: string;
}

export interface AppointmentRequestPayload {
  patientId: string;
  symptoms: string;
  urgency: AppointmentUrgency;
  notes?: string;
}

export interface AppointmentSchedulingPayload {
  appointmentId: string;
  secretaryId: string;
  dentistId: string;
  appointmentDate: string;
  appointmentTime: string;
  notes?: string;
}

export interface AppointmentStatusUpdatePayload {
  appointmentId: string;
  status: AppointmentStatus;
  actorId: string;
  comments?: string;
  appointmentDate?: string;
  appointmentTime?: string;
}

export interface Appointment {
  id: string;
  patientId: string;
  dentistId?: string | null;
  secretaryId?: string | null;
  symptoms: string;
  urgency: AppointmentUrgency;
  notes?: string | null;
  appointmentDate?: string | null;
  appointmentTime?: string | null;
  status: AppointmentStatus;
  createdAt: string;
  updatedAt: string;
  confirmedAt?: string | null;
  priority: 'baixa' | 'normal' | 'alta' | 'urgente';
  patient?: {
    id: string;
    nome?: string;
    telefone?: string;
    email?: string;
  } | null;
  dentist?: {
    id: string;
    nome?: string;
    especialidade?: string;
    telefone?: string;
  } | null;
  secretary?: {
    id: string;
    nome?: string;
    telefone?: string;
  } | null;
}

export interface AppointmentRealtimePayload {
  eventType: string;
  appointment: Appointment;
}
