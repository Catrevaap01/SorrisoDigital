import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  TextInput,
  Image,
  Alert,
  ActivityIndicator,
  Modal,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import Toast from 'react-native-toast-message';
import { useAuth } from '../../contexts/AuthContext';
import { buscarTriagemPorId, responderTriagem, atualizarStatusTriagem } from '../../services/triagemService';
import { COLORS, SIZES, SHADOWS } from '../../styles/theme';
import { STATUS_TRIAGEM, RECOMENDACAO } from '../../utils/constants';
import { formatDateTime } from '../../utils/helpers';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { DentistaStackParamList } from '../../navigation/types';

type CasoDetalheProps = NativeStackScreenProps<DentistaStackParamList, 'CasoDetalhe'>;

const CasoDetalheScreen: React.FC<CasoDetalheProps> = ({ route, navigation }) => {
  const { triagemId } = route.params;
  const { profile } = useAuth();
  
  const [triagem, setTriagem] = useState<any | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [enviando, setEnviando] = useState<boolean>(false);
  const [imagemModal, setImagemModal] = useState<string | null>(null);
  
  // Campos da resposta
  const [orientacao, setOrientacao] = useState<string>('');
  const [recomendacao, setRecomendacao] = useState<string>('');
  const [observacoes, setObservacoes] = useState<string>('');

  const carregarTriagem = async () => {
    const result = await buscarTriagemPorId(triagemId);
    if (result.success) {
      setTriagem(result.data);
      
      // Se já tem resposta, preencher campos
      if (result.data.respostas && result.data.respostas.length > 0) {
        const resposta = result.data.respostas[0];
        setOrientacao(resposta.orientacao || '');
        setRecomendacao(resposta.recomendacao || '');
        setObservacoes(resposta.observacoes || '');
      }
    }
    setLoading(false);
  };

  useEffect(() => {
    carregarTriagem();
  }, [triagemId]);

  const handleEnviarResposta = async () => {
    if (!orientacao.trim()) {
      Toast.show({ type: 'error', text1: 'Digite sua orientação' });
      return;
    }
    if (!recomendacao) {
      Toast.show({ type: 'error', text1: 'Selecione uma recomendação' });
      return;
    }

    Alert.alert(
      'Confirmar Resposta',
      'Deseja enviar esta orientação ao paciente?',
      [
        { text: 'Cancelar', style: 'cancel' },
        { text: 'Enviar', onPress: processarResposta },
      ]
    );
  };

  const processarResposta = async () => {
    setEnviando(true);

    const result = await responderTriagem(triagemId, profile.id, {
      orientacao: orientacao.trim(),
      recomendacao,
      observacoes: observacoes.trim(),
    });

    setEnviando(false);

    if (result.success) {
      Toast.show({
        type: 'success',
        text1: 'Resposta enviada!',
        text2: 'O paciente será notificado',
      });
      navigation.goBack();
    } else {
      Toast.show({
        type: 'error',
        text1: 'Erro ao enviar',
        text2: 'Tente novamente',
      });
    }
  };

  const handleMarcarUrgente = () => {
    Alert.alert(
      'Marcar como Urgente',
      'Isso indicará que o paciente precisa de atendimento presencial urgente.',
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Confirmar',
          style: 'destructive',
          onPress: async () => {
            const result = await atualizarStatusTriagem(triagemId, 'urgente', 'urgente');
            if (result.success) {
              Toast.show({ type: 'success', text1: 'Marcado como urgente' });
              await carregarTriagem();
            }
          },
        },
      ]
    );
  };

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={COLORS.secondary} />
        <Text style={styles.loadingText}>Carregando caso...</Text>
      </View>
    );
  }

  if (!triagem) {
    return (
      <View style={styles.loadingContainer}>
        <Text>Caso não encontrado</Text>
      </View>
    );
  }

  const statusInfo = STATUS_TRIAGEM[triagem.status] || STATUS_TRIAGEM.pendente;
  const jaRespondido = triagem.respostas && triagem.respostas.length > 0;

  return (
    <ScrollView style={styles.container}>
      {/* Header do Paciente */}
      <View style={styles.pacienteCard}>
        <View style={styles.pacienteHeader}>
          <View style={styles.pacienteAvatar}>
            <Ionicons name="person" size={28} color={COLORS.primary} />
          </View>
          <View style={styles.pacienteInfo}>
            <Text style={styles.pacienteNome}>{triagem.paciente?.nome || 'Paciente'}</Text>
            <Text style={styles.pacienteDetalhe}>{triagem.paciente?.email}</Text>
            {triagem.paciente?.telefone && (
              <Text style={styles.pacienteDetalhe}>
                <Ionicons name="call-outline" size={12} /> {triagem.paciente.telefone}
              </Text>
            )}
            {triagem.paciente?.provincia && (
              <Text style={styles.pacienteDetalhe}>
                <Ionicons name="location-outline" size={12} /> {triagem.paciente.provincia}
              </Text>
            )}
          </View>
        </View>
      </View>

      {/* Status e Data */}
      <View style={styles.statusCard}>
        <View style={[styles.statusBadgeLarge, { backgroundColor: statusInfo.color }]}>
          <Ionicons name={statusInfo.icon as any} size={18} color="#fff" />
          <Text style={styles.statusTextLarge}>{statusInfo.label}</Text>
        </View>
        <Text style={styles.dataText}>
          Enviado em {formatDateTime(triagem.created_at)}
        </Text>
      </View>

      {/* Informações da Triagem */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Informações do Caso</Text>

        <View style={styles.infoRow}>
          <Text style={styles.infoLabel}>Sintoma Principal</Text>
          <Text style={styles.infoValor}>{triagem.sintoma_principal}</Text>
        </View>

        <View style={styles.infoRowDupla}>
          <View style={styles.infoColuna}>
            <Text style={styles.infoLabel}>Intensidade da Dor</Text>
            <Text style={[
              styles.infoValor,
              triagem.intensidade_dor >= 7 && styles.valorUrgente
            ]}>
              {triagem.intensidade_dor}/10
            </Text>
          </View>
          <View style={styles.infoColuna}>
            <Text style={styles.infoLabel}>Duração</Text>
            <Text style={styles.infoValor}>{triagem.duracao || 'Não informado'}</Text>
          </View>
        </View>

        {triagem.localizacao && (
          <View style={styles.infoRow}>
            <Text style={styles.infoLabel}>Localização</Text>
            <Text style={styles.infoValor}>{triagem.localizacao}</Text>
          </View>
        )}

        {triagem.descricao && (
          <View style={styles.infoRow}>
            <Text style={styles.infoLabel}>Descrição do Paciente</Text>
            <Text style={styles.descricaoText}>{triagem.descricao}</Text>
          </View>
        )}
      </View>

      {/* Imagens */}
      {triagem.imagens && triagem.imagens.length > 0 && (
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Fotos Enviadas ({triagem.imagens.length})</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false}>
            {triagem.imagens.map((uri, index) => (
              <TouchableOpacity
                key={index}
                onPress={() => setImagemModal(uri)}
              >
                <Image source={{ uri }} style={styles.imagemPreview} />
              </TouchableOpacity>
            ))}
          </ScrollView>
          <Text style={styles.imagemDica}>Toque para ampliar</Text>
        </View>
      )}

      {/* Formulário de Resposta */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>
          {jaRespondido ? 'Sua Resposta' : 'Responder ao Paciente'}
        </Text>

        {/* Orientação */}
        <Text style={styles.campoLabel}>Orientação *</Text>
        <TextInput
          style={styles.textArea}
          placeholder="Digite suas orientações e recomendações para o paciente..."
          placeholderTextColor={COLORS.textLight}
          value={orientacao}
          onChangeText={setOrientacao}
          multiline
          numberOfLines={5}
          textAlignVertical="top"
          editable={!jaRespondido}
        />

        {/* Recomendação */}
        <Text style={styles.campoLabel}>Recomendação *</Text>
        <View style={styles.recomendacoesGrid}>
          {Object.entries(RECOMENDACAO).map(([key, info]) => (
            <TouchableOpacity
              key={key}
              style={[
                styles.recomendacaoCard,
                recomendacao === key && styles.recomendacaoCardActive,
                recomendacao === key && { borderColor: info.color },
              ]}
              onPress={() => !jaRespondido && setRecomendacao(key)}
              disabled={jaRespondido}
            >
              <Ionicons
                name={info.icon as any}
                size={24}
                color={recomendacao === key ? info.color : COLORS.textSecondary}
              />
              <Text
                style={[
                  styles.recomendacaoLabel,
                  recomendacao === key && { color: info.color },
                ]}
              >
                {info.label}
              </Text>
            </TouchableOpacity>
          ))}
        </View>

        {/* Observações */}
        <Text style={styles.campoLabel}>Observações internas (opcional)</Text>
        <TextInput
          style={styles.textAreaSmall}
          placeholder="Notas para você ou outros profissionais..."
          placeholderTextColor={COLORS.textLight}
          value={observacoes}
          onChangeText={setObservacoes}
          multiline
          numberOfLines={2}
          textAlignVertical="top"
          editable={!jaRespondido}
        />
      </View>

      {/* Botões de Ação */}
      {!jaRespondido && (
        <View style={styles.acoesContainer}>
          <TouchableOpacity
            style={styles.urgenteButton}
            onPress={handleMarcarUrgente}
          >
            <Ionicons name="alert-circle" size={20} color={COLORS.textInverse} />
            <Text style={styles.urgenteButtonText}>Urgente</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.enviarButton, enviando && styles.buttonDisabled]}
            onPress={handleEnviarResposta}
            disabled={enviando}
          >
            {enviando ? (
              <ActivityIndicator color={COLORS.textInverse} />
            ) : (
              <>
                <Ionicons name="send" size={20} color={COLORS.textInverse} />
                <Text style={styles.enviarButtonText}>Enviar Resposta</Text>
              </>
            )}
          </TouchableOpacity>
        </View>
      )}

      {/* Aviso */}
      <View style={styles.avisoContainer}>
        <Ionicons name="information-circle" size={18} color={COLORS.accent} />
        <Text style={styles.avisoText}>
          Lembre-se: esta é uma triagem inicial. Sempre recomende avaliação 
          presencial quando necessário e evite diagnósticos definitivos.
        </Text>
      </View>

      {/* Modal de Imagem */}
      <Modal
        visible={!!imagemModal}
        transparent
        animationType="fade"
        onRequestClose={() => setImagemModal(null)}
      >
        <TouchableOpacity
          style={styles.imagemModalOverlay}
          activeOpacity={1}
          onPress={() => setImagemModal(null)}
        >
          <Image
            source={{ uri: imagemModal }}
            style={styles.imagemModalFull}
            resizeMode="contain"
          />
          <TouchableOpacity
            style={styles.imagemModalClose}
            onPress={() => setImagemModal(null)}
          >
            <Ionicons name="close-circle" size={40} color="#fff" />
          </TouchableOpacity>
        </TouchableOpacity>
      </Modal>

      <View style={{ height: 30 }} />
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.background,
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
  pacienteCard: {
    backgroundColor: COLORS.surface,
    padding: SIZES.md,
    ...SHADOWS.sm,
  },
  pacienteHeader: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  pacienteAvatar: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: '#E3F2FD',
    justifyContent: 'center',
    alignItems: 'center',
  },
  pacienteInfo: {
    flex: 1,
    marginLeft: SIZES.md,
  },
  pacienteNome: {
    fontSize: SIZES.fontLg,
    fontWeight: 'bold',
    color: COLORS.text,
  },
  pacienteDetalhe: {
    fontSize: SIZES.fontSm,
    color: COLORS.textSecondary,
    marginTop: 2,
  },
  statusCard: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: COLORS.surface,
    padding: SIZES.md,
    marginTop: 1,
    ...SHADOWS.sm,
  },
  statusBadgeLarge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: SIZES.md,
    paddingVertical: SIZES.xs,
    borderRadius: SIZES.radiusFull,
  },
  statusTextLarge: {
    color: COLORS.textInverse,
    fontWeight: 'bold',
    marginLeft: SIZES.xs,
  },
  dataText: {
    fontSize: SIZES.fontSm,
    color: COLORS.textSecondary,
  },
  section: {
    backgroundColor: COLORS.surface,
    marginTop: SIZES.md,
    padding: SIZES.md,
  },
  sectionTitle: {
    fontSize: SIZES.fontLg,
    fontWeight: 'bold',
    color: COLORS.text,
    marginBottom: SIZES.md,
  },
  infoRow: {
    marginBottom: SIZES.md,
  },
  infoRowDupla: {
    flexDirection: 'row',
    marginBottom: SIZES.md,
  },
  infoColuna: {
    flex: 1,
  },
  infoLabel: {
    fontSize: SIZES.fontSm,
    color: COLORS.textSecondary,
    marginBottom: 4,
  },
  infoValor: {
    fontSize: SIZES.fontMd,
    color: COLORS.text,
    fontWeight: '500',
  },
  valorUrgente: {
    color: COLORS.danger,
    fontWeight: 'bold',
  },
  descricaoText: {
    fontSize: SIZES.fontMd,
    color: COLORS.text,
    lineHeight: 22,
    backgroundColor: COLORS.background,
    padding: SIZES.sm,
    borderRadius: SIZES.radiusSm,
  },
  imagemPreview: {
    width: 150,
    height: 150,
    borderRadius: SIZES.radiusMd,
    marginRight: SIZES.sm,
  },
  imagemDica: {
    fontSize: SIZES.fontXs,
    color: COLORS.textLight,
    marginTop: SIZES.xs,
  },
  campoLabel: {
    fontSize: SIZES.fontMd,
    fontWeight: '600',
    color: COLORS.text,
    marginBottom: SIZES.xs,
    marginTop: SIZES.sm,
  },
  textArea: {
    backgroundColor: COLORS.background,
    borderRadius: SIZES.radiusMd,
    padding: SIZES.md,
    fontSize: SIZES.fontMd,
    color: COLORS.text,
    minHeight: 120,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  textAreaSmall: {
    backgroundColor: COLORS.background,
    borderRadius: SIZES.radiusMd,
    padding: SIZES.md,
    fontSize: SIZES.fontMd,
    color: COLORS.text,
    minHeight: 60,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  recomendacoesGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
  },
  recomendacaoCard: {
    width: '48%',
    backgroundColor: COLORS.background,
    borderRadius: SIZES.radiusMd,
    padding: SIZES.md,
    alignItems: 'center',
    marginBottom: SIZES.sm,
    borderWidth: 2,
    borderColor: 'transparent',
  },
  recomendacaoCardActive: {
    backgroundColor: COLORS.surface,
    ...SHADOWS.md,
  },
  recomendacaoLabel: {
    marginTop: SIZES.xs,
    fontSize: SIZES.fontSm,
    color: COLORS.textSecondary,
    textAlign: 'center',
  },
  acoesContainer: {
    flexDirection: 'row',
    padding: SIZES.md,
  },
  urgenteButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: COLORS.danger,
    paddingVertical: SIZES.md,
    paddingHorizontal: SIZES.md,
    borderRadius: SIZES.radiusMd,
    marginRight: SIZES.sm,
  },
  urgenteButtonText: {
    color: COLORS.textInverse,
    fontWeight: 'bold',
    marginLeft: SIZES.xs,
  },
  enviarButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: COLORS.secondary,
    paddingVertical: SIZES.md,
    borderRadius: SIZES.radiusMd,
  },
  buttonDisabled: {
    backgroundColor: COLORS.secondaryLight,
  },
  enviarButtonText: {
    color: COLORS.textInverse,
    fontWeight: 'bold',
    marginLeft: SIZES.xs,
  },
  avisoContainer: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    backgroundColor: '#FFF3E0',
    marginHorizontal: SIZES.md,
    padding: SIZES.md,
    borderRadius: SIZES.radiusMd,
  },
  avisoText: {
    flex: 1,
    marginLeft: SIZES.sm,
    fontSize: SIZES.fontSm,
    color: '#E65100',
    lineHeight: 18,
  },
  // Modal de Imagem
  imagemModalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.9)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  imagemModalFull: {
    width: '100%',
    height: '80%',
  },
  imagemModalClose: {
    position: 'absolute',
    top: 50,
    right: 20,
  },
});

export default CasoDetalheScreen;