// Importa o React para usar JSX e hooks (useState, useEffect)
import React from 'react';

// LogBox: suprime avisos indesejados; Platform: verifica a plataforma actual (web/android/ios)
import { LogBox, Platform } from 'react-native';

// Barra de estado da aplicação (barra superior do sistema)
import { StatusBar } from 'expo-status-bar';

// Contentor principal de navegação — envolve toda a estrutura de rotas
import { NavigationContainer } from '@react-navigation/native';

// Fornece suporte de área segura (notch, bottom bar) em todos os ecrãs
import { SafeAreaProvider } from 'react-native-safe-area-context';

// Componentes de Toast (notificações visuais temporárias)
import Toast, { BaseToast, ErrorToast, ToastConfig } from 'react-native-toast-message';

// Contexto de autenticação — gere sessão do utilizador
import { AuthProvider } from './src/contexts/AuthContext';

// Contexto de tema — gere cores e modo claro/escuro
import { ThemeProvider } from './src/contexts/ThemeContext';

// Contexto do dentista — gere dados do dentista activo
import { DentistProvider } from './src/contexts/DentistContext';

// Contexto de rede — detecta se o dispositivo está online ou offline
import { NetworkProvider, useNetwork } from './src/contexts/NetworkContext';

// Contexto de real-time — gere subscrições Supabase em tempo real
import { RealtimeProvider } from './src/contexts/RealtimeContext';

// Contexto de presença em tempo real — gere estado online/offline no chat e na app
import { PresenceProvider } from './src/contexts/PresenceContext';

// Serviço de sincronização offline — envia dados pendentes quando volta online
import { processOfflineQueue } from './src/services/offlineSyncService';

// Serviço de lembretes automáticos — notifica consultas de amanhã
import { startReminderWorker, stopReminderWorker } from './src/services/reminderWorkerService';

// Serviço de notificações locais — inicializa as permissões de push notification
import { initializeNotifications } from './src/services/localNotificationService';

// Navegador principal que define as rotas da aplicação
import AppNavigator from './src/navigation/AppNavigator';

// ── Silenciar avisos de depreciação do RN Web (de bibliotecas externas) ───────
// Apenas no browser — alguns pacotes emitem avisos de propriedades deprecadas que não controlamos
if (Platform.OS === 'web') {
  // Guarda a função original de aviso
  const _warn = console.warn;

  // Substitui console.warn por uma versão filtrada
  console.warn = (...args) => {
    const msg = args[0];
    // Ignora avisos específicos de propriedades shadow e pointerEvents deprecadas
    if (
      typeof msg === 'string' &&
      (msg.includes('shadow* style props are deprecated') ||
        msg.includes('props.pointerEvents is deprecated'))
    ) {
      return; // Silencia o aviso e não faz nada
    }
    // Para todos os outros avisos, usa o comportamento normal
    _warn(...args);
  };

  // Também suprime estes avisos no LogBox (painel de debug do Expo)
  LogBox.ignoreLogs([
    'shadow* style props are deprecated',
    'props.pointerEvents is deprecated',
  ]);
}

// ── Configuração visual dos Toast (notificações temporárias) ──────────────────
const toastConfig: ToastConfig = {
  // Toast de sucesso — borda esquerda verde
  success: (props) => (
    <BaseToast
      {...props}
      style={[
        { borderLeftColor: '#43A047' }, // Cor verde de sucesso
        // No web, aplica sombra via boxShadow (CSS); em nativo, não é necessário
        Platform.OS === 'web' ? { boxShadow: '0px 2px 4px rgba(0,0,0,0.1)' } : {},
      ]}
      contentContainerStyle={{ paddingHorizontal: 15 }} // Espaçamento interno
      text1Style={{ fontSize: 15, fontWeight: 'bold' }}  // Estilo do título
      text2Style={{ fontSize: 13 }}                      // Estilo da mensagem
    />
  ),

  // Toast de erro — borda esquerda vermelha
  error: (props) => (
    <ErrorToast
      {...props}
      style={[
        { borderLeftColor: '#E53935' }, // Cor vermelha de erro
        // Sombra apenas no web
        Platform.OS === 'web' ? { boxShadow: '0px 2px 4px rgba(0,0,0,0.1)' } : {},
      ]}
      text1Style={{ fontSize: 15, fontWeight: 'bold' }} // Estilo do título
      text2Style={{ fontSize: 13 }}                     // Estilo da mensagem
    />
  ),
};

