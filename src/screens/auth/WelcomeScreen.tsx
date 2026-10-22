import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  StatusBar,
  ScrollView,
  SafeAreaView,
  Animated,
  Platform,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { COLORS, SIZES, TYPOGRAPHY } from '../../styles/theme';

type RootStackParamList = {
  Login: undefined;
  Register: undefined;
};

type WelcomeScreenNavigationProp = NativeStackNavigationProp<RootStackParamList, 'Login'>;

// 5 Fotografias reais da clínica fornecidas pelo utilizador
const SLIDES = [
  {
    image: require('../../../assets/welcome_slide_1.jpg'),
    tag: 'Clínica One Smile',
    title: 'Sorriso Digital',
    subtitle: 'Estrutura Moderna no Coração de Angola',
  },
  {
    image: require('../../../assets/welcome_slide_2.png'),
    tag: 'Atendimento & Recepção',
    title: 'Cuidado & Pontualidade',
    subtitle: 'Ambiente acolhedor e marcações eficientes',
  },
  {
    image: require('../../../assets/welcome_slide_3.png'),
    tag: 'Corpo Clínico Certificado',
    title: 'Excelência & Rigor',
    subtitle: 'Profissionais dedicados ao seu sorriso',
  },
  {
    image: require('../../../assets/welcome_slide_4.png'),
    tag: 'Sala de Espera Climatizada',
    title: 'Conforto & Bem-Estar',
    subtitle: 'Espaço pensado para a sua máxima tranquilidade',
  },
  {
    image: require('../../../assets/welcome_slide_5.png'),
    tag: 'Consultório Avançado',
    title: 'Tecnologia Odontológica',
    subtitle: 'Equipamentos modernos para diagnósticos precisos',
  },
];

const ROTATION_INTERVAL_MS = 10000; // 10 segundos por imagem conforme pedido

const WelcomeScreen: React.FC = () => {
  const navigation = useNavigation<WelcomeScreenNavigationProp>();
  const [activeIndex, setActiveIndex] = useState(0);

  // Valores animados de opacidade para cada um dos 5 slides (cross-fade suave)
  const opacityAnims = useRef(
    SLIDES.map((_, i) => new Animated.Value(i === 0 ? 1 : 0))
  ).current;

  // Troca de imagem automática a cada 10 segundos
  useEffect(() => {
    const timer = setInterval(() => {
      setActiveIndex((prev) => (prev + 1) % SLIDES.length);
    }, ROTATION_INTERVAL_MS);

    return () => clearInterval(timer);
  }, []);

  // Transição animada de fade cruzado quando activeIndex muda
  useEffect(() => {
    const animations = SLIDES.map((_, idx) => {
      return Animated.timing(opacityAnims[idx], {
        toValue: idx === activeIndex ? 1 : 0,
        duration: 900,
        useNativeDriver: Platform.OS !== 'web',
      });
    });

    Animated.parallel(animations).start();
  }, [activeIndex, opacityAnims]);

  const handleGetStarted = () => {
    navigation.navigate('Login');
  };

  const handleSelectSlide = (idx: number) => {
    setActiveIndex(idx);
  };

  const currentSlide = SLIDES[activeIndex];

  return (
    <View style={styles.containerRoot}>
      <StatusBar barStyle="light-content" backgroundColor="transparent" translucent />

      {/* Camada das Imagens de Fundo com Transição de 10s */}
      {SLIDES.map((slide, idx) => (
        <Animated.Image
          key={idx}
          source={slide.image}
          style={[styles.bgImage, { opacity: opacityAnims[idx] }]}
          resizeMode="cover"
        />
      ))}

      {/* Overlay com gradiente escuro/elegante para garantir legibilidade dos textos */}
      <View style={styles.overlay} />

      <SafeAreaView style={{ flex: 1 }}>
        <ScrollView
          contentContainerStyle={styles.container}
          showsVerticalScrollIndicator={false}
          bounces={false}
        >
          {/* Header Superior com Tag da Foto Actual */}
          <View style={styles.header}>
            <View style={styles.logoBadge}>
              <Ionicons name="medical" size={32} color="#fff" />
            </View>

            <View style={styles.facilityTag}>
              <Ionicons name="location-sharp" size={14} color="#38BDF8" />
              <Text style={styles.facilityTagText}>{currentSlide.tag}</Text>
            </View>

            <Text style={styles.title}>{currentSlide.title}</Text>
            <Text style={styles.subtitle}>{currentSlide.subtitle}</Text>
          </View>

          {/* Cartão Central */}
          <View style={styles.contentCard}>
            <Text style={styles.welcomeText}>Bem-vindo à sua clínica digital</Text>
            <Text style={styles.description}>
              Gerencie seus agendamentos, tratamentos e consultas odontológicas com total segurança e comodidade.
            </Text>

            {/* Indicadores de Slide (5 bolinhas com largura activa) */}
            <View style={styles.indicatorsContainer}>
              {SLIDES.map((_, idx) => (
                <TouchableOpacity
                  key={idx}
                  onPress={() => handleSelectSlide(idx)}
                  hitSlop={{ top: 10, bottom: 10, left: 6, right: 6 }}
                  style={[
                    styles.indicatorDot,
                    idx === activeIndex ? styles.indicatorDotActive : styles.indicatorDotInactive,
                  ]}
                />
              ))}
            </View>
          </View>

          {/* Botão de Acesso */}
          <View style={styles.buttonContainer}>
            <TouchableOpacity
              style={styles.getStartedButton}
              onPress={handleGetStarted}
              activeOpacity={0.85}
            >
              <Text style={styles.getStartedButtonText}>Começar</Text>
              <Ionicons name="arrow-forward" size={22} color={COLORS.primary} style={{ marginLeft: 8 }} />
            </TouchableOpacity>
          </View>

          {/* Rodapé com Direitos Reservados */}
          <View style={styles.footer}>
            <Text style={styles.footerText}>© 2026 Sorriso Digital • TeOdonto Angola</Text>
            <Text style={styles.footerSubtext}>Todos os direitos reservados</Text>
          </View>
        </ScrollView>
      </SafeAreaView>
    </View>
  );
};

