/**
 * Navegador do Admin com Bottom Tabs
 * Dashboard, RelatÃ³rios, RecuperaÃ§Ã£o de Senhas, Perfil
 */

import React from 'react';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { Ionicons } from '@expo/vector-icons';
import { COLORS } from '../styles/theme';
import AdminDashboardScreen from '../screens/admin/AdminDashboardScreen';
import AdminReportsScreen from '../screens/admin/AdminReportsScreen';
import AdminPasswordRecoveryScreen from '../screens/admin/AdminPasswordRecoveryScreen';
import AdminProfileScreen from '../screens/admin/AdminProfileScreen';

export type AdminTabParamList = {
  AdminDashboard: undefined;
  AdminReports: undefined;
  AdminPasswordRecovery: undefined;
  AdminProfile: undefined;
};

const Tab = createBottomTabNavigator<AdminTabParamList>();

const AdminNavigator: React.FC = () => {
  return (
    <Tab.Navigator
      id="AdminTab"
      screenOptions={({ route }) => ({
        tabBarIcon: ({ focused, color, size }) => {
          let iconName = 'ellipse';
          switch (route.name) {
            case 'AdminDashboard':
              iconName = focused ? 'grid' : 'grid-outline';
              break;
            case 'AdminReports':
              iconName = focused ? 'bar-chart' : 'bar-chart-outline';
              break;
            case 'AdminPasswordRecovery':
              iconName = focused ? 'key' : 'key-outline';
              break;
            case 'AdminProfile':
              iconName = focused ? 'person' : 'person-outline';
              break;
          }
          return <Ionicons name={iconName as any} size={size} color={color} />;
        },
        tabBarShowLabel: true,
        tabBarStyle: {
          backgroundColor: COLORS.surface,
          borderTopWidth: 0,
          height: 72,
          paddingTop: 8,
          paddingBottom: 10,
          paddingHorizontal: 10,
          borderTopLeftRadius: 18,
          borderTopRightRadius: 18,
          elevation: 10,
        },
        tabBarItemStyle: {
          borderRadius: 12,
          marginHorizontal: 4,
          marginVertical: 2,
        },
        tabBarLabelStyle: {
          fontSize: 11,
          fontWeight: '700',
        },
        tabBarActiveBackgroundColor: (COLORS.danger || '#dc3545') + '18',
        tabBarActiveTintColor: COLORS.danger || '#dc3545',
        tabBarInactiveTintColor: COLORS.textSecondary,
        headerStyle: { backgroundColor: COLORS.danger || '#dc3545' },
        headerTintColor: COLORS.textInverse,
        headerTitleStyle: { fontWeight: 'bold' },
      })}
    >
      <Tab.Screen
        name="AdminDashboard"
        component={AdminDashboardScreen}
        options={{
          title: 'Dentistas',
          tabBarLabel: 'Dentistas',
        }}
      />
      <Tab.Screen
        name="AdminReports"
        component={AdminReportsScreen}
        options={{
          title: 'Relatorios',
          tabBarLabel: 'Relatorios',
        }}
      />
      <Tab.Screen
        name="AdminPasswordRecovery"
        component={AdminPasswordRecoveryScreen}
        options={{
          title: 'Recuperar Senha',
          tabBarLabel: 'Senhas',
        }}
      />
      <Tab.Screen
        name="AdminProfile"
        component={AdminProfileScreen}
        options={{
          title: 'Meu Perfil',
          tabBarLabel: 'Perfil',
        }}
      />
    </Tab.Navigator>
  );
};

export default AdminNavigator;

