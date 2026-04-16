import React, { useState, useEffect, useCallback } from 'react';
import type { Triagem } from '../../types/triagem';
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
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import Toast from 'react-native-toast-message';
import { useAuth } from '../../contexts/AuthContext';
import { buscarTriagemPorId, responderTriagem, atualizarStatusTriagem, recusarTriagem } from '../../services/triagemService';
import { obterOuCriarConversa } from '../../services/messagesService';
import { supabase } from '../../config/supabase';
import { COLORS, SIZES, SHADOWS } from '../../styles/theme';
import { STATUS_TRIAGEM, RECOMENDACAO } from '../../utils/constants';
import { formatDateTime } from '../../utils/helpers';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { DentistaStackParamList } from '../../navigation/types';

type CasoDetalheProps = NativeStackScreenProps<DentistaStackParamList, 'CasoDetalhe'>;

const CasoDetalheScreen: React.FC<CasoDetalheProps> = ({ route, navigation }) => {
  const { triagemId } = route.params;
  const { profile } = useAuth();
  
  const [triagem, setTriagem] = useState<Triagem | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [enviando, setEnviando] = useState<boolean>(false);
  const [imagemModal, setImagemModal] = useState<string | null>(null);
  
  // Campos da resposta
  const [orientacao, setOrientacao] = useState<string>('');
  const [recomendacao, setRecomendacao] = useState<string>('');
  const [observacoes, setObservacoes] = useState<string>('');

  // Recusar caso
  const [modalRecusa, setModalRecusa] = useState(false);
  const [motivoRecusa, setMotivoRecusa] = useState('');
  const [recusando, setRecusando] = useState(false);

const carregarTriagem = async () => {
    const result = await buscarTriagemPorId(triagemId);
    if (result.success) {
      let tri = result.data;

      // if patient name missing, try loading it explicitly
      if ((!tri.paciente || !tri.paciente.nome) && tri.paciente_id) {
        const { data: prof } = await supabase
          .from('profiles')
          .select('nome')
          .eq('id', tri.paciente_id)
          .maybeSingle();
        if (prof && prof.nome) {
          tri = { ...tri, paciente: { ...(tri.paciente || {}), nome: prof.nome } };
        }
      }

      setTriagem(tri as any);
      
      // Se já tem resposta, preencher campos
      if (tri.respostas && tri.respostas.length > 0) {
        const resposta = tri.respostas[0];
        setOrientacao(resposta.orientacao || '');
        setRecomendacao(resposta.recomendacao || '');
      setObservacoes(resposta.observacoes || '');
      }
    }
    setLoading(false);
  };

  useEffect(() => {
    carregarTriagem();

    // Realtime subscription for triage changes
    const channel = supabase
      .channel(`triagem-${triagemId}`)
      .on(
        'postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'triagens', filter: `id=eq.${triagemId}` },
        () => {
          console.log('🔄 Triagem alterada, recarregando...');
          carregarTriagem();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
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

    if (Platform.OS === 'web') {
      const confirmou = window.confirm('Deseja enviar esta orientação ao paciente?');
      if (confirmou) {
        processarResposta();
      }
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
    console.log('🚀 Iniciando processarResposta...');
    
    if (!profile?.id) {
      console.error('❌ Perfil do dentista não carregado');
      Toast.show({
        type: 'error',
        text1: 'Erro de autenticação',
        text2: 'Seu perfil ainda não foi carregado. Tente novamente em instantes.',
      });
      return;
    }

    setEnviando(true);

    try {
      console.log('📡 Chamando responderTriagem...', { triagemId, profileId: profile.id });
      const result = await responderTriagem(triagemId, profile.id, {
        orientacao: orientacao.trim(),
        recomendacao,
        observacoes: observacoes.trim(),
      }, {
        pacienteId: triagem!.paciente_id!,
        dentistaNome: profile.nome || 'Dentista',
        dentistaAvatar: profile.foto_url || null
      });

      console.log('📥 Resultado do responderTriagem:', result);
      setEnviando(false);

      if (result.success) {
        Toast.show({
          type: 'success',
          text1: 'Resposta enviada!',
          text2: 'O paciente será notificado',
        });
        navigation.goBack();
      } else {
        const errorMsg = typeof result.error === 'object' ? result.error.message : String(result.error);
        console.error('❌ Erro no result.success=false:', errorMsg);
        Toast.show({
          type: 'error',
          text1: 'Erro ao enviar',
          text2: errorMsg || 'Tente novamente',
        });
      }
    } catch (err) {
      console.error('💥 Erro catastrófico no processarResposta:', err);
      setEnviando(false);
      Toast.show({
        type: 'error',
        text1: 'Erro crítico',
        text2: 'Falha na conexão ou erro interno. Tente novamente.',
      });
    }
  };

  const handleMarcarUrgente = () => {
    if (Platform.OS === 'web') {
      const confirmou = window.confirm('Deseja marcar este caso como URGENTE? Isso indicará que o paciente precisa de atendimento presencial imediato.');
      if (confirmou) {
        processarUrgente();
      }
      return;
    }

    Alert.alert(
      'Marcar como Urgente',
      'Isso indicará que o paciente precisa de atendimento presencial urgente.',
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Confirmar',
          style: 'destructive',
          onPress: processarUrgente,
        },
      ]
    );
  };

  const processarUrgente = async () => {
    setLoading(true);
    const result = await atualizarStatusTriagem(triagemId, 'urgente', 'urgente');
    if (result.success) {
      Toast.show({ type: 'success', text1: 'Marcado como urgente' });
      await carregarTriagem();
    } else {
      Toast.show({ type: 'error', text1: 'Erro ao marcar urgente' });
    }
    setLoading(false);
  };

  const handleRecusarCaso = () => setModalRecusa(true);

  const processarRecusa = async () => {
    if (!motivoRecusa.trim()) {
      Toast.show({ type: 'error', text1: 'Escreva o motivo da recusa' });
      return;
    }
    if (!profile?.id) return;
    setRecusando(true);
    const result = await recusarTriagem(triagemId, profile.id, motivoRecusa.trim());
    setRecusando(false);
    if (result.success) {
      setModalRecusa(false);
      Toast.show({
        type: 'success',
        text1: 'Caso recusado',
        text2: 'O secretário será notificado para re-atribuir',
      });
      navigation.goBack();
    } else {
      Toast.show({ type: 'error', text1: 'Erro ao recusar caso' });
    }
  };

  const handleAbrirChatPaciente = async () => {
    if (!profile?.id || !profile?.nome) return;
    const pacienteId = triagem?.paciente_id;
    if (!pacienteId) {
      Toast.show({
        type: 'error',
        text1: 'Nao foi possivel abrir chat',
        text2: 'Paciente nao identificado neste caso',
      });
      return;
    }

    const result = await obterOuCriarConversa(
      profile.id,
      pacienteId,
      profile.nome,
      triagem.paciente?.nome || 'Paciente',
      profile.foto_url || null,
      triagem.paciente?.foto_url || null
    );

    if (!result.success || !result.data) {
      Toast.show({
        type: 'error',
        text1: 'Erro',
        text2: result.error || 'Nao foi possivel abrir conversa',
      });
      return;
    }

    navigation.navigate('DentistaTabs' as any, {
      screen: 'Mensagens',
      params: {
        openConversationId: result.data.id,
        otherUserName: triagem.paciente?.nome || 'Paciente',
        otherUserAvatar: triagem.paciente?.foto_url || undefined,
      },
    });
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

  const temResposta = triagem && triagem.respostas && triagem.respostas.length > 0;
  const statusAtual = String(triagem?.status || 'pendente').toLowerCase();
  const prioridadeAtual = String(triagem?.prioridade || '').toLowerCase();
  const effectiveStatus = temResposta
    ? 'respondido'
    : (prioridadeAtual === 'urgente' || prioridadeAtual === 'alta' || Number(triagem?.intensidade_dor || 0) >= 8
        ? 'urgente'
        : statusAtual);
  const statusInfo = STATUS_TRIAGEM[effectiveStatus] || STATUS_TRIAGEM.pendente;

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      keyboardVerticalOffset={Platform.OS === 'ios' ? 90 : 0}
    >
      <ScrollView
        style={styles.container}
        keyboardShouldPersistTaps="handled"
        keyboardDismissMode="on-drag"
      >
      <View style={styles.pacienteCard}>
        <View style={styles.pacienteHeader}>
          <View style={styles.pacienteAvatar}>
            <Ionicons name="person" size={28} color={COLORS.primary} />
          </View>
          <View style={styles.pacienteInfo}>
            <Text style={styles.pacienteNome}>{triagem.paciente?.nome || 'Paciente'}</Text>
            {triagem.paciente?.telefone ? (
              <Text style={styles.pacienteDetalhe}>
                <Ionicons name="call-outline" size={12} /> {String(triagem.paciente.telefone)}
              </Text>
            ) : null}
            <Text style={styles.pacienteResumo}>
              {`Caso enviado ${formatDateTime(triagem.created_at)}`}
            </Text>
          </View>
        </View>
        <View style={styles.pacienteButtonsRow}>
          <TouchableOpacity style={styles.chatButton} onPress={handleAbrirChatPaciente}>
            <Ionicons name="chatbubble-ellipses" size={18} color={COLORS.textInverse} />
            <Text style={styles.chatButtonText}>Conversar com paciente</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.chatButton, styles.historyButton]}
            onPress={() => {
              if (triagem.paciente_id) {
                navigation.navigate('PacienteHistorico' as any, {
                  pacienteId: triagem.paciente_id,
                  pacienteNome: triagem.paciente?.nome,
                });
              }
            }}
          >
            <Ionicons name="document-text" size={18} color={COLORS.textInverse} />
            <Text style={styles.chatButtonText}>Ver histórico</Text>
          </TouchableOpacity>
        </View>

        {/* Módulo Clínico — Anamnese, Plano, Prescrição */}
        <View style={styles.clinicaRow}>
          <TouchableOpacity
            style={styles.clinicaBtn}
            onPress={() => triagem.paciente_id && navigation.navigate('Anamnese', {
              triagemId, pacienteId: triagem.paciente_id, pacienteNome: triagem.paciente?.nome,
            })}
          >
            <Ionicons name="clipboard" size={16} color="#7C3AED" />
            <Text style={[styles.clinicaBtnText, { color: '#7C3AED' }]}>Anamnese</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.clinicaBtn}
            onPress={() => triagem.paciente_id && navigation.navigate('PlanoTratamento', {
              triagemId, pacienteId: triagem.paciente_id, pacienteNome: triagem.paciente?.nome,
            })}
          >
            <Ionicons name="list" size={16} color={COLORS.primary} />
            <Text style={[styles.clinicaBtnText, { color: COLORS.primary }]}>Plano</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.clinicaBtn}
            onPress={() => triagem.paciente_id && navigation.navigate('Prescricao', {
              triagemId, pacienteId: triagem.paciente_id, pacienteNome: triagem.paciente?.nome,
            })}
          >
            <Ionicons name="medical" size={16} color="#E91E63" />
            <Text style={[styles.clinicaBtnText, { color: '#E91E63' }]}>Prescrição</Text>
          </TouchableOpacity>
        </View>
      </View>

      <View style={styles.statusCard}>
        <View style={[styles.statusBadgeLarge, { backgroundColor: statusInfo.color }]}>
          <Ionicons name={statusInfo.icon as any} size={18} color="#fff" />
          <Text style={styles.statusTextLarge}>{statusInfo.label}</Text>
        </View>
      </View>
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Informações do Caso</Text>

        <View style={styles.infoRow}>
          <Text style={styles.infoLabel}>Sintoma Principal</Text>
          <Text style={styles.infoValor}>{triagem.sintoma_principal ?? 'Não informado'}</Text>
        </View>

        <View style={styles.infoRowDupla}>
          <View style={styles.infoColuna}>
            <Text style={styles.infoLabel}>Intensidade da Dor</Text>
            <Text style={[
              styles.infoValor,
              Number(triagem.intensidade_dor || 0) >= 7 && styles.valorUrgente
            ]}>
{Number(triagem.intensidade_dor || 0)}/10
            </Text>
          </View>
          <View style={styles.infoColuna}>
            <Text style={styles.infoLabel}>Duração</Text>
            <Text style={styles.infoValor}>{triagem.duracao || 'Não informado'}</Text>
          </View>
        </View>

        {triagem.localizacao ? (
          <View style={styles.infoRow}>
            <Text style={styles.infoLabel}>Localização</Text>
            <Text style={styles.infoValor}>{triagem.localizacao}</Text>
          </View>
        ) : null}
        {triagem.descricao ? (
          <View style={styles.infoRow}>
            <Text style={styles.infoLabel}>Descrição do Paciente</Text>
            <Text style={styles.descricaoText}>{triagem.descricao}</Text>
          </View>
        ) : null}
      </View>
      {triagem.imagens && (Array.isArray(triagem.imagens) ? triagem.imagens.length > 0 : typeof triagem.imagens === 'string') ? (
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>
            Fotos Enviadas ({Array.isArray(triagem.imagens) ? triagem.imagens.length : 1})
          </Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false}>
            {(Array.isArray(triagem.imagens) ? triagem.imagens : [triagem.imagens]).map((uri, index) => (
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
      ) : null}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>
          {temResposta ? 'Sua Resposta' : 'Responder ao Paciente'}
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
          editable={!temResposta}
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
              onPress={() => !temResposta && setRecomendacao(key)}
              disabled={temResposta}
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
          editable={!temResposta}
        />
      </View>
      {!temResposta ? (
        <View style={styles.acoesContainer}>
          <TouchableOpacity
            style={styles.urgenteButton}
            onPress={handleMarcarUrgente}
          >
            <Ionicons name="alert-circle" size={20} color={COLORS.textInverse} />
            <Text style={styles.urgenteButtonText}>Urgente</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.recusarButton}
            onPress={handleRecusarCaso}
          >
            <Ionicons name="close-circle-outline" size={20} color={COLORS.textInverse} />
            <Text style={styles.urgenteButtonText}>Recusar</Text>
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
      ) : null}
      <View style={styles.avisoContainer}>
        <Ionicons name="information-circle" size={18} color={COLORS.accent} />
        <Text style={styles.avisoText}>
          Lembre-se: esta é uma triagem inicial. Sempre recomende avaliação 
          presencial quando necessário e evite diagnósticos definitivos.
        </Text>
      </View>
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

      {/* Modal de Recusa */}
      <Modal
        visible={modalRecusa}
        transparent
        animationType="slide"
        onRequestClose={() => setModalRecusa(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalBox}>
            <Text style={styles.modalTitle}>Recusar Caso</Text>
            <Text style={styles.modalSub}>
              Explica o motivo da recusa. O secretário será notificado para atribuir a outro dentista.
            </Text>
            <TextInput
              style={styles.motivoInput}
              placeholder="Ex: Fora da minha especialidade. Recomendo endodontista."
              placeholderTextColor={COLORS.textSecondary}
              value={motivoRecusa}
              onChangeText={setMotivoRecusa}
              multiline
              numberOfLines={4}
              textAlignVertical="top"
            />
            <View style={styles.modalBtns}>
              <TouchableOpacity
                style={styles.modalBtnCancel}
                onPress={() => setModalRecusa(false)}
                disabled={recusando}
              >
                <Text style={styles.modalBtnCancelText}>Cancelar</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.modalBtnConfirm, recusando && { opacity: 0.6 }]}
                onPress={processarRecusa}
                disabled={recusando}
              >
                {recusando ? (
                  <ActivityIndicator size="small" color="white" />
                ) : (
                  <Text style={styles.modalBtnConfirmText}>Confirmar Recusa</Text>
                )}
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

        <View style={{ height: 30 }} />
      </ScrollView>
    </KeyboardAvoidingView>
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
  chatButton: {
    marginTop: SIZES.md,
    backgroundColor: COLORS.primary,
    borderRadius: SIZES.radiusMd,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: SIZES.sm,
  },
  pacienteButtonsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: SIZES.md,
  },
  historyButton: {
    backgroundColor: COLORS.secondary,
    marginLeft: SIZES.sm,
  },
  chatButtonText: {
    color: COLORS.textInverse,
    marginLeft: SIZES.xs,
    fontWeight: '700',
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
  pacienteResumo: {
    fontSize: SIZES.fontSm,
    color: COLORS.textSecondary,
    marginTop: 6,
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
  agendamentoCard: {
    backgroundColor: COLORS.background,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: SIZES.radiusSm,
    padding: SIZES.sm,
    marginBottom: SIZES.sm,
  },
  agendamentoHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  agendamentoTipo: {
    fontSize: SIZES.fontMd,
    fontWeight: '700',
    color: COLORS.text,
  },
  agendamentoStatus: {
    fontSize: SIZES.fontXs,
    color: COLORS.primary,
    fontWeight: '700',
    textTransform: 'capitalize',
  },
  agendamentoData: {
    marginTop: 4,
    fontSize: SIZES.fontSm,
    color: COLORS.textSecondary,
  },
  agendamentoObs: {
    marginTop: 6,
    fontSize: SIZES.fontSm,
    color: COLORS.text,
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
  recusarButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#6B7280',
    paddingVertical: SIZES.md,
    paddingHorizontal: SIZES.md,
    borderRadius: SIZES.radiusMd,
    marginRight: SIZES.sm,
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
  clinicaRow: {
    flexDirection: 'row',
    gap: SIZES.sm,
    marginTop: SIZES.sm,
  },
  clinicaBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
    backgroundColor: COLORS.background,
    borderRadius: SIZES.radiusMd,
    paddingVertical: 10,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  clinicaBtnText: {
    fontSize: SIZES.fontSm,
    fontWeight: '700',
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
  // Modal de Recusa
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.6)',
    justifyContent: 'flex-end',
    alignItems: 'center',
  },
  modalBox: {
    backgroundColor: COLORS.surface,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    padding: SIZES.lg,
    width: '100%',
    maxWidth: 600,
  },
  modalTitle: {
    fontSize: SIZES.fontXl,
    fontWeight: '800',
    color: COLORS.text,
    marginBottom: SIZES.sm,
  },
  modalSub: {
    fontSize: SIZES.fontSm,
    color: COLORS.textSecondary,
    marginBottom: SIZES.md,
    lineHeight: 20,
  },
  motivoInput: {
    backgroundColor: COLORS.background,
    borderRadius: SIZES.radiusMd,
    padding: SIZES.md,
    fontSize: SIZES.fontMd,
    color: COLORS.text,
    minHeight: 100,
    borderWidth: 1,
    borderColor: COLORS.border,
    marginBottom: SIZES.md,
  },
  modalBtns: {
    flexDirection: 'row',
    gap: SIZES.sm,
  },
  modalBtnCancel: {
    flex: 1,
    backgroundColor: COLORS.background,
    borderRadius: SIZES.radiusMd,
    paddingVertical: SIZES.md,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  modalBtnCancelText: {
    fontSize: SIZES.fontMd,
    color: COLORS.textSecondary,
    fontWeight: '600',
  },
  modalBtnConfirm: {
    flex: 1,
    backgroundColor: '#EF4444',
    borderRadius: SIZES.radiusMd,
    paddingVertical: SIZES.md,
    alignItems: 'center',
  },
  modalBtnConfirmText: {
    fontSize: SIZES.fontMd,
    color: 'white',
    fontWeight: '700',
  },
});


export default CasoDetalheScreen;
