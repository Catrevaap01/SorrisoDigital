import React from 'react';
import { View, Text, ScrollView, StyleSheet, TouchableOpacity, Linking } from 'react-native';
import { COLORS, SIZES, TYPOGRAPHY } from '../../styles/theme';
import { Ionicons } from '@expo/vector-icons';

export default function AjudaScreen() {
  const ligarSuporte = () => Linking.openURL('tel:+244912345678');
  const enviarEmail = () => Linking.openURL('mailto:suporte@teodontoangola.com');

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <Text style={styles.header}>Central de Ajuda</Text>
      <Text style={styles.description}>
        Encontre respostas rápidas ou entre em contato conosco.
      </Text>

      <View style={styles.card}>
        <Ionicons name="book-outline" size={28} color={COLORS.primary} />
        <Text style={styles.cardTitle}>Perguntas Frequentes</Text>
        <Text style={styles.cardText}>Como fazer triagem? Agendar consulta? Tudo explicado.</Text>
      </View>

      <View style={styles.card}>
        <Ionicons name="videocam-outline" size={28} color={COLORS.secondary} />
        <Text style={styles.cardTitle}>Tutoriais em Vídeo</Text>
        <Text style={styles.cardText}>Assista passo a passo do uso do app.</Text>
      </View>

      <View style={styles.suporteSection}>
        <Text style={styles.sectionTitle}>📞 Suporte Direto</Text>
        
        <TouchableOpacity style={styles.supportButton} onPress={ligarSuporte}>
          <Ionicons name="call-outline" size={24} color={COLORS.success} />
          <Text style={styles.supportText}>Ligar: +244 912 345 678</Text>
        </TouchableOpacity>

        <TouchableOpacity style={styles.supportButton} onPress={enviarEmail}>
          <Ionicons name="mail-outline" size={24} color={COLORS.primary} />
          <Text style={styles.supportText}>Email: suporte@teodontoangola.com</Text>
        </TouchableOpacity>
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
  card: {
    flexDirection: 'row',
    backgroundColor: COLORS.surface,
    padding: SIZES.lg,
    borderRadius: SIZES.radiusMd,
    marginBottom: SIZES.lg,
    alignItems: 'center',
  },
  cardTitle: {
    fontSize: TYPOGRAPHY.sizes.lg,
    fontWeight: '600',
    color: COLORS.text,
    marginLeft: SIZES.md,
    flex: 1,
  },
  cardText: {
    fontSize: TYPOGRAPHY.sizes.sm,
    color: COLORS.textSecondary,
    marginLeft: SIZES.md,
    marginTop: SIZES.xs,
  },
  suporteSection: {
    backgroundColor: COLORS.surface,
    padding: SIZES.lg,
    borderRadius: SIZES.radiusMd,
  },
  sectionTitle: {
    fontSize: TYPOGRAPHY.sizes.lg,
    fontWeight: '600',
    color: COLORS.text,
    marginBottom: SIZES.md,
  },
  supportButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: SIZES.md,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
  },
  supportText: {
    fontSize: TYPOGRAPHY.sizes.md,
    color: COLORS.text,
    marginLeft: SIZES.md,
    flex: 1,
  },
});

