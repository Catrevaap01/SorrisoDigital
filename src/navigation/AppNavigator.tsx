import React, { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { Ionicons } from '@expo/vector-icons';

import { useAuth } from '../contexts/AuthContext';
import { COLORS } from '../styles/theme';
import { supabase, PROFILE_SCHEMA_FEATURES } from '../config/supabase';
import { contarMensagensNaoLidasTotalUsuario } from '../services/messagesService';
import { notifyNewMessage } from '../services/localNotificationService';
import {
  AuthStackParamList,
  DentistaStackParamList,
  DentistaTabParamList,
  PacienteStackParamList,
  PacienteTabParamList,
  RootStackParamList,
} from './types';

import LoginScreen from '../screens/auth/LoginScreen';
import RegisterScreen from '../screens/auth/RegisterScreen';
import ForgotPasswordScreen from '../screens/auth/ForgotPasswordScreen';
import ChangePasswordScreen from '../screens/auth/ChangePasswordScreen';

import HomeScreen from '../screens/paciente/HomeScreen';
import TriagemScreen from '../screens/paciente/TriagemScreen';
import HistoricoScreen from '../screens/paciente/HistoricoScreen';
import EducacaoScreen from '../screens/paciente/EducacaoScreen';
import AgendamentoScreen from '../screens/paciente/AgendamentoScreen';
import PerfilScreen from '../screens/paciente/PerfilScreen';
import MensagensScreen from '../screens/paciente/MensagensScreen';
import DentistasScreen from '../screens/paciente/DentistasScreen';

import DashboardScreen from '../screens/dentista/DashboardScreen';
import CasoDetalheScreen from '../screens/dentista/CasoDetalheScreen';
import DentistaMensagensScreen from '../screens/dentista/DentistaMensagensScreen';
import PacientesScreen from '../screens/dentista/PacientesScreen';
import AdminNavigator from './AdminNavigator';

let AgendaDentistaScreen: React.ComponentType<any>;
try {
  AgendaDentistaScreen = require('../screens/dentista/AgendaDentistaScreen').default;
} catch (e) {
  AgendaDentistaScreen = function AgendaFallback() {
    return (
      <View style={styles.center}>
        <Text>AgendaDentistaScreen nao encontrada.</Text>
      </View>
    );
  };
}

const AuthStack = createNativeStackNavigator<AuthStackParamList>();

// helper component to render auth screens

const PacienteTab = createBottomTabNavigator<PacienteTabParamList>();
const DentistaTab = createBottomTabNavigator<DentistaTabParamList>();
const PacienteStackNav = createNativeStackNavigator<PacienteStackParamList>();
const DentistaStackNav = createNativeStackNavigator<DentistaStackParamList>();
const Stack = createNativeStackNavigator<RootStackParamList>();

interface TabsProps {
  unreadCount: number;
}

const PacienteTabs: React.FC<TabsProps> = ({ unreadCount }) => (
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
          case 'Educação':
            iconName = focused ? 'book' : 'book-outline';
            break;
          case 'Histórico':
            iconName = focused ? 'time' : 'time-outline';
            break;
          case 'Mensagens':
            iconName = focused ? 'chatbubbles' : 'chatbubbles-outline';
            break;
          case 'Dentistas':
            iconName = focused ? 'people' : 'people-outline';
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
      tabBarBadge:
        route.name === 'Mensagens' && unreadCount > 0
          ? unreadCount > 99
            ? '99+'
            : unreadCount
          : undefined,
    })}
  >
    <PacienteTab.Screen name="Início" component={HomeScreen} options={{ title: 'TeOdonto Angola' }} />
    <PacienteTab.Screen name="Triagem" component={TriagemScreen} />
    <PacienteTab.Screen name="Educação" component={EducacaoScreen} options={{ title: 'Educação' }} />
    <PacienteTab.Screen name="Histórico" component={HistoricoScreen} options={{ title: 'Histórico' }} />
    <PacienteTab.Screen name="Mensagens" component={MensagensScreen} />
    <PacienteTab.Screen name="Dentistas" component={DentistasScreen} />
    <PacienteTab.Screen name="Perfil" component={PerfilScreen} />
  </PacienteTab.Navigator>
);

