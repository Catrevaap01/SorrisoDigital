/// <reference path="./deno.d.ts" />
/**
 * Supabase Edge Function: send-email
 *
 * Envia emails transacionais para o TeOdonto Angola.
 * Suporta os tipos:
 *   - appointment_reminder   → Lembrete 24h antes da consulta
 *   - dentist_welcome        → Boas-vindas ao dentista (senha temp)
 *   - password_recovery      → Recuperação de senha
 *   - new_message            → Notificação de nova mensagem
 *
 * Provider: Resend (https://resend.com) — principal
 * Fallback:  Log + 200 em dev se RESEND_API_KEY não configurado
 *
 * Variáveis de ambiente (Supabase Dashboard → Settings → Edge Functions → Secrets):
 *   RESEND_API_KEY   → chave da API Resend
 *   FROM_EMAIL       → ex: "TeOdonto Angola <no-reply@seudominio.com>"
 */

// ─── Tipos ────────────────────────────────────────────────────────────────────

interface EmailPayload {
  to: string;
  subject?: string;
  type:
    | 'appointment_reminder'
    | 'dentist_welcome'
    | 'password_recovery'
    | 'new_message';
  data: Record<string, unknown>;
}

interface TemplateResult {
  subject: string;
  html: string;
  text: string;
}

// ─── CORS headers ─────────────────────────────────────────────────────────────

const CORS_HEADERS: Record<string, string> = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization, x-client-info, apikey',
};

// ─── Templates HTML ───────────────────────────────────────────────────────────

function baseTemplate(content: string, title: string): string {
  return `<!DOCTYPE html>
<html lang="pt">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>${title}</title>
  <style>
    body{margin:0;padding:0;background:#f0f4f8;font-family:'Segoe UI',Arial,sans-serif}
    .wrapper{max-width:600px;margin:32px auto;background:#fff;border-radius:16px;overflow:hidden;box-shadow:0 4px 24px rgba(0,0,0,.08)}
    .header{background:linear-gradient(135deg,#0e7490 0%,#155e75 100%);padding:36px 32px;text-align:center}
    .header h1{color:#fff;margin:0;font-size:24px;font-weight:700}
    .header .logo{font-size:40px;margin-bottom:12px;display:block}
    .body{padding:36px 32px;color:#1e293b}
    .body p{line-height:1.7;margin:0 0 16px;font-size:15px}
    .card{background:#f8fafc;border:1px solid #e2e8f0;border-radius:12px;padding:20px 24px;margin:24px 0}
    .row{display:flex;align-items:flex-start;gap:10px;margin-bottom:10px;font-size:15px}
    .row:last-child{margin-bottom:0}
    .icon{font-size:18px;width:24px;text-align:center;flex-shrink:0;margin-top:2px}
    .label{color:#64748b;font-size:12px;margin-bottom:2px}
    .value{font-weight:600;color:#0f172a}
    .highlight{background:#ecfdf5;border-left:4px solid #10b981;border-radius:0 8px 8px 0;padding:12px 16px;margin:20px 0;font-size:14px;color:#065f46}
    .alert{background:#fff7ed;border-left:4px solid #f59e0b;border-radius:0 8px 8px 0;padding:12px 16px;margin:20px 0;font-size:14px;color:#92400e}
    .footer{background:#f8fafc;padding:24px 32px;text-align:center;color:#94a3b8;font-size:13px;border-top:1px solid #e2e8f0}
  </style>
</head>
<body>
  <div class="wrapper">
    <div class="header">
      <span class="logo">🦷</span>
      <h1>Sorriso Digital – TeOdonto Angola</h1>
    </div>
    <div class="body">${content}</div>
    <div class="footer">
      <p>© 2026 Sorriso Digital – TeOdonto Angola 🇦🇴<br/>
      Email enviado automaticamente. Por favor não responda directamente.</p>
    </div>
  </div>
</body>
</html>`;
}

type TemplateMap = Record<EmailPayload['type'], (d: Record<string, unknown>) => TemplateResult>;

