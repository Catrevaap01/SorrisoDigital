import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  ActivityIndicator,
  Image,
  TouchableOpacity,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation, useRoute } from '@react-navigation/native';
import { useAuth } from '../../contexts/AuthContext';
import { buscarTriagemPorId } from '../../services/triagemService';
import { buscarAgendamentosPaciente } from '../../services/agendamentoService';
import { COLORS, SIZES, SHADOWS } from '../../styles/theme';
import { STATUS_TRIAGEM, STATUS_AGENDAMENTO } from '../../utils/constants';
import { formatDateTime } from '../../utils/helpers';

interface DetailItem {
  id: string;
  tipo: 'triagem' | 'agendamento';
  data?: string;
}

const TriagemDetalheScreen = () => {
  const navigation = useNavigation();
  const route = useRoute();
  const { profile } = useAuth();
  const { item } = route.params as { item: DetailItem };

  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    carregarDetalhe();
  }, []);

  const carregarDetalhe = async () => {
    setLoading(true);
    try {
      if (item.tipo === 'triagem') {
        const result = await buscarTriagemPorId(item.id);
        if (result.success) setData(result.data!);
      } else {
        // Agendamento detail (simplified, fetch full agendamento if service available)
        const result = await buscarAgendamentosPaciente(profile!.id!);
        if (result.success) {
          const ag = result.data!.find((a: any) => a.id === item.id);
          setData(ag);
        }
      }
    } catch (error) {
      console.error('Erro carregando detalhe:', error);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={COLORS.primary} />
      </View>
    );
  }

  if (!data) {
    return (
      <View style={styles.emptyContainer}>
        <Text>Detalhes não encontrados</Text>
      </View>
    );
  }

  const statusInfo = item.tipo === 'triagem' 
    ? STATUS_TRIAGEM[data.status || 'pendente'] 
    : STATUS_AGENDAMENTO[data.status || 'pendente'];

  return (
    <ScrollView style={styles.container}>
    
      <View style={styles.statusCard}>
        <View style={[styles.statusBadge, { backgroundColor: statusInfo.color + '20' }]}>
          <Ionicons name={statusInfo.icon as any} size={20} color={statusInfo.color} />
          <Text style={[styles.statusLabel, { color: statusInfo.color }]}>{statusInfo.label}</Text>
        </View>
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Informações</Text>
        {data.sintoma_principal && (
          <View style={styles.infoRow}>
            <Text style={styles.label}>Sintoma Principal</Text>
            <Text style={styles.value}>{data.sintoma_principal}</Text>
          </View>
        )}
        {data.descricao && (
          <View style={styles.infoRow}>
            <Text style={styles.label}>Descrição</Text>
            <Text style={styles.value}>{data.descricao}</Text>
          </View>
        )}
        {data.intensidade_dor && (
          <View style={styles.infoRow}>
            <Text style={styles.label}>Intensidade Dor</Text>
            <Text style={styles.value}>{data.intensidade_dor}/10</Text>
          </View>
        )}
        {data.data_agendamento && (
          <View style={styles.infoRow}>
            <Text style={styles.label}>Data</Text>
            <Text style={styles.value}>{formatDateTime(data.data_agendamento)}</Text>
          </View>
        )}
        {data.tipo && (
          <View style={styles.infoRow}>
            <Text style={styles.label}>Tipo</Text>
            <Text style={styles.value}>{data.tipo}</Text>
          </View>
        )}
        {data.respostas && data.respostas.length > 0 && (
          <View style={styles.respostaSection}>
            <Text style={styles.sectionTitle}>Resposta do Dentista</Text>
            <Text style={styles.respostaText}>{data.respostas[0].orientacao}</Text>
            {data.respostas[0].recomendacao && (
              <Text style={styles.recomendacao}>Recomendação: {data.respostas[0].recomendacao}</Text>
            )}
          </View>
        )}
        {data.imagens && data.imagens.length > 0 && (
          <View style={styles.imagensSection}>
            <Text style={styles.sectionTitle}>Imagens</Text>
            <ScrollView horizontal>
              {data.imagens.map((img: string, idx: number) => (
                <Image key={idx} source={{ uri: img }} style={styles.imagem} />
              ))}
            </ScrollView>
          </View>
        )}
      </View>
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.background },
  header: { flexDirection: 'row', padding: SIZES.lg, alignItems: 'center' },
  backButton: { padding: SIZES.sm },
  title: { fontSize: SIZES.fontXl, fontWeight: 'bold', flex: 1, textAlign: 'center' },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  statusCard: { padding: SIZES.lg },
  statusBadge: { flexDirection: 'row', alignItems: 'center', padding: SIZES.md, borderRadius: SIZES.radiusFull },
  statusLabel: { fontWeight: 'bold', marginLeft: SIZES.sm, fontSize: SIZES.fontMd },
  section: { backgroundColor: COLORS.surface, margin: SIZES.md, borderRadius: SIZES.radiusMd, padding: SIZES.lg, ...SHADOWS.sm },
  sectionTitle: { fontSize: SIZES.fontLg, fontWeight: 'bold', marginBottom: SIZES.md },
  infoRow: { marginBottom: SIZES.lg },
  label: { fontSize: SIZES.fontSm, color: COLORS.textSecondary, marginBottom: SIZES.xs },
  value: { fontSize: SIZES.fontMd, fontWeight: '500', color: COLORS.text },
  respostaSection: { marginTop: SIZES.lg },
  respostaText: { fontSize: SIZES.fontMd, lineHeight: 22, backgroundColor: COLORS.background, padding: SIZES.md, borderRadius: SIZES.radiusSm },
  recomendacao: { marginTop: SIZES.sm, fontStyle: 'italic', color: COLORS.primary },
  imagensSection: { marginTop: SIZES.lg },
  imagem: { width: 120, height: 120, borderRadius: SIZES.radiusSm, marginRight: SIZES.sm },
});

export default TriagemDetalheScreen;

