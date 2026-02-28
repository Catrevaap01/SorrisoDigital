import React, { useState } from 'react';
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
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import Toast from 'react-native-toast-message';
import { useAuth } from '../../contexts/AuthContext';
import { criarTriagem } from '../../services/triagemService';
import { COLORS, SIZES, SHADOWS } from '../../styles/theme';
import { SINTOMAS, DURACAO_OPTIONS, LOCALIZACAO_DENTE } from '../../utils/constants';
import { BottomTabScreenProps } from '@react-navigation/bottom-tabs';
import { PacienteTabParamList } from '../../navigation/types';

type TriagemScreenProps = BottomTabScreenProps<PacienteTabParamList, 'Triagem'>;

const TriagemScreen: React.FC<TriagemScreenProps> = ({ navigation }) => {
  const { profile } = useAuth();
  const [etapa, setEtapa] = useState<number>(1);
  const [loading, setLoading] = useState<boolean>(false);
  
  // Dados da triagem
  const [sintomaPrincipal, setSintomaPrincipal] = useState<string>('');
  const [descricao, setDescricao] = useState<string>('');
  const [duracao, setDuracao] = useState<string>('');
  const [localizacao, setLocalizacao] = useState<string>('');
  const [intensidadeDor, setIntensidadeDor] = useState<number>(0);
  const [imagens, setImagens] = useState<string[]>([]);

  // Funções de câmera/galeria - CORRIGIDO
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
        mediaTypes: ImagePicker.MediaTypeOptions.Images as any,
        allowsEditing: true,
        aspect: [4, 3],
        quality: 0.7,
        videoMaxDuration: 0, // Apenas fotos
      });

      // Verifica se o usuário cancelou
      if (result.canceled) {
        return;
      }

      // Obtém a URI da imagem
      if (result.assets && result.assets[0]) {
        const uri = result.assets[0].uri;
        
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
        mediaTypes: ImagePicker.MediaTypeOptions.Images as any,
        allowsEditing: true,
        aspect: [4, 3],
        quality: 0.7,
        selectionLimit: 5 - imagens.length, // Permite selecionar múltiplas imagens
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

    const triagemData = {
      paciente_id: profile.id,
      sintoma_principal: sintomaPrincipal,
      descricao,
      duracao,
      localizacao,
      intensidade_dor: intensidadeDor,
    };

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
      <Text style={styles.fieldLabel}>Onde está o problema?</Text>
      <ScrollView horizontal showsHorizontalScrollIndicator={false}>
        <View style={styles.optionsRow}>
          {LOCALIZACAO_DENTE.map((loc) => (
            <TouchableOpacity
              key={loc.id}
              style={[
                styles.optionChip,
                localizacao === loc.id && styles.optionChipActive,
              ]}
              onPress={() => setLocalizacao(loc.id)}
            >
              <Text
                style={[
                  styles.optionChipText,
                  localizacao === loc.id && styles.optionChipTextActive,
                ]}
              >
                {loc.label}
              </Text>
            </TouchableOpacity>
          ))}
        </View>
      </ScrollView>

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
      <Text style={styles.fieldLabel}>Descreva melhor (opcional)</Text>
      <TextInput
        style={styles.textArea}
        placeholder="Ex: A dor piora quando como doce, sangra ao escovar..."
        placeholderTextColor={COLORS.textLight}
        value={descricao}
        onChangeText={setDescricao}
        multiline
        numberOfLines={4}
        textAlignVertical="top"
      />

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
    <ScrollView style={styles.container}>
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
  textArea: {
    backgroundColor: COLORS.surface,
    borderRadius: SIZES.radiusMd,
    padding: SIZES.md,
    fontSize: SIZES.fontMd,
    color: COLORS.text,
    minHeight: 100,
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
});

export default TriagemScreen;
