/**
 * Tela inicial do paciente
 */

import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  RefreshControl,
  Platform,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '../../contexts/AuthContext';
import { useDentist } from '../../contexts/DentistContext';
import { buscarTriagensPaciente } from '../../services/triagemService';
import { COLORS, SIZES, SHADOWS } from '../../styles/theme';
import { STATUS_TRIAGEM } from '../../utils/constants';
import { formatRelativeTime, getInitials } from '../../utils/helpers';
import { BottomTabScreenProps } from '@react-navigation/bottom-tabs';
import { PacienteTabParamList } from '../../navigation/types';

type HomeProps = BottomTabScreenProps<PacienteTabParamList, 'Início'>;

const HomeScreen: React.FC<HomeProps> = ({ navigation }) => {
  const { profile } = useAuth();
  const [triagensRecentes, setTriagensRecentes] = useState<any[]>([]);
  const [refreshing, setRefreshing] = useState<boolean>(false);
  const [loading, setLoading] = useState<boolean>(true);

  const { selectedDentist, consumeAutoOpenChooseDentist } = useDentist();

  const carregarDados = async () => {
    if (!profile?.id) return;

    const result = await buscarTriagensPaciente(profile.id);
    if (result.success) {
      setTriagensRecentes(result.data?.slice(0, 3) || []);
    }
    setLoading(false);
  };

  useEffect(() => {
    carregarDados();
  }, [profile]);

  // Redirecionar imediatamente para escolha de dentista se necessário
  useEffect(() => {
    if (!selectedDentist) {
      // Consume auto-open flag if set
      consumeAutoOpenChooseDentist();
      // Redirecionar imediatamente sem Alert
      const timer = setTimeout(() => {
        navigation.getParent()?.navigate('ChooseDentista' as any);
      }, 300); // Pequeno delay para garantir que a navegação está pronta
      return () => clearTimeout(timer);
    }
  }, [selectedDentist, navigation]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await carregarDados();
    setRefreshing(false);
  }, [profile]);

  const dicasDoDia = [
    'Escove os dentes por pelo menos 2 minutos',
    'Use fio dental diariamente antes de dormir',
    'Troque sua escova a cada 3 meses',
    'Evite alimentos muito ácidos ou açucarados',
    'Beba bastante água durante o dia',
  ];

  const dicaAleatoria = dicasDoDia[Math.floor(Math.random() * dicasDoDia.length)];

  return (
    <ScrollView
      style={styles.container}
      refreshControl={
        <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
      }
    >
      {/* Header com saudação */}
      <View style={styles.headerCard}>
        <View style={styles.headerContent}>
          <Text style={styles.greeting}>
            Olá, {profile?.nome?.split(' ')[0] || 'Usuário'}! 👋
          </Text>
          <Text style={styles.headerSubtitle}>
            Como está sua saúde bucal hoje?
          </Text>
        </View>
        <View style={styles.avatarContainer}>
          <Text style={styles.avatarText}>
            {getInitials(profile?.nome)}
          </Text>
        </View>
      </View>

      {/* Ações Rápidas */}
      <Text style={styles.sectionTitle}>Ações Rápidas</Text>
      <View style={styles.actionsRow}>
        <TouchableOpacity
          style={styles.actionCard}
          onPress={() => navigation.navigate('Triagem')}
        >
          <View style={[styles.actionIcon, { backgroundColor: '#E3F2FD' }]}
          >
            <Ionicons name="camera" size={28} color={COLORS.primary} />
          </View>
          <Text style={styles.actionTitle}>Nova Triagem</Text>
          <Text style={styles.actionSubtitle}>Enviar fotos</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.actionCard}
          onPress={() => navigation.navigate('Educação')}
        >
          <View style={[styles.actionIcon, { backgroundColor: '#E8F5E9' }]}
          >
            <Ionicons name="book" size={28} color={COLORS.secondary} />
          </View>
          <Text style={styles.actionTitle}>Educação</Text>
          <Text style={styles.actionSubtitle}>Dicas de saúde</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.actionCard}
          onPress={() => navigation.getParent()?.navigate('Agendamento' as any)}
        >
          <View style={[styles.actionIcon, { backgroundColor: '#FFF3E0' }]}
          >
            <Ionicons name="calendar" size={28} color={COLORS.accent} />
          </View>
          <Text style={styles.actionTitle}>Agendar</Text>
          <Text style={styles.actionSubtitle}>Consulta</Text>
        </TouchableOpacity>
      </View>

      {/* Dica do Dia */}
      <View style={styles.dicaCard}>
        <View style={styles.dicaHeader}>
          <Ionicons name="bulb" size={22} color="#F9A825" />
          <Text style={styles.dicaTitle}>Dica do Dia</Text>
        </View>
        <Text style={styles.dicaText}>{dicaAleatoria}</Text>
      </View>

      {/* Triagens Recentes */}
      <View style={styles.sectionHeader}>
        <Text style={styles.sectionTitle}>Triagens Recentes</Text>
        {triagensRecentes.length > 0 && (
          <TouchableOpacity onPress={() => navigation.navigate('Histórico')}>
            <Text style={styles.verTodos}>Ver todas</Text>
          </TouchableOpacity>
        )}
      </View>

      {loading ? (
        <View style={styles.loadingContainer}>
          <Text style={styles.loadingText}>Carregando...</Text>
        </View>
      ) : triagensRecentes.length === 0 ? (
        <View style={styles.emptyCard}>
          <Ionicons name="document-text-outline" size={48} color={COLORS.textLight} />
          <Text style={styles.emptyTitle}>Nenhuma triagem ainda</Text>
          <Text style={styles.emptySubtitle}>
            Faça sua primeira triagem para receber orientações
          </Text>
          <TouchableOpacity
            style={styles.emptyButton}
            onPress={() => navigation.navigate('Triagem')}
          >
            <Text style={styles.emptyButtonText}>Fazer Triagem</Text>
          </TouchableOpacity>
        </View>
      ) : (
        triagensRecentes.map((triagem) => {
          const temResposta = triagem.respostas && triagem.respostas.length > 0;
          const isRealizado = triagem.status === 'realizado' || triagem.agendamento_status === 'realizado' || (triagem.agendamentos && triagem.agendamentos.some((a: any) => a.status === 'realizado'));
          
          const effectiveStatus = isRealizado
            ? 'realizado'
            : temResposta
              ? 'respondido'
              : triagem.status === 'urgente' || triagem.prioridade === 'urgente' || Number(triagem.intensidade_dor || 0) >= 8
                ? 'urgente'
                : triagem.status || 'pendente';
                
          const statusInfo = STATUS_TRIAGEM[effectiveStatus] || STATUS_TRIAGEM.pendente;

          return (
            <TouchableOpacity
              key={triagem.id}
              style={styles.triagemCard}
              onPress={() => navigation.navigate('Histórico')}
            >
              <View style={styles.triagemHeader}>
                <View style={[styles.statusBadge, { backgroundColor: statusInfo.color }]}>
                  {temResposta && (
                    <Ionicons name="chatbubbles" size={12} color="#fff" style={{ marginRight: 4 }} />
                  )}
                  <Text style={styles.statusText}>{statusInfo.label}</Text>
                </View>
                <Text style={styles.triagemData}>
                  {formatRelativeTime(triagem.created_at)}
                </Text>
              </View>

              <Text style={styles.triagemSintoma}>{triagem.sintoma_principal}</Text>

              {temResposta && (
                <View style={styles.respostaPreview}>
                  <View style={styles.respostaHeader}>
                    <Ionicons name="person-circle-outline" size={16} color={COLORS.primary} />
                    <Text style={styles.dentistaNome}>
                      Dr(a). {triagem.respostas[0].dentista?.nome || 'Dentista'}
                    </Text>
                  </View>
                  
                  {triagem.respostas[0].recomendacao && (
                    <Text style={styles.recomendacaoText} numberOfLines={1}>
                      ⭐ {triagem.respostas[0].recomendacao}
                    </Text>
                  )}
                  
                  <Text style={styles.respostaText} numberOfLines={2}>
                    {triagem.respostas[0].orientacao}
                  </Text>
                </View>
              )}
            </TouchableOpacity>
          );
        })
      )}

      {/* Aviso Legal */}
      <View style={styles.avisoContainer}>
        <Ionicons name="information-circle" size={18} color={COLORS.accent} />
        <Text style={styles.avisoText}>
          Lembre-se: este aplicativo oferece orientações iniciais e não substitui 
          a consulta presencial com um profissional de odontologia.
        </Text>
      </View>

      <View style={{ height: 30 }} />
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.background,
  },
  headerCard: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    padding: SIZES.lg,
  },
  headerContent: {
    flex: 1,
  },
  greeting: {
    fontSize: SIZES.fontLg,
    fontWeight: '600',
    color: COLORS.text,
  },
  headerSubtitle: {
    fontSize: SIZES.fontMd,
    color: COLORS.textSecondary,
  },
  avatarContainer: {
    width: 50,
    height: 50,
    borderRadius: 25,
    backgroundColor: COLORS.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarText: {
    color: COLORS.textInverse,
    fontSize: SIZES.fontLg,
    fontWeight: 'bold',
  },
  sectionTitle: {
    fontSize: SIZES.fontMd,
    fontWeight: '600',
    color: COLORS.text,
    marginLeft: SIZES.lg,
    marginTop: SIZES.lg,
  },
  actionsRow: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    marginTop: SIZES.sm,
  },
  actionCard: {
    alignItems: 'center',
    width: '30%',
  },
  actionIcon: {
    width: 60,
    height: 60,
    borderRadius: 30,
    alignItems: 'center',
    justifyContent: 'center',
  },
  actionTitle: {
    marginTop: SIZES.xs,
    fontSize: SIZES.fontSm,
    color: COLORS.text,
    textAlign: 'center',
  },
  actionSubtitle: {
    fontSize: SIZES.fontXs,
    color: COLORS.textSecondary,
    textAlign: 'center',
  },
  dicaCard: {
    backgroundColor: COLORS.surface,
    margin: SIZES.lg,
    padding: SIZES.lg,
    borderRadius: SIZES.radiusMd,
    ...SHADOWS.md,
  },
  dicaHeader: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  dicaTitle: {
    fontSize: SIZES.fontMd,
    fontWeight: '600',
    marginLeft: SIZES.sm,
    color: COLORS.text,
  },
  dicaText: {
    marginTop: SIZES.sm,
    fontSize: SIZES.fontSm,
    color: COLORS.textSecondary,
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginHorizontal: SIZES.lg,
    marginTop: SIZES.lg,
  },
  verTodos: {
    color: COLORS.primary,
    marginRight: SIZES.lg,
  },
  loadingContainer: {
    alignItems: 'center',
    marginTop: SIZES.lg,
  },
  loadingText: {
    color: COLORS.textSecondary,
  },
  emptyCard: {
    alignItems: 'center',
    marginTop: SIZES.lg,
  },
  emptyTitle: {
    fontSize: SIZES.fontLg,
    fontWeight: '600',
    color: COLORS.textSecondary,
    marginTop: SIZES.md,
  },
  emptySubtitle: {
    fontSize: SIZES.fontSm,
    color: COLORS.textSecondary,
    marginTop: SIZES.xs,
    textAlign: 'center',
    paddingHorizontal: SIZES.lg,
  },
  emptyButton: {
    marginTop: SIZES.md,
    backgroundColor: COLORS.primary,
    paddingHorizontal: SIZES.lg,
    paddingVertical: SIZES.sm,
    borderRadius: SIZES.radiusMd,
  },
  emptyButtonText: {
    color: COLORS.textInverse,
    fontSize: SIZES.fontMd,
  },
  triagemCard: {
    backgroundColor: COLORS.surface,
    marginHorizontal: SIZES.lg,
    marginVertical: SIZES.sm,
    padding: SIZES.md,
    borderRadius: SIZES.radiusMd,
    ...SHADOWS.sm,
  },
  triagemHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  statusBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: SIZES.sm,
    paddingVertical: 2,
    borderRadius: SIZES.radiusSm,
  },
  statusText: {
    marginLeft: SIZES.xs,
    fontSize: SIZES.fontXs,
    color: '#fff',
  },
  triagemData: {
    fontSize: SIZES.fontXs,
    color: COLORS.textSecondary,
  },
  triagemSintoma: {
    fontSize: SIZES.fontMd,
    fontWeight: '600',
    marginTop: SIZES.xs,
    color: COLORS.text,
  },
  respostaPreview: {
    backgroundColor: '#F0F7FF',
    padding: SIZES.md,
    borderRadius: SIZES.radiusMd,
    marginTop: SIZES.md,
    borderLeftWidth: 3,
    borderLeftColor: COLORS.primary,
  },
  respostaHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 4,
  },
  dentistaNome: {
    fontSize: SIZES.fontSm,
    fontWeight: 'bold',
    color: COLORS.text,
    marginLeft: 4,
  },
  recomendacaoText: {
    fontSize: SIZES.fontXs,
    fontWeight: '600',
    color: COLORS.secondary,
    marginBottom: 4,
  },
  respostaText: {
    fontSize: SIZES.fontSm,
    color: COLORS.textSecondary,
    lineHeight: 18,
  },
  avisoContainer: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    backgroundColor: '#FFF8E1',
    borderRadius: SIZES.radiusMd,
    padding: SIZES.md,
    margin: SIZES.lg,
  },
  avisoText: {
    flex: 1,
    marginLeft: SIZES.sm,
    fontSize: SIZES.fontSm,
    color: COLORS.textSecondary,
    lineHeight: 18,
  },
});

export default HomeScreen;
