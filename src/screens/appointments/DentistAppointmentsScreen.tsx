import React from 'react';
import { ActivityIndicator, ScrollView, StyleSheet, Text, TouchableOpacity, View, Platform } from 'react-native';
import { useAppointments } from '../../hooks/useAppointments';
import AppointmentCard from '../../components/AppointmentCard';
import { COLORS, SPACING, TYPOGRAPHY, SHADOWS } from '../../styles/theme';

const DentistAppointmentsScreen: React.FC = () => {
  const { appointments, loading, error, refresh } = useAppointments('dentista');

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <View style={styles.header}>
        <Text style={styles.title}>Consultas atribuídas</Text>
        <TouchableOpacity onPress={refresh}>
          <Text style={styles.refreshText}>Atualizar</Text>
        </TouchableOpacity>
      </View>

      {loading ? (
        <ActivityIndicator color={COLORS.primary} size="large" />
      ) : error ? (
        <Text style={styles.errorText}>{error}</Text>
      ) : appointments.length === 0 ? (
        <Text style={styles.emptyText}>Nenhuma consulta atribuída.</Text>
      ) : (
        appointments.map((appointment) => (
          <AppointmentCard key={appointment.id} appointment={appointment} />
        ))
      )}

      <View style={styles.footer}>
        <Text style={styles.caption}>
          Use este painel para revisar solicitações, confirmar, rejeitar ou solicitar reagendamento.
        </Text>
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
  header: {
    marginBottom: SPACING.md,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  title: {
    fontSize: TYPOGRAPHY.sizes.lg,
    fontWeight: '700',
    color: COLORS.text,
  },
  refreshText: {
    color: COLORS.primary,
    fontWeight: '700',
  },
  errorText: {
    color: COLORS.danger || '#dc3545',
  },
  emptyText: {
    color: COLORS.textSecondary,
  },
  footer: {
    marginTop: SPACING.md,
    padding: SPACING.md,
    borderRadius: 16,
    backgroundColor: COLORS.surface,
    ...SHADOWS.sm,
  },
  caption: {
    color: COLORS.textSecondary,
    lineHeight: 20,
  },
});

export default DentistAppointmentsScreen;
