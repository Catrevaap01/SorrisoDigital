// ─────────────────────────────────────────────────────────────────────────────
// src/contexts/NetworkContext.tsx
// Contexto para monitorizar o estado da ligação de rede (online/offline)
// Partilha o estado de conectividade com toda a aplicação em tempo real
// ─────────────────────────────────────────────────────────────────────────────

// React e hooks necessários para criar contexto e gerir estado
import React, { createContext, useContext, useState, useEffect } from 'react';
// NetInfo: biblioteca para monitorizar a rede (Wi-Fi, dados móveis, etc.)
import NetInfo, { NetInfoState } from '@react-native-community/netinfo';
// Platform e AppState: verifica plataforma e retorno ao primeiro plano
import { AppState, AppStateStatus, Platform } from 'react-native';
// Utilitário que determina se a rede está realmente online (com lógica de validação)
import { isNetworkOnline } from '../utils/networkUtils';

// Interface que define os dados de rede disponíveis no contexto
interface NetworkContextValue {
  isOnline: boolean; // true se houver ligação à internet
  type: string | null; // Tipo de rede: 'wifi', 'cellular', 'none', etc.
  details: any;      // Detalhes adicionais da ligação (velocidade, IP, etc.)
}

// Cria o contexto com valor padrão "online" (optimista — assume ligação no arranque)
const NetworkContext = createContext<NetworkContextValue>({
  isOnline: true,    // Assume online por defeito
  type: 'unknown',   // Tipo desconhecido no arranque
  details: null,     // Sem detalhes iniciais
});

// Hook simples para aceder ao contexto de rede em qualquer componente
export const useNetwork = () => useContext(NetworkContext);

// Componente Provider: monitoriza a rede e partilha o estado com todos os filhos
export const NetworkProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  // Estado da rede — actualizado sempre que muda
  const [networkState, setNetworkState] = useState<NetworkContextValue>({
    isOnline: true,   // Valor inicial optimista
    type: 'unknown',
    details: null,
  });

  useEffect(() => {
    const syncFromNetInfo = (state: NetInfoState) => {
      setNetworkState({
        isOnline: isNetworkOnline(state), // Usa lógica robusta de validação
        type: state.type,                 // 'wifi', 'cellular', 'none', etc.
        details: state.details,           // Dados técnicos da ligação
      });
    };

    // Subscreve mudanças de rede em tempo real (Wi-Fi ↔ dados ↔ offline)
    const unsubscribe = NetInfo.addEventListener(syncFromNetInfo);

    // Verificação inicial do estado da rede ao montar o componente
    NetInfo.fetch().then(syncFromNetInfo).catch(() => {});

    // Web/PWA: eventos nativos do browser são instantâneos quando a rede cai/volta
    let handleWebOnline: (() => void) | undefined;
    let handleWebOffline: (() => void) | undefined;

    if (Platform.OS === 'web' && typeof window !== 'undefined' && window.addEventListener) {
      handleWebOnline = () => {
        NetInfo.fetch().then(syncFromNetInfo).catch(() => {
          setNetworkState((prev) => ({ ...prev, isOnline: true }));
        });
      };
      handleWebOffline = () => {
        setNetworkState((prev) => ({ ...prev, isOnline: false, type: 'none' }));
      };
      window.addEventListener('online', handleWebOnline);
      window.addEventListener('offline', handleWebOffline);
    }

    // Mobile/Web: re-verifica ao voltar do segundo plano
    const appStateSub = AppState.addEventListener('change', (nextState: AppStateStatus) => {
      if (nextState === 'active') {
        NetInfo.fetch().then(syncFromNetInfo).catch(() => {});
      }
    });

    // Limpeza: cancela as subscrições quando o componente é desmontado
    return () => {
      unsubscribe();
      appStateSub.remove();
      if (Platform.OS === 'web' && typeof window !== 'undefined' && handleWebOnline && handleWebOffline) {
        window.removeEventListener('online', handleWebOnline);
        window.removeEventListener('offline', handleWebOffline);
      }
    };
  }, []); // Executa apenas uma vez, no arranque

  // Fornece o estado de rede a todos os componentes filhos
  return (
    <NetworkContext.Provider value={networkState}>
      {children}
    </NetworkContext.Provider>
  );
};