const templates: TemplateMap = {
  appointment_reminder: (d) => {
    const hora = String(d.horaConsulta ?? '—');
    const data = String(d.dataConsulta ?? '—');
    const paciente = String(d.nomePaciente ?? 'Paciente');
    const dentista = String(d.nomeDentista ?? 'o seu dentista');
    const tipo = String(d.tipoConsulta ?? 'Consulta Odontológica');
    return {
      subject: `🦷 Lembrete: Consulta amanhã às ${hora} – TeOdonto Angola`,
      html: baseTemplate(`
        <p>Olá <strong>${paciente}</strong>,</p>
        <p>Este é um lembrete amigável da sua consulta marcada para <strong>amanhã</strong>:</p>
        <div class="card">
          <div class="row"><span class="icon">📅</span><div><div class="label">Data</div><div class="value">${data}</div></div></div>
          <div class="row"><span class="icon">🕒</span><div><div class="label">Hora</div><div class="value">${hora}</div></div></div>
          <div class="row"><span class="icon">🦷</span><div><div class="label">Tipo</div><div class="value">${tipo}</div></div></div>
          <div class="row"><span class="icon">👨‍⚕️</span><div><div class="label">Dentista</div><div class="value">${dentista}</div></div></div>
        </div>
        <div class="highlight">✅ Chegue com <strong>10 minutos de antecedência</strong> e leve o seu documento de identificação.</div>
        <p>Se precisar de remarcar, entre em contacto o mais brevemente possível.</p>
        <p>Obrigado por confiar na <strong>Sorriso Digital</strong>! 😊</p>
      `, `Lembrete: Consulta amanhã às ${hora}`),
      text: `Olá ${paciente},\n\nLembrete: consulta amanhã às ${hora}.\n\nData: ${data}\nHora: ${hora}\nDentista: ${dentista}\n\nChegue 10 minutos antes.\n\nSorriso Digital – TeOdonto Angola`,
    };
  },

  dentist_welcome: (d) => {
    const nome = String(d.nome ?? 'Dentista');
    const senha = String(d.senhaTemporaria ?? '—');
    const email = String(d.email ?? '—');
    return {
      subject: `👋 Bem-vindo ao TeOdonto Angola, Dr(a). ${nome}!`,
      html: baseTemplate(`
        <p>Olá <strong>Dr(a). ${nome}</strong>,</p>
        <p>A sua conta foi criada com sucesso na plataforma <strong>TeOdonto Angola</strong>.</p>
        <div class="card">
          <div class="row"><span class="icon">📧</span><div><div class="label">Email</div><div class="value">${email}</div></div></div>
          <div class="row"><span class="icon">🔑</span><div><div class="label">Senha temporária</div><div class="value" style="font-family:monospace;font-size:18px;color:#0e7490">${senha}</div></div></div>
        </div>
        <div class="alert">⚠️ Por segurança, <strong>altere a senha</strong> no primeiro login. Esta senha expira em 24 horas.</div>
        <p>Bem-vindo à equipa! 🇦🇴</p>
      `, `Bem-vindo ao TeOdonto Angola`),
      text: `Bem-vindo Dr(a). ${nome}!\n\nSenha temporária: ${senha}\n\nAltere no primeiro login.\n\nTeOdonto Angola`,
    };
  },

  password_recovery: (d) => {
    const nome = String(d.nome ?? 'Utilizador');
    const senha = String(d.senhaTemporaria ?? '—');
    return {
      subject: `🔑 Recuperação de senha – TeOdonto Angola`,
      html: baseTemplate(`
        <p>Olá <strong>${nome}</strong>,</p>
        <p>Recebemos um pedido de recuperação de senha para a sua conta.</p>
        <div class="card">
          <div class="row"><span class="icon">🔑</span><div><div class="label">Nova senha temporária</div><div class="value" style="font-family:monospace;font-size:20px;color:#0e7490;letter-spacing:2px">${senha}</div></div></div>
        </div>
        <div class="alert">⚠️ Altere esta senha imediatamente após o login. Se não pediu esta recuperação, contacte o suporte.</div>
      `, 'Recuperação de senha'),
      text: `Olá ${nome},\n\nNova senha temporária: ${senha}\n\nAltere após o login.\n\nTeOdonto Angola`,
    };
  },

  new_message: (d) => {
    const recipient = String(d.recipientName ?? 'Utilizador');
    const sender = String(d.senderName ?? 'Alguém');
    const preview = String(d.messagePreview ?? '…');
    return {
      subject: `💬 Nova mensagem de ${sender} – TeOdonto Angola`,
      html: baseTemplate(`
        <p>Olá <strong>${recipient}</strong>,</p>
        <p>Tem uma nova mensagem de <strong>${sender}</strong>:</p>
        <div class="card" style="border-left:4px solid #0e7490">
          <p style="margin:0;font-style:italic;color:#334155">"${preview}"</p>
        </div>
        <p>Aceda à plataforma para responder.</p>
      `, `Nova mensagem de ${sender}`),
      text: `Nova mensagem de ${sender}:\n\n"${preview}"\n\nAceda ao TeOdonto Angola para responder.`,
    };
  },
};

