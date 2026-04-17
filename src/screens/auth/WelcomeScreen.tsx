import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet, StatusBar, ImageBackground } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { COLORS, SIZES, TYPOGRAPHY } from '../../styles/theme';

type RootStackParamList = {
  Login: undefined;
  Register: undefined;
};

type WelcomeScreenNavigationProp = NativeStackNavigationProp<RootStackParamList, 'Login'>;

const WelcomeScreen: React.FC = () => {
  const navigation = useNavigation<WelcomeScreenNavigationProp>();

  const handleGetStarted = () => {
    navigation.navigate('Login');
  };

  return (
    <ImageBackground
      source={require('../../../assets/welcome_bg.png')}
      style={styles.background}
      resizeMode="cover"
    >
      <View style={styles.overlay} />
      <View style={styles.container}>
        <StatusBar barStyle="light-content" backgroundColor="transparent" translucent />
        
        {/* Logo e Título */}
        <View style={styles.header}>
          <View style={styles.logoContainer}>
            <Ionicons name="medical" size={80} color={COLORS.textInverse} />
          </View>
          <Text style={styles.title}>Sorriso Digital</Text>
          <Text style={styles.subtitle}>Clínica Odontológica de Excelência</Text>
        </View>

        {/* Conteúdo Principal */}
        <View style={styles.content}>
          <Text style={styles.welcomeText}>Bem-vindo à sua clínica digital</Text>
          <Text style={styles.description}>
            Gerencie seus agendamentos, tratamentos e finanças de forma simples e eficiente.
          </Text>
        </View>

        {/* Botão Central */}
        <View style={styles.buttonContainer}>
          <TouchableOpacity 
            style={styles.getStartedButton} 
            onPress={handleGetStarted}
            activeOpacity={0.8}
          >
            <Text style={styles.getStartedButtonText}>Começar</Text>
            <Ionicons name="arrow-forward" size={24} color={COLORS.primary} style={{ marginLeft: 8 }} />
          </TouchableOpacity>
        </View>

        {/* Footer */}
        <View style={styles.footer}>
          <Text style={styles.footerText}>© 2026 Sorriso Digital</Text>
          <Text style={styles.footerText}>Todos os direitos reservados</Text>
        </View>
      </View>
    </ImageBackground>
  );
};

const styles = StyleSheet.create({
  background: {
    flex: 1,
    width: '100%',
    height: '100%',
  },
  overlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(51, 65, 85, 0.75)', // Slate-700 desaturated (cor morta)
  },
  container: {
    flex: 1,
    justifyContent: 'space-between',
    paddingHorizontal: SIZES.xl,
    paddingTop: SIZES.xxl,
    paddingBottom: SIZES.xl,
  },
  header: {
    alignItems: 'center',
    marginTop: SIZES.xxl,
    backgroundColor: 'rgba(255, 255, 255, 0.1)', // Glass effect
    padding: SIZES.xl,
    borderRadius: 24,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.2)',
  },
  logoContainer: {
    width: 100,
    height: 100,
    borderRadius: 50,
    backgroundColor: 'rgba(255, 255, 255, 0.15)',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: SIZES.lg,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.3)',
  },
  title: {
    fontSize: TYPOGRAPHY.sizes.h1,
    fontWeight: TYPOGRAPHY.weights.bold,
    color: COLORS.textInverse,
    textAlign: 'center',
    marginBottom: SIZES.sm,
  },
  subtitle: {
    fontSize: TYPOGRAPHY.sizes.body,
    color: COLORS.textInverse,
    opacity: 0.8,
    textAlign: 'center',
  },
  content: {
    backgroundColor: 'rgba(255, 255, 255, 0.05)', // Subtle glass for content
    padding: SIZES.xl,
    borderRadius: 24,
    marginVertical: SIZES.xl,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.1)',
    alignItems: 'center',
  },
  welcomeText: {
    fontSize: TYPOGRAPHY.sizes.h2,
    fontWeight: TYPOGRAPHY.weights.bold,
    color: COLORS.textInverse,
    textAlign: 'center',
    marginBottom: SIZES.md,
  },
  description: {
    fontSize: TYPOGRAPHY.sizes.body,
    color: COLORS.textInverse,
    opacity: 0.8,
    textAlign: 'center',
    lineHeight: 24,
  },
  buttonContainer: {
    alignItems: 'center',
    marginBottom: SIZES.xl,
  },
  getStartedButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.9)', // Glassy white
    paddingHorizontal: SIZES.xl,
    paddingVertical: SIZES.md,
    borderRadius: 50,
    minWidth: 200,
    justifyContent: 'center',
    elevation: 8,
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 4,
    },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.5)',
  },
  getStartedButtonText: {
    fontSize: TYPOGRAPHY.sizes.body,
    fontWeight: TYPOGRAPHY.weights.bold,
    color: '#1e293b', // Slate-800
    marginLeft: SIZES.sm,
  },
  footer: {
    alignItems: 'center',
  },
  footerText: {
    fontSize: TYPOGRAPHY.sizes.small,
    color: COLORS.textInverse,
    opacity: 0.6,
    textAlign: 'center',
  },
});

export default WelcomeScreen;
