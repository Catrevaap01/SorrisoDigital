/**
 * Componente para exibição de filas de triagens e agendamentos
 * Usado no painel da Secretária
 */

import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  ListRenderItem,
  ActivityIndicator,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { COLORS, SPACING, TYPOGRAPHY } from '../styles/theme';
import { formatRelativeTime } from '../utils/helpers';

export interface FilaTriagem {
  id: string;
  paciente_id: string;
  sintoma_principal: string;
  descricao?: string;
  intensidade_dor?: number;
  prioridade?: string;
  created_at: string;
  paciente?: {
    nome?: string;
    email?: string;
    telefone?: string;
    foto_url?: string;
  };
}

export interface FilaAgendamento {
  id: string;
  paciente_id: string;
  symptoms: string;
  urgency: 'baixa' | 'normal' | 'alta' | 'urgente';
  created_at: string;
  paciente?: {
    nome?: string;
    email?: string;
    telefone?: string;
    foto_url?: string;
  };
}

interface FilaTriagenComponentProps {
  titulo: string;
  icone: string;
  item: FilaTriagem | FilaAgendamento;
  tipo: 'triagem' | 'agendamento';
  onAtribuir: (item: any) => void;
  onRejeitar: (item: any) => void;
  isLoading?: boolean;
}

const getPriorityColor = (priority: string | number): string => {
  const p = String(priority).toLowerCase();
  if (p === 'urgente' || p === 'alta' || Number(p) >= 8) return '#EF4444';
  if (p === 'normal' || (Number(p) >= 4 && Number(p) < 8)) return '#F59E0B';
  return '#10B981';
};

const getPriorityLabel = (priority: string | number): string => {
  const p = String(priority).toLowerCase();
  if (p === 'urgente' || p === 'alta' || Number(p) >= 8) return '🔴 Urgente';
  if (p === 'normal' || (Number(p) >= 4 && Number(p) < 8)) return '🟡 Normal';
  return '🟢 Baixa';
};

export const FilaTriagemCard: React.FC<FilaTriagenComponentProps> = ({
  titulo,
  icone,
  item,
  tipo,
  onAtribuir,
  onRejeitar,
  isLoading,
}) => {
  const isTriagem = tipo === 'triagem';
  const triagem = item as FilaTriagem;
  const agendamento = item as FilaAgendamento;

  const priorityColor = isTriagem
    ? getPriorityColor(triagem.intensidade_dor || '0')
    : getPriorityColor(agendamento.urgency);

  const priorityLabel = isTriagem
    ? `Dor: ${triagem.intensidade_dor || '?'}/10`
    : getPriorityLabel(agendamento.urgency);

  return (
    <View style={[styles.card, { borderLeftColor: priorityColor }]}>
      <View style={styles.cardHeader}>
        <View style={{ flex: 1 }}>
          <Text style={styles.cardPaciente} ellipsizeMode="tail" numberOfLines={1}>
            {isTriagem ? triagem.paciente?.nome : agendamento.paciente?.nome} 👤
          </Text>
          <Text style={styles.cardSintoma} ellipsizeMode="tail" numberOfLines={2}>
            {isTriagem ? triagem.sintoma_principal : agendamento.symptoms}
          </Text>
        </View>
        <View style={[styles.priorityBadge, { backgroundColor: priorityColor }]}>
          <Text style={styles.priorityBadgeText}>{priorityLabel}</Text>
        </View>
      </View>

      <View style={styles.cardMeta}>
        <Ionicons name="time-outline" size={12} color={COLORS.textSecondary} />
        <Text style={styles.metaText}>{formatRelativeTime(item.created_at)}</Text>
      </View>

      {isTriagem && triagem.descricao && (
        <View style={styles.descricao}>
          <Text style={styles.descricaoText} numberOfLines={2}>
            "{triagem.descricao}"
          </Text>
        </View>
      )}

      <View style={styles.actions}>
        <TouchableOpacity
          style={[styles.actionButton, styles.rejectButton]}
          onPress={() => onRejeitar(item)}
          disabled={isLoading}
        >
          {isLoading ? (
            <ActivityIndicator size="small" color={COLORS.error} />
          ) : (
            <>
              <Ionicons name="close-outline" size={14} color={COLORS.error} />
              <Text style={[styles.actionButtonText, { color: COLORS.error }]}>Rejeitar</Text>
            </>
          )}
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.actionButton, styles.acceptButton]}
          onPress={() => onAtribuir(item)}
          disabled={isLoading}
        >
          {isLoading ? (
            <ActivityIndicator size="small" color="white" />
          ) : (
            <>
              <Ionicons name="checkmark-done-outline" size={14} color="white" />
              <Text style={styles.actionButtonText}>Atribuir</Text>
            </>
          )}
        </TouchableOpacity>
      </View>
    </View>
  );
};

interface FilasListProps {
  titulo: string;
  tipo: 'triagem' | 'agendamento';
  dados: (FilaTriagem | FilaAgendamento)[];
  loading?: boolean;
  onAtribuir: (item: any) => void;
  onRejeitar: (item: any) => void;
  emptyMessage?: string;
}

