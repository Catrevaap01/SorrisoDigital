/**
 * Servico de envio de emails.
 * Tenta primeiro Supabase Edge Function (send-email) e, opcionalmente, fallback por endpoint HTTP absoluto.
 */

import Constants from 'expo-constants';
import { supabase } from '../config/supabase';

type EmailPayload = {
  to: string;
  subject: string;
  type: 'password_recovery' | 'dentist_welcome' | 'new_message' | 'appointment_reminder';
  data: Record<string, any>;
};

const extra = Constants.expoConfig?.extra;
const EMAIL_API_URL = extra?.EMAIL_API_URL as string | undefined;
const SENDGRID_API_KEY = extra?.SENDGRID_API_KEY as string | undefined; // opcional
const RESEND_API_KEY = extra?.RESEND_API_KEY as string | undefined; // fallback directo

const MAX_RETRIES = 3;

const sleep = (ms: number) => new Promise(r => setTimeout(r, ms));

/**
 * Cadeia de envio de email com 4 providers e retry:
 *  1. Supabase Edge Function (send-email)   → principal
 *  2. Resend API directa                    → fallback 1
 *  3. EMAIL_API_URL customizada             → fallback 2
 *  4. SendGrid API                          → fallback 3
 *
 * Cada provider tenta até MAX_RETRIES vezes com backoff exponencial.
 */
const sendEmail = async (payload: EmailPayload): Promise<{ success: boolean; error?: string }> => {
  console.log('▶ sendEmail payload', payload.type, payload.to);
  const errors: string[] = [];

  // ── Provider 1: Supabase Edge Function ────────────────────────────────────
  for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
    try {
      const { data, error } = await supabase.functions.invoke('send-email', {
        body: payload,
      });

      if (!error && data?.success === true) {
        console.log('✔ send-email Edge Function OK');
        return { success: true };
      }

      const msg = (error as any)?.message || (data && !data.success ? data.message : 'Falha na Edge Function');
      console.warn(`send-email attempt ${attempt}/${MAX_RETRIES}: ${msg}`);
      errors.push(`EF:${msg}`);

      if (attempt < MAX_RETRIES) await sleep(1000 * attempt);
    } catch (e: any) {
      console.warn(`send-email exception attempt ${attempt}: ${e?.message}`);
      errors.push(`EF:${e?.message}`);
      if (attempt < MAX_RETRIES) await sleep(1000 * attempt);
    }
  }

  // ── Provider 2: Resend API directa (fallback sem Edge Function) ───────────
  if (RESEND_API_KEY) {
    console.log('↪ Resend API directa (fallback)');
    for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
      try {
        const subject = payload.subject || `TeOdonto Angola — ${payload.type}`;
        const text = payload.data?.textoSimples ||
          `Olá ${payload.data?.nome || payload.data?.nomePaciente || ''},\n\n` +
          (payload.data?.senhaTemporaria ? `Senha temporária: ${payload.data.senhaTemporaria}\n\n` : '') +
          'Obrigado — TeOdonto Angola';

        const resendRes = await fetch('https://api.resend.com/emails', {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${RESEND_API_KEY}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            from: 'Sorriso Digital <no-reply@teodontoangola.com>',
            to: [payload.to],
            subject,
            text,
          }),
        });

        if (resendRes.ok) {
          console.log('✔ email enviado via Resend directo');
          return { success: true };
        }

        const resendErr = await resendRes.text();
        console.warn(`Resend attempt ${attempt}: ${resendErr}`);
        errors.push(`Resend:${resendErr}`);
        if (attempt < MAX_RETRIES) await sleep(1000 * attempt);
      } catch (e: any) {
        errors.push(`Resend:${e?.message}`);
        if (attempt < MAX_RETRIES) await sleep(1000 * attempt);
      }
    }
  }

  // ── Provider 3: EMAIL_API_URL customizada ─────────────────────────────────
  if (EMAIL_API_URL) {
    console.log('↪ falling back to EMAIL_API_URL', EMAIL_API_URL);
    try {
      const response = await fetch(EMAIL_API_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      if (response.ok) {
        console.log('✔ email enviado via EMAIL_API_URL');
        return { success: true };
      }

      let detail = 'Erro ao enviar email';
      try {
        const errorBody = await response.json();
        detail = errorBody?.message || detail;
      } catch { /* ignora parse error */ }
      errors.push(`API_URL:${detail}`);
    } catch (e: any) {
      errors.push(`API_URL:${e?.message}`);
    }
  }

  // ── Provider 4: SendGrid ──────────────────────────────────────────────────
  if (SENDGRID_API_KEY) {
    console.log('↪ trying SendGrid fallback');
    try {
      const to = payload.to;
      const subject = payload.subject || `TeOdonto Angola — ${payload.type}`;
      const text = payload.data?.textoSimples ||
        `Olá ${payload.data.nome || ''},\n\n` +
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
        errors.push(`SendGrid:${errText}`);
      }
    } catch (sgErr: any) {
      errors.push(`SendGrid:${sgErr?.message}`);
    }
  }

  const errorMsg = errors.join(' | ') || 'Todos os providers falharam';
  console.warn('❌ Email: todos os providers falharam:', errorMsg);
  return { success: false, error: errorMsg };
};

