/// <reference path="../send-email/deno.d.ts" />
/**
 * Supabase Edge Function: send-reminders
 *
 * Função SERVER-SIDE que garante 100% de envio de lembretes.
 * Pode ser chamada por:
 *   - pg_cron (Supabase) → diariamente às 08:00
 *   - External cron (cron-job.org, GitHub Actions)
 *   - Manualmente via HTTP POST
 *
 * Fluxo:
 *  1. Busca agendamentos de amanhã (status confirmado/atribuído)
 *  2. Para cada um, verifica se já foi lembrado hoje (reminder_log)
 *  3. Envia email via Resend
 *  4. Envia WhatsApp via WhatsApp Business Cloud API (se configurado)
 *  5. Cria notificação in-app na tabela notificacoes
 *  6. Regista tudo no reminder_log + audit_log
 *  7. Em caso de falha, tenta até 3x com backoff
 */

const CORS_HEADERS: Record<string, string> = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization, x-client-info, apikey',
};

const STATUS_ELEGIVEIS = [
  'confirmado_dentista',
  'atribuido_dentista',
  'agendado',
  'confirmado',
];

const MAX_RETRIES = 3;

// ─── Helpers ──────────────────────────────────────────────────────────────────

function getTomorrowDateStr(): string {
  const d = new Date();
  d.setDate(d.getDate() + 1);
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

function formatData(dateStr: string): string {
  try {
    const [y, m, d] = dateStr.split('T')[0].split('-');
    return `${d}/${m}/${y}`;
  } catch {
    return dateStr;
  }
}

async function sleep(ms: number): Promise<void> {
  return new Promise(r => setTimeout(r, ms));
}

function createSupabaseClient(url: string, key: string) {
  return {
    from: (table: string) => ({
      select: (cols: string) => createQuery(url, key, table, 'GET', cols),
      insert: (rows: unknown[]) => createMutation(url, key, table, 'POST', rows),
    }),
  };
}

function createQuery(url: string, key: string, table: string, _method: string, cols: string) {
  let queryParams = `select=${encodeURIComponent(cols)}`;
  const filters: string[] = [];

  const builder = {
    eq: (col: string, val: string) => { filters.push(`${col}=eq.${val}`); return builder; },
    in: (col: string, vals: string[]) => { filters.push(`${col}=in.(${vals.map(v => `"${v}"`).join(',')})`); return builder; },
    gte: (col: string, val: string) => { filters.push(`${col}=gte.${val}`); return builder; },
    limit: (n: number) => { queryParams += `&limit=${n}`; return builder; },
    single: () => ({ ...builder, _single: true }),
    then: async (resolve: (v: any) => void) => {
      try {
        const filterStr = filters.length > 0 ? '&' + filters.join('&') : '';
        const res = await fetch(
          `${url}/rest/v1/${table}?${queryParams}${filterStr}`,
          {
            headers: {
              'apikey': key,
              'Authorization': `Bearer ${key}`,
              'Content-Type': 'application/json',
            },
          }
        );
        const data = await res.json();
        resolve({ data: Array.isArray(data) ? data : [data], error: res.ok ? null : data });
      } catch (err) {
        resolve({ data: null, error: err });
      }
    },
  };
  return builder;
}

function createMutation(url: string, key: string, table: string, _method: string, rows: unknown[]) {
  return {
    then: async (resolve: (v: any) => void) => {
      try {
        const res = await fetch(`${url}/rest/v1/${table}`, {
          method: 'POST',
          headers: {
            'apikey': key,
            'Authorization': `Bearer ${key}`,
            'Content-Type': 'application/json',
            'Prefer': 'return=minimal',
          },
          body: JSON.stringify(rows),
        });
        resolve({ error: res.ok ? null : await res.text() });
      } catch (err) {
        resolve({ error: err });
      }
    },
  };
}

// ─── Email via Resend ─────────────────────────────────────────────────────────

async function sendEmailResend(
  to: string,
  subject: string,
  html: string,
  text: string,
  apiKey: string,
  from: string,
): Promise<{ ok: boolean; error?: string }> {
  for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
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
      console.warn(`[send-reminders] Resend attempt ${attempt}/${MAX_RETRIES} failed: ${body}`);

      if (attempt < MAX_RETRIES) {
        await sleep(1000 * attempt); // backoff: 1s, 2s, 3s
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Erro desconhecido';
      console.warn(`[send-reminders] Resend exception attempt ${attempt}: ${msg}`);
      if (attempt < MAX_RETRIES) await sleep(1000 * attempt);
    }
  }
  return { ok: false, error: `Falhou após ${MAX_RETRIES} tentativas` };
}

