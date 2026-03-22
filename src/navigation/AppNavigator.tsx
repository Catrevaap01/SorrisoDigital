import React, { useCallback, useEffect, useState } from 'react';
import { 
  ActivityIndicator as _ActivityIndicator, 
  StyleSheet, 
  Text, 
  View, 
  Pressable,
  Platform,
} from 'react-native';

const ActivityIndicator: React.ComponentType<any> = _ActivityIndicator || (() => null);
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
import ChangePasswordScreen from '../screens/auth/ChangePasswordScreen';
import ForgotPasswordScreen from '../screens/auth/ForgotPasswordScreen';

import HomeScreen from '../screens/paciente/HomeScreen';
import TriagemScreen from '../screens/paciente/TriagemScreen';
import HistoricoScreen from '../screens/paciente/HistoricoScreen';
import EducacaoScreen from '../screens/paciente/EducacaoScreen';
import AgendamentoScreen from '../screens/paciente/AgendamentoScreen';
import ChooseDentistaScreen from '../screens/paciente/ChooseDentistaScreen';
import PerfilScreen from '../screens/paciente/PerfilScreen';
import MensagensScreen from '../screens/paciente/MensagensScreen';

import DashboardScreen from '../screens/dentista/DashboardScreen';
import DentistaRelatorioScreen from '../screens/dentista/DentistaRelatorioScreen';
import CasoDetalheScreen from '../screens/dentista/CasoDetalheScreen';
import PacienteHistoricoScreen from '../screens/dentista/PacienteHistoricoScreen';
import DentistaMensagensScreen from '../screens/dentista/DentistaMensagensScreen';
import NovoPacienteScreen from '../screens/dentista/NovoPacienteScreen';
import GerirPacientesScreen from '../screens/dentista/GerirPacientesScreen';
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

// navigation for authentication (login/signup/forgot etc)

const PacienteTab = createBottomTabNavigator<PacienteTabParamList>();
const DentistaTab = createBottomTabNavigator<DentistaTabParamList>();
const PacienteStackNav = createNativeStackNavigator<PacienteStackParamList>();
const DentistaStackNav = createNativeStackNavigator<DentistaStackParamList>();
const Stack = createNativeStackNavigator<RootStackParamList>();

interface TabsProps {
  unreadCount: number;
  role?: string;
}

const PacienteTabs: React.FC<TabsProps> = ({ unreadCount }) => (
  <PacienteTab.Navigator
    id="PacienteTab"
    screenOptions={({ route, navigation }) => ({
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
          case 'Perfil':
            iconName = focused ? 'person' : 'person-outline';
            break;
        }
        return <Ionicons name={iconName as any} size={size} color={color} />;
      },
      tabBarBadge: (() => {
        const state = navigation.getState();
        const activeRouteName = state.routes[state.index]?.name;
        const isActiveMensagens = route.name === 'Mensagens' && activeRouteName === 'Mensagens';

        return route.name === 'Mensagens' && !isActiveMensagens && unreadCount > 0
          ? unreadCount > 99
            ? '99+'
            : unreadCount
          : undefined;
      })(),
      tabBarActiveTintColor: COLORS.primary,
      tabBarInactiveTintColor: COLORS.textSecondary,
      tabBarHideOnKeyboard: true,
      headerStyle: { backgroundColor: COLORS.primary },
      headerTintColor: COLORS.textInverse,
      headerTitleStyle: { fontWeight: 'bold' },
      tabBarStyle: Platform.OS === 'web' ? {
        maxWidth: 800,
        width: '100%',
        alignSelf: 'center',
        borderTopWidth: 1,
        borderTopColor: COLORS.divider,
        backgroundColor: COLORS.surface,
        position: 'absolute',
        bottom: 0,
        left: '50%',
        marginLeft: -400,
        height: 60,
      } : { height: 60 },
    })}
  >
    <PacienteTab.Screen name="Início" component={HomeScreen} options={{ title: 'Odontologia Angola' }} />
    <PacienteTab.Screen name="Triagem" component={TriagemScreen} />
    <PacienteTab.Screen name="Educação" component={EducacaoScreen} options={{ title: 'Educação' }} />
    <PacienteTab.Screen name="Histórico" component={HistoricoScreen} options={{ title: 'Histórico' }} />
    <PacienteTab.Screen name="Mensagens" component={MensagensScreen} />
    <PacienteTab.Screen name="Perfil" component={PerfilScreen} />
  </PacienteTab.Navigator>
);

