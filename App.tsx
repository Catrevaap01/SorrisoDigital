import React from 'react';
import { LogBox, Platform } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { NavigationContainer } from '@react-navigation/native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import Toast, { BaseToast, ErrorToast, ToastConfig } from 'react-native-toast-message';

import { AuthProvider } from './src/contexts/AuthContext';
import { ThemeProvider } from './src/contexts/ThemeContext';
import { DentistProvider } from './src/contexts/DentistContext';
import { NetworkProvider, useNetwork } from './src/contexts/NetworkContext';
import { processOfflineQueue } from './src/services/offlineSyncService';
import AppNavigator from './src/navigation/AppNavigator';
import { SHADOWS } from './src/styles/theme';

// Silenciar avisos de depreciação e otimizar compilação
LogBox.ignoreLogs([
  'Warning:...',
  'console.warn',
  'shadow* style props are deprecated',
  'props.pointerEvents is deprecated',
  'componentWillReceiveProps',
  'componentWillMount',
  'Each child in a list should have a unique "key" prop',
]);

if (Platform.OS === 'web') {
  const warn = console.warn;
  console.warn = (...args) => {
    const msg = args[0];
    if (typeof msg === 'string' && (
      msg.includes('shadow* style props are deprecated') || 
      msg.includes('props.pointerEvents is deprecated')
    )) {
      return;
    }
    warn(...args);
  };
  
  // Também para LogBox se estiver ativo
  LogBox.ignoreLogs([
    'shadow* style props are deprecated',
    'props.pointerEvents is deprecated'
  ]);
}

const toastConfig: ToastConfig = {
  success: (props) => (
    <BaseToast
      {...props}
      style={[
        { borderLeftColor: '#43A047' },
        Platform.OS === 'web' ? { boxShadow: '0px 2px 4px rgba(0,0,0,0.1)' } : {}
      ]}
      contentContainerStyle={{ paddingHorizontal: 15 }}
      text1Style={{ fontSize: 15, fontWeight: 'bold' }}
      text2Style={{ fontSize: 13 }}
    />
  ),
  error: (props) => (
    <ErrorToast
      {...props}
      style={[
        { borderLeftColor: '#E53935' },
        Platform.OS === 'web' ? { boxShadow: '0px 2px 4px rgba(0,0,0,0.1)' } : {}
      ]}
      text1Style={{ fontSize: 15, fontWeight: 'bold' }}
      text2Style={{ fontSize: 13 }}
    />
  )
};

const AppContent = () => {
  const { isOnline } = useNetwork();
  const [syncing, setSyncing] = React.useState(false);

  React.useEffect(() => {
    if (isOnline && !syncing) {
      setSyncing(true);
      processOfflineQueue().then(({ synced, failed }) => {
        if (synced > 0) {
          Toast.show({
            type: 'success',
            text1: 'Sincronização Concluída',
            text2: `${synced} ações sincronizadas com sucesso.`,
          });
        }
        if (failed > 0) {
          Toast.show({
            type: 'error',
            text1: 'Erro na Sincronização',
            text2: `${failed} ações falharam ao sincronizar.`,
          });
        }
        setSyncing(false);
      }).catch(() => setSyncing(false));
    }
  }, [isOnline]);

  return (
    <>
      <StatusBar style="light" />
      <AppNavigator />
      <Toast config={toastConfig} />
    </>
  );
};

export default function App(): React.JSX.Element {
  return (
    <SafeAreaProvider>
      <NetworkProvider>
        <ThemeProvider>
          <AuthProvider>
            <DentistProvider>
              <NavigationContainer>
                <AppContent />
              </NavigationContainer>
            </DentistProvider>
          </AuthProvider>
        </ThemeProvider>
      </NetworkProvider>
    </SafeAreaProvider>
  );
}
