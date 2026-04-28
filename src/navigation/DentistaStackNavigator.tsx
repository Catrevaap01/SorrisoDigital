import React from 'react';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { COLORS } from '../styles/theme';
import { DentistaStackParamList } from './types';

import { DentistaTabs } from './AppNavigator';
import CasoDetalheScreen from '../screens/dentista/CasoDetalheScreen';
import PacienteHistoricoScreen from '../screens/dentista/PacienteHistoricoScreen';
import AnamneseScreen from '../screens/dentista/AnamneseScreen';
import PlanoTratamentoScreen from '../screens/dentista/PlanoTratamentoScreen';
import PrescricaoScreen from '../screens/dentista/PrescricaoScreen';
import EvolucaoClinicaScreen from '../screens/dentista/EvolucaoClinicaScreen';
import NovoPacienteScreen from '../screens/dentista/NovoPacienteScreen';
import SettingsScreen from '../screens/paciente/SettingsScreen';
import NotificacoesScreen from '../screens/paciente/NotificacoesScreen';
import NotificacoesDetalheScreen from '../screens/paciente/NotificacoesDetalheScreen';
import PrivacidadeScreen from '../screens/paciente/PrivacidadeScreen';
import TermosUsoScreen from '../screens/paciente/TermosUsoScreen';
import AjudaScreen from '../screens/paciente/AjudaScreen';

const DentistaStackNav = createNativeStackNavigator<DentistaStackParamList>();

interface DentistaStackProps {
  unreadCount: number;
  role?: string;
}

const DentistaStackNavigator: React.FC<DentistaStackProps> = ({ unreadCount, role }) => {
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
          headerStyle: { backgroundColor: COLORS.secondary || '#43A047' },
          headerTintColor: '#fff',
        }}
      />

      <DentistaStackNav.Screen
        name="CadastrarPaciente"
        component={NovoPacienteScreen}
        options={{
          title: 'Cadastrar Paciente',
          headerStyle: { backgroundColor: COLORS.primary },
          headerTintColor: '#fff',
        }}
      />

      <DentistaStackNav.Screen
        name="Settings"
        component={SettingsScreen}
        options={{
          title: 'Configurações',
          headerStyle: { backgroundColor: COLORS.secondary },
          headerTintColor: COLORS.textInverse,
        }}
      />

      <DentistaStackNav.Screen
        name="Notificacoes"
        component={NotificacoesScreen}
        options={{
          title: 'Notificações',
          headerStyle: { backgroundColor: COLORS.secondary },
          headerTintColor: COLORS.textInverse,
        }}
      />

      <DentistaStackNav.Screen
        name="NotificacoesDetalhe"
        component={NotificacoesDetalheScreen}
        options={{
          title: 'Minhas Notificações',
          headerStyle: { backgroundColor: COLORS.secondary },
          headerTintColor: COLORS.textInverse,
        }}
      />

      <DentistaStackNav.Screen
        name="Privacidade"
        component={PrivacidadeScreen}
        options={{
          title: 'Privacidade',
          headerStyle: { backgroundColor: COLORS.secondary },
          headerTintColor: COLORS.textInverse,
        }}
      />

      <DentistaStackNav.Screen
        name="TermosUso"
        component={TermosUsoScreen}
        options={{
          title: 'Termos de Uso',
          headerStyle: { backgroundColor: COLORS.secondary },
          headerTintColor: COLORS.textInverse,
        }}
      />

      <DentistaStackNav.Screen
        name="Ajuda"
        component={AjudaScreen}
        options={{
          title: 'Ajuda',
          headerStyle: { backgroundColor: COLORS.secondary },
          headerTintColor: COLORS.textInverse,
        }}
      />

      {/* Módulo Clínico */}
      <DentistaStackNav.Screen
        name="Anamnese"
        component={AnamneseScreen}
        options={{
          title: 'Anamnese',
          headerStyle: { backgroundColor: '#7C3AED' },
          headerTintColor: '#fff',
        }}
      />

      <DentistaStackNav.Screen
        name="PlanoTratamento"
        component={PlanoTratamentoScreen}
        options={{
          title: 'Plano de Tratamento',
          headerStyle: { backgroundColor: COLORS.primary },
          headerTintColor: '#fff',
        }}
      />

      <DentistaStackNav.Screen
        name="Prescricao"
        component={PrescricaoScreen}
        options={{
          title: 'Prescrição',
          headerStyle: { backgroundColor: '#E91E63' },
          headerTintColor: '#fff',
        }}
      />

      <DentistaStackNav.Screen
        name="EvolucaoClinica"
        component={EvolucaoClinicaScreen}
        options={{
          title: 'Evolução Clínica',
          headerStyle: { backgroundColor: COLORS.primary },
          headerTintColor: '#fff',
        }}
      />
    </DentistaStackNav.Navigator>
  );
};

export default DentistaStackNavigator;
