/**
 * Navegador do Admin com Bottom Tabs
 * Dashboard, Relatórios, Recuperação de Senhas, Perfil
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
          title: 'Dashboard',
          tabBarLabel: 'Dashboard',
        }}
      />
      <Tab.Screen
        name="AdminReports"
        component={AdminReportsScreen}
        options={{
          title: 'Relatórios',
          tabBarLabel: 'Relatórios',
        }}
      />
      <Tab.Screen
        name="AdminPasswordRecovery"
        component={AdminPasswordRecoveryScreen}
        options={{
          title: 'Recuperar Senha',
          tabBarLabel: 'Recuperação',
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
