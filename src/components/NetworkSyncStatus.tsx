import React from 'react';
import { Platform, StyleSheet, Text, View } from 'react-native';
import { useNetworkStatus, useOfflineSync } from '../hooks/useNetworkSync';

export const NetworkSyncStatus = () => {
  const { isOnline } = useNetworkStatus();
  const { pendingCount, isSyncing, lastSync } = useOfflineSync();

  return (
    <View style={styles.container}>
      <Text style={styles.text}>
        {isOnline ? 'Conectado' : 'Offline'} • {pendingCount} ação(ões) offline
      </Text>
      <Text style={[styles.text, isOnline ? styles.online : styles.offline]}>
        {isSyncing ? 'Sincronizando...' : lastSync ? `Última sync: ${new Date(lastSync).toLocaleTimeString()}` : 'Aguardando sincronização'}
      </Text>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    zIndex: 9999,
    backgroundColor: '#1E88E5',
    paddingVertical: 6,
    paddingHorizontal: 10,
    borderBottomWidth: 1,
    borderColor: '#1976d2',
    display: 'flex',
    flexDirection: 'column',
  },
  text: {
    color: 'white',
    fontSize: 12,
    lineHeight: 16,
  },
  online: {
    color: '#AEEA00',
  },
  offline: {
    color: '#FFEB3B',
  },
});