// ─── Envio via Resend ─────────────────────────────────────────────────────────

async function sendViaResend(
  to: string,
  subject: string,
  html: string,
  text: string,
  apiKey: string,
  from: string,
): Promise<{ ok: boolean; error?: string }> {
  try {
    const res = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ from, to: [to], subject, html, text }),
    });

    if (res.ok) return { ok: true };
    const body = await res.text();
    return { ok: false, error: `Resend ${res.status}: ${body}` };
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Erro desconhecido';
    return { ok: false, error: msg };
  }
}

// ─── Handler (Deno.serve — API moderna Supabase Edge) ─────────────────────────

Deno.serve(async (req: Request): Promise<Response> => {
  // CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: CORS_HEADERS, status: 204 });
  }

  if (req.method !== 'POST') {
    return new Response(
      JSON.stringify({ success: false, message: 'Método não permitido' }),
      { status: 405, headers: { 'Content-Type': 'application/json', ...CORS_HEADERS } },
    );
  }

  try {
    const body = await req.json() as EmailPayload;
    const { to, subject: subjectOverride, type, data } = body;

    if (!to || !type) {
      return new Response(
        JSON.stringify({ success: false, message: 'Campos obrigatórios em falta: to, type' }),
        { status: 400, headers: { 'Content-Type': 'application/json', ...CORS_HEADERS } },
      );
    }

    const templateFn = templates[type];
    if (!templateFn) {
      return new Response(
        JSON.stringify({ success: false, message: `Tipo desconhecido: ${type}` }),
        { status: 400, headers: { 'Content-Type': 'application/json', ...CORS_HEADERS } },
      );
    }

    const { subject, html, text } = templateFn(data ?? {});
    const finalSubject = subjectOverride ?? subject;

    // Variáveis de ambiente (configurar em Supabase → Settings → Edge Functions → Secrets)
    const RESEND_API_KEY = Deno.env.get('RESEND_API_KEY');
    const FROM_EMAIL =
      Deno.env.get('FROM_EMAIL') ??
      'Sorriso Digital <no-reply@seudominio.com>';

    console.log(`[send-email] tipo=${type} to=${to} resend=${Boolean(RESEND_API_KEY)}`);

    if (RESEND_API_KEY) {
      const result = await sendViaResend(to, finalSubject, html, text, RESEND_API_KEY, FROM_EMAIL);
      if (result.ok) {
        console.log(`[send-email] ✅ enviado via Resend para ${to}`);
        return new Response(
          JSON.stringify({ success: true, provider: 'resend' }),
          { status: 200, headers: { 'Content-Type': 'application/json', ...CORS_HEADERS } },
        );
      }
      console.warn(`[send-email] Resend falhou: ${result.error}`);
    } else {
      console.warn('[send-email] RESEND_API_KEY não configurada — Supabase → Settings → Edge Functions → Secrets');
    }

    // Dev fallback: retorna 200 para não bloquear o fluxo da app
    return new Response(
      JSON.stringify({
        success: false,
        devMode: true,
        message: 'Configure RESEND_API_KEY em Supabase → Settings → Edge Functions → Secrets.',
        payload: { to, type, subject: finalSubject },
      }),
      { status: 200, headers: { 'Content-Type': 'application/json', ...CORS_HEADERS } },
    );
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Erro interno';
    console.error('[send-email] erro inesperado:', message);
    return new Response(
      JSON.stringify({ success: false, message }),
      { status: 500, headers: { 'Content-Type': 'application/json', ...CORS_HEADERS } },
    );
  }
});
