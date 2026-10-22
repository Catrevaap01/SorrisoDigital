/**
 * Serviço de notificações locais / push.
 * ─ Native (Android/iOS): usa expo-notifications
 * ─ Web / PWA: usa a Web Notifications API (navigator.serviceWorker + Notification)
 *
 * Também fornece openWhatsAppReminder() para deep-link wa.me
 * compatível com Web, PWA e Mobile (React Native Linking).
 */

import { Platform, Linking } from 'react-native';
import Toast from 'react-native-toast-message';

// ─── expo-notifications (opcional — só existe em builds native) ──────────────
let Notifications: any = null;
try {
  // eslint-disable-next-line global-require
  Notifications = require('expo-notifications');
} catch {
  Notifications = null;
}

let configured = false;

// ─── Helpers de plataforma ───────────────────────────────────────────────────

const isWeb = Platform.OS === 'web';

/** Verifica se o browser suporta a Web Notifications API */
const supportsWebNotification = (): boolean =>
  isWeb &&
  typeof window !== 'undefined' &&
  'Notification' in window;

/** Pede permissão de notificação no browser (Web / PWA) */
const requestWebPermission = async (): Promise<boolean> => {
  if (!supportsWebNotification()) return false;
  if (Notification.permission === 'granted') return true;
  if (Notification.permission === 'denied') return false;
  const result = await Notification.requestPermission();
  return result === 'granted';
};

// ─── Configuração expo-notifications (native) ────────────────────────────────

const ensureConfigured = async (): Promise<void> => {
  if (!Notifications || configured) return;

  Notifications.setNotificationHandler({
    handleNotification: async () => ({
      shouldShowAlert: true,
      shouldPlaySound: true,
      shouldSetBadge: true,
    }),
  });

  if (Platform.OS === 'android') {
    try {
      await Notifications.setNotificationChannelAsync('default', {
        name: 'Geral',
        importance: Notifications.AndroidImportance?.MAX ?? 5,
        vibrationPattern: [0, 250, 250, 250],
        lightColor: '#1E88E5',
        sound: 'default',
      });
    } catch {
      // Canal indisponivel em ambientes sem suporte nativo.
    }
  }

  try {
    const perm = await Notifications.getPermissionsAsync();
    if (!perm.granted && perm.status !== 'granted') {
      const requested = await Notifications.requestPermissionsAsync();
      if (!requested.granted && requested.status !== 'granted') {
        configured = true;
        return;
      }
    }
  } catch {
    // ignora — fallback para toast
  }

  configured = true;
};

export const initializeNotifications = async (): Promise<boolean> => {
  if (isWeb) {
    return requestWebPermission();
  }

  if (!Notifications) {
    return false;
  }

  await ensureConfigured();

  try {
    const perm = await Notifications.getPermissionsAsync();
    return !!perm.granted || perm.status === 'granted';
  } catch {
    return false;
  }
};

// ─── notifyNewMessage ─────────────────────────────────────────────────────────

/**
 * Mostra uma notificação imediata (mensagem nova, etc.).
 * Web/PWA: usa Web Notifications API.
 * Native: usa expo-notifications.
 * Fallback: Toast.
 */
export const notifyNewMessage = async (
  title: string,
  body: string
): Promise<void> => {
  // ── Web / PWA ──
  if (isWeb) {
    if (supportsWebNotification()) {
      const granted = await requestWebPermission();
      if (granted) {
        try {
          new Notification(title, { body, icon: '/favicon.png' });
          return;
        } catch {
          // continua para toast
        }
      }
    }
    Toast.show({ type: 'info', text1: title, text2: body });
    return;
  }

  // ── Native ──
  if (!Notifications) {
    Toast.show({ type: 'info', text1: title, text2: body });
    return;
  }

  await ensureConfigured();

  try {
    await Notifications.scheduleNotificationAsync({
      content: { title, body, sound: 'default', channelId: 'default' },
      trigger: null,
    });
  } catch {
    Toast.show({ type: 'info', text1: title, text2: body });
  }
};

// ─── scheduleLocalNotification ────────────────────────────────────────────────

/**
 * Agenda uma notificação local para uma data futura.
 * Web/PWA: usa setTimeout + Web Notifications API (funciona em abas abertas;
 *   para background real precisaria de Service Worker com push API).
 * Native: usa expo-notifications.
 */