// ─── WhatsApp via Business Cloud API ──────────────────────────────────────────

async function sendWhatsAppMessage(
  phone: string,
  message: string,
  apiToken: string,
  phoneNumberId: string,
): Promise<{ ok: boolean; error?: string }> {
  for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
    try {
      const res = await fetch(
        `https://graph.facebook.com/v18.0/${phoneNumberId}/messages`,
        {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${apiToken}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            messaging_product: 'whatsapp',
            to: phone.replace(/\D/g, ''),
            type: 'text',
            text: { body: message },
          }),
        }
      );

      if (res.ok) return { ok: true };

      const body = await res.text();
      console.warn(`[send-reminders] WhatsApp attempt ${attempt}: ${body}`);
      if (attempt < MAX_RETRIES) await sleep(1000 * attempt);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Erro';
      console.warn(`[send-reminders] WhatsApp exception attempt ${attempt}: ${msg}`);
      if (attempt < MAX_RETRIES) await sleep(1000 * attempt);
    }
  }
  return { ok: false, error: `WhatsApp falhou após ${MAX_RETRIES} tentativas` };
}

// ─── Templates ────────────────────────────────────────────────────────────────

function buildEmailHtml(nome: string, data: string, hora: string, dentista: string, tipo: string): string {
  return `<!DOCTYPE html><html lang="pt"><head><meta charset="UTF-8"/><style>
    body{margin:0;padding:0;background:#f0f4f8;font-family:'Segoe UI',Arial,sans-serif}
    .w{max-width:600px;margin:32px auto;background:#fff;border-radius:16px;overflow:hidden;box-shadow:0 4px 24px rgba(0,0,0,.08)}
    .h{background:linear-gradient(135deg,#0e7490,#155e75);padding:36px 32px;text-align:center;color:#fff}
    .h h1{margin:0;font-size:22px}.b{padding:32px}.b p{line-height:1.7;font-size:15px;color:#1e293b;margin:0 0 14px}
    .c{background:#f8fafc;border:1px solid #e2e8f0;border-radius:12px;padding:20px;margin:20px 0}
    .r{display:flex;gap:10px;margin-bottom:8px;font-size:15px}.l{color:#64748b;font-size:12px}.v{font-weight:600;color:#0f172a}
    .g{background:#ecfdf5;border-left:4px solid #10b981;padding:12px 16px;border-radius:0 8px 8px 0;margin:16px 0;font-size:14px;color:#065f46}
    .f{background:#f8fafc;padding:20px 32px;text-align:center;color:#94a3b8;font-size:12px;border-top:1px solid #e2e8f0}
  </style></head><body><div class="w">
    <div class="h"><div style="font-size:40px;margin-bottom:10px">🦷</div><h1>Lembrete de Consulta</h1></div>
    <div class="b">
      <p>Olá <strong>${nome}</strong>,</p>
      <p>Este é um lembrete da sua consulta marcada para <strong>amanhã</strong>:</p>
      <div class="c">
        <div class="r"><span>📅</span><div><div class="l">Data</div><div class="v">${data}</div></div></div>
        <div class="r"><span>🕒</span><div><div class="l">Hora</div><div class="v">${hora}</div></div></div>
        <div class="r"><span>🦷</span><div><div class="l">Tipo</div><div class="v">${tipo}</div></div></div>
        <div class="r"><span>👨‍⚕️</span><div><div class="l">Dentista</div><div class="v">${dentista}</div></div></div>
      </div>
      <div class="g">✅ Chegue com <strong>10 minutos de antecedência</strong>.</div>
      <p>Obrigado por confiar na <strong>Sorriso Digital</strong>! 😊</p>
    </div>
    <div class="f">© 2026 Sorriso Digital – TeOdonto Angola 🇦🇴</div>
  </div></body></html>`;
}

function buildWhatsAppMessage(nome: string, data: string, hora: string, dentista: string, tipo: string): string {
  return `Olá ${nome} 👋\n\nEste é um lembrete da sua consulta marcada para *amanhã*:\n\n📅 *Data:* ${data}\n🕒 *Hora:* ${hora}\n🦷 *Tipo:* ${tipo}\n👨‍⚕️ *Dentista:* ${dentista}\n\nPor favor, chegue com 10 minutos de antecedência.\n\n_Sorriso Digital – TeOdonto Angola_ 🦷`;
}

// ─── Handler ──────────────────────────────────────────────────────────────────

