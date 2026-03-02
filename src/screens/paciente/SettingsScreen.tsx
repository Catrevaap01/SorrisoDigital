import React from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Switch, Linking } from 'react-native';
import { COLORS, SIZES, TYPOGRAPHY } from '../../styles/theme';
import { Ionicons } from '@expo/vector-icons';

const SettingsScreen: React.FC<any> = () => {
  const [notificationsEnabled, setNotificationsEnabled] = React.useState<boolean>(true);

  const openLink = (url: string) => {
    Linking.canOpenURL(url).then((supported) => {
      if (supported) {
        Linking.openURL(url);
      }
    });
  };

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <Text style={styles.header}>Configurações</Text>

      {/* Notificações */}
      <View style={styles.row}>
        <Text style={styles.label}>Notificações</Text>
        <Switch
          value={notificationsEnabled}
          onValueChange={setNotificationsEnabled}
          trackColor={{ true: COLORS.primary, false: COLORS.border }}
          thumbColor={notificationsEnabled ? COLORS.primary : COLORS.surface}
        />
      </View>
      <Text style={styles.description}>
        Ative ou desative alertas push e local para novos
        agendamentos, mensagens e avisos do aplicativo.
      </Text>

      {/* Privacidade */}
      <TouchableOpacity style={styles.linkRow} onPress={() => {/* placeholder */}}>
        <Text style={styles.label}>Privacidade</Text>
        <Ionicons name="chevron-forward" size={20} color={COLORS.textSecondary} />
      </TouchableOpacity>
      <Text style={styles.description}>
        Veja como seus dados são coletados e usados. Esta seção
        traz informações sobre política de privacidade.
      </Text>

      {/* Ajuda */}
      <TouchableOpacity style={styles.linkRow} onPress={() => {/* placeholder */}}>
        <Text style={styles.label}>Ajudar</Text>
        <Ionicons name="chevron-forward" size={20} color={COLORS.textSecondary} />
      </TouchableOpacity>
      <Text style={styles.description}>
        Dicas de uso, perguntas frequentes e suporte.
      </Text>

      {/* Termos de Uso */}
      <TouchableOpacity
        style={styles.linkRow}
        onPress={() => openLink('https://example.com/termos-de-uso')}
      >
        <Text style={styles.label}>Termos de Uso</Text>
        <Ionicons name="chevron-forward" size={20} color={COLORS.textSecondary} />
      </TouchableOpacity>
      <Text style={styles.description}>
        Leia os termos e condições que regem a utilização
        do serviço.
      </Text>
    </ScrollView>
  );
};

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
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: SIZES.sm,
  },
  linkRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: SIZES.sm,
  },
  label: {
    fontSize: TYPOGRAPHY.sizes.md,
    color: COLORS.text,
  },
  description: {
    fontSize: TYPOGRAPHY.sizes.sm,
    color: COLORS.textSecondary,
    marginBottom: SIZES.md,
  },
});

export default SettingsScreen;
