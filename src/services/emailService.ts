/**
 * Serviço de envio de emails
 * Integração com serviço de email (Resend, SendGrid, etc.)
 */

/**
 * Enviar email de recuperação de senha
 * Você pode integrar com Resend, SendGrid, ou outro serviço
 */
export const sendPasswordRecoveryEmail = async (
  email: string,
  nome: string,
  senhaTemporaria: string
): Promise<{ success: boolean; error?: string }> => {
  try {
    // Exemplo usando fetch para um endpoint de email
    // Você precisa implementar um endpoint backend que envie o email
    const response = await fetch('/api/send-email', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        to: email,
        subject: 'TeOdonto Angola - Sua Senha Foi Recuperada',
        type: 'password_recovery',
        data: {
          nome,
          senhaTemporaria,
        },
      }),
    });

    if (!response.ok) {
      const error = await response.json();
      return { success: false, error: error.message || 'Erro ao enviar email' };
    }

    return { success: true };
  } catch (error: any) {
    return {
      success: false,
      error: error.message || 'Erro ao enviar email de recuperação',
    };
  }
};

/**
 * Enviar email de boas-vindas para novo dentista
 */
export const sendWelcomeEmailToDentista = async (
  email: string,
  nome: string,
  senhaTemporaria: string
): Promise<{ success: boolean; error?: string }> => {
  try {
    const response = await fetch('/api/send-email', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        to: email,
        subject: 'TeOdonto Angola - Bem-vindo!',
        type: 'dentist_welcome',
        data: {
          nome,
          senhaTemporaria,
        },
      }),
    });

    if (!response.ok) {
      const error = await response.json();
      return { success: false, error: error.message || 'Erro ao enviar email' };
    }

    return { success: true };
  } catch (error: any) {
    return {
      success: false,
      error: error.message || 'Erro ao enviar email de boas-vindas',
    };
  }
};

/**
 * Enviar notificação de nova mensagem
 */
export const sendNewMessageNotificationEmail = async (
  email: string,
  recipientName: string,
  senderName: string,
  messagePreview: string
): Promise<{ success: boolean; error?: string }> => {
  try {
    const response = await fetch('/api/send-email', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        to: email,
        subject: `Nova mensagem de ${senderName}`,
        type: 'new_message',
        data: {
          recipientName,
          senderName,
          messagePreview,
        },
      }),
    });

    if (!response.ok) {
      const error = await response.json();
      return { success: false, error: error.message || 'Erro ao enviar email' };
    }

    return { success: true };
  } catch (error: any) {
    return {
      success: false,
      error: error.message || 'Erro ao enviar notificação de mensagem',
    };
  }
};
