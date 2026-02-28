/**
 * Servico de envio de emails.
 * Tenta primeiro Supabase Edge Function (send-email) e, opcionalmente, fallback por endpoint HTTP absoluto.
 */

import Constants from 'expo-constants';
import { supabase } from '../config/supabase';

type EmailPayload = {
  to: string;
  subject: string;
  type: 'password_recovery' | 'dentist_welcome' | 'new_message';
  data: Record<string, any>;
};

const extra = Constants.expoConfig?.extra;
const EMAIL_API_URL = extra?.EMAIL_API_URL as string | undefined;

const sendEmail = async (payload: EmailPayload): Promise<{ success: boolean; error?: string }> => {
  try {
    const { error } = await supabase.functions.invoke('send-email', {
      body: payload,
    });

    if (!error) {
      return { success: true };
    }

    if (EMAIL_API_URL) {
      const response = await fetch(EMAIL_API_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      if (!response.ok) {
        let detail = 'Erro ao enviar email';
        try {
          const errorBody = await response.json();
          detail = errorBody?.message || detail;
        } catch {
          // ignora parse error
        }
        return { success: false, error: detail };
      }

      return { success: true };
    }

    return {
      success: false,
      error:
        error.message ||
        'Falha ao enviar email. Configure a Edge Function "send-email" ou EMAIL_API_URL no app.json.',
    };
  } catch (error: any) {
    return {
      success: false,
      error: error?.message || 'Erro inesperado ao enviar email',
    };
  }
};

export const sendPasswordRecoveryEmail = async (
  email: string,
  nome: string,
  senhaTemporaria: string
): Promise<{ success: boolean; error?: string }> => {
  return sendEmail({
    to: email,
    subject: 'TeOdonto Angola - Sua Senha Foi Recuperada',
    type: 'password_recovery',
    data: {
      nome,
      senhaTemporaria,
    },
  });
};

export const sendWelcomeEmailToDentista = async (
  email: string,
  nome: string,
  senhaTemporaria: string
): Promise<{ success: boolean; error?: string }> => {
  return sendEmail({
    to: email,
    subject: 'TeOdonto Angola - Bem-vindo!',
    type: 'dentist_welcome',
    data: {
      nome,
      senhaTemporaria,
    },
  });
};

export const sendNewMessageNotificationEmail = async (
  email: string,
  recipientName: string,
  senderName: string,
  messagePreview: string
): Promise<{ success: boolean; error?: string }> => {
  return sendEmail({
    to: email,
    subject: `Nova mensagem de ${senderName}`,
    type: 'new_message',
    data: {
      recipientName,
      senderName,
      messagePreview,
    },
  });
};