export const scheduleLocalNotification = async (
  title: string,
  body: string,
  date: Date,
  data: Record<string, any> = {}
): Promise<void> => {
  const now = Date.now();
  const target = date.getTime();

  if (isNaN(target) || target <= now) return; // data inválida ou no passado

  const delayMs = target - now;

  // ── Web / PWA ──
  if (isWeb) {
    if (!supportsWebNotification()) return;
    const granted = await requestWebPermission();
    if (!granted) return;

    // setTimeout funciona enquanto a aba está aberta (PWA standalone).
    // Para PWA com background completo seria necessário SW Push API.
    setTimeout(() => {
      try {
        new Notification(title, {
          body,
          icon: '/favicon.png',
          data,
        });
      } catch {
        // ignora se a aba já não estiver em foco
      }
    }, delayMs);
    return;
  }

  // ── Native ──
  if (!Notifications) return;

  await ensureConfigured();

  try {
    await Notifications.scheduleNotificationAsync({
      content: { title, body, data, sound: 'default', channelId: 'default' },
      trigger: date,
    });
  } catch {
    // ignora — não crítico
  }
};

// ─── scheduleAppointmentReminder ──────────────────────────────────────────────

/**
 * Agenda um lembrete push/local para 24h antes da consulta.
 * Compatible: Web, PWA, Android, iOS.
 *
 * @param appointmentDate  string ISO ou YYYY-MM-DD ou datetime completo
 */
export const scheduleAppointmentReminder = async (
  title: string,
  body: string,
  appointmentDate: string
): Promise<void> => {
  try {
    const date = new Date(appointmentDate);
    if (isNaN(date.getTime())) return;

    // 24 horas antes (alterado de 1h para 24h)
    const reminder = new Date(date.getTime() - 24 * 60 * 60 * 1000);
    if (reminder <= new Date()) return;

    await scheduleLocalNotification(title, body, reminder, { appointmentDate });
  } catch {
    // ignora falhas de agendamento — não são críticas
  }
};

// ─── openWhatsAppReminder ─────────────────────────────────────────────────────

/**
 * Abre o WhatsApp com uma mensagem de lembrete pré-escrita para o paciente.
 *
 * ─ Mobile (native): abre a app do WhatsApp via Linking
 * ─ Web / PWA: abre wa.me numa nova tab do browser
 *
 * Retorna true se o link foi aberto com sucesso.
 */
export const openWhatsAppReminder = async (params: {
  telefonePaciente: string;  // número com DDI, ex: "244923456789"
  nomePaciente: string;
  dataConsulta: string;      // legível, ex: "19/05/2026"
  horaConsulta: string;      // legível, ex: "09:30"
  nomeDentista?: string;
  tipoConsulta?: string;
}): Promise<{ success: boolean; error?: string }> => {
  try {
    const {
      telefonePaciente,
      nomePaciente,
      dataConsulta,
      horaConsulta,
      nomeDentista = 'o seu dentista',
      tipoConsulta = 'Consulta Odontológica',
    } = params;

    // Sanitizar número: apenas dígitos
    const phone = telefonePaciente.replace(/\D/g, '');
    if (!phone) {
      return { success: false, error: 'Número de telefone inválido' };
    }

    const mensagem =
      `Olá ${nomePaciente} 👋\n\n` +
      `Este é um lembrete da sua consulta marcada para *amanhã*:\n\n` +
      `📅 *Data:* ${dataConsulta}\n` +
      `🕒 *Hora:* ${horaConsulta}\n` +
      `🦷 *Tipo:* ${tipoConsulta}\n` +
      `👨‍⚕️ *Dentista:* ${nomeDentista}\n\n` +
      `Por favor, chegue com 10 minutos de antecedência.\n\n` +
      `_Sorriso Digital – TeOdonto Angola_ 🦷`;

    const url = `https://wa.me/${phone}?text=${encodeURIComponent(mensagem)}`;

    if (isWeb) {
      // Web / PWA: abrir numa nova tab
      window.open(url, '_blank', 'noopener,noreferrer');
      return { success: true };
    }

    // Native: usar Linking
    const canOpen = await Linking.canOpenURL(url);
    if (!canOpen) {
      // WhatsApp não instalado → tentar URL web como fallback
      const webUrl = `https://web.whatsapp.com/send?phone=${phone}&text=${encodeURIComponent(mensagem)}`;
      await Linking.openURL(webUrl);
      return { success: true };
    }

    await Linking.openURL(url);
    return { success: true };
  } catch (err: any) {
    console.warn('openWhatsAppReminder error:', err);
    return { success: false, error: err?.message || 'Erro ao abrir WhatsApp' };
  }
};