export const FilasList: React.FC<FilasListProps> = ({
  titulo,
  tipo,
  dados,
  loading = false,
  onAtribuir,
  onRejeitar,
  emptyMessage,
}) => {
  const icone = tipo === 'triagem' ? 'clipboard-outline' : 'calendar-outline';

  const renderItem: ListRenderItem<FilaTriagem | FilaAgendamento> = ({ item }) => (
    <FilaTriagemCard
      titulo={titulo}
      icone={icone}
      item={item}
      tipo={tipo}
      onAtribuir={onAtribuir}
      onRejeitar={onRejeitar}
      isLoading={loading}
    />
  );

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Ionicons name={icone as any} size={20} color={COLORS.primary} />
        <View style={{ flex: 1, marginLeft: SPACING.md }}>
          <Text style={styles.titulo}>{titulo}</Text>
          <Text style={styles.subtitulo}>{dados.length} item(ns) na fila</Text>
        </View>
      </View>

      {loading && dados.length === 0 ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={COLORS.primary} />
          <Text style={styles.loadingText}>Carregando fila...</Text>
        </View>
      ) : dados.length === 0 ? (
        <View style={styles.emptyContainer}>
          <Ionicons name="checkmark-circle-outline" size={48} color={COLORS.success} />
          <Text style={styles.emptyText}>
            {emptyMessage || 'Nenhum item na fila no momento'}
          </Text>
          <Text style={styles.emptySubtext}>Volte em breve para verificar!</Text>
        </View>
      ) : (
        <FlatList
          data={dados}
          renderItem={renderItem}
          keyExtractor={(item) => item.id}
          scrollEnabled={false}
          ItemSeparatorComponent={() => <View style={styles.separator} />}
          contentContainerStyle={styles.listContent}
        />
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    marginVertical: SPACING.md,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.md,
    backgroundColor: COLORS.surface,
    borderRadius: 12,
    marginBottom: SPACING.md,
  },
  titulo: {
    fontSize: TYPOGRAPHY.sizes.h4,
    color: COLORS.text,
    fontWeight: TYPOGRAPHY.weights.semiBold,
  },
  subtitulo: {
    fontSize: TYPOGRAPHY.sizes.small,
    color: COLORS.textSecondary,
    marginTop: 2,
  },
  card: {
    backgroundColor: COLORS.surface,
    borderRadius: 12,
    padding: SPACING.md,
    borderLeftWidth: 4,
    borderLeftColor: COLORS.primary,
    marginBottom: SPACING.md,
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: SPACING.sm,
  },
  cardPaciente: {
    fontSize: TYPOGRAPHY.sizes.h4,
    color: COLORS.text,
    fontWeight: TYPOGRAPHY.weights.semiBold,
  },
  cardSintoma: {
    fontSize: TYPOGRAPHY.sizes.bodySmall,
    color: COLORS.textSecondary,
    marginTop: 4,
  },
  priorityBadge: {
    paddingHorizontal: SPACING.sm,
    paddingVertical: 4,
    borderRadius: 8,
    marginLeft: SPACING.sm,
  },
  priorityBadgeText: {
    color: 'white',
    fontWeight: TYPOGRAPHY.weights.semiBold,
    fontSize: 11,
  },
  cardMeta: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginBottom: SPACING.sm,
  },
  metaText: {
    fontSize: TYPOGRAPHY.sizes.small,
    color: COLORS.textSecondary,
  },
  descricao: {
    backgroundColor: COLORS.background,
    padding: SPACING.sm,
    borderRadius: 8,
    marginBottom: SPACING.sm,
    borderLeftWidth: 3,
    borderLeftColor: COLORS.primary,
  },
  descricaoText: {
    fontSize: TYPOGRAPHY.sizes.small,
    color: COLORS.textSecondary,
    fontStyle: 'italic',
  },
  actions: {
    flexDirection: 'row',
    gap: SPACING.sm,
    marginTop: SPACING.sm,
  },
  actionButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: SPACING.sm,
    borderRadius: 8,
    gap: 4,
  },
  acceptButton: {
    backgroundColor: COLORS.success,
  },
  rejectButton: {
    backgroundColor: COLORS.errorLight,
    borderWidth: 1,
    borderColor: COLORS.error,
  },
  actionButtonText: {
    fontSize: TYPOGRAPHY.sizes.small,
    color: 'white',
    fontWeight: TYPOGRAPHY.weights.semiBold,
  },
  loadingContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 40,
  },
  loadingText: {
    fontSize: TYPOGRAPHY.sizes.body,
    color: COLORS.textSecondary,
    marginTop: SPACING.md,
  },
  emptyContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 40,
  },
  emptyText: {
    fontSize: TYPOGRAPHY.sizes.h4,
    color: COLORS.text,
    marginTop: SPACING.md,
    textAlign: 'center',
    fontWeight: TYPOGRAPHY.weights.semiBold,
  },
  emptySubtext: {
    fontSize: TYPOGRAPHY.sizes.small,
    color: COLORS.textSecondary,
    marginTop: 4,
  },
  separator: {
    height: 1,
    backgroundColor: COLORS.border,
  },
  listContent: {
    paddingHorizontal: 0,
  },
});

export default FilasList;