const styles = StyleSheet.create({
  containerRoot: {
    flex: 1,
    backgroundColor: '#0F172A',
  },
  bgImage: {
    ...StyleSheet.absoluteFillObject,
    width: '100%',
    height: '100%',
  },
  overlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(15, 23, 42, 0.72)', // Slate escuro sofisticado com transparência perfeita
  },
  container: {
    flexGrow: 1,
    justifyContent: 'space-between',
    paddingHorizontal: SIZES.lg,
    paddingTop: Platform.OS === 'web' ? 40 : 60,
    paddingBottom: 30,
    minHeight: '100%',
  },
  header: {
    alignItems: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    paddingVertical: 24,
    paddingHorizontal: 20,
    borderRadius: 24,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.2)',
  },
  logoBadge: {
    width: 68,
    height: 68,
    borderRadius: 34,
    backgroundColor: 'rgba(255, 255, 255, 0.18)',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 14,
    borderWidth: 1.5,
    borderColor: 'rgba(255, 255, 255, 0.4)',
  },
  facilityTag: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: 'rgba(14, 165, 233, 0.25)',
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: 'rgba(56, 189, 248, 0.4)',
    marginBottom: 10,
  },
  facilityTagText: {
    color: '#E0F2FE',
    fontSize: 12,
    fontWeight: '700',
    letterSpacing: 0.4,
  },
  title: {
    fontSize: 28,
    fontWeight: '800',
    color: '#FFFFFF',
    textAlign: 'center',
    marginBottom: 4,
    letterSpacing: 0.5,
  },
  subtitle: {
    fontSize: 14,
    color: 'rgba(255, 255, 255, 0.85)',
    textAlign: 'center',
    fontWeight: '500',
  },
  contentCard: {
    backgroundColor: 'rgba(255, 255, 255, 0.08)',
    paddingVertical: 24,
    paddingHorizontal: 20,
    borderRadius: 24,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.15)',
    alignItems: 'center',
    marginVertical: 20,
  },
  welcomeText: {
    fontSize: 20,
    fontWeight: '700',
    color: '#FFFFFF',
    textAlign: 'center',
    marginBottom: 10,
  },
  description: {
    fontSize: 14,
    color: 'rgba(255, 255, 255, 0.8)',
    textAlign: 'center',
    lineHeight: 22,
    marginBottom: 18,
  },
  indicatorsContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    marginTop: 4,
  },
  indicatorDot: {
    height: 6,
    borderRadius: 3,
  },
  indicatorDotActive: {
    width: 28,
    backgroundColor: '#38BDF8',
  },
  indicatorDotInactive: {
    width: 8,
    backgroundColor: 'rgba(255, 255, 255, 0.35)',
  },
  buttonContainer: {
    alignItems: 'center',
    marginVertical: 10,
  },
  getStartedButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    paddingHorizontal: 36,
    paddingVertical: 16,
    borderRadius: 50,
    minWidth: 220,
    justifyContent: 'center',
    elevation: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 10,
  },
  getStartedButtonText: {
    fontSize: 16,
    fontWeight: '800',
    color: '#0F172A',
    letterSpacing: 0.5,
  },
  footer: {
    alignItems: 'center',
    marginTop: 10,
  },
  footerText: {
    fontSize: 12,
    color: 'rgba(255, 255, 255, 0.7)',
    textAlign: 'center',
    fontWeight: '500',
  },
  footerSubtext: {
    fontSize: 11,
    color: 'rgba(255, 255, 255, 0.45)',
    textAlign: 'center',
    marginTop: 2,
  },
});

export default WelcomeScreen;
