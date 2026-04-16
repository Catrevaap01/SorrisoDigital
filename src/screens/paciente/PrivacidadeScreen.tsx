import React from 'react';
import { View, Text, ScrollView, StyleSheet } from 'react-native';
import { COLORS, SIZES, TYPOGRAPHY } from '../../styles/theme';

export default function PrivacidadeScreen() {
  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <Text style={styles.header}>Política de Privacidade</Text>
      <Text style={styles.description}>
        Seus dados são protegidos e utilizados apenas para fornecer o melhor atendimento odontológico.
      </Text>
      
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>📱 Dados Coletados</Text>
        <Text style={styles.text}>
          • Informações de perfil (nome, telefone, localização){'\n'}
          • Histórico de triagens e agendamentos{'\n'}
          • Mensagens de comunicação{'\n'}
          • Preferências de notificações
        </Text>
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>🔒 Como Protegemos</Text>
        <Text style={styles.text}>
          • Criptografia de dados em trânsito e repouso{'\n'}
          • Acesso restrito apenas ao seu dentista{'\n'}
          • Conformidade com LGPD{'\n'}
          • Backups seguros e anônimos
        </Text>
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>✅ Seus Direitos</Text>
        <Text style={styles.text}>
          Você pode solicitar exclusão, retificação ou exportação de seus dados a qualquer momento.
        </Text>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.background,
  },
  content: {
    padding: SIZES.md,
  },
  header: {
    fontSize: TYPOGRAPHY.sizes.xl,
    fontWeight: 'bold',
    marginBottom: SIZES.lg,
    color: COLORS.text,
  },
  description: {
    fontSize: TYPOGRAPHY.sizes.md,
    color: COLORS.textSecondary,
    marginBottom: SIZES.xl,
    lineHeight: 22,
  },
  section: {
    backgroundColor: COLORS.surface,
    padding: SIZES.lg,
    borderRadius: SIZES.radiusMd,
    marginBottom: SIZES.lg,
  },
  sectionTitle: {
    fontSize: TYPOGRAPHY.sizes.lg,
    fontWeight: '600',
    color: COLORS.text,
    marginBottom: SIZES.md,
  },
  text: {
    fontSize: TYPOGRAPHY.sizes.sm,
    color: COLORS.textSecondary,
    lineHeight: 22,
  },
});

