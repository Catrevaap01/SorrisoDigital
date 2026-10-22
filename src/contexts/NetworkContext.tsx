// ─────────────────────────────────────────────────────────────────────────────
// src/contexts/NetworkContext.tsx
// Contexto para monitorizar o estado da ligação de rede (online/offline)
// Partilha o estado de conectividade com toda a aplicação em tempo real
// ─────────────────────────────────────────────────────────────────────────────

// React e hooks necessários para criar contexto e gerir estado
import React, { createContext, useContext, useState, useEffect } from 'react';
// NetInfo: biblioteca para monitorizar a rede (Wi-Fi, dados móveis, etc.)
import NetInfo, { NetInfoState } from '@react-native-community/netinfo';
// Platform: verifica se corre no web, Android ou iOS
import { Platform } from 'react-native';
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
    // Subscreve mudanças de rede em tempo real (Wi-Fi ↔ dados ↔ offline)
    const unsubscribe = NetInfo.addEventListener((state: NetInfoState) => {
      setNetworkState({
        isOnline: isNetworkOnline(state), // Usa lógica robusta de validação
        type: state.type,                 // 'wifi', 'cellular', 'none', etc.
        details: state.details,           // Dados técnicos da ligação
      });
    });

    // Verificação inicial do estado da rede ao montar o componente
    NetInfo.fetch().then((state) => {
      setNetworkState({
        isOnline: isNetworkOnline(state),
        type: state.type,
        details: state.details,
      });
    });

    // Limpeza: cancela a subscrição quando o componente é desmontado
    return () => {
      unsubscribe();
    };
  }, []); // Executa apenas uma vez, no arranque

  // Fornece o estado de rede a todos os componentes filhos
  return (
    <NetworkContext.Provider value={networkState}>
      {children}
    </NetworkContext.Provider>
  );
};
