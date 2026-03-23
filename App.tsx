import React from 'react';
import { Platform } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { NavigationContainer } from '@react-navigation/native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import Toast, { BaseToast, ErrorToast, ToastConfig } from 'react-native-toast-message';
import { AuthProvider } from './src/contexts/AuthContext';
import { ThemeProvider } from './src/contexts/ThemeContext';
import { DentistProvider } from './src/contexts/DentistContext';
import AppNavigator from './src/navigation/AppNavigator';
import { NetworkSyncStatus } from './src/components/NetworkSyncStatus';

const toastConfig: ToastConfig = {
  success: (props) => (
    <BaseToast
      {...props}
      style={[
        { borderLeftColor: '#43A047' },
        Platform.OS === 'web' && { 
          // @ts-ignore - boxShadow is web-only
          boxShadow: '0px 2px 4px rgba(0,0,0,0.1)' 
        }
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
        Platform.OS === 'web' && { 
          // @ts-ignore - boxShadow is web-only
          boxShadow: '0px 2px 4px rgba(0,0,0,0.1)' 
        }
      ]}
      text1Style={{ fontSize: 15, fontWeight: 'bold' }}
      text2Style={{ fontSize: 13 }}
    />
  )
};

export default function App() {
  return (
    <SafeAreaProvider>
      <ThemeProvider>
        <AuthProvider>
          <DentistProvider>
            <NavigationContainer children={<AppNavigator />} />
            <StatusBar style="light" />
            <NetworkSyncStatus />
            <Toast config={toastConfig} />
          </DentistProvider>
        </AuthProvider>
      </ThemeProvider>
    </SafeAreaProvider>
  );
}
