import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  RefreshControl,
  ActivityIndicator,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '../../contexts/AuthContext';
import { buscarTodasNotificacoes, marcarNotificacaoComoLida, Notificacao } from '../../services/notificacoesService';
import { COLORS, SIZES, SHADOWS } from '../../styles/theme';
import { formatRelativeTime } from '../../utils/helpers';

const NotificacoesScreen: React.FC = () => {
  const { profile } = useAuth();
  const [notificacoes, setNotificacoes] = useState<Notificacao[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [refreshing, setRefreshing] = useState<boolean>(false);

  const carregarNotificacoes = async () => {
    if (!profile?.id) return;

    const result = await buscarTodasNotificacoes(profile.id);
    if (result.success && result.data) {
      setNotificacoes(result.data);
    }
    setLoading(false);
  };

  useEffect(() => {
    carregarNotificacoes();
  }, [profile?.id]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await carregarNotificacoes();
    setRefreshing(false);
  }, []);

  const handleMarcarComoLida = async (notificacao: Notificacao) => {
    if (!notificacao.lida) {
      await marcarNotificacaoComoLida(notificacao.id);
      setNotificacoes(
        notificacoes.map((n) =>
          n.id === notificacao.id ? { ...n, lida: true } : n
        )
      );
    }
  };

  const getIconAndColor = (tipo: string): { icon: string; color: string } => {
    switch (tipo) {
      case 'triagem_enviada':
        return { icon: 'medical', color: COLORS.secondary };
      case 'triagem_respondida':
        return { icon: 'checkmark-circle', color: COLORS.success };
      case 'urgencia':
        return { icon: 'alert-circle', color: COLORS.danger };
      case 'feedback_saude':
        return { icon: 'information-circle', color: COLORS.info };
      case 'conselho':
        return { icon: 'bulb', color: '#FFA726' };
      default:
        return { icon: 'notifications', color: COLORS.primary };
    }
  };

  const renderNotificacao = ({ item }: { item: Notificacao }) => {
    const { icon, color } = getIconAndColor(item.tipo);
    const recomendacoes = item.dados?.recomendacoes || [];

    return (
      <TouchableOpacity
        style={[
          styles.notificacaoCard,
          !item.lida && styles.notificacaoCardNaoLida,
          item.tipo === 'urgencia' && styles.notificacaoCardUrgencia,
        ]}
        onPress={() => handleMarcarComoLida(item)}
        activeOpacity={0.7}
      >
        <View style={styles.iconContainer}>
          <Ionicons name={icon as any} size={24} color={color} />
          {!item.lida && <View style={[styles.notificacaoBadge, { backgroundColor: color }]} />}
        </View>

        <View style={styles.conteudo}>
          <Text style={[styles.titulo, !item.lida && styles.tituloNaoLido]}>
            {item.titulo}
          </Text>
          <Text style={styles.mensagem}>{item.mensagem}</Text>

          {recomendacoes.length > 0 && (
            <View style={styles.recomendacoesContainer}>
              <Text style={styles.recomendacoesLabel}>Recomendações:</Text>
              {recomendacoes.map((rec, idx) => (
                <View key={idx} style={styles.recomendacaoItem}>
                  <Ionicons name="checkmark" size={14} color={COLORS.success} />
                  <Text style={styles.recomendacaoText}>{rec}</Text>
                </View>
              ))}
            </View>
          )}

          <Text style={styles.horario}>
            {item.created_at ? formatRelativeTime(item.created_at) : 'Recentemente'}
          </Text>
        </View>
      </TouchableOpacity>
    );
  };

  const renderVazio = () => (
    <View style={styles.vazio}>
      <Ionicons name="notifications-outline" size={64} color={COLORS.textSecondary} />
      <Text style={styles.vazioTexto}>Nenhuma notificação</Text>
      <Text style={styles.vazioSubtexto}>Você está sempre atualizado!</Text>
    </View>
  );

  if (loading) {
    return (
      <View style={styles.container}>
        <ActivityIndicator size="large" color={COLORS.primary} />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <FlatList
        data={notificacoes}
        renderItem={renderNotificacao}
        keyExtractor={(item) => item.id}
        ListEmptyComponent={renderVazio}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
        }
        contentContainerStyle={notificacoes.length === 0 && styles.listaVazia}
      />
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.background,
  },
  listaVazia: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  notificacaoCard: {
    flexDirection: 'row',
    padding: SIZES.md,
    marginHorizontal: SIZES.sm,
    marginVertical: SIZES.xs,
    backgroundColor: COLORS.surface,
    borderRadius: SIZES.radiusMd,
    ...SHADOWS.small,
  },
  notificacaoCardNaoLida: {
    backgroundColor: '#F5F5F5',
    borderLeftWidth: 4,
    borderLeftColor: COLORS.primary,
  },
  notificacaoCardUrgencia: {
    backgroundColor: COLORS.danger + '10',
    borderLeftColor: COLORS.danger,
  },
  iconContainer: {
    marginRight: SIZES.md,
    position: 'relative',
  },
  notificacaoBadge: {
    position: 'absolute',
    top: -2,
    right: -2,
    width: 12,
    height: 12,
    borderRadius: 6,
    borderWidth: 2,
    borderColor: COLORS.background,
  },
  conteudo: {
    flex: 1,
  },
  titulo: {
    fontSize: SIZES.fontMd,
    fontWeight: '600',
    color: COLORS.text,
    marginBottom: 4,
  },
  tituloNaoLido: {
    fontWeight: '700',
    color: COLORS.primary,
  },
  mensagem: {
    fontSize: SIZES.fontSm,
    color: COLORS.textSecondary,
    marginBottom: 8,
  },
  recomendacoesContainer: {
    backgroundColor: COLORS.background,
    borderRadius: SIZES.radiusSm,
    padding: SIZES.sm,
    marginBottom: 8,
  },
  recomendacoesLabel: {
    fontSize: SIZES.fontXs,
    fontWeight: '600',
    color: COLORS.text,
    marginBottom: 4,
  },
  recomendacaoItem: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 4,
  },
  recomendacaoText: {
    fontSize: SIZES.fontXs,
    color: COLORS.textSecondary,
    marginLeft: 6,
    flex: 1,
  },
  horario: {
    fontSize: SIZES.fontXs,
    color: COLORS.textSecondary,
  },
  vazio: {
    alignItems: 'center',
  },
  vazioTexto: {
    fontSize: SIZES.fontLg,
    fontWeight: '600',
    color: COLORS.text,
    marginTop: SIZES.md,
  },
  vazioSubtexto: {
    fontSize: SIZES.fontSm,
    color: COLORS.textSecondary,
    marginTop: SIZES.sm,
  },
});

export default NotificacoesScreen;