const DentistaTabs: React.FC<TabsProps> = ({ unreadCount }) => (
  <DentistaTab.Navigator
    id="DentistaTab"
    screenOptions={({ route }) => ({
      tabBarIcon: ({ focused, color, size }) => {
        let iconName = 'ellipse';
        switch (route.name) {
          case 'Dashboard':
            iconName = focused ? 'grid' : 'grid-outline';
            break;
          case 'Agenda':
            iconName = focused ? 'calendar' : 'calendar-outline';
            break;
          case 'Mensagens':
            iconName = focused ? 'chatbubbles' : 'chatbubbles-outline';
            break;
          case 'Pacientes':
            iconName = focused ? 'people' : 'people-outline';
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
      tabBarBadge:
        route.name === 'Mensagens' && unreadCount > 0
          ? unreadCount > 99
            ? '99+'
            : unreadCount
          : undefined,
    })}
  >
    <DentistaTab.Screen
      name="Dashboard"
      component={DashboardScreen}
      options={{ title: 'Painel do Dentista' }}
    />
    <DentistaTab.Screen name="Agenda" component={AgendaDentistaScreen} />
    <DentistaTab.Screen name="Mensagens" component={DentistaMensagensScreen} />
    <DentistaTab.Screen name="Pacientes" component={PacientesScreen} />
    <DentistaTab.Screen name="Perfil" component={PerfilScreen} />
  </DentistaTab.Navigator>
);

const PacienteStack: React.FC<TabsProps> = ({ unreadCount }) => (
  <PacienteStackNav.Navigator id="PacienteStack">
    <PacienteStackNav.Screen name="PacienteTabs" options={{ headerShown: false }}>
      {() => <PacienteTabs unreadCount={unreadCount} />}
    </PacienteStackNav.Screen>
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

const DentistaStack: React.FC<TabsProps> = ({ unreadCount }) => (
  <DentistaStackNav.Navigator id="DentistaStack">
    <DentistaStackNav.Screen name="DentistaTabs" options={{ headerShown: false }}>
      {() => <DentistaTabs unreadCount={unreadCount} />}
    </DentistaStackNav.Screen>
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

const AppNavigator: React.FC = () => {
  const { user, profile, initializing } = useAuth();
  const [unreadCount, setUnreadCount] = useState(0);

  const userId = user?.id;

  const refreshUnreadCount = useCallback(async () => {
    if (!userId) {
      setUnreadCount(0);
      return;
    }

    const result = await contarMensagensNaoLidasTotalUsuario(userId);
    if (result.success) {
      setUnreadCount(result.count || 0);
    }
  }, [userId]);

  useEffect(() => {
    if (!userId) {
      setUnreadCount(0);
      return;
    }

    refreshUnreadCount();

    const channel = supabase
      .channel(`messages-badge-${userId}`)
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'messages' },
        async (payload) => {
          const msg = payload.new as {
            conversation_id?: string;
            sender_id?: string;
            sender_name?: string;
            content?: string;
          };

          if (!msg?.conversation_id) {
            await refreshUnreadCount();
            return;
          }

          const { data: conversa } = await supabase
            .from('conversations')
            .select('participant_1_id, participant_2_id, participant_1_name, participant_2_name')
            .eq('id', msg.conversation_id)
            .single();

          const isForUser =
            conversa &&
            (conversa.participant_1_id === userId || conversa.participant_2_id === userId);

          if (isForUser && msg.sender_id !== userId) {
            const senderName =
              msg.sender_name ||
              (conversa.participant_1_id === msg.sender_id
                ? conversa.participant_1_name
                : conversa.participant_2_name) ||
              'Nova mensagem';

            await notifyNewMessage('Nova mensagem', `${senderName}: ${msg.content || ''}`);
          }

          await refreshUnreadCount();
        }
      )
      .on(
        'postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'messages' },
        async () => {
          await refreshUnreadCount();
        }
      )
      .subscribe();

    return () => {
      channel.unsubscribe();
    };
  }, [refreshUnreadCount, userId]);

  if (initializing) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color={COLORS.primary} />
      </View>
    );
  }

  const precisaMudarSenha =
    !!user &&
    !!profile &&
    (
      PROFILE_SCHEMA_FEATURES.hasSenhaAlterada
        ? !profile.senha_alterada
        : !!user.user_metadata?.force_password_change
    );

  return (
    <Stack.Navigator id="RootStack" screenOptions={{ headerShown: false }}>
      {!user ? (
        <>
          <Stack.Screen name="Login" component={LoginScreen} />
          <Stack.Screen name="Register" component={RegisterScreen} />
          <Stack.Screen name="ForgotPassword" component={ForgotPasswordScreen} />
        </>
      ) : precisaMudarSenha ? (
        <Stack.Screen name="ChangePassword" component={ChangePasswordScreen} />
      ) : profile?.tipo === 'admin' ? (
        <Stack.Screen name="AdminMain" component={AdminNavigator} />
      ) : profile?.tipo === 'dentista' ? (
        <Stack.Screen name="DentistaMain">
          {() => <DentistaStack unreadCount={unreadCount} />}
        </Stack.Screen>
      ) : (
        <Stack.Screen name="PacienteMain">
          {() => <PacienteStack unreadCount={unreadCount} />}
        </Stack.Screen>
      )}
    </Stack.Navigator>
  );
};

const styles = StyleSheet.create({
  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
});

export default AppNavigator;
