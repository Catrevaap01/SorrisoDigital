import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Appointment } from '../types/appointment';
import { fetchAppointmentsForRole, fetchAppointmentById, subscribeToAppointmentChanges } from '../services/appointmentsService';
import { useAuth } from '../contexts/AuthContext';
import { RealtimeChannel } from '@supabase/supabase-js';

interface UseAppointmentsReturn {
  appointments: Appointment[];
  loading: boolean;
  error: string | null;
  refresh: () => Promise<void>;
  getAppointment: (appointmentId: string) => Promise<Appointment | null>;
}

export const useAppointments = (role: 'paciente' | 'dentista' | 'secretario') : UseAppointmentsReturn => {
  const { profile } = useAuth();
  const userId = profile?.id ?? '';
  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const subscriptionRef = useRef<RealtimeChannel | null>(null);

  const loadAppointments = useCallback(async () => {
    if (!userId) {
      setError('Usuário não autenticado');
      setLoading(false);
      return;
    }

    setLoading(true);
    setError(null);

    const result = await fetchAppointmentsForRole(role, userId);
    if (result.success && result.data) {
      setAppointments(result.data);
    } else {
      setError(result.error ? String(result.error) : 'Erro ao carregar consultas');
      setAppointments([]);
    }

    setLoading(false);
  }, [role, userId]);

  const matchAppointmentForRole = useCallback(
    (appointment: Appointment): boolean => {
      switch (role) {
        case 'paciente':
          return appointment.patientId === userId;
        case 'dentista':
          return appointment.dentistId === userId;
        case 'secretario':
          return (
            appointment.secretaryId === userId ||
            appointment.status === 'solicitado' ||
            appointment.status === 'em_triagem' ||
            appointment.status === 'reagendamento_solicitado'
          );
        default:
          return false;
      }
    },
    [role, userId]
  );

  const handleRealtimeUpdate = useCallback(
    (payload: { eventType: string; appointment: Appointment }) => {
      const appointment = payload.appointment;
      if (!matchAppointmentForRole(appointment)) {
        return;
      }

      setAppointments((current) => {
        const exists = current.some((item) => item.id === appointment.id);
        if (payload.eventType === 'DELETE') {
          return current.filter((item) => item.id !== appointment.id);
        }
        if (exists) {
          return current.map((item) => (item.id === appointment.id ? appointment : item));
        }
        return [appointment, ...current];
      });
    },
    [matchAppointmentForRole]
  );

  useEffect(() => {
    loadAppointments();
  }, [loadAppointments]);

  useEffect(() => {
    if (!userId) return;

    const subscription = subscribeToAppointmentChanges(handleRealtimeUpdate, (err) => setError(err));
    subscriptionRef.current = subscription;

    return () => {
      subscriptionRef.current?.unsubscribe();
      subscriptionRef.current = null;
    };
  }, [handleRealtimeUpdate, userId]);

  const refresh = useCallback(async () => {
    await loadAppointments();
  }, [loadAppointments]);

  const getAppointment = useCallback(async (appointmentId: string) => {
    const result = await fetchAppointmentById(appointmentId);
    if (result.success && result.data) {
      return result.data;
    }
    return null;
  }, []);

  return useMemo(
    () => ({
      appointments,
      loading,
      error,
      refresh,
      getAppointment,
    }),
    [appointments, loading, error, refresh, getAppointment]
  );
};
