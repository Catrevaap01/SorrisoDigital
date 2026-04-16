import React, { useState, useEffect } from 'react';
import { View, Text, ScrollView, StyleSheet, TouchableOpacity, FlatList, RefreshControl } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { COLORS, SIZES, TYPOGRAPHY, SHADOWS } from '../../styles/theme';
import { useAuth } from '../../contexts/AuthContext';
import {
  buscarTodasNotificacoes,
  Notificacao as ServiceNotificacao,
} from '../../services/notificacoesService';
import { marcarNotificacaoComoLida } from '../../services/notificacoesService';

type Notificacao = ServiceNotificacao & {
  created_at: string;
};

const NotificacoesDetalheScreen = () => {
  const { user } = useAuth();
  const [notificacoes, setNotificacoes] = useState<Notificacao[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const carregarNotificacoes = async () => {
    if (!user?.id) return;
    setRefreshing(true);
    const result = await buscarTodasNotificacoes(user.id);
    if (result.success) {
      setNotificacoes((result.data || []).filter((item): item is Notificacao => !!item.created_at));
    }
    setRefreshing(false);
  };

  const marcarLida = async (id: string) => {
    await marcarNotificacaoComoLida(id);
    setNotificacoes(notificacoes.map(n => n.id === id ? { ...n, lida: true } : n));
  };

  useEffect(() => {
    carregarNotificacoes().finally(() => setLoading(false));
  }, []);

  const renderNotificacao = ({ item }: { item: Notificacao }) => (
    <TouchableOpacity 
      style={[styles.notificacao, !item.lida && styles.notificacaoNaoLida]}
      onPress={() => !item.lida && marcarLida(item.id)}
    >
      <View style={styles.notificacaoHeader}>
        <Ionicons 
          name={item.lida ? "notifications" : "notifications-off-outline"} 
          size={24} 
          color={item.lida ? COLORS.textSecondary : COLORS.primary} 
        />
        <Text style={styles.titulo}>{item.titulo}</Text>
        {!item.lida && <View style={styles.badge} />}
      </View>
      <Text style={styles.mensagem}>{item.mensagem}</Text>
      <Text style={styles.data}>{new Date(item.created_at).toLocaleDateString('pt-PT')}</Text>
    </TouchableOpacity>
  );

  if (loading) {
    return (
      <View style={styles.center}>
        <Ionicons name="notifications-outline" size={48} color={COLORS.primary} />
        <Text style={styles.loadingText}>Carregando notificações...</Text>
      </View>
    );
  }

  return (
    <ScrollView 
      style={styles.container} 
      contentContainerStyle={styles.content}
      refreshControl={
        <RefreshControl refreshing={refreshing} onRefresh={carregarNotificacoes} />
      }
    >
      <Text style={styles.header}>Minhas Notificações</Text>
      
      {notificacoes.length === 0 ? (
        <View style={styles.emptyState}>
          <Ionicons name="notifications-off-outline" size={64} color={COLORS.textSecondary} />
          <Text style={styles.emptyTitle}>Nenhuma notificação</Text>
          <Text style={styles.emptyText}>Você será notificado sobre triagens, respostas e alertas importantes</Text>
        </View>
      ) : (
        <FlatList
          data={notificacoes}
          renderItem={renderNotificacao}
          keyExtractor={(item) => item.id}
          showsVerticalScrollIndicator={false}
          scrollEnabled={false}
        />
      )}
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
  center: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: SIZES.lg,
  },
  loadingText: {
    fontSize: TYPOGRAPHY.sizes.md,
    color: COLORS.textSecondary,
    marginTop: SIZES.sm,
  },
  emptyState: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: SIZES.xl,
  },
  emptyTitle: {
    fontSize: TYPOGRAPHY.sizes.lg,
    fontWeight: '600',
    color: COLORS.text,
    marginTop: SIZES.md,
    marginBottom: SIZES.sm,
  },
  emptyText: {
    fontSize: TYPOGRAPHY.sizes.sm,
    color: COLORS.textSecondary,
    textAlign: 'center',
    lineHeight: 22,
  },
  notificacao: {
    backgroundColor: COLORS.surface,
    padding: SIZES.lg,
    borderRadius: SIZES.radiusMd,
    marginBottom: SIZES.sm,
    borderLeftWidth: 4,
    borderLeftColor: COLORS.primary + '20',
  },
  notificacaoNaoLida: {
    borderLeftColor: COLORS.primary,
    ...SHADOWS.sm,
  },
  notificacaoHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: SIZES.sm,
  },
  titulo: {
    flex: 1,
    fontSize: TYPOGRAPHY.sizes.md,
    fontWeight: '600',
    color: COLORS.text,
    marginLeft: SIZES.sm,
  },
  badge: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: COLORS.primary,
  },
  mensagem: {
    fontSize: TYPOGRAPHY.sizes.sm,
    color: COLORS.textSecondary,
    lineHeight: 20,
    marginBottom: SIZES.xs,
  },
  data: {
    fontSize: TYPOGRAPHY.sizes.xs,
    color: COLORS.textSecondary,
  },
});

export default NotificacoesDetalheScreen;
