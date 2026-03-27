import React from 'react';
import { LogBox, Platform } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { NavigationContainer } from '@react-navigation/native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import Toast, { BaseToast, ErrorToast, ToastConfig } from 'react-native-toast-message';

import { AuthProvider } from './src/contexts/AuthContext';
import { ThemeProvider } from './src/contexts/ThemeContext';
import { DentistProvider } from './src/contexts/DentistContext';
import AppNavigator from './src/navigation/AppNavigator';
import { NetworkSyncStatus } from './src/components/NetworkSyncStatus';
import { SHADOWS } from './src/styles/theme';

// PWA Service Worker basic support - no TS errors
if (Platform.OS === 'web' && 'serviceWorker' in navigator) {
  navigator.serviceWorker.ready.then(registration => {
    console.log('PWA Service Worker ready');
  }).catch(() => {});
}

// Silenciar avisos de depreciação do React Native Web
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

export default function App(): React.JSX.Element {
  return (
    <SafeAreaProvider>
      <ThemeProvider>
        <AuthProvider>
          <DentistProvider>
            <NavigationContainer>
              <StatusBar style="light" />
              <AppNavigator />
              <NetworkSyncStatus />
              <Toast config={toastConfig} />
            </NavigationContainer>
          </DentistProvider>
        </AuthProvider>
      </ThemeProvider>
    </SafeAreaProvider>
  );
}