// ── AppContent: lógica principal da aplicação (dentro dos contextos) ──────────
const AppContent = () => {
  // Obtém o estado de conectividade do contexto de rede
  const { isOnline } = useNetwork();

  // Estado local para evitar múltiplas sincronizações simultâneas
  const [syncing, setSyncing] = React.useState(false);

  // Efeito: sincroniza fila offline quando o dispositivo volta a ter ligação
  React.useEffect(() => {
    // Só sincroniza se estiver online e não estiver já a sincronizar
    if (isOnline && !syncing) {
      setSyncing(true); // Marca como "a sincronizar"

      processOfflineQueue()
        .then(({ synced, failed }) => {
          // Se alguma acção foi sincronizada com sucesso, mostra notificação verde
          if (synced > 0) {
            Toast.show({
              type: 'success',
              text1: 'Sincronização Concluída',
              text2: `${synced} ações sincronizadas com sucesso.`,
            });
          }
          // Se alguma acção falhou, mostra notificação de erro
          if (failed > 0) {
            Toast.show({
              type: 'error',
              text1: 'Erro na Sincronização',
              text2: `${failed} ações falharam ao sincronizar.`,
            });
          }
          setSyncing(false); // Liberta o bloqueio de sincronização
        })
        .catch(() => setSyncing(false)); // Em caso de erro inesperado, liberta igualmente
    }
  }, [isOnline]); // Executado sempre que o estado de rede muda

  // Efeito: inicia o worker de lembretes automáticos ao montar o componente
  // Worker: verifica consultas de amanhã a cada hora
  // Canais de notificação: in-app + email + WhatsApp deep-link + push local (24h antes)
  React.useEffect(() => {
    void initializeNotifications(); // Inicializa as permissões de notificações push
    startReminderWorker();          // Inicia o worker de lembretes automáticos

    // Função de limpeza: para o worker quando o componente é desmontado
    return () => {
      stopReminderWorker();
    };
  }, []); // Executa apenas uma vez, no arranque da aplicação

  // Renderiza a estrutura principal da aplicação
  return (
    <>
      {/* Barra de estado com texto claro (para fundos escuros) */}
      <StatusBar style="light" />

      {/* Navegador principal com todas as rotas da aplicação */}
      <AppNavigator />

      {/* Sistema de Toast (notificações temporárias) com config personalizada */}
      <Toast config={toastConfig} />
    </>
  );
};

// ── Root: componente raiz exportado — envolve tudo nos contextos globais ──────
export default function App(): React.JSX.Element {
  return (
    // Fornece suporte de área segura (notch/safe areas) em toda a app
    <SafeAreaProvider>
      {/* Fornece o estado de rede (online/offline) a toda a aplicação */}
      <NetworkProvider>
        {/* Fornece o tema visual (cores, modo escuro) a toda a aplicação */}
        <ThemeProvider>
          {/* Fornece a sessão de autenticação a toda a aplicação */}
          <AuthProvider>
            {/* Fornece os dados do dentista activo a toda a aplicação */}
            <DentistProvider>
              {/* Fornece as subscrições real-time do Supabase a toda a aplicação */}
              <RealtimeProvider>
                {/* Fornece o estado de presença (online/offline) em tempo real */}
                <PresenceProvider>
                  {/* Contentor de navegação — necessário para React Navigation */}
                  <NavigationContainer>
                    {/* Conteúdo principal com lógica de sincronização e lembretes */}
                    <AppContent />
                  </NavigationContainer>
                </PresenceProvider>
              </RealtimeProvider>
            </DentistProvider>
          </AuthProvider>
        </ThemeProvider>
      </NetworkProvider>
    </SafeAreaProvider>
  );
}
