/**
 * Deploy Edge Functions via Supabase Management API.
 * Alternativa ao CLI quando não se tem access token.
 *
 * IMPORTANTE: Este script requer um Personal Access Token do Supabase.
 * Obtenha em: https://supabase.com/dashboard/account/tokens
 *
 * Uso: node scripts/deploy_edge_functions.js <ACCESS_TOKEN>
 */

const fs = require('fs');
const path = require('path');

const PROJECT_REF = 'yyscwmcghokyzhtcluif';
const API_BASE = 'https://api.supabase.com';

const ACCESS_TOKEN = process.argv[2];

if (!ACCESS_TOKEN) {
  console.log(`
========================================
 Deploy de Edge Functions — TeOdonto
========================================

Para fazer deploy, precisa de um Personal Access Token do Supabase.

1. Vá a: https://supabase.com/dashboard/account/tokens
2. Clique em "Generate new token"
3. Copie o token gerado
4. Execute novamente:

   node scripts/deploy_edge_functions.js <SEU_TOKEN>

OU, se preferir usar o CLI:

   npx supabase login
   npx supabase functions deploy send-email --project-ref ${PROJECT_REF}
   npx supabase functions deploy send-reminders --project-ref ${PROJECT_REF}
`);
  process.exit(1);
}

const headers = {
  'Authorization': `Bearer ${ACCESS_TOKEN}`,
  'Content-Type': 'application/json',
};

async function deployFunction(funcName) {
  console.log(`\n⏳ Fazendo deploy de ${funcName}...`);

  const funcDir = path.join(__dirname, '..', 'supabase', 'functions', funcName);
  const indexPath = path.join(funcDir, 'index.ts');

  if (!fs.existsSync(indexPath)) {
    console.log(`   ❌ Ficheiro não encontrado: ${indexPath}`);
    return false;
  }

  const sourceCode = fs.readFileSync(indexPath, 'utf8');

  // Verificar se a função já existe
  const checkRes = await fetch(
    `${API_BASE}/v1/projects/${PROJECT_REF}/functions/${funcName}`,
    { headers }
  );

  if (checkRes.ok) {
    // Actualizar função existente
    console.log(`   📝 Função já existe — actualizando...`);
    const updateRes = await fetch(
      `${API_BASE}/v1/projects/${PROJECT_REF}/functions/${funcName}`,
      {
        method: 'PATCH',
        headers,
        body: JSON.stringify({
          body: sourceCode,
          verify_jwt: false, // Necessário para pg_cron
        }),
      }
    );

    if (updateRes.ok) {
      console.log(`   ✅ ${funcName} actualizado com sucesso!`);
      return true;
    }

    const errBody = await updateRes.text();
    console.log(`   ❌ Erro ao actualizar: ${updateRes.status} — ${errBody}`);
    return false;
  }

  // Criar nova função
  const createRes = await fetch(
    `${API_BASE}/v1/projects/${PROJECT_REF}/functions`,
    {
      method: 'POST',
      headers,
      body: JSON.stringify({
        name: funcName,
        slug: funcName,
        body: sourceCode,
        verify_jwt: false,
      }),
    }
  );

  if (createRes.ok || createRes.status === 201) {
    console.log(`   ✅ ${funcName} criado com sucesso!`);
    return true;
  }

  const errBody = await createRes.text();
  console.log(`   ❌ Erro ao criar: ${createRes.status} — ${errBody}`);
  return false;
}

async function main() {
  console.log('========================================');
  console.log(' Deploy de Edge Functions — TeOdonto');
  console.log('========================================');

  // Verificar token
  const meRes = await fetch(`${API_BASE}/v1/projects`, { headers });
  if (!meRes.ok) {
    console.log('\n❌ Token inválido. Verifique o seu Personal Access Token.');
    console.log('   Obtenha em: https://supabase.com/dashboard/account/tokens');
    process.exit(1);
  }

  const functions = ['send-email', 'send-reminders'];
  const results = {};

  for (const func of functions) {
    results[func] = await deployFunction(func);
  }

  console.log('\n========================================');
  console.log(' Resultado do Deploy');
  console.log('========================================\n');

  for (const [func, ok] of Object.entries(results)) {
    console.log(`   ${ok ? '✅' : '❌'} ${func}`);
  }

  const allOk = Object.values(results).every(Boolean);
  if (allOk) {
    console.log('\n🎉 Todas as Edge Functions deployadas com sucesso!');
    console.log('\nPróximos passos:');
    console.log('   1. Configure RESEND_API_KEY em Dashboard → Settings → Edge Functions → Secrets');
    console.log('   2. Execute docs/REMINDER_CRON_SETUP.sql no SQL Editor');
    console.log('   3. (Opcional) Configure WhatsApp Business API tokens');
  }
  console.log();
}

main().catch(console.error);
