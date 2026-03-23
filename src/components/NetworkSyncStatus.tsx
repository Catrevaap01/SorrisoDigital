import React from 'react';
import { Platform, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useNetworkStatus, useOfflineSync } from '../hooks/useNetworkSync';
import { SHADOWS } from '../styles/theme';

export const NetworkSyncStatus = () => {
  const { isOnline } = useNetworkStatus();
  const { pendingCount, isSyncing, lastSync } = useOfflineSync();
  const insets = useSafeAreaInsets();
  const [visible, setVisible] = React.useState(false);
  
  // Minimal top offset is 15. If safe area is larger (like Notch on iOS), use safe area + 5
  const topOffset = Math.max(insets.top + 5, Platform.OS === 'ios' ? 45 : 15);

  React.useEffect(() => {
    setVisible(true);
    const timer = setTimeout(() => {
      setVisible(false);
    }, 15000); // 15 segundos

    return () => clearTimeout(timer);
  }, [isOnline, isSyncing]);

  if (!visible) return null;

  return (
    <View style={[styles.outerWrapper, { top: topOffset }]} pointerEvents="none">
      <View style={[styles.container, !isOnline ? styles.containerOffline : null]}>
        <View style={styles.row}>
          <Ionicons 
            name={isOnline ? "wifi" : "wifi-outline"} 
            size={14} 
            color={isOnline ? "#AEEA00" : "#FFCDD2"} 
          />
          <Text style={styles.text}>
            {isOnline ? 'Conectado' : 'Offline'} • {pendingCount} ação(ões) offline
          </Text>
        </View>
        <Text style={styles.subtext}>
          {isSyncing 
            ? 'Sincronizando...' 
            : lastSync 
              ? `Última sync: ${new Date(lastSync).toLocaleTimeString()}` 
              : 'Aguardando sincronização'}
        </Text>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  outerWrapper: {
    position: 'absolute',
    left: 0,
    right: 0,
    alignItems: 'center',
    zIndex: 9999,
  },
  container: {
    backgroundColor: 'rgba(30, 136, 229, 0.95)',
    paddingVertical: 8,
    paddingHorizontal: 20,
    borderRadius: 24,
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    ...SHADOWS.md, // Soft elevation
  },
  containerOffline: {
    backgroundColor: 'rgba(211, 47, 47, 0.95)',
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
  },
  text: {
    color: '#ffffff',
    fontSize: 13,
    fontWeight: '700',
  },
  subtext: {
    color: 'rgba(255,255,255,0.85)',
    fontSize: 11,
    marginTop: 3,
    fontWeight: '500',
  },
});