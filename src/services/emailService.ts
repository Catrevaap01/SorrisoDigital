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
const SENDGRID_API_KEY = extra?.SENDGRID_API_KEY as string | undefined; // opcional

const sendEmail = async (payload: EmailPayload): Promise<{ success: boolean; error?: string }> => {
  console.log('▶ sendEmail payload', payload);
  try {
    const { error } = await supabase.functions.invoke('send-email', {
      body: payload,
    });

    if (!error) {
      console.log('✔ send-email function invoked successfully');
      return { success: true };
    }

    if (EMAIL_API_URL) {
      console.log('↪ falling back to EMAIL_API_URL', EMAIL_API_URL);
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
        console.warn('fallback EMAIL_API_URL falhou:', detail);
      } else {
        return { success: true };
      }
    }

    if (SENDGRID_API_KEY) {
      console.log('↪ trying SendGrid fallback');
      try {
        const to = payload.to;
        const subject = payload.subject;
        // montar texto simples com dados
        const text = `Olá ${payload.data.nome || ''},\n\n` +
          (payload.data.senhaTemporaria
            ? `Sua senha temporária: ${payload.data.senhaTemporaria}\n\n` : '') +
          'Por favor, altere sua senha no primeiro login.';

        const sgRes = await fetch('https://api.sendgrid.com/v3/mail/send', {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${SENDGRID_API_KEY}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            personalizations: [{ to: [{ email: to }] }],
            from: { email: 'no-reply@teodontoangola.com', name: 'TeOdonto Angola' },
            subject,
            content: [{ type: 'text/plain', value: text }],
          }),
        });
        if (sgRes.ok) {
          console.log('✔ email enviado via SendGrid');
          return { success: true };
        } else {
          const errText = await sgRes.text();
          console.warn('SendGrid falhou:', errText);
        }
      } catch (sgErr) {
        console.warn('exceção SendGrid:', sgErr);
      }
    }
  } catch (error: any) {
    console.warn('erro inesperado em sendEmail:', error);
    return { success: false, error: error?.message || 'Erro inesperado ao enviar email' };
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