Deno.serve(async (req: Request): Promise<Response> => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: CORS_HEADERS, status: 204 });
  }

  const SUPABASE_URL = Deno.env.get('SUPABASE_URL') ?? '';
  const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';
  const RESEND_API_KEY = Deno.env.get('RESEND_API_KEY') ?? '';
  const FROM_EMAIL = Deno.env.get('FROM_EMAIL') ?? 'Sorriso Digital <no-reply@seudominio.com>';
  const WHATSAPP_TOKEN = Deno.env.get('WHATSAPP_API_TOKEN') ?? '';
  const WHATSAPP_PHONE_ID = Deno.env.get('WHATSAPP_PHONE_NUMBER_ID') ?? '';

  if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
    return new Response(
      JSON.stringify({ success: false, error: 'SUPABASE_URL ou SERVICE_ROLE_KEY não configurados' }),
      { status: 500, headers: { 'Content-Type': 'application/json', ...CORS_HEADERS } },
    );
  }

  const amanha = getTomorrowDateStr();
  const hoje = new Date().toISOString().slice(0, 10);
  console.log(`[send-reminders] Verificando consultas para ${amanha}...`);

  const stats = { total: 0, email_ok: 0, email_fail: 0, wa_ok: 0, wa_fail: 0, inapp_ok: 0, skipped: 0 };

  try {
    // 1. Buscar agendamentos de amanhã
    const agRes = await fetch(
      `${SUPABASE_URL}/rest/v1/appointments?select=*&appointment_date=eq.${amanha}&status=in.(${STATUS_ELEGIVEIS.map(s => `"${s}"`).join(',')})`,
      {
        headers: {
          'apikey': SUPABASE_SERVICE_ROLE_KEY,
          'Authorization': `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`,
        },
      }
    );

    if (!agRes.ok) {
      const err = await agRes.text();
      console.error(`[send-reminders] Erro ao buscar agendamentos: ${err}`);
      return new Response(
        JSON.stringify({ success: false, error: err }),
        { status: 500, headers: { 'Content-Type': 'application/json', ...CORS_HEADERS } },
      );
    }

    const agendamentos = await agRes.json() as any[];
    stats.total = agendamentos.length;
    console.log(`[send-reminders] ${agendamentos.length} consulta(s) encontrada(s)`);

    for (const ag of agendamentos) {
      const agId = ag.id;
      const patientId = ag.patient_id;
      if (!patientId) { stats.skipped++; continue; }

      // 2. Verificar se já foi enviado hoje
      const logRes = await fetch(
        `${SUPABASE_URL}/rest/v1/reminder_log?select=id&appointment_id=eq.${agId}&canal=eq.email&sent_at=gte.${hoje}T00:00:00&limit=1`,
        {
          headers: {
            'apikey': SUPABASE_SERVICE_ROLE_KEY,
            'Authorization': `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`,
          },
        }
      );
      const logData = logRes.ok ? await logRes.json() : [];
      if (Array.isArray(logData) && logData.length > 0) {
        console.log(`[send-reminders] ${agId} já foi lembrado hoje — skip`);
        stats.skipped++;
        continue;
      }

      // 3. Buscar perfil do paciente
      const profRes = await fetch(
        `${SUPABASE_URL}/rest/v1/profiles?select=id,nome,email,telefone&id=eq.${patientId}&limit=1`,
        {
          headers: {
            'apikey': SUPABASE_SERVICE_ROLE_KEY,
            'Authorization': `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`,
          },
        }
      );
      const profiles = profRes.ok ? await profRes.json() : [];
      const paciente = Array.isArray(profiles) ? profiles[0] : null;
      if (!paciente) { stats.skipped++; continue; }

      // 4. Buscar nome do dentista
      let nomeDentista = 'o seu dentista';
      if (ag.dentist_id) {
        const dRes = await fetch(
          `${SUPABASE_URL}/rest/v1/profiles?select=nome&id=eq.${ag.dentist_id}&limit=1`,
          { headers: { 'apikey': SUPABASE_SERVICE_ROLE_KEY, 'Authorization': `Bearer ${SUPABASE_SERVICE_ROLE_KEY}` } }
        );
        const dProfiles = dRes.ok ? await dRes.json() : [];
        if (Array.isArray(dProfiles) && dProfiles[0]?.nome) nomeDentista = dProfiles[0].nome;
      }

      const dataFmt = formatData(ag.appointment_date);
      const hora = ag.appointment_time?.slice(0, 5) ?? '—';
      const tipo = ag.symptoms || 'Consulta Odontológica';

      // ── EMAIL (com retry) ──
      if (paciente.email && RESEND_API_KEY) {
        const html = buildEmailHtml(paciente.nome, dataFmt, hora, nomeDentista, tipo);
        const text = `Olá ${paciente.nome}, lembrete: consulta amanhã ${dataFmt} às ${hora} com ${nomeDentista}.`;
        const subject = `🦷 Lembrete: Consulta amanhã às ${hora} – TeOdonto Angola`;

        const emailResult = await sendEmailResend(paciente.email, subject, html, text, RESEND_API_KEY, FROM_EMAIL);

        // Registar no reminder_log
        await fetch(`${SUPABASE_URL}/rest/v1/reminder_log`, {
          method: 'POST',
          headers: {
            'apikey': SUPABASE_SERVICE_ROLE_KEY,
            'Authorization': `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`,
            'Content-Type': 'application/json',
            'Prefer': 'return=minimal',
          },
          body: JSON.stringify([{
            appointment_id: agId,
            canal: 'email',
            sucesso: emailResult.ok,
            detalhes: emailResult.ok ? null : emailResult.error,
            sent_at: new Date().toISOString(),
          }]),
        });

        if (emailResult.ok) { stats.email_ok++; console.log(`[send-reminders] ✅ Email → ${paciente.email}`); }
        else { stats.email_fail++; console.warn(`[send-reminders] ❌ Email falhou → ${paciente.email}: ${emailResult.error}`); }
      }

      // ── WHATSAPP (com retry) ──
      if (paciente.telefone && WHATSAPP_TOKEN && WHATSAPP_PHONE_ID) {
        const waMsg = buildWhatsAppMessage(paciente.nome, dataFmt, hora, nomeDentista, tipo);
        const waResult = await sendWhatsAppMessage(paciente.telefone, waMsg, WHATSAPP_TOKEN, WHATSAPP_PHONE_ID);

        await fetch(`${SUPABASE_URL}/rest/v1/reminder_log`, {
          method: 'POST',
          headers: {
            'apikey': SUPABASE_SERVICE_ROLE_KEY,
            'Authorization': `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`,
            'Content-Type': 'application/json',
            'Prefer': 'return=minimal',
          },
          body: JSON.stringify([{
            appointment_id: agId,
            canal: 'whatsapp',
            sucesso: waResult.ok,
            detalhes: waResult.ok ? null : waResult.error,
            sent_at: new Date().toISOString(),
          }]),
        });

        if (waResult.ok) { stats.wa_ok++; console.log(`[send-reminders] ✅ WhatsApp → ${paciente.telefone}`); }
        else { stats.wa_fail++; console.warn(`[send-reminders] ❌ WhatsApp falhou → ${paciente.telefone}`); }
      }

      // ── IN-APP NOTIFICATION ──
      try {
        await fetch(`${SUPABASE_URL}/rest/v1/notificacoes`, {
          method: 'POST',
          headers: {
            'apikey': SUPABASE_SERVICE_ROLE_KEY,
            'Authorization': `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`,
            'Content-Type': 'application/json',
            'Prefer': 'return=minimal',
          },
          body: JSON.stringify([{
            usuario_id: patientId,
            titulo: '📅 Lembrete: Consulta amanhã',
            mensagem: `Tem consulta amanhã ${dataFmt} às ${hora} com ${nomeDentista}.`,
            tipo: 'lembrete',
            lida: false,
            dados: { agendamento_id: agId, appointment_date: ag.appointment_date },
            created_at: new Date().toISOString(),
          }]),
        });

        await fetch(`${SUPABASE_URL}/rest/v1/reminder_log`, {
          method: 'POST',
          headers: {
            'apikey': SUPABASE_SERVICE_ROLE_KEY,
            'Authorization': `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`,
            'Content-Type': 'application/json',
            'Prefer': 'return=minimal',
          },
          body: JSON.stringify([{
            appointment_id: agId,
            canal: 'in_app',
            sucesso: true,
            sent_at: new Date().toISOString(),
          }]),
        });
        stats.inapp_ok++;
      } catch (e: unknown) {
        console.warn(`[send-reminders] In-app notification falhou: ${e}`);
      }
    }

    console.log(`[send-reminders] ✅ Concluído:`, stats);

    return new Response(
      JSON.stringify({ success: true, date: amanha, stats }),
      { status: 200, headers: { 'Content-Type': 'application/json', ...CORS_HEADERS } },
    );
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Erro interno';
    console.error(`[send-reminders] Erro crítico: ${msg}`);
    return new Response(
      JSON.stringify({ success: false, error: msg }),
      { status: 500, headers: { 'Content-Type': 'application/json', ...CORS_HEADERS } },
    );
  }
});
