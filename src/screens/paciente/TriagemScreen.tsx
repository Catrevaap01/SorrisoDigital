import React, { useState, useEffect, useRef } from 'react';
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
  KeyboardAvoidingView,
  Platform,
  Keyboard,
  Modal,
  FlatList,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import Svg, { Ellipse, G, Path, Text as SvgText } from 'react-native-svg';
import * as ImagePicker from 'expo-image-picker';
import Toast from 'react-native-toast-message';
import { useAuth } from '../../contexts/AuthContext';
import { useDentist } from '../../contexts/DentistContext';
import { criarTriagem } from '../../services/triagemService';
import { COLORS, SIZES, SHADOWS } from '../../styles/theme';
import { SINTOMAS, DURACAO_OPTIONS } from '../../utils/constants';
import { BottomTabScreenProps } from '@react-navigation/bottom-tabs';
import { PacienteTabParamList } from '../../navigation/types';

type TriagemScreenProps = BottomTabScreenProps<PacienteTabParamList, 'Triagem'>;

const ARCADA_SUPERIOR = ['18', '17', '16', '15', '14', '13', '12', '11', '21', '22', '23', '24', '25', '26', '27', '28'];
const ARCADA_INFERIOR = ['48', '47', '46', '45', '44', '43', '42', '41', '31', '32', '33', '34', '35', '36', '37', '38'];
const SVG_WIDTH = 344;
const SVG_HEIGHT = 248;

const formatarLocalizacaoTriagem = (dentes: Set<string>): string => {
  if (dentes.size === 0) return '';
  const sorted = Array.from(dentes).sort((a, b) => Number(a) - Number(b));
  return dentes.size === 1 ? `Dente ${sorted[0]}` : `Dentes ${sorted.join(', ')}`;
};

const createToothPath = (
  centerX: number,
  centerY: number,
  width: number,
  height: number,
  inverted: boolean
): string => {
  const halfW = width / 2;
  const crownH = height * 0.42;
  const rootH = height - crownH;
  const topY = centerY - height / 2;
  const bottomY = centerY + height / 2;
  const crownBottomY = inverted ? topY + rootH : topY + crownH;
  const rootStartY = crownBottomY;

  if (!inverted) {
    return [
      `M ${centerX - halfW} ${topY + crownH * 0.3}`,
      `Q ${centerX - halfW} ${topY} ${centerX - halfW * 0.35} ${topY}`,
      `L ${centerX + halfW * 0.35} ${topY}`,
      `Q ${centerX + halfW} ${topY} ${centerX + halfW} ${topY + crownH * 0.3}`,
      `L ${centerX + halfW * 0.72} ${crownBottomY}`,
      `Q ${centerX + halfW * 0.42} ${rootStartY + rootH * 0.72} ${centerX + halfW * 0.12} ${bottomY}`,
      `Q ${centerX} ${bottomY - rootH * 0.18} ${centerX - halfW * 0.12} ${bottomY}`,
      `Q ${centerX - halfW * 0.42} ${rootStartY + rootH * 0.72} ${centerX - halfW * 0.72} ${crownBottomY}`,
      'Z',
    ].join(' ');
  }

  return [
    `M ${centerX - halfW * 0.72} ${rootStartY}`,
    `Q ${centerX - halfW * 0.42} ${topY + rootH * 0.28} ${centerX - halfW * 0.12} ${topY}`,
    `Q ${centerX} ${topY + rootH * 0.18} ${centerX + halfW * 0.12} ${topY}`,
    `Q ${centerX + halfW * 0.42} ${topY + rootH * 0.28} ${centerX + halfW * 0.72} ${rootStartY}`,
    `L ${centerX + halfW} ${bottomY - crownH * 0.3}`,
    `Q ${centerX + halfW} ${bottomY} ${centerX + halfW * 0.35} ${bottomY}`,
    `L ${centerX - halfW * 0.35} ${bottomY}`,
    `Q ${centerX - halfW} ${bottomY} ${centerX - halfW} ${bottomY - crownH * 0.3}`,
    'Z',
  ].join(' ');
};

