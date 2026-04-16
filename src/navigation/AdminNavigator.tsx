/**
 * Navegador do Admin com Bottom Tabs
 * Dashboard, Relatórios, Recuperação de Senhas, Perfil
 */

import * as React from 'react';
import { Platform, Text, View } from 'react-native';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { Ionicons } from '@expo/vector-icons';
import { COLORS, SHADOWS } from '../styles/theme';
import { useAuth } from '../contexts/AuthContext';
import AdminDashboardScreen from '../screens/admin/AdminDashboardScreen';
import AdminReportsScreen from '../screens/admin/AdminReportsScreen';
import AdminPasswordRecoveryScreen from '../screens/admin/AdminPasswordRecoveryScreen';
import AdminProfileScreen from '../screens/admin/AdminProfileScreen';
import AdminSecretariosScreen from '../screens/admin/AdminSecretariosScreen';

export type AdminTabParamList = {
  AdminDashboard: undefined;
  AdminSecretarios: undefined;
  AdminReports: undefined;
  AdminPasswordRecovery: undefined;
  AdminProfile: undefined;
};

const Tab = createBottomTabNavigator<AdminTabParamList>();

const AdminNavigator: React.FC = () => {
  const { profile, user } = useAuth();
  const roleFromProfile = profile?.tipo;
  const roleFromMetadata = user?.user_metadata?.tipo as string | undefined;
  const isAdmin = roleFromProfile === 'admin' || roleFromMetadata === 'admin';

  // Só bloqueia quando temos role definida e ela não é admin.
  if ((roleFromProfile || roleFromMetadata) && !isAdmin) {
    return (
      <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: COLORS.background }}>
        <Text style={{ color: COLORS.textSecondary }}>Area exclusiva de administrador</Text>
      </View>
    );
  }

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
            case 'AdminSecretarios':
              iconName = focused ? 'people' : 'people-outline';
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
        tabBarStyle: Platform.OS === 'web' ? {
          width: '100%',
          maxWidth: 800,
          alignSelf: 'center',
          backgroundColor: COLORS.surface,
          borderTopWidth: 0,
          height: 72,
          paddingTop: 8,
          paddingBottom: 10,
          paddingHorizontal: 10,
          borderTopLeftRadius: 18,
          borderTopRightRadius: 18,
          position: 'absolute',
          bottom: 0,
          left: 0,
          right: 0,
          marginHorizontal: 'auto',
          ...SHADOWS.lg,
        } : {
          backgroundColor: COLORS.surface,
          borderTopWidth: 0,
          height: 72,
          paddingTop: 8,
          paddingBottom: 10,
          paddingHorizontal: 10,
          borderTopLeftRadius: 18,
          borderTopRightRadius: 18,
          ...SHADOWS.lg,
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
        tabBarHideOnKeyboard: true,
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
        name="AdminSecretarios"
        component={AdminSecretariosScreen}
        options={{
          title: 'Secretários',
          tabBarLabel: 'Secretários',
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

