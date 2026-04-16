import React from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { Appointment } from '../types/appointment';
import { APPOINTMENT_STATUS, APPOINTMENT_URGENCY } from '../utils/constants';
import { COLORS, SPACING, TYPOGRAPHY, SHADOWS } from '../styles/theme';

interface AppointmentCardProps {
  appointment: Appointment;
  onPress?: () => void;
}

const AppointmentCard: React.FC<AppointmentCardProps> = ({ appointment, onPress }) => {
  const status = APPOINTMENT_STATUS[appointment.status] || {
    label: appointment.status,
    color: COLORS.textSecondary,
    icon: 'help-circle-outline',
  };

  const urgency = APPOINTMENT_URGENCY[appointment.urgency] || {
    label: appointment.urgency,
    color: COLORS.warning || '#F59E0B',
  };

  return (
    <TouchableOpacity style={styles.card} onPress={onPress} activeOpacity={onPress ? 0.8 : 1}>
      <View style={styles.header}>
        <Text style={styles.title}>{appointment.symptoms}</Text>
        <Text style={[styles.badge, { backgroundColor: urgency.color }]}>{urgency.label}</Text>
      </View>

      <Text style={styles.meta} numberOfLines={2}>
        {appointment.notes || 'Sem observações adicionais'}
      </Text>

      <View style={styles.row}>
        <View>
          <Text style={styles.label}>Data</Text>
          <Text style={styles.value}>{appointment.appointmentDate || 'Não definido'}</Text>
        </View>
        <View>
          <Text style={styles.label}>Hora</Text>
          <Text style={styles.value}>{appointment.appointmentTime || '---'}</Text>
        </View>
      </View>

      <View style={styles.footer}>
        <Text style={[styles.status, { color: status.color }]}>{status.label}</Text>
        <Text style={styles.smallText}>
          Dentista: {appointment.dentist?.nome || 'Aguardando'}
        </Text>
      </View>
    </TouchableOpacity>
  );
};

const styles = StyleSheet.create({
  card: {
    backgroundColor: COLORS.surface,
    borderRadius: 16,
    padding: SPACING.md,
    marginBottom: SPACING.sm,
    ...SHADOWS.sm,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: SPACING.xs,
  },
  title: {
    fontSize: TYPOGRAPHY.sizes.md,
    fontWeight: '700',
    color: COLORS.text,
    flex: 1,
    marginRight: SPACING.sm,
  },
  badge: {
    borderRadius: 999,
    paddingHorizontal: SPACING.sm,
    paddingVertical: 4,
    color: COLORS.textInverse,
    fontWeight: '700',
    overflow: 'hidden',
  },
  meta: {
    color: COLORS.textSecondary,
    marginBottom: SPACING.sm,
  },
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: SPACING.sm,
  },
  label: {
    color: COLORS.textSecondary,
    fontSize: TYPOGRAPHY.sizes.xs,
  },
  value: {
    color: COLORS.text,
    fontSize: TYPOGRAPHY.sizes.sm,
    fontWeight: '600',
  },
  footer: {
    borderTopWidth: 1,
    borderTopColor: COLORS.border,
    paddingTop: SPACING.sm,
  },
  status: {
    fontWeight: '700',
  },
  smallText: {
    color: COLORS.textSecondary,
    fontSize: TYPOGRAPHY.sizes.xs,
    marginTop: SPACING.xs,
  },
});

export default AppointmentCard;
