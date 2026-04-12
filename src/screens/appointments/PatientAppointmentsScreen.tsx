import React, { useState } from 'react';
import {
  ActivityIndicator,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
  Platform,
} from 'react-native';
import { useAppointments } from '../../hooks/useAppointments';
import { useAuth } from '../../contexts/AuthContext';
import AppointmentCard from '../../components/AppointmentCard';
import { AppointmentUrgency } from '../../types/appointment';
import { COLORS, SPACING, TYPOGRAPHY, SHADOWS } from '../../styles/theme';
import { createAppointmentRequest } from '../../services/appointmentsService';

const urgencyOptions: AppointmentUrgency[] = ['baixa', 'normal', 'alta', 'urgente'];

const PatientAppointmentsScreen: React.FC = () => {
  const { profile } = useAuth();
  const { appointments, loading, error, refresh } = useAppointments('paciente');
  const [symptoms, setSymptoms] = useState('');
  const [notes, setNotes] = useState('');
  const [urgency, setUrgency] = useState<AppointmentUrgency>('normal');
  const [submitting, setSubmitting] = useState(false);

  const handleRequest = async () => {
    if (!profile?.id) return;
    if (!symptoms.trim()) return;

    setSubmitting(true);
    await createAppointmentRequest({
      patientId: profile.id,
      symptoms: symptoms.trim(),
      urgency,
      notes: notes.trim(),
    });
    setSymptoms('');
    setNotes('');
    setUrgency('normal');
    await refresh();
    setSubmitting(false);
  };

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <View style={styles.section}>
        <Text style={styles.heading}>Solicitar nova consulta</Text>
        <TextInput
          style={styles.input}
          placeholder="Descreva seus sintomas"
          placeholderTextColor={COLORS.textSecondary}
          value={symptoms}
          onChangeText={setSymptoms}
          multiline
        />
        <TextInput
          style={styles.input}
          placeholder="Observações adicionais"
          placeholderTextColor={COLORS.textSecondary}
          value={notes}
          onChangeText={setNotes}
          multiline
        />
        <View style={styles.urgencyRow}>
          {urgencyOptions.map((option) => (
            <TouchableOpacity
              key={option}
              style={[
                styles.urgencyButton,
                urgency === option && styles.urgencyButtonActive,
              ]}
              onPress={() => setUrgency(option)}
            >
              <Text style={styles.urgencyText}>{option}</Text>
            </TouchableOpacity>
          ))}
        </View>
        <TouchableOpacity
          style={[styles.submitButton, submitting && styles.buttonDisabled]}
          onPress={handleRequest}
          disabled={submitting}
        >
          {submitting ? <ActivityIndicator color={COLORS.textInverse} /> : <Text style={styles.submitText}>Enviar solicitação</Text>}
        </TouchableOpacity>
      </View>

      <View style={styles.section}>
        <View style={styles.headerRow}>
          <Text style={styles.heading}>Minhas consultas</Text>
          <TouchableOpacity onPress={refresh}>
            <Text style={styles.refreshText}>Atualizar</Text>
          </TouchableOpacity>
        </View>

        {loading ? (
          <ActivityIndicator color={COLORS.primary} size="large" />
        ) : error ? (
          <Text style={styles.errorText}>{error}</Text>
        ) : appointments.length === 0 ? (
          <Text style={styles.emptyText}>Nenhuma solicitação de consulta encontrada.</Text>
        ) : (
          appointments.map((appointment) => (
            <AppointmentCard key={appointment.id} appointment={appointment} />
          ))
        )}
      </View>
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.background,
  },
  content: {
    padding: SPACING.md,
    paddingBottom: Platform.OS === 'web' ? 120 : 24,
  },
  section: {
    marginBottom: SPACING.lg,
  },
  heading: {
    fontSize: TYPOGRAPHY.sizes.lg,
    fontWeight: '700',
    color: COLORS.text,
    marginBottom: SPACING.sm,
  },
  input: {
    backgroundColor: COLORS.surface,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: COLORS.border,
    padding: SPACING.md,
    color: COLORS.text,
    marginBottom: SPACING.sm,
    minHeight: 52,
  },
  urgencyRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: SPACING.xs,
    marginBottom: SPACING.sm,
  },
  urgencyButton: {
    borderRadius: 999,
    paddingVertical: 8,
    paddingHorizontal: SPACING.md,
    backgroundColor: COLORS.surface,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  urgencyButtonActive: {
    backgroundColor: COLORS.primary,
  },
  urgencyText: {
    color: COLORS.text,
    fontWeight: '700',
  },
  submitButton: {
    backgroundColor: COLORS.primary,
    borderRadius: 14,
    paddingVertical: SPACING.md,
    alignItems: 'center',
  },
  submitText: {
    color: COLORS.textInverse,
    fontWeight: '700',
  },
  buttonDisabled: {
    opacity: 0.6,
  },
  headerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: SPACING.sm,
  },
  refreshText: {
    color: COLORS.primary,
    fontWeight: '700',
  },
  emptyText: {
    color: COLORS.textSecondary,
  },
  errorText: {
    color: COLORS.danger || '#dc3545',
  },
});

export default PatientAppointmentsScreen;