const DentistaTabs: React.FC<TabsProps> = ({ unreadCount }) => (
  <DentistaTab.Navigator
    id="DentistaTab"
    screenOptions={({ route, navigation }) => ({
      tabBarIcon: ({ focused, color, size }) => {
        let iconName = 'ellipse';
        switch (route.name) {
          case 'Dashboard':
            iconName = focused ? 'grid' : 'grid-outline';
            break;
          case 'Agenda':
            iconName = focused ? 'calendar' : 'calendar-outline';
            break;
          case 'Pacientes':
            iconName = focused ? 'people' : 'people-outline';
            break;
          case 'Relatorio':
            iconName = focused ? 'document-text' : 'document-text-outline';
            break;
          case 'Mensagens':
            iconName = focused ? 'chatbubbles' : 'chatbubbles-outline';
            break;
          case 'Perfil':
            iconName = focused ? 'person' : 'person-outline';
            break;
        }
        return <Ionicons name={iconName as any} size={size} color={color} />;
      },
      tabBarBadge: (() => {
        const state = navigation.getState();
        const activeRouteName = state.routes[state.index]?.name;
        const isActiveMensagens = route.name === 'Mensagens' && activeRouteName === 'Mensagens';

        return route.name === 'Mensagens' && !isActiveMensagens && unreadCount > 0
          ? unreadCount > 99
            ? '99+'
            : unreadCount
          : undefined;
      })(),
      tabBarActiveTintColor: COLORS.secondary,
      tabBarInactiveTintColor: COLORS.textSecondary,
      tabBarHideOnKeyboard: true,
      headerStyle: { backgroundColor: COLORS.secondary },
      headerTintColor: COLORS.textInverse,
      headerTitleStyle: { fontWeight: 'bold' },
      tabBarStyle: Platform.OS === 'web' ? {
        maxWidth: 800,
        width: '100%',
        alignSelf: 'center',
        borderTopWidth: 1,
        borderTopColor: COLORS.divider,
        backgroundColor: COLORS.surface,
        position: 'absolute',
        bottom: 0,
        left: '50%',
        marginLeft: -400,
        height: 60,
      } : { height: 60 },
    })}
  >
    <DentistaTab.Screen
      name="Dashboard"
      component={DashboardScreen}
      options={{ title: 'Painel do Dentista' }}
    />
    <DentistaTab.Screen name="Agenda" component={AgendaDentistaScreen} />
    <DentistaTab.Screen
      name="Pacientes"
      component={GerirPacientesScreen}
      options={({ navigation }) => ({ 
        title: 'Acompanhamento',
        headerLeft: () => (
          <Pressable 
            onPress={() => navigation.navigate('Dashboard')}
            style={{ marginLeft: 16 }}
          >
            <Ionicons name="arrow-back" size={24} color={COLORS.textInverse} />
          </Pressable>
        )
      })}
    />
    <DentistaTab.Screen name="Relatorio" component={DentistaRelatorioScreen} options={{ title: 'Relatórios' }} />
    <DentistaTab.Screen name="Mensagens" component={DentistaMensagensScreen} />
    <DentistaTab.Screen name="Perfil" component={PerfilScreen} />
  </DentistaTab.Navigator>
);

const PacienteStack: React.FC<TabsProps> = ({ unreadCount, role }) => {
  if (role !== 'paciente') return null;
  return (
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
      <PacienteStackNav.Screen
        name="ChooseDentista"
        component={ChooseDentistaScreen}
        options={{
          title: 'Escolher Dentista',
          headerStyle: { backgroundColor: COLORS.primary },
          headerTintColor: COLORS.textInverse,
        }}
      />
      <PacienteStackNav.Screen
        name="Settings"
        component={require('../screens/paciente/SettingsScreen').default}
        options={{
          title: 'Configurações',
          headerStyle: { backgroundColor: COLORS.primary },
          headerTintColor: COLORS.textInverse,
        }}
      />
      <PacienteStackNav.Screen
        name="Notificacoes"
        component={require('../screens/paciente/NotificacoesScreen').default}
        options={{
          title: 'Notificações',
          headerStyle: { backgroundColor: COLORS.primary },
          headerTintColor: COLORS.textInverse,
        }}
      />
      <PacienteStackNav.Screen
        name="NotificacoesDetalhe"
        component={require('../screens/paciente/NotificacoesDetalheScreen').default}
        options={{
          title: 'Minhas Notificações',
          headerStyle: { backgroundColor: COLORS.primary },
          headerTintColor: COLORS.textInverse,
        }}
      />
      <PacienteStackNav.Screen
        name="Privacidade"
        component={require('../screens/paciente/PrivacidadeScreen').default}
        options={{
          title: 'Privacidade',
          headerStyle: { backgroundColor: COLORS.primary },
          headerTintColor: COLORS.textInverse,
        }}
      />
      <PacienteStackNav.Screen
        name="TermosUso"
        component={require('../screens/paciente/TermosUsoScreen').default}
        options={{
          title: 'Termos de Uso',
          headerStyle: { backgroundColor: COLORS.primary },
          headerTintColor: COLORS.textInverse,
        }}
      />
      <PacienteStackNav.Screen
        name="Ajuda"
        component={require('../screens/paciente/AjudaScreen').default}
        options={{
          title: 'Ajuda',
          headerStyle: { backgroundColor: COLORS.primary },
          headerTintColor: COLORS.textInverse,
        }}
      />
    </PacienteStackNav.Navigator>
  );
};

