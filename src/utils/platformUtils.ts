/**
 * platformUtils.ts
 *
 * Utilitários de detecção de plataforma para garantir que
 * funcionalidades como "Criar Conta" aparecem apenas onde faz sentido.
 *
 * Desktop EXE (ocultar Criar Conta + Recuperar Senha):
 *  ✓ Electron (Windows/Mac/Linux EXE)
 *  ✓ Tauri (Windows/Mac/Linux EXE)
 *  ✓ NW.js (Windows/Mac/Linux EXE)
 *  ✓ React Native Windows / macOS (Platform.OS = 'windows'/'macos')
 *  ✓ file:// protocol (EXE local sem servidor)
 *
 * Mobile / Web / PWA (mostrar Criar Conta):
 *  ✓ Android / iOS
 *  ✓ Browser web normal
 *  ✓ PWA instalada em telemóvel
 */

import { Platform } from 'react-native';

/**
 * Detecta se a app está a correr num ambiente desktop/EXE.
 * Pacientes registam-se pelo mobile — no desktop apenas existem
 * dentistas, secretários e admins (sem opção de auto-registo).
 */
export const isDesktopApp = (): boolean => {
  // React Native Windows / macOS (Expo Native)
  if (Platform.OS === 'windows' || Platform.OS === 'macos') {
    return true;
  }

  // Plataformas móveis nunca são desktop
  if (Platform.OS === 'ios' || Platform.OS === 'android') {
    return false;
  }

  // A partir daqui: Platform.OS === 'web'
  if (typeof window === 'undefined' || typeof navigator === 'undefined') {
    return false;
  }

  const ua = navigator.userAgent || '';

  // Electron (todos os wrappers electron-builder, electron-forge, etc.)
  if (/Electron/i.test(ua)) return true;

  // Tauri (desktop app framework moderno)
  if ('__TAURI__' in window) return true;

  // NW.js
  if ('nw' in window || /nwjs/i.test(ua)) return true;

  // Capacitor desktop
  if ((window as any)?.Capacitor?.isNativePlatform?.()) {
    const platform = (window as any)?.Capacitor?.getPlatform?.();
    if (platform === 'electron' || platform === 'desktop') return true;
  }

  // file:// protocol → app carregada localmente (EXE sem servidor)
  if (typeof window.location !== 'undefined' && window.location.protocol === 'file:') {
    return true;
  }

  return false;
};

/**
 * Verifica se estamos numa PWA instalada (modo standalone).
 * Numa PWA instalada em desktop queremos MOSTRAR "Criar Conta"
 * (pode ser paciente a usar pelo computador).
 */
export const isInstalledPWA = (): boolean => {
  if (Platform.OS !== 'web' || typeof window === 'undefined') return false;
  return (
    window.matchMedia?.('(display-mode: standalone)').matches ||
    (window.navigator as any)?.standalone === true
  );
};

/**
 * Indica se devemos mostrar opções de auto-registo de paciente.
 * Regra: mostrar em mobile nativo + browser web + PWA instalada
 *        ocultar em desktop EXE (Electron/Tauri/etc.)
 */
export const canSelfRegister = (): boolean => {
  return !isDesktopApp();
};
