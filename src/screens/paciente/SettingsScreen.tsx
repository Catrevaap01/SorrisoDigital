import React from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity } from 'react-native';
import { COLORS, SIZES, TYPOGRAPHY } from '../../styles/theme';
import { Ionicons } from '@expo/vector-icons';

const SettingsScreen: React.FC<any> = ({ navigation }) => {
  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <Text style={styles.header}>Configurações</Text>

      {/* Item Notificações - Único com o link corrigido */}
      <TouchableOpacity 
        style={styles.item} 
        onPress={() => navigation.navigate('NotificacoesDetalhe')} // Nome igual ao do Navigator
        activeOpacity={0.7}
      >
        <View style={styles.leftContent}>
          <Ionicons name="notifications-outline" size={24} color={COLORS.text} />
          <Text style={styles.label}>Notificações</Text>
        </View>
        <Ionicons name="chevron-forward" size={20} color={COLORS.textSecondary} />
      </TouchableOpacity>

      <View style={styles.separator} />

      {/* Outros itens mantendo a consistência */}
      <TouchableOpacity 
        style={styles.item} 
        onPress={() => navigation.navigate('Privacidade')} 
        activeOpacity={0.7}
      >
        <View style={styles.leftContent}>
          <Ionicons name="shield-checkmark-outline" size={24} color={COLORS.text} />
          <Text style={styles.label}>Privacidade</Text>
        </View>
        <Ionicons name="chevron-forward" size={20} color={COLORS.textSecondary} />
      </TouchableOpacity>

      <View style={styles.separator} />

      <TouchableOpacity 
        style={styles.item} 
        onPress={() => navigation.navigate('Ajuda')} 
        activeOpacity={0.7}
      >
        <View style={styles.leftContent}>
          <Ionicons name="help-circle-outline" size={24} color={COLORS.text} />
          <Text style={styles.label}>Ajuda</Text>
        </View>
        <Ionicons name="chevron-forward" size={20} color={COLORS.textSecondary} />
      </TouchableOpacity>

      <View style={styles.separator} />

      <TouchableOpacity 
        style={styles.item} 
        onPress={() => navigation.navigate('TermosUso')} 
        activeOpacity={0.7}
      >
        <View style={styles.leftContent}>
          <Ionicons name="document-text-outline" size={24} color={COLORS.text} />
          <Text style={styles.label}>Termos de Uso</Text>
        </View>
        <Ionicons name="chevron-forward" size={20} color={COLORS.textSecondary} />
      </TouchableOpacity>

      <View style={styles.separator} />
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#FFFFFF',
  },
  content: {
    paddingTop: 40,
  },
  header: {
    fontSize: 26,
    fontWeight: 'bold',
    marginBottom: 20,
    paddingHorizontal: 20,
    color: '#000',
  },
  item: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 18,
    paddingHorizontal: 20,
  },
  leftContent: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  label: {
    fontSize: 17,
    color: '#333',
    marginLeft: 15,
  },
  separator: {
    height: 1,
    backgroundColor: '#EAEAEA',
    marginLeft: 20,
  },
});

export default SettingsScreen;