const TriagemScreen: React.FC<TriagemScreenProps> = ({ navigation }) => {
  // scrollRef e keyboard handler já existe abaixo
  const { profile } = useAuth();
  const { selectedDentist, selectDentist } = useDentist();
  const [etapa, setEtapa] = useState<number>(1);
  const [loading, setLoading] = useState<boolean>(false);
  
  // Dados da triagem
  const [sintomaPrincipal, setSintomaPrincipal] = useState<string>('');
  const [descricao, setDescricao] = useState<string>('');
  const [duracao, setDuracao] = useState<string>('');
  const [localizacao, setLocalizacao] = useState<string>('');
  const [dentesSelecionados, setDentesSelecionados] = useState<Set<string>>(new Set());
  const [intensidadeDor, setIntensidadeDor] = useState<number>(0);
  const [imagens, setImagens] = useState<string[]>([]);
  const [dentistas, setDentistas] = useState<any[]>([]);
  const [dentistaSelecionado, setDentistaSelecionado] = useState<string | null>(null);
  const [keyboardHeight, setKeyboardHeight] = useState<number>(0);
  const [sugestoesAbertas, setSugestoesAbertas] = useState<boolean>(false);
  const scrollRef = useRef<ScrollView>(null);

  // Funções de câmera/galeria - CORRIGIDO
  // load dentists on first render
  React.useEffect(() => {
    (async () => {
      const { listarDentistas } = await import('../../services/dentistaService');
      const res = await listarDentistas();
      if (res.success && res.data) {
        setDentistas(res.data);
      }
    })();
  }, []);

  // prefill selectedDentist from context
  useEffect(() => {
    if (selectedDentist) {
      setDentistaSelecionado(selectedDentist.id);
    }
  }, [selectedDentist]);

  // if there's no dentist chosen at all, force the user to pick one
  useEffect(() => {
    if (!selectedDentist) {
      Alert.alert(
        'Dentista obrigatório',
        'Você deve selecionar um dentista antes de enviar triagem.',
        [
          {
            text: 'Escolher agora',
            onPress: () => navigation.getParent()?.navigate('ChooseDentista' as any),
          },
        ],
        { cancelable: false }
      );
    }
  }, [selectedDentist]);

  useEffect(() => {
    const showEvent = Platform.OS === 'ios' ? 'keyboardWillShow' : 'keyboardDidShow';
    const hideEvent = Platform.OS === 'ios' ? 'keyboardWillHide' : 'keyboardDidHide';

    const showSub = Keyboard.addListener(showEvent, (event) => {
      setKeyboardHeight(event.endCoordinates?.height || 0);
    });

    const hideSub = Keyboard.addListener(hideEvent, () => {
      setKeyboardHeight(0);
    });

    return () => {
      showSub.remove();
      hideSub.remove();
    };
  }, []);


  const tirarFoto = async () => {
    try {
      // Primeiro verifica permissões
      const { status } = await ImagePicker.requestCameraPermissionsAsync();
      
      if (status !== 'granted') {
        Alert.alert(
          'Permissão Necessária',
          'Precisamos de acesso à câmera para tirar fotos. Por favor, ative a permissão nas configurações do aplicativo.'
        );
        return;
      }

      // Depois abre a câmera
      const result = await ImagePicker.launchCameraAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsEditing: true,
        aspect: [4, 3],
        quality: 0.7,
      });

      // Verifica se o usuário cancelou
      if (result.canceled) {
        return;
      }

      // Obtém a URI da imagem
      if (result.assets && result.assets[0]) {
        const {uri} = result.assets[0];
        
        // Valida se já atingiu o máximo de fotos
        if (imagens.length < 5) {
          setImagens([...imagens, uri]);
          Toast.show({
            type: 'success',
            text1: 'Foto adicionada',
            text2: `${imagens.length + 1}/5 fotos`,
          });
        } else {
          Toast.show({
            type: 'info',
            text1: 'Limite atingido',
            text2: 'Máximo de 5 fotos atingido. Remova uma para adicionar outra.',
          });
        }
      }
    } catch (error: any) {
      console.error('Erro ao tirar foto:', error);
      Toast.show({
        type: 'error',
        text1: 'Erro ao acessar câmera',
        text2: error.message || 'Tente novamente',
      });
    }
  };

  const selecionarGaleria = async () => {
    try {
      // Solicita permissão de acesso à galeria
      const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
      
      if (status !== 'granted') {
        Alert.alert(
          'Permissão Necessária',
          'Precisamos de acesso à sua galeria. Por favor, ative a permissão nas configurações do aplicativo.'
        );
        return;
      }

      // Abre a galeria
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsEditing: true,
        aspect: [4, 3],
        quality: 0.7,
        selectionLimit: 5 - imagens.length,
      });

      // Verifica se o usuário cancelou
      if (result.canceled) {
        return;
      }

      // Obtém as URIs das imagens
      if (result.assets && result.assets.length > 0) {
        const novasImagens = result.assets.map((asset) => asset.uri);
        
        // Valida o limite
        if (imagens.length + novasImagens.length <= 5) {
          setImagens([...imagens, ...novasImagens]);
          Toast.show({
            type: 'success',
            text1: 'Fotos adicionadas',
            text2: `${imagens.length + novasImagens.length}/5 fotos`,
          });
        } else {
          const restante = 5 - imagens.length;
          Toast.show({
            type: 'info',
            text1: 'Limite de fotos',
            text2: `Você pode adicionar apenas ${restante} foto(s) mais`,
          });
          
          // Adiciona apenas o máximo permitido
          setImagens([...imagens, ...novasImagens.slice(0, restante)]);
        }
      }
    } catch (error: any) {
      console.error('Erro ao acessar galeria:', error);
      Toast.show({
        type: 'error',
        text1: 'Erro ao acessar galeria',
        text2: error.message || 'Tente novamente',
      });
    }
  };

  const removerImagem = (index) => {
    const novas = [...imagens];
    novas.splice(index, 1);
    setImagens(novas);
  };

  // Enviar triagem
  const enviarTriagem = async () => {
    if (!sintomaPrincipal) {
      Toast.show({ type: 'error', text1: 'Selecione o sintoma principal' });
      return;
    }

    // ensure a dentist is chosen (from step or context)
    if (!dentistaSelecionado) {
      Toast.show({ type: 'error', text1: 'Selecione um dentista' });
      navigation.getParent()?.navigate('ChooseDentista' as any);
      return;
    }

    if (imagens.length === 0) {
      Alert.alert(
        'Sem imagens',
        'Fotos ajudam muito na avaliação. Deseja continuar sem fotos?',
        [
          { text: 'Voltar', style: 'cancel' },
          { text: 'Continuar', onPress: () => processarEnvio() },
        ]
      );
      return;
    }

    await processarEnvio();
  };

  const processarEnvio = async () => {
    setLoading(true);

    const triagemData: any = {
      paciente_id: profile.id,
      sintoma_principal: sintomaPrincipal,
      descricao,
      duracao,
      localizacao,
      intensidade_dor: intensidadeDor,
    };

    // include dentist if selected
    if (dentistaSelecionado) {
      triagemData.dentista_id = dentistaSelecionado;
    }
    const result = await criarTriagem(triagemData, imagens, profile.id);

    setLoading(false);

    if (result.success) {
      Toast.show({
        type: 'success',
        text1: 'Triagem enviada!',
        text2: 'Aguarde a análise do profissional',
      });

      // Resetar formulário
      setSintomaPrincipal('');
      setDescricao('');
      setDuracao('');
      setLocalizacao('');
      setDentesSelecionados(new Set());
      setIntensidadeDor(0);
      setImagens([]);
      setEtapa(1);

      navigation.navigate('Histórico');
    } else {
      Toast.show({
        type: 'error',
        text1: 'Erro ao enviar',
        text2: 'Tente novamente em alguns instantes',
      });
    }
  };

  // Renderizar Etapa 1 - Sintomas
  const renderEtapa1 = () => (
    <View>
      <Text style={styles.etapaTitle}>Qual é o problema principal?</Text>
      <Text style={styles.etapaSubtitle}>Selecione o que melhor descreve seu sintoma</Text>

      <View style={styles.sintomasGrid}>
        {SINTOMAS.map((sintoma) => (
          <TouchableOpacity
            key={sintoma.id}
            style={[
              styles.sintomaCard,
              sintomaPrincipal === sintoma.label && styles.sintomaCardActive,
            ]}
            onPress={() => setSintomaPrincipal(sintoma.label)}
          >
            <Ionicons
              name={sintoma.icon as any}
              size={28}
              color={sintomaPrincipal === sintoma.label ? COLORS.primary : COLORS.textSecondary}
            />
            <Text
              style={[
                styles.sintomaLabel,
                sintomaPrincipal === sintoma.label && styles.sintomaLabelActive,
              ]}
            >
              {sintoma.label}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      <TouchableOpacity
        style={[styles.nextButton, !sintomaPrincipal && styles.buttonDisabled]}
        onPress={() => setEtapa(2)}
        disabled={!sintomaPrincipal}
      >
        <Text style={styles.nextButtonText}>Próximo</Text>
        <Ionicons name="arrow-forward" size={20} color={COLORS.textInverse} />
      </TouchableOpacity>
    </View>
  );

  // Renderizar Etapa 2 - Detalhes
  const selecionarDente = (denteId: string) => {
    setDentesSelecionados((prev) => {
      const next = new Set(prev);
      if (next.has(denteId)) {
        next.delete(denteId);
      } else {
        next.add(denteId);
      }
      setLocalizacao(formatarLocalizacaoTriagem(next));
      return next;
    });
  };

  const renderOdontogramaSvg = () => {
    const buildArc = (
      teeth: string[],
      centerY: number,
      inverted: boolean
    ) => {
      const startX = 28;
      const spacing = 18;

      return teeth.map((tooth, index) => {
        const centerX = startX + index * spacing + 16;
        const curveDistance = Math.abs(index - 7.5);
        const curveOffset = (7.5 - curveDistance) * 3.4;
        const toothHeight = tooth.endsWith('1') || tooth.endsWith('2') || tooth.endsWith('3') ? 38 : 34;
        const toothWidth = tooth.endsWith('6') || tooth.endsWith('7') || tooth.endsWith('8') ? 17 : 15;
        const y = inverted ? centerY + curveOffset : centerY - curveOffset;
        const ativo = dentesSelecionados.has(tooth);

        return (
          <G 
            key={`${inverted ? 'lower' : 'upper'}-${tooth}`} 
            onPress={() => selecionarDente(tooth)}
            style={Platform.OS === 'web' ? { cursor: 'pointer' } as any : undefined}
          >
            <Path
              d={createToothPath(centerX, y, toothWidth, toothHeight, inverted)}
              fill={ativo ? COLORS.primary : '#FFFFFF'}
              stroke={ativo ? COLORS.primaryDark : '#9EB6CC'}
              strokeWidth={ativo ? 2 : 1.4}
            />
            <SvgText
              x={centerX}
              y={inverted ? y + toothHeight * 0.95 : y + toothHeight * 0.88}
              fontSize="8"
              fontWeight="700"
              fill={ativo ? COLORS.primaryDark : '#5C6F82'}
              textAnchor="middle"
            >
              {tooth}
            </SvgText>
          </G>
        );
      });
    };

    return (
      <View style={styles.svgWrapper}>
        <Svg width="100%" height={SVG_HEIGHT} viewBox={`0 0 ${SVG_WIDTH} ${SVG_HEIGHT}`}>
          <Ellipse
            cx={SVG_WIDTH / 2}
            cy={70}
            rx={144}
            ry={44}
            fill="#FDE2DB"
            stroke="#F5C9BD"
            strokeWidth="1.4"
          />
          <Ellipse
            cx={SVG_WIDTH / 2}
            cy={178}
            rx={144}
            ry={44}
            fill="#FDE2DB"
            stroke="#F5C9BD"
            strokeWidth="1.4"
          />
          <Path
            d="M 60 122 Q 172 108 284 122"
            stroke="#E5B7AA"
            strokeWidth="3"
            fill="none"
          />
          <Path
            d="M 60 126 Q 172 140 284 126"
            stroke="#E5B7AA"
            strokeWidth="3"
            fill="none"
          />

          <SvgText
            x={SVG_WIDTH / 2}
            y="24"
            fontSize="13"
            fontWeight="700"
            fill="#6A5B58"
            textAnchor="middle"
          >
            Arcada superior
          </SvgText>
          <SvgText
            x={SVG_WIDTH / 2}
            y="236"
            fontSize="13"
            fontWeight="700"
            fill="#6A5B58"
            textAnchor="middle"
          >
            Arcada inferior
          </SvgText>

          {buildArc(ARCADA_SUPERIOR, 82, false)}
          {buildArc(ARCADA_INFERIOR, 166, true)}
        </Svg>
      </View>
    );
  };

  const renderEtapa2 = () => (
    <View>
      <TouchableOpacity style={styles.backLink} onPress={() => setEtapa(1)}>
        <Ionicons name="arrow-back" size={20} color={COLORS.primary} />
        <Text style={styles.backLinkText}>Voltar</Text>
      </TouchableOpacity>

      <Text style={styles.etapaTitle}>Mais detalhes</Text>

      {/* Duração */}
      <Text style={styles.fieldLabel}>Há quanto tempo sente isso?</Text>
      <ScrollView horizontal showsHorizontalScrollIndicator={false}>
        <View style={styles.optionsRow}>
          {DURACAO_OPTIONS.map((opt) => (
            <TouchableOpacity
              key={opt.id}
              style={[
                styles.optionChip,
                duracao === opt.id && styles.optionChipActive,
              ]}
              onPress={() => setDuracao(opt.id)}
            >
              <Text
                style={[
                  styles.optionChipText,
                  duracao === opt.id && styles.optionChipTextActive,
                ]}
              >
                {opt.label}
              </Text>
            </TouchableOpacity>
          ))}
        </View>
      </ScrollView>

      {/* Localização */}
      <Text style={styles.fieldLabel}>Toque no dente que dói</Text>
      <Text style={styles.fieldHelperText}>
        Toque diretamente na imagem da boca para marcar o dente com dor.
      </Text>
      <View style={styles.bocaCard}>
        {renderOdontogramaSvg()}
        <Text style={styles.toothHint}>
          {dentesSelecionados.size > 0
            ? `Selecionados: ${formatarLocalizacaoTriagem(dentesSelecionados)} (${dentesSelecionados.size})`
            : 'Nenhum dente selecionado (toque para selecionar vários)'}
        </Text>
      </View>

      {!!localizacao && (
        <View style={styles.localizacaoResumo}>
          <Ionicons name="medical" size={16} color={COLORS.primary} />
          <Text style={styles.localizacaoResumoTexto}>{localizacao}</Text>
        </View>
      )}

      {/* Escolher dentista */}
      <View style={styles.campo}>
        <Text style={styles.campoLabel}>Enviar para</Text>
        <TouchableOpacity
          style={styles.selectButton}
          onPress={() => setSugestoesAbertas(true)}
        >
          <Text style={[styles.selectText, !dentistaSelecionado && styles.selectPlaceholder]}>
            {dentistaSelecionado
              ? dentistas.find((d) => d.id === dentistaSelecionado)?.nome
              : 'Selecione um profissional (Opcional)'}
          </Text>
          <Ionicons name="chevron-down" size={20} color={COLORS.textSecondary} />
        </TouchableOpacity>
      </View>

      {/* Modal de Seleção de Dentista */}
      <Modal
        visible={sugestoesAbertas}
        transparent
        animationType="slide"
        onRequestClose={() => setSugestoesAbertas(false)}
      >
        <TouchableOpacity
          style={styles.modalOverlay}
          activeOpacity={1}
          onPress={() => setSugestoesAbertas(false)}
        >
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Escolher Dentista</Text>
              <TouchableOpacity onPress={() => setSugestoesAbertas(false)}>
                <Ionicons name="close" size={24} color={COLORS.text} />
              </TouchableOpacity>
            </View>

            <FlatList
              data={dentistas}
              keyExtractor={(item) => item.id}
              renderItem={({ item }) => (
                <TouchableOpacity
                  style={styles.dentistaSelectItem}
                  onPress={() => {
                    setDentistaSelecionado(item.id);
                    selectDentist({ id: item.id, nome: item.nome, foto_url: item.foto_url });
                    setSugestoesAbertas(false);
                  }}
                >
                  <View style={styles.dentistaSelectInfo}>
                    <Text style={styles.dentistaSelectNome}>{item.nome}</Text>
                    {item.especialidade && (
                      <Text style={styles.dentistaSelectEspecialidade}>{item.especialidade}</Text>
                    )}
                  </View>
                  {dentistaSelecionado === item.id && (
                    <Ionicons name="checkmark-circle" size={24} color={COLORS.secondary} />
                  )}
                </TouchableOpacity>
              )}
              ListEmptyComponent={
                <View style={styles.emptyContainer}>
                  <Text style={styles.emptyText}>Nenhum dentista disponível no momento.</Text>
                </View>
              }
            />
          </View>
        </TouchableOpacity>
      </Modal>

      {/* Intensidade da dor */}
      <Text style={styles.fieldLabel}>
        Intensidade da dor: <Text style={styles.dorValor}>{intensidadeDor}/10</Text>
      </Text>
      <View style={styles.dorContainer}>
        {[0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map((num) => (
          <TouchableOpacity
            key={num}
            style={[
              styles.dorButton,
              intensidadeDor === num && styles.dorButtonActive,
              intensidadeDor === num && num >= 7 && styles.dorButtonHigh,
            ]}
            onPress={() => setIntensidadeDor(num)}
          >
            <Text
              style={[
                styles.dorButtonText,
                intensidadeDor === num && styles.dorButtonTextActive,
              ]}
            >
              {num}
            </Text>
          </TouchableOpacity>
        ))}
      </View>
      <View style={styles.dorLabels}>
        <Text style={styles.dorLabelText}>Sem dor</Text>
        <Text style={styles.dorLabelText}>Dor intensa</Text>
      </View>

      {/* Descrição */}
      <Text style={styles.fieldLabel}>Descreva melhor o que está sentindo (opcional)</Text>
      <Text style={styles.fieldHelperText}>
        Informe quando começa, o que piora/melhora, se sangra e se já tomou algum medicamento.
      </Text>
      <View style={styles.textAreaWrapper}>
        <TextInput
          style={styles.textArea}
          placeholder="Ex: Dor latejante há 2 dias, piora ao mastigar, sangra ao escovar."
          placeholderTextColor={COLORS.textLight}
          value={descricao}
          onChangeText={setDescricao}
          multiline
          numberOfLines={4}
          scrollEnabled={true}
          textAlignVertical="top"
          returnKeyType="done"
          disableFullscreenUI={true}
          onContentSizeChange={(e) => {
            // keep fixed height, ignore content size
          }}
        />
      </View>

      <TouchableOpacity style={styles.nextButton} onPress={() => setEtapa(3)}>
        <Text style={styles.nextButtonText}>Próximo</Text>
        <Ionicons name="arrow-forward" size={20} color={COLORS.textInverse} />
      </TouchableOpacity>
    </View>
  );

  // Renderizar Etapa 3 - Fotos
  const renderEtapa3 = () => (
    <View>
      <TouchableOpacity style={styles.backLink} onPress={() => setEtapa(2)}>
        <Ionicons name="arrow-back" size={20} color={COLORS.primary} />
        <Text style={styles.backLinkText}>Voltar</Text>
      </TouchableOpacity>

      <Text style={styles.etapaTitle}>Adicione fotos</Text>
      <Text style={styles.etapaSubtitle}>
        Fotos claras da região afetada ajudam muito na avaliação
      </Text>

      {/* Botões de adicionar foto */}
      <View style={styles.fotoButtonsRow}>
        <TouchableOpacity style={styles.fotoButton} onPress={tirarFoto}>
          <Ionicons name="camera" size={32} color={COLORS.primary} />
          <Text style={styles.fotoButtonText}>Câmera</Text>
        </TouchableOpacity>

        <TouchableOpacity style={styles.fotoButton} onPress={selecionarGaleria}>
          <Ionicons name="images" size={32} color={COLORS.primary} />
          <Text style={styles.fotoButtonText}>Galeria</Text>
        </TouchableOpacity>
      </View>

      {/* Preview das imagens */}
      {imagens.length > 0 && (
        <View style={styles.imagensContainer}>
          <Text style={styles.imagensCount}>{imagens.length}/5 fotos</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false}>
            {imagens.map((uri, index) => (
              <View key={index} style={styles.imagemWrapper}>
                <Image source={{ uri }} style={styles.imagemPreview} />
                <TouchableOpacity
                  style={styles.imagemRemove}
                  onPress={() => removerImagem(index)}
                >
                  <Ionicons name="close-circle" size={26} color={COLORS.danger} />
                </TouchableOpacity>
              </View>
            ))}
          </ScrollView>
        </View>
      )}

      {/* Dicas */}
      <View style={styles.dicasBox}>
        <Text style={styles.dicasTitle}>📷 Dicas para boas fotos:</Text>
        <Text style={styles.dicasItem}>• Use boa iluminação natural</Text>
        <Text style={styles.dicasItem}>• Foco na região afetada</Text>
        <Text style={styles.dicasItem}>• Evite fotos tremidas ou borradas</Text>
        <Text style={styles.dicasItem}>• Inclua diferentes ângulos se possível</Text>
      </View>

      {/* Botão Enviar */}
      <TouchableOpacity
        style={[styles.enviarButton, loading && styles.buttonDisabled]}
        onPress={enviarTriagem}
        disabled={loading}
      >
        {loading ? (
          <ActivityIndicator color={COLORS.textInverse} />
        ) : (
          <>
            <Ionicons name="send" size={20} color={COLORS.textInverse} />
            <Text style={styles.enviarButtonText}>Enviar Triagem</Text>
          </>
        )}
      </TouchableOpacity>

      {/* Aviso Legal */}
      <View style={styles.avisoLegal}>
        <Ionicons name="information-circle" size={18} color={COLORS.accent} />
        <Text style={styles.avisoLegalText}>
          Esta triagem é apenas orientativa e não substitui consulta presencial
          com profissional de odontologia.
        </Text>
      </View>
    </View>
  );

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? "padding" : undefined}
      enabled={Platform.OS === 'ios'}
    >
      <ScrollView
        ref={scrollRef}
        style={styles.container}
        contentContainerStyle={styles.scrollContent}
        keyboardShouldPersistTaps="always"
        keyboardDismissMode="on-drag"
        automaticallyAdjustKeyboardInsets={Platform.OS === 'ios'}
      >
        {/* Indicador de Progresso */}
        <View style={styles.progressContainer}>
          {[1, 2, 3].map((step) => (
            <React.Fragment key={step}>
              <View
                style={[
                  styles.progressStep,
                  etapa >= step && styles.progressStepActive,
                ]}
              >
                <Text
                  style={[
                    styles.progressStepText,
                    etapa >= step && styles.progressStepTextActive,
                  ]}
                >
                  {step}
                </Text>
              </View>
              {step < 3 && (
                <View
                  style={[
                    styles.progressLine,
                    etapa > step && styles.progressLineActive,
                  ]}
                />
              )}
            </React.Fragment>
          ))}
        </View>

        <View style={styles.content}>
          {etapa === 1 && renderEtapa1()}
          {etapa === 2 && renderEtapa2()}
          {etapa === 3 && renderEtapa3()}
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.background,
  },
  progressContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: SIZES.lg,
    backgroundColor: COLORS.surface,
    ...SHADOWS.sm,
  },
  progressStep: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: COLORS.border,
    justifyContent: 'center',
    alignItems: 'center',
  },
  progressStepActive: {
    backgroundColor: COLORS.primary,
  },
  progressStepText: {
    color: COLORS.textSecondary,
    fontWeight: 'bold',
  },
  progressStepTextActive: {
    color: COLORS.textInverse,
  },
  progressLine: {
    width: 50,
    height: 3,
    backgroundColor: COLORS.border,
  },
  progressLineActive: {
    backgroundColor: COLORS.primary,
  },
  content: {
    padding: SIZES.md,
  },
  scrollContent: {
    paddingBottom: 0,
  },
  backLink: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: SIZES.md,
  },
  backLinkText: {
    color: COLORS.primary,
    marginLeft: SIZES.xs,
    fontWeight: '500',
  },
  etapaTitle: {
    fontSize: SIZES.fontXxl,
    fontWeight: 'bold',
    color: COLORS.text,
    marginBottom: SIZES.xs,
  },
  etapaSubtitle: {
    fontSize: SIZES.fontMd,
    color: COLORS.textSecondary,
    marginBottom: SIZES.lg,
  },
  sintomasGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
  },
  sintomaCard: {
    width: '48%',
    backgroundColor: COLORS.surface,
    borderRadius: SIZES.radiusMd,
    padding: SIZES.md,
    marginBottom: SIZES.sm,
    alignItems: 'center',
    borderWidth: 2,
    borderColor: COLORS.border,
    ...SHADOWS.sm,
  },
  sintomaCardActive: {
    borderColor: COLORS.primary,
    backgroundColor: '#E3F2FD',
  },
  sintomaLabel: {
    marginTop: SIZES.sm,
    fontSize: SIZES.fontMd,
    color: COLORS.textSecondary,
    textAlign: 'center',
  },
  sintomaLabelActive: {
    color: COLORS.primary,
    fontWeight: '600',
  },
  nextButton: {
    backgroundColor: COLORS.primary,
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    padding: SIZES.md,
    borderRadius: SIZES.radiusMd,
    marginTop: SIZES.lg,
  },
  nextButtonText: {
    color: COLORS.textInverse,
    fontSize: SIZES.fontLg,
    fontWeight: 'bold',
    marginRight: SIZES.sm,
  },
  buttonDisabled: {
    backgroundColor: COLORS.primaryLight,
  },
  fieldLabel: {
    fontSize: SIZES.fontMd,
    fontWeight: '600',
    color: COLORS.text,
    marginTop: SIZES.md,
    marginBottom: SIZES.sm,
  },
  fieldHelperText: {
    fontSize: SIZES.fontSm,
    color: COLORS.textSecondary,
    marginTop: -2,
    marginBottom: SIZES.sm,
    lineHeight: 18,
  },
  optionsRow: {
    flexDirection: 'row',
    paddingBottom: SIZES.sm,
  },
  optionChip: {
    paddingHorizontal: SIZES.md,
    paddingVertical: SIZES.sm,
    borderRadius: SIZES.radiusFull,
    backgroundColor: COLORS.surface,
    borderWidth: 1,
    borderColor: COLORS.border,
    marginRight: SIZES.sm,
  },
  optionChipActive: {
    backgroundColor: COLORS.primary,
    borderColor: COLORS.primary,
  },
  optionChipText: {
    color: COLORS.text,
    fontSize: SIZES.fontMd,
  },
  optionChipTextActive: {
    color: COLORS.textInverse,
    fontWeight: '600',
  },
  bocaCard: {
    marginTop: SIZES.sm,
    backgroundColor: '#FFF7F3',
    borderRadius: SIZES.radiusLg,
    padding: SIZES.md,
    borderWidth: 1,
    borderColor: '#F0D6CD',
    ...SHADOWS.sm,
  },
  svgWrapper: {
    alignItems: 'center',
  },
  toothHint: {
    marginTop: SIZES.sm,
    textAlign: 'center',
    color: COLORS.textSecondary,
    fontSize: SIZES.fontSm,
  },
  localizacaoResumo: {
    marginTop: SIZES.sm,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#E8F5E9',
    borderRadius: SIZES.radiusMd,
    padding: SIZES.sm,
  },
  localizacaoResumoTexto: {
    flex: 1,
    marginLeft: SIZES.xs,
    color: COLORS.secondaryDark,
    fontSize: SIZES.fontSm,
    fontWeight: '600',
  },
  dorContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  dorButton: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: COLORS.surface,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  dorButtonActive: {
    backgroundColor: COLORS.primary,
    borderColor: COLORS.primary,
  },
  dorButtonHigh: {
    backgroundColor: COLORS.danger,
    borderColor: COLORS.danger,
  },
  dorButtonText: {
    fontSize: SIZES.fontSm,
    color: COLORS.text,
  },
  dorButtonTextActive: {
    color: COLORS.textInverse,
    fontWeight: 'bold',
  },
  dorLabels: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: SIZES.xs,
  },
  dorLabelText: {
    fontSize: SIZES.fontXs,
    color: COLORS.textSecondary,
  },
  dorValor: {
    color: COLORS.primary,
    fontWeight: 'bold',
  },
  textAreaWrapper: {
    height: 120,
    maxHeight: 120,
  },
  textArea: {
    flex: 1,
    backgroundColor: COLORS.surface,
    borderRadius: SIZES.radiusMd,
    padding: SIZES.md,
    fontSize: SIZES.fontMd,
    color: COLORS.text,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  fotoButtonsRow: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    marginVertical: SIZES.lg,
  },
  fotoButton: {
    alignItems: 'center',
    padding: SIZES.lg,
    backgroundColor: '#E3F2FD',
    borderRadius: SIZES.radiusMd,
    width: '45%',
  },
  fotoButtonText: {
    marginTop: SIZES.sm,
    color: COLORS.primary,
    fontWeight: '600',
  },
  imagensContainer: {
    marginBottom: SIZES.md,
  },
  imagensCount: {
    color: COLORS.textSecondary,
    marginBottom: SIZES.sm,
  },
  imagemWrapper: {
    position: 'relative',
    marginRight: SIZES.sm,
  },
  imagemPreview: {
    width: 100,
    height: 100,
    borderRadius: SIZES.radiusMd,
  },
  imagemRemove: {
    position: 'absolute',
    top: -10,
    right: -10,
    backgroundColor: COLORS.surface,
    borderRadius: 15,
  },
  dicasBox: {
    backgroundColor: '#E3F2FD',
    padding: SIZES.md,
    borderRadius: SIZES.radiusMd,
    marginBottom: SIZES.md,
  },
  dicasTitle: {
    fontWeight: 'bold',
    color: COLORS.primaryDark,
    marginBottom: SIZES.sm,
  },
  dicasItem: {
    color: COLORS.textSecondary,
    fontSize: SIZES.fontSm,
    marginTop: 2,
  },
  enviarButton: {
    backgroundColor: COLORS.secondary,
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    padding: SIZES.md,
    borderRadius: SIZES.radiusMd,
  },
  enviarButtonText: {
    color: COLORS.textInverse,
    fontSize: SIZES.fontLg,
    fontWeight: 'bold',
    marginLeft: SIZES.sm,
  },
  avisoLegal: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    backgroundColor: '#FFF3E0',
    padding: SIZES.md,
    borderRadius: SIZES.radiusMd,
    marginTop: SIZES.md,
    marginBottom: SIZES.xl,
  },
  avisoLegalText: {
    flex: 1,
    marginLeft: SIZES.sm,
    fontSize: SIZES.fontSm,
    color: '#E65100',
    lineHeight: 18,
  },
  // estilos para seleção de dentista
  campo: {
    marginTop: SIZES.md,
  },
  campoLabel: {
    fontSize: SIZES.fontMd,
    fontWeight: '600',
    color: COLORS.text,
    marginBottom: SIZES.xs,
  },
  selectButton: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: COLORS.surface,
    padding: SIZES.md,
    borderRadius: SIZES.radiusMd,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  selectText: {
    fontSize: SIZES.fontMd,
    color: COLORS.text,
  },
  selectPlaceholder: {
    color: COLORS.textSecondary,
  },
  // Submodal styles
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: Platform.OS === 'web' ? 'center' : 'flex-end',
    alignItems: Platform.OS === 'web' ? 'center' : 'stretch',
  },
  modalContent: {
    backgroundColor: COLORS.surface,
    borderTopLeftRadius: SIZES.radiusXl,
    borderTopRightRadius: SIZES.radiusXl,
    borderBottomLeftRadius: Platform.OS === 'web' ? SIZES.radiusXl : 0,
    borderBottomRightRadius: Platform.OS === 'web' ? SIZES.radiusXl : 0,
    maxHeight: '70%',
    width: Platform.OS === 'web' ? '100%' : undefined,
    maxWidth: Platform.OS === 'web' ? 500 : undefined,
    paddingBottom: Platform.OS === 'ios' ? 40 : SIZES.xl,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: SIZES.md,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.divider,
  },
  modalTitle: {
    fontSize: SIZES.fontLg,
    fontWeight: 'bold',
    color: COLORS.text,
  },
  dentistaSelectItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: SIZES.md,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.divider,
  },
  dentistaSelectInfo: {
    flex: 1,
  },
  dentistaSelectNome: {
    fontSize: SIZES.fontMd,
    fontWeight: '500',
    color: COLORS.text,
  },
  dentistaSelectEspecialidade: {
    fontSize: SIZES.fontSm,
    color: COLORS.textSecondary,
    marginTop: 2,
  },
  emptyContainer: {
    padding: SIZES.xl,
    alignItems: 'center',
  },
  emptyText: {
    color: COLORS.textSecondary,
    fontSize: SIZES.fontMd,
    textAlign: 'center',
  },
});

export default TriagemScreen;