import { sanitizeWhatsAppPhone } from './whatsappMfaService';

export const buildPasswordRecoveryMailto = (
  email: string,
  nome: string,
  senhaTemporaria: string
): string => {
  const subject = encodeURIComponent('TeOdonto Angola - Sua Nova Senha Temporária');
  const body = encodeURIComponent(
    `Olá, ${nome || 'Utilizador'}!\n\n` +
    `A sua senha de acesso ao TeOdonto Angola foi redefinida com sucesso pelo Administrador.\n\n` +
    `🔑 Nova Senha Temporária: ${senhaTemporaria}\n\n` +
    `Por favor, aceda à plataforma no link abaixo e altere a sua senha no primeiro login para maior segurança:\n` +
    `https://teodontoangola.vercel.app\n\n` +
    `Atenciosamente,\n` +
    `Equipa Sorriso Digital — TeOdonto Angola 🇦🇴`
  );
  return `mailto:${email}?subject=${subject}&body=${body}`;
};

export const buildPasswordRecoveryWhatsApp = (
  phone: string,
  nome: string,
  senhaTemporaria: string
): string => {
  const sanitized = sanitizeWhatsAppPhone(phone);
  const text = encodeURIComponent(
    `🦷 *TeOdonto Angola — Recuperação de Senha*\n\n` +
    `Olá, *${nome || 'Utilizador'}*!\n\n` +
    `A sua senha de acesso foi redefinida pelo Administrador:\n\n` +
    `🔑 *Nova Senha Temporária:* \`${senhaTemporaria}\`\n\n` +
    `🌐 *Acesso:* https://teodontoangola.vercel.app\n\n` +
    `⚠️ _Por segurança, altere esta senha no seu próximo login._`
  );
  return `https://wa.me/${sanitized}?text=${text}`;
};

export const sendPasswordRecoveryEmail = async (
  email: string,
  nome: string,
  senhaTemporaria: string
): Promise<{ success: boolean; error?: string }> => {
  console.log('📧 Enviando recuperação de senha para:', email);
  let providerSuccess = false;
  let providerError = '';

  // 1. Tenta envio através do pipeline (Edge Function, Resend, SendGrid)
  try {
    const res = await sendEmail({
      to: email,
      subject: 'TeOdonto Angola - Sua Senha Foi Recuperada',
      type: 'password_recovery',
      data: {
        nome,
        senhaTemporaria,
      },
    });
    if (res.success) {
      providerSuccess = true;
    } else {
      providerError = res.error || '';
    }
  } catch (err: any) {
    providerError = err?.message || 'Falha no envio';
  }

  // 2. Disparar resetPasswordForEmail nativo do Supabase Auth para a caixa de correio real
  try {
    const cleanEmail = email.trim().toLowerCase();
    const { error: nativeError } = await supabase.auth.resetPasswordForEmail(cleanEmail);
    if (!nativeError) {
      console.log('✔ Supabase Auth native resetPasswordForEmail enviado para:', cleanEmail);
      return { success: true };
    } else {
      console.warn('Supabase resetPasswordForEmail aviso:', nativeError.message);
    }
  } catch (e: any) {
    console.warn('Supabase resetPasswordForEmail erro:', e?.message);
  }

  if (providerSuccess) {
    return { success: true };
  }

  // Se nenhum dos canais automáticos remotos disparou com sucesso, reporta o aviso mas não quebra a operação
  return {
    success: false,
    error: providerError || 'Configure RESEND_API_KEY ou use os atalhos de E-mail / WhatsApp diretos.',
  };
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

/**
 * Envia um email de lembrete de consulta ao paciente.
 * Funciona via Edge Function send-email (tipo appointment_reminder).
 * Em caso de falha na EF, monta um email de texto simples como fallback interno.
 */
export const sendAppointmentReminderEmail = async (
  email: string,
  nomePaciente: string,
  dataConsulta: string,   // formato legível ex: "19/05/2026"
  horaConsulta: string,   // formato legível ex: "09:30"
  nomeDentista?: string,
  tipoConsulta?: string
): Promise<{ success: boolean; error?: string }> => {
  const dentistaNome = nomeDentista || 'o seu dentista';
  const tipo = tipoConsulta || 'Consulta Odontológica';
  return sendEmail({
    to: email,
    subject: `TeOdonto Angola – Lembrete: Consulta amanhã às ${horaConsulta}`,
    type: 'appointment_reminder',
    data: {
      nomePaciente,
      dataConsulta,
      horaConsulta,
      nomeDentista: dentistaNome,
      tipoConsulta: tipo,
      // Texto simples para fallback no handler da Edge Function
      textoSimples:
        `Olá ${nomePaciente},\n\n` +
        `Este é um lembrete de que tem uma consulta marcada para amanhã.\n\n` +
        `📅 Data: ${dataConsulta}\n` +
        `🕒 Hora: ${horaConsulta}\n` +
        `🦷 Tipo: ${tipo}\n` +
        `👨‍⚕️ Dentista: ${dentistaNome}\n\n` +
        `Por favor, confirme a sua presença e chegue com 10 minutos de antecedência.\n\n` +
        `Obrigado,\nEquipa Sorriso Digital – TeOdonto Angola`,
    },
  });
};
