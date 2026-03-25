import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  RefreshControl,
  ActivityIndicator,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '../../contexts/AuthContext';
import {
  buscarTriagensPaciente,
  buscarTriagensDentista,
  buscarTodasTriagens,
} from '../../services/triagemService';
import { buscarAgendamentosPaciente } from '../../services/agendamentoService';
import { COLORS, SIZES, SHADOWS } from '../../styles/theme';
import { FILTROS_HISTORICO, STATUS_TRIAGEM, STATUS_AGENDAMENTO } from '../../utils/constants';
import { formatRelativeTime } from '../../utils/helpers';

interface HistoricoItem {
  id: string;
  tipo: 'triagem' | 'agendamento';
  status?: string;
  created_at?: string;
  data_agendamento?: string;
  sintoma_principal?: string;
  descricao?: string;
  respostas?: any[];
  intensidade_dor?: string;
  prioridade?: string;
}

const HistoricoScreen = () => {
  const { profile } = useAuth();
  const [dados, setDados] = useState<HistoricoItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [categoriaAtiva, setCategoriaAtiva] = useState('todos');

  const carregarDados = async (filtro: string | null) => {
    setLoading(true);
    setRefreshing(true);
    try {
      if (!profile?.id) {
        setDados([]);
        return;
      }

      let triagens: any[] = [];
      let agendamentos: any[] = [];

      const tipo = profile.tipo;
      if (tipo === 'dentista' || tipo === 'medico') {
        const result = await buscarTriagensDentista(profile.id);
        if (result.success) triagens = result.data || [];
      } else if (tipo === 'admin') {
        const result = await buscarTodasTriagens({ status: null });
        if (result.success) triagens = result.data || [];
      } else {
        const result = await buscarTriagensPaciente(profile.id);
        if (result.success) triagens = result.data || [];
      }

      const resultAg = await buscarAgendamentosPaciente(profile.id);
      if (resultAg.success) agendamentos = resultAg.data || [];

      let dadosCombinados: HistoricoItem[] = [
        ...triagens.map((t: any) => ({ ...t, tipo: 'triagem' as const, descricao: t.sintoma_principal })),
        ...agendamentos.map((a: any) => ({ ...a, tipo: 'agendamento' as const })),
      ];

      if (filtro && filtro !== 'todos') {
        dadosCombinados = dadosCombinados.filter((item) => {
          if (item.tipo === 'triagem') {
            return item.status === filtro || (filtro === 'urgente' && (item.status === 'urgente' || Number(item.intensidade_dor || 0) >= 8));
          }
          return item.status === filtro;
        });
      }

      setDados(dadosCombinados.sort((a, b) => {
        const dataA = a.tipo === 'triagem' ? a.created_at : a.data_agendamento;
        const dataB = b.tipo === 'triagem' ? b.created_at : b.data_agendamento;
        return new Date(dataB || 0).getTime() - new Date(dataA || 0).getTime();
      }));
    } catch (error) {
      console.error('Erro carregando dados:', error);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    carregarDados(categoriaAtiva === 'todos' ? null : categoriaAtiva);
  }, [categoriaAtiva, profile]);

  const onRefresh = () => {
    carregarDados(categoriaAtiva === 'todos' ? null : categoriaAtiva);
  };

  const getStatusInfo = (item: HistoricoItem) => {
    if (item.tipo === 'triagem') {
      const effectiveStatus = item.respostas && item.respostas.length > 0 ? 'respondido' : item.status || 'pendente';
      return (STATUS_TRIAGEM as any)[effectiveStatus] || (STATUS_TRIAGEM as any).pendente;
    }
    return (STATUS_AGENDAMENTO as any)[item.status || 'pendente'] || (STATUS_AGENDAMENTO as any).pendente;
  };

  const getIconeTipo = (tipo: string) => {
    if (tipo === 'triagem') return 'help-circle-outline';
    if (tipo === 'agendamento') return 'calendar-outline';
    return 'document-text-outline';
  };

  const getCorTipo = (tipo: string) => {
    if (tipo === 'triagem') return '#FF9800';
    if (tipo === 'agendamento') return '#4CAF50';
    return COLORS.primary;
  };

  const renderHistoricoItem = (item: HistoricoItem) => {
    const statusInfo = getStatusInfo(item);
    const cor = getCorTipo(item.tipo);
    const data = formatRelativeTime(item.tipo === 'triagem' ? (item.created_at || '') : (item.data_agendamento || ''));

    
    return (
      <TouchableOpacity
        key={item.id}
        style={styles.card}
        activeOpacity={0.7}
      >
        <View style={[styles.cardIconContainer, { backgroundColor: cor + '20' }]}>
          <Ionicons name={getIconeTipo(item.tipo) as any} size={28} color={cor} />
        </View>
        
        <View style={styles.cardContent}>
          <Text style={styles.cardTitulo} numberOfLines={2}>
            {item.tipo === 'triagem' ? item.sintoma_principal : item.tipo || 'Consulta'}
          </Text>
          {item.descricao && (
            <Text style={styles.cardDescricao} numberOfLines={2}>{item.descricao}</Text>
          )}
          
          <View style={styles.cardFooter}>
            <View style={[styles.categoriaBadge, { backgroundColor: cor + '20' }]}>
              <Text style={[styles.categoriaText, { color: cor }]}>{statusInfo.label}</Text>
            </View>
            
            <View style={styles.viewsContainer}>
              <Ionicons name="time-outline" size={14} color={COLORS.textSecondary} />
              <Text style={styles.viewsText}>{data}</Text>
            </View>
          </View>
        </View>

        <Ionicons name="chevron-forward" size={20} color={COLORS.textLight} />
      </TouchableOpacity>
    );
  };

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={COLORS.primary} />
        <Text style={styles.loadingText}>Carregando histórico...</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <View style={styles.categoriasContainer}>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.scrollContent}>
          {FILTROS_HISTORICO.map((cat) => (
            <TouchableOpacity
              key={cat.id}
              style={[
                styles.categoriaButton,
                categoriaAtiva === cat.id && styles.categoriaButtonActive,
              ]}
              onPress={() => setCategoriaAtiva(cat.id)}
            >
              <Ionicons
                name={cat.icon as any}
                size={18}
                color={categoriaAtiva === cat.id ? COLORS.textInverse : COLORS.primary}
              />
              <Text
                style={[
                  styles.categoriaButtonText,
                  categoriaAtiva === cat.id && styles.categoriaButtonTextActive,
                ]}
              >
                {cat.label}
              </Text>
            </TouchableOpacity>
          ))}
        </ScrollView>
      </View>

      {dados.length === 0 ? (
        <View style={styles.emptyContainer}>
          <Ionicons name="document-text-outline" size={64} color={COLORS.textLight} />
          <Text style={styles.emptyText}>Nenhum registro encontrado</Text>
        </View>
      ) : (
        <ScrollView
          style={styles.listaContainer}
          showsVerticalScrollIndicator={false}
        >
          <View style={styles.destaqueContainer}>
            <Text style={styles.destaqueTitle}>📋 Seu Histórico</Text>
            <Text style={styles.destaqueSubtitle}>
              Agendamentos e triagens realizadas
            </Text>
          </View>

          {dados.map(renderHistoricoItem)}

          <View style={{ height: 20 }} />
        </ScrollView>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.background,
  },
  categoriasContainer: {
    backgroundColor: COLORS.surface,
    paddingVertical: SIZES.sm,
    paddingHorizontal: SIZES.sm,
    ...SHADOWS.sm,
  },
  scrollContent: {
    paddingHorizontal: SIZES.md,
  },
  categoriaButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: SIZES.md,
    paddingVertical: SIZES.sm,
    borderRadius: SIZES.radiusFull,
    backgroundColor: '#E3F2FD',
    marginRight: SIZES.sm,
  },
  categoriaButtonActive: {
    backgroundColor: COLORS.primary,
  },
  categoriaButtonText: {
    marginLeft: SIZES.xs,
    color: COLORS.primary,
    fontWeight: '500',
  },
  categoriaButtonTextActive: {
    color: COLORS.textInverse,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    marginTop: SIZES.md,
    color: COLORS.textSecondary,
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  emptyText: {
    marginTop: SIZES.md,
    color: COLORS.textSecondary,
    fontSize: SIZES.fontLg,
  },
  listaContainer: {
    flex: 1,
  },
  destaqueContainer: {
    backgroundColor: COLORS.primary,
    margin: SIZES.md,
    padding: SIZES.lg,
    borderRadius: SIZES.radiusMd,
  },
  destaqueTitle: {
    fontSize: SIZES.fontXl,
    fontWeight: 'bold',
    color: COLORS.textInverse,
  },
  destaqueSubtitle: {
    fontSize: SIZES.fontMd,
    color: COLORS.textInverse,
    opacity: 0.9,
    marginTop: SIZES.xs,
  },
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.surface,
    marginHorizontal: SIZES.md,
    marginBottom: SIZES.sm,
    padding: SIZES.md,
    borderRadius: SIZES.radiusMd,
    ...SHADOWS.sm,
  },
  cardIconContainer: {
    width: 56,
    height: 56,
    borderRadius: 28,
    justifyContent: 'center',
    alignItems: 'center',
  },
  cardContent: {
    flex: 1,
    marginLeft: SIZES.md,
    marginRight: SIZES.sm,
  },
  cardTitulo: {
    fontSize: SIZES.fontMd,
    fontWeight: 'bold',
    color: COLORS.text,
  },
  cardDescricao: {
    fontSize: SIZES.fontSm,
    color: COLORS.textSecondary,
    marginTop: 2,
    lineHeight: 18,
  },
  cardFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: SIZES.sm,
  },
  categoriaBadge: {
    paddingHorizontal: SIZES.sm,
    paddingVertical: 2,
    borderRadius: SIZES.radiusSm,
  },
  categoriaText: {
    fontSize: SIZES.fontXs,
    fontWeight: '600',
  },
  viewsContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  viewsText: {
    fontSize: SIZES.fontXs,
    color: COLORS.textSecondary,
    marginLeft: 4,
  },
});

export default HistoricoScreen;

