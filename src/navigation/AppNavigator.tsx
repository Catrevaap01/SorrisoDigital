/**
 * Configuração de navegação principal (stack + tabs).
 * Tipado utilizando as param lists definidas em ./types.ts
 */

import React from 'react';
import { ActivityIndicator, View, Text, StyleSheet } from 'react-native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { Ionicons } from '@expo/vector-icons';

import { useAuth } from '../contexts/AuthContext';
import { COLORS } from '../styles/theme';
import {
  AuthStackParamList,
  PacienteTabParamList,
  DentistaTabParamList,
  AdminTabParamList,
  PacienteStackParamList,
  DentistaStackParamList,
  AdminStackParamList,
  RootStackParamList,
} from './types';
import AdminNavigator from './AdminNavigator';

// telas de autenticação
import LoginScreen from '../screens/auth/LoginScreen';
import RegisterScreen from '../screens/auth/RegisterScreen';
import ChangePasswordScreen from '../screens/auth/ChangePasswordScreen';

// telas do paciente
import HomeScreen from '../screens/paciente/HomeScreen';
import TriagemScreen from '../screens/paciente/TriagemScreen';
import HistoricoScreen from '../screens/paciente/HistoricoScreen';
import EducacaoScreen from '../screens/paciente/EducacaoScreen';
import AgendamentoScreen from '../screens/paciente/AgendamentoScreen';
import PerfilScreen from '../screens/paciente/PerfilScreen';
import MensagensScreen from '../screens/paciente/MensagensScreen';

// telas do dentista
import DashboardScreen from '../screens/dentista/DashboardScreen';
import CasoDetalheScreen from '../screens/dentista/CasoDetalheScreen';
import DentistaMensagensScreen from '../screens/dentista/DentistaMensagensScreen';

// telas compartilhadas
import NotificacoesScreen from '../screens/shared/NotificacoesScreen';

// carregamento condicional de AgendaDentistaScreen
let AgendaDentistaScreen: React.ComponentType<any>;
try {
  // eslint-disable-next-line global-require
  AgendaDentistaScreen = require('../screens/dentista/AgendaDentistaScreen').default;
} catch (e) {
  AgendaDentistaScreen = function AgendaFallback() {
    return (
      <View style={styles.center}>
        <Text>AgendaDentistaScreen não encontrada. Crie src/screens/dentista/AgendaDentistaScreen.tsx</Text>
      </View>
    );
  };
}

const AuthStack = createNativeStackNavigator<AuthStackParamList>();
const PacienteTab = createBottomTabNavigator<PacienteTabParamList>();
const DentistaTab = createBottomTabNavigator<DentistaTabParamList>();
const AdminTab = createBottomTabNavigator<AdminTabParamList>();
const PacienteStackNav = createNativeStackNavigator<PacienteStackParamList>();
const DentistaStackNav = createNativeStackNavigator<DentistaStackParamList>();
const AdminStackNav = createNativeStackNavigator<AdminStackParamList>();
const Stack = createNativeStackNavigator<RootStackParamList>();

// Navigator de abas do paciente
const PacienteTabs: React.FC = () => (
  <PacienteTab.Navigator
    id="PacienteTab"
    screenOptions={({ route }) => ({
      tabBarIcon: ({ focused, color, size }) => {
        let iconName = 'ellipse';
        switch (route.name) {
          case 'Início':
            iconName = focused ? 'home' : 'home-outline';
            break;
          case 'Triagem':
            iconName = focused ? 'medical' : 'medical-outline';
            break;
          case 'Mensagens':
            iconName = focused ? 'chatbubbles' : 'chatbubbles-outline';
            break;
          case 'Notificações':
            iconName = focused ? 'notifications' : 'notifications-outline';
            break;
          case 'Educação':
            iconName = focused ? 'book' : 'book-outline';
            break;
          case 'Histórico':
            iconName = focused ? 'time' : 'time-outline';
            break;
          case 'Perfil':
            iconName = focused ? 'person' : 'person-outline';
            break;
        }
        return <Ionicons name={iconName as any} size={size} color={color} />;
      },
      tabBarActiveTintColor: COLORS.primary,
      tabBarInactiveTintColor: COLORS.textSecondary,
      headerStyle: { backgroundColor: COLORS.primary },
      headerTintColor: COLORS.textInverse,
      headerTitleStyle: { fontWeight: 'bold' },
    })}
  >
    <PacienteTab.Screen
      name="Início"
      component={HomeScreen}
      options={{ title: 'TeOdonto Angola' }}
    />
    <PacienteTab.Screen name="Triagem" component={TriagemScreen} />
    <PacienteTab.Screen name="Mensagens" component={MensagensScreen} />
    <PacienteTab.Screen name="Notificações" component={NotificacoesScreen} />
    <PacienteTab.Screen name="Educação" component={EducacaoScreen} />
    <PacienteTab.Screen name="Histórico" component={HistoricoScreen} />
    <PacienteTab.Screen name="Perfil" component={PerfilScreen} />
  </PacienteTab.Navigator>
);

