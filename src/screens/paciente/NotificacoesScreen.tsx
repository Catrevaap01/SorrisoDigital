import React from 'react';
import { View, Text, ScrollView, StyleSheet, TouchableOpacity } from 'react-native';
import { COLORS, SIZES, TYPOGRAPHY } from '../../styles/theme';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';

export default function NotificacoesScreen() {
  const navigation = useNavigation();

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      {/* Botão de Voltar caso o header nativo não apareça */}
      <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
        <Ionicons name="arrow-back" size={24} color={COLORS.text} />
        <Text style={styles.backText}>Voltar</Text>
      </TouchableOpacity>

      <Text style={styles.header}>Notificações</Text>
      
      <Text style={styles.description}>
        Suas notificações aparecerão aqui quando houver atualizações sobre agendamentos, mensagens e alertas de saúde.
      </Text>

      <View style={styles.card}>
        <View style={styles.iconCircle}>
          <Ionicons name="notifications-outline" size={40} color={COLORS.primary} />
        </View>
        <Text style={styles.cardTitle}>Ativar Notificações</Text>
        <Text style={styles.cardText}>
          Certifique-se de permitir notificações push nas configurações do seu dispositivo para receber alertas importantes.
        </Text>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#FFFFFF',
  },
  content: {
    padding: SIZES.md,
  },
  backButton: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 20,
    marginTop: 10,
  },
  backText: {
    marginLeft: 8,
    fontSize: 16,
    color: COLORS.text,
  },
  header: {
    fontSize: 28,
    fontWeight: 'bold',
    marginBottom: SIZES.lg,
    color: '#000',
  },
  description: {
    fontSize: 16,
    color: COLORS.textSecondary,
    marginBottom: 30,
    lineHeight: 22,
  },
  card: {
    backgroundColor: '#F8F9FA',
    padding: 30,
    borderRadius: 16,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#EAEAEA',
  },
  iconCircle: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: COLORS.primary + '15',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 15,
  },
  cardTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: COLORS.text,
    marginBottom: 10,
  },
  cardText: {
    fontSize: 14,
    color: COLORS.textSecondary,
    textAlign: 'center',
    lineHeight: 20,
  },
});