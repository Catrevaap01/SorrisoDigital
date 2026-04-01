import React, { createContext, useContext, useState, useEffect } from 'react';
import NetInfo, { NetInfoState } from '@react-native-community/netinfo';
import { Platform } from 'react-native';

interface NetworkContextValue {
  isOnline: boolean;
  type: string | null;
  details: any;
}

const NetworkContext = createContext<NetworkContextValue>({
  isOnline: true,
  type: 'unknown',
  details: null,
});

export const useNetwork = () => useContext(NetworkContext);

export const NetworkProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [networkState, setNetworkState] = useState<NetworkContextValue>({
    isOnline: true,
    type: 'unknown',
    details: null,
  });

  useEffect(() => {
    // Escutar mudanças de rede
    const unsubscribe = NetInfo.addEventListener((state: NetInfoState) => {
      setNetworkState({
        isOnline: !!state.isConnected && !!state.isInternetReachable,
        type: state.type,
        details: state.details,
      });
    });

    // Check inicial
    NetInfo.fetch().then((state) => {
      setNetworkState({
        isOnline: !!state.isConnected && !!state.isInternetReachable,
        type: state.type,
        details: state.details,
      });
    });

    return () => {
      unsubscribe();
    };
  }, []);

  return (
    <NetworkContext.Provider value={networkState}>
      {children}
    </NetworkContext.Provider>
  );
};