// Navigator de abas do dentista
const DentistaTabs: React.FC = () => (
  <DentistaTab.Navigator
    id="DentistaTab"
    screenOptions={({ route }) => ({
      tabBarIcon: ({ focused, color, size }) => {
        let iconName = 'ellipse';
        switch (route.name) {
          case 'Dashboard':
            iconName = focused ? 'grid' : 'grid-outline';
            break;
          case 'Mensagens':
            iconName = focused ? 'chatbubbles' : 'chatbubbles-outline';
            break;
          case 'Notificações':
            iconName = focused ? 'notifications' : 'notifications-outline';
            break;
          case 'Agenda':
            iconName = focused ? 'calendar' : 'calendar-outline';
            break;
          case 'Perfil':
            iconName = focused ? 'person' : 'person-outline';
            break;
        }
        return <Ionicons name={iconName as any} size={size} color={color} />;
      },
      tabBarActiveTintColor: COLORS.secondary,
      tabBarInactiveTintColor: COLORS.textSecondary,
      headerStyle: { backgroundColor: COLORS.secondary },
      headerTintColor: COLORS.textInverse,
      headerTitleStyle: { fontWeight: 'bold' },
    })}
  >
    <DentistaTab.Screen
      name="Dashboard"
      component={DashboardScreen}
      options={{ title: 'Painel do Dentista' }}
    />
    <DentistaTab.Screen name="Mensagens" component={DentistaMensagensScreen} />
    <DentistaTab.Screen name="Notificações" component={NotificacoesScreen} />
    <DentistaTab.Screen name="Agenda" component={AgendaDentistaScreen} />
    <DentistaTab.Screen name="Perfil" component={PerfilScreen} />
  </DentistaTab.Navigator>
);

// Pilha de telas do paciente (inclui tabs + modais)
const PacienteStack: React.FC = () => (
  <PacienteStackNav.Navigator id="PacienteStack">
    <PacienteStackNav.Screen
      name="PacienteTabs"
      component={PacienteTabs}
      options={{ headerShown: false }}
    />
    <PacienteStackNav.Screen
      name="Agendamento"
      component={AgendamentoScreen}
      options={{
        title: 'Agendar Consulta',
        headerStyle: { backgroundColor: COLORS.primary },
        headerTintColor: COLORS.textInverse,
      }}
    />
  </PacienteStackNav.Navigator>
);

// Pilha de telas do dentista
const DentistaStack: React.FC = () => (
  <DentistaStackNav.Navigator id="DentistaStack">
    <DentistaStackNav.Screen
      name="DentistaTabs"
      component={DentistaTabs}
      options={{ headerShown: false }}
    />
    <DentistaStackNav.Screen
      name="CasoDetalhe"
      component={CasoDetalheScreen}
      options={{
        title: 'Detalhes do Caso',
        headerStyle: { backgroundColor: COLORS.secondary },
        headerTintColor: COLORS.textInverse,
      }}
    />
  </DentistaStackNav.Navigator>
);

// Navigator para o Admin
const AdminStack: React.FC = () => (
  <AdminStackNav.Navigator id="AdminStack">
    <AdminStackNav.Screen
      name="AdminMain"
      component={AdminNavigator}
      options={{
        headerShown: false,
      }}
    />
  </AdminStackNav.Navigator>
);

// Navegador principal que alterna entre autenticado e não autenticado
const AppNavigator: React.FC = () => {
  const { user, profile, initializing } = useAuth();

  if (initializing) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color={COLORS.primary} />
      </View>
    );
  }

  // Verificar se precisa alterar senha (primeira login)
  const precisaMudarSenha = user && profile && !profile.senha_alterada && profile.tipo !== 'paciente';

  return (
    <Stack.Navigator id="RootStack" screenOptions={{ headerShown: false }}>
      {!user ? (
        <>
          <Stack.Screen name="Login" component={LoginScreen} />
          <Stack.Screen name="Register" component={RegisterScreen} />
        </>
      ) : precisaMudarSenha ? (
        <Stack.Screen name="ChangePassword" component={ChangePasswordScreen} />
      ) : profile?.tipo === 'admin' ? (
        <Stack.Screen name="AdminMain" component={AdminStack} />
      ) : profile?.tipo === 'dentista' ? (
        <Stack.Screen name="DentistaMain" component={DentistaStack} />
      ) : (
        <Stack.Screen name="PacienteMain" component={PacienteStack} />
      )}
    </Stack.Navigator>
  );
};

const styles = StyleSheet.create({
  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
});

export default AppNavigator;
