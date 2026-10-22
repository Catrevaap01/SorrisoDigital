// ─────────────────────────────────────────────────────────────────────────────
// src/contexts/ThemeContext.tsx
// Contexto para gerir o tema visual da aplicação (Claro, Escuro, Automático)
// ─────────────────────────────────────────────────────────────────────────────

// Importações do React necessárias para criar o contexto e gerir estado
import React, { createContext, useContext, useState, useEffect } from 'react';
// Hook nativo do React Native que detecta o esquema de cores do sistema operativo
import { useColorScheme } from 'react-native';

// Modos de tema disponíveis na aplicação
export type ThemeMode = 'light' | 'dark' | 'automatic';

// Interface que define os valores disponíveis no contexto de tema
export interface ThemeContextValue {
  themeMode: ThemeMode;                    // Modo activo escolhido pelo utilizador
  isDarkMode: boolean;                     // true se o tema actual for escuro
  setThemeMode: (mode: ThemeMode) => void; // Função para mudar o tema
}

// Cria o contexto com valor inicial undefined (força o uso do ThemeProvider)
const ThemeContext = createContext<ThemeContextValue | undefined>(undefined);

// Componente Provider: envolve a aplicação e fornece o tema a todos os filhos
export const ThemeProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  // Detecta o esquema de cores definido pelo sistema (light ou dark)
  const systemColorScheme = useColorScheme();

  // Estado do modo de tema escolhido pelo utilizador (padrão: automático)
  const [themeMode, setThemeModeState] = useState<ThemeMode>('automatic');

  // Determina se está em modo escuro:
  // - Se 'automatic': segue o sistema operativo
  // - Se 'dark': sempre escuro
  // - Se 'light': sempre claro
  const isDarkMode =
    themeMode === 'automatic'
      ? systemColorScheme === 'dark' // Segue o sistema
      : themeMode === 'dark';        // Forçado pelo utilizador

  // Função para mudar o tema — actualiza o estado e pode guardar em armazenamento
  const setThemeMode = (mode: ThemeMode) => {
    setThemeModeState(mode);
    // TODO: Guardar preferência no AsyncStorage para persistência entre sessões
    // saveThemeModeToStorage(mode);
  };

  // Disponibiliza o tema a todos os componentes filhos
  return (
    <ThemeContext.Provider value={{ themeMode, isDarkMode, setThemeMode }}>
      {children}
    </ThemeContext.Provider>
  );
};

// Hook para aceder ao tema em qualquer componente da aplicação
export const useTheme = (): ThemeContextValue => {
  const context = useContext(ThemeContext);
  // Garante que o hook só é usado dentro do ThemeProvider
  if (!context) {
    throw new Error('useTheme must be used within a ThemeProvider');
  }
  return context;
};
