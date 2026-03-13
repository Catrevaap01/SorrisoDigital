import React from 'react';
import { View, Text, ScrollView, StyleSheet, Linking } from 'react-native';
import { COLORS, SIZES, TYPOGRAPHY } from '../../styles/theme';

export default function TermosUsoScreen() {
  const abrirSite = () => {
    Linking.openURL('https://teodontoangola.com/termos');
  };

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <Text style={styles.header}>Termos e Condições de Uso</Text>
      <Text style={styles.description}>
        Leia atentamente os termos que regem o uso do TeOdonto Angola.
      </Text>
      
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>📋 Resumo dos Termos</Text>
        <Text style={styles.text}>
          • Uso apenas para consultas odontológicas{'\n'}
          • Proibido uso comercial ou de terceiros{'\n'}
          • Dentistas credenciados apenas{'\n'}
          • Responsabilidade pelos dados informados
        </Text>
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>⚕️ Limitações Médicas</Text>
        <Text style={styles.text}>
          Este app não substitui consulta presencial.{'\n'}
          Triagens são apenas indicativas.{'\n'}
          Siga sempre recomendação do seu dentista.
        </Text>
      </View>

      <View style={styles.buttonContainer}>
        <Text style={styles.buttonText} onPress={abrirSite}>
          📄 Ler Termos Completos
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
  buttonContainer: {
    backgroundColor: COLORS.primary,
    padding: SIZES.lg,
    borderRadius: SIZES.radiusMd,
    alignItems: 'center',
  },
  buttonText: {
    color: COLORS.textInverse,
    fontSize: TYPOGRAPHY.sizes.md,
    fontWeight: '600',
  },
});