const DentistaStack: React.FC<TabsProps> = ({ unreadCount, role }) => {
  if (role !== 'dentista') return null;
  return (
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
      <DentistaStackNav.Screen
        name="PacienteHistorico"
        component={PacienteHistoricoScreen}
        options={{
          title: 'Histórico do Paciente',
          headerStyle: { backgroundColor: COLORS.secondary },
          headerTintColor: COLORS.textInverse,
        }}
      />

      <DentistaStackNav.Screen
        name="CadastrarPaciente"
        component={NovoPacienteScreen}
        options={{
          title: 'Cadastrar Paciente',
          headerStyle: { backgroundColor: COLORS.secondary },
          headerTintColor: COLORS.textInverse,
        }}
      />


      <DentistaStackNav.Screen
        name="Settings"
        component={require('../screens/paciente/SettingsScreen').default}
        options={{
          title: 'Configurações',
          headerStyle: { backgroundColor: COLORS.secondary },
          headerTintColor: COLORS.textInverse,
        }}
      />
      <DentistaStackNav.Screen
        name="Notificacoes"
        component={require('../screens/paciente/NotificacoesScreen').default}
        options={{
          title: 'Notificações',
          headerStyle: { backgroundColor: COLORS.secondary },
          headerTintColor: COLORS.textInverse,
        }}
      />
      <DentistaStackNav.Screen
        name="NotificacoesDetalhe"
        component={require('../screens/paciente/NotificacoesDetalheScreen').default}
        options={{
          title: 'Minhas Notificações',
          headerStyle: { backgroundColor: COLORS.secondary },
          headerTintColor: COLORS.textInverse,
        }}
      />
      <DentistaStackNav.Screen
        name="Privacidade"
        component={require('../screens/paciente/PrivacidadeScreen').default}
        options={{
          title: 'Privacidade',
          headerStyle: { backgroundColor: COLORS.secondary },
          headerTintColor: COLORS.textInverse,
        }}
      />
      <DentistaStackNav.Screen
        name="TermosUso"
        component={require('../screens/paciente/TermosUsoScreen').default}
        options={{
          title: 'Termos de Uso',
          headerStyle: { backgroundColor: COLORS.secondary },
          headerTintColor: COLORS.textInverse,
        }}
      />
      <DentistaStackNav.Screen
        name="Ajuda"
        component={require('../screens/paciente/AjudaScreen').default}
        options={{
          title: 'Ajuda',
          headerStyle: { backgroundColor: COLORS.secondary },
          headerTintColor: COLORS.textInverse,
        }}
      />
    </DentistaStackNav.Navigator>
  );
};


// helper registration for components that need to force-refresh badge
let refreshUnreadCallback: (() => void) | null = null;
let adjustUnreadCountCallback: ((delta: number) => void) | null = null;
let markUnreadSeenCallback: (() => void) | null = null;
export const registerUnreadRefresh = (cb: () => void) => {
  refreshUnreadCallback = cb;
};
export const registerUnreadAdjust = (cb: (delta: number) => void) => {
  adjustUnreadCountCallback = cb;
};
export const registerUnreadSeen = (cb: () => void) => {
  markUnreadSeenCallback = cb;
};
export const triggerUnreadRefresh = () => {
  if (refreshUnreadCallback) {
    refreshUnreadCallback();
  }
};
export const adjustUnreadCount = (delta: number) => {
  if (adjustUnreadCountCallback && delta !== 0) {
    adjustUnreadCountCallback(delta);
  }
};
export const markUnreadAsSeen = () => {
  if (markUnreadSeenCallback) {
    markUnreadSeenCallback();
  }
};

