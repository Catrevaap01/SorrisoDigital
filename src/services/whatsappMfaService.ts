/**
 * Serviço de Verificação em Duas Etapas (2FA) via WhatsApp
 * TeOdonto Angola — Sistema Digital de Odontologia
 */

import { Linking, Platform } from 'react-native';
import { supabase } from '../config/supabase';
import { logger } from '../utils/logger';

export interface WhatsAppMfaChallenge {
  code: string;
  phone: string;
  expiresAt: number;
}

/**
 * Normaliza o número de telefone para o padrão WhatsApp internacional (Angola: 244).
 */
export const sanitizeWhatsAppPhone = (phoneRaw: string): string => {
  let cleaned = (phoneRaw || '').replace(/\D/g, '');
  if (!cleaned) return '';

  // Se já começar com 244 e tiver 12 dígitos (ex: 244923456789)
  if (cleaned.startsWith('244') && cleaned.length >= 11) {
    return cleaned;
  }

  // Se for número local de Angola com 9 dígitos (ex: 923456789)
  if (cleaned.length === 9 && cleaned.startsWith('9')) {
    return `244${cleaned}`;
  }

  // Se tiver 9 dígitos mas outro prefixo
  if (cleaned.length === 9) {
    return `244${cleaned}`;
  }

  return cleaned;
};

/**
 * Abre o WhatsApp (app nativo ou Web) com a mensagem contendo o código de 6 dígitos.
 */
export const sendWhatsAppMessage = async (
  phoneRaw: string,
  nome: string,
  code: string
): Promise<{ success: boolean; error?: string }> => {
  try {
    const phone = sanitizeWhatsAppPhone(phoneRaw);
    if (!phone || phone.length < 9) {
      return { success: false, error: 'Número de telefone WhatsApp inválido.' };
    }

    const mensagem =
      `🦷 *TeOdonto Angola — Verificação em Duas Etapas*\n\n` +
      `Olá, *${nome || 'Utilizador'}*! 👋\n\n` +
      `O seu código de segurança para aceder ao sistema é:\n` +
      `👉 *${code}* 👈\n\n` +
      `⏱️ Este código é válido por *10 minutos*.\n` +
      `🔒 Nunca partilhe este código com ninguém.\n\n` +
      `_Sistema Digital de Odontologia de Angola_`;

    const url = `https://wa.me/${phone}?text=${encodeURIComponent(mensagem)}`;

    if (Platform.OS === 'web') {
      if (typeof window !== 'undefined') {
        window.open(url, '_blank', 'noopener,noreferrer');
      }
      return { success: true };
    }

    const canOpen = await Linking.canOpenURL(url);
    if (!canOpen) {
      const fallbackUrl = `https://web.whatsapp.com/send?phone=${phone}&text=${encodeURIComponent(mensagem)}`;
      await Linking.openURL(fallbackUrl);
      return { success: true };
    }

    await Linking.openURL(url);
    return { success: true };
  } catch (err: any) {
    logger.warn('Erro ao abrir link do WhatsApp:', err);
    return { success: false, error: err?.message || 'Falha ao contactar o WhatsApp.' };
  }
};

// Armazenamento em memória para desafios activos durante a sessão de login
const activeChallenges = new Map<string, WhatsAppMfaChallenge>();

/**
 * Gera um código de 6 dígitos, salva o desafio e dispara para o WhatsApp do utilizador.
 */
export const generateAndSendWhatsAppOtp = async (params: {
  userId: string;
  nome: string;
  telefone: string;
}): Promise<{ success: boolean; challenge?: WhatsAppMfaChallenge; error?: string }> => {
  try {
    const { userId, nome, telefone } = params;

    const phone = sanitizeWhatsAppPhone(telefone);
    if (!phone) {
      return {
        success: false,
        error: 'Nenhum número de telefone associado à conta para envio do WhatsApp.',
      };
    }

    // Gerar código de 6 dígitos
    const code = Math.floor(100000 + Math.random() * 900000).toString();
    const expiresAt = Date.now() + 10 * 60 * 1000; // 10 minutos de validade

    const challengeData: WhatsAppMfaChallenge = {
      code,
      phone,
      expiresAt,
    };

    // 1. Guardar em memória
    activeChallenges.set(userId, challengeData);

    // 2. Persistir no perfil (temp_password) para redundância segura
    try {
      await supabase
        .from('profiles')
        .update({
          temp_password: `WA_OTP:${code}:${expiresAt}`,
        })
        .eq('id', userId);
    } catch (dbErr) {
      logger.warn('Aviso: Não foi possível persistir OTP na BD (usando memória):', dbErr);
    }

    // 3. Abrir/Enviar mensagem WhatsApp
    await sendWhatsAppMessage(phone, nome, code);

    return {
      success: true,
      challenge: challengeData,
    };
  } catch (err: any) {
    logger.error('Erro ao gerar código WhatsApp 2FA:', err);
    return { success: false, error: err?.message || 'Erro ao gerar código WhatsApp' };
  }
};

/**
 * Reenvia o código activo para o WhatsApp do utilizador.
 */
export const resendWhatsAppOtp = async (
  userId: string,
  nome: string,
  telefone: string
): Promise<{ success: boolean; error?: string }> => {
  let challenge = activeChallenges.get(userId);

  // Se já expirou ou não existe, gera um novo
  if (!challenge || Date.now() > challenge.expiresAt) {
    const res = await generateAndSendWhatsAppOtp({ userId, nome, telefone });
    return { success: res.success, error: res.error };
  }

  return await sendWhatsAppMessage(challenge.phone || telefone, nome, challenge.code);
};

/**
 * Valida o código introduzido pelo utilizador contra o desafio gerado.
 */
export const verifyWhatsAppOtp = async (
  userId: string,
  inputCode: string
): Promise<{ success: boolean; error?: string }> => {
  try {
    const cleanInput = (inputCode || '').replace(/\D/g, '').trim();
    if (cleanInput.length !== 6) {
      return { success: false, error: 'O código deve conter 6 dígitos.' };
    }

    // 1. Verificar em memória primeiro
    let challenge = activeChallenges.get(userId);

    // 2. Fallback para verificação no perfil da BD
    if (!challenge) {
      const { data: prof } = await supabase
        .from('profiles')
        .select('temp_password')
        .eq('id', userId)
        .maybeSingle();

      if (prof?.temp_password && prof.temp_password.startsWith('WA_OTP:')) {
        const parts = prof.temp_password.split(':');
        challenge = {
          code: parts[1],
          phone: '',
          expiresAt: parseInt(parts[2], 10),
        };
      }
    }

    if (!challenge) {
      return {
        success: false,
        error: 'Nenhum código pendente. Solicite um novo código via WhatsApp.',
      };
    }

    if (Date.now() > challenge.expiresAt) {
      activeChallenges.delete(userId);
      return {
        success: false,
        error: 'O código de verificação expirou (10 min). Solicite outro código.',
      };
    }

    if (challenge.code !== cleanInput) {
      return {
        success: false,
        error: 'Código de verificação incorreto. Verifique o seu WhatsApp.',
      };
    }

    // Sucesso: limpar o código usado
    activeChallenges.delete(userId);
    try {
      await supabase
        .from('profiles')
        .update({ temp_password: null })
        .eq('id', userId);
    } catch {
      // Ignora erro ao limpar
    }

    return { success: true };
  } catch (err: any) {
    return { success: false, error: err?.message || 'Erro ao validar código.' };
  }
};