const AppNavigator: React.FC = () => {
  const { user, profile, initializing, loading } = useAuth();
  const [unreadCount, setUnreadCount] = useState(0);
  const unreadSuppressedRef = React.useRef(false);

  const userId = user?.id;

  const refreshUnreadCount = useCallback(async () => {
    if (!userId) {
      setUnreadCount(0);
      unreadSuppressedRef.current = false;
      return;
    }

    const result = await contarMensagensNaoLidasTotalUsuario(userId);
    if (result.success) {
      if (result.count && result.count > 0) {
        console.log('📊 Unread check:', result.count);
      }
      if (result.count && result.count > 0 && (result as any).data) {
        const unreadConvs = (result as any).data.map((m: any) => m.conversation_id);
        console.log('📍 Unread messages in conversations:', [...new Set(unreadConvs)]);
      }
      if ((result.count || 0) === 0) {
        unreadSuppressedRef.current = false;
      }
      setUnreadCount(unreadSuppressedRef.current ? 0 : (result.count || 0));
    }
  }, [userId]);

  useEffect(() => {
    if (!userId) {
      setUnreadCount(0);
      return;
    }

    // allow other components to manually trigger this same logic
    registerUnreadRefresh(refreshUnreadCount);
    registerUnreadAdjust((delta: number) => {
      setUnreadCount((prev) => Math.max(0, prev + delta));
    });
    registerUnreadSeen(() => {
      unreadSuppressedRef.current = true;
      setUnreadCount(0);
    });

    refreshUnreadCount();

    const channel = supabase
      .channel('messages-realtime-badge')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'messages' },
        async (payload) => {
          console.log('🔔 Mensagem alterada:', payload.eventType);
          if (payload.eventType === 'INSERT') {
            unreadSuppressedRef.current = false;
          }
          // Reduzido para 300ms para resposta mais rápida
          setTimeout(async () => {
            await refreshUnreadCount();
            console.log('✅ Contador atualizado via realtime');
          }, 300);
        }
      )
      .subscribe();

    // Aumentado polling para a cada 3 segundos para consistência absoluta
    const interval = setInterval(async () => {
      await refreshUnreadCount();
    }, 3000);

    return () => {
      channel.unsubscribe();
      clearInterval(interval);
    };
  }, [refreshUnreadCount, userId]);

  if (initializing) {
    return (
      <View style={[styles.center, { backgroundColor: '#EEF2F6' }]}>
        <ActivityIndicator size="large" color={COLORS.primary} />
      </View>
    );
  }

  // Aguarda carregamento do perfil apenas enquanto AuthContext ainda processa.
  // Se profile falhar (RLS/schema), seguimos com fallback por metadata para
  // evitar spinner infinito.
  if (user && !profile && loading) {
    return (
      <View style={[styles.center, { backgroundColor: '#EEF2F6' }]}>
        <ActivityIndicator size="large" color={COLORS.primary} />
      </View>
    );
  }

  const currentRole =
    (profile?.tipo ||
      (user?.user_metadata?.tipo as string | undefined) ||
      'paciente') as 'admin' | 'dentista' | 'paciente';

  const precisaMudarSenha =
    !!user &&
    (
      PROFILE_SCHEMA_FEATURES.hasSenhaAlterada
        ? !!profile && !profile.senha_alterada
        : !!user.user_metadata?.force_password_change
    );

  // pacientes que ainda não preencheram dados básicos (telefone/provincia)
  const needsProfileCompletion = (prof: any | null): boolean => {
    if (!prof || prof.tipo !== 'paciente') return false;
    // we treat nome as already provided at signup, so only check telefone/provincia
    return !prof.telefone || !prof.provincia;
  };

  return (
    <Stack.Navigator id="RootStack" screenOptions={{ headerShown: false }}>
      {!user ? (
        <>
          <Stack.Screen name="Login" component={LoginScreen} />
          <Stack.Screen name="Register" component={RegisterScreen} />
          <Stack.Screen
            name="ForgotPassword"
            component={ForgotPasswordScreen}
            options={{ title: 'Recuperar senha' }}
          />
        </>
      ) : precisaMudarSenha ? (
        <Stack.Screen name="ChangePassword" component={ChangePasswordScreen} />
      ) : currentRole === 'admin' ? (
        <Stack.Screen name="AdminMain" component={AdminNavigator} />
      ) : currentRole === 'dentista' ? (
        <Stack.Screen name="DentistaMain">
          {() => <DentistaStack unreadCount={unreadCount} role={currentRole} />}
        </Stack.Screen>
      ) : currentRole === 'paciente' && needsProfileCompletion(profile) ? (
        <Stack.Screen
          name="CompleteProfile"
          component={PerfilScreen}
          options={{ headerShown: false }}
          initialParams={{ forceEdit: true }}
        />
      ) : (
        <Stack.Screen name="PacienteMain">
          {() => <PacienteStack unreadCount={unreadCount} role={currentRole} />}
        </Stack.Screen>
      )}

      <Stack.Screen
        name="CadastrarPaciente"
        component={NovoPacienteScreen}
        options={{
          headerShown: true,
          title: 'Cadastrar Paciente',
          headerStyle: { backgroundColor: COLORS.secondary },
          headerTintColor: COLORS.textInverse,
        }}
      />
    </Stack.Navigator>
  );
};

const styles = StyleSheet.create({
  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
});

export default AppNavigator;
