/**
 * Script para criar um admin no Supabase
 * 
 * Uso:
 * node create-admin.js <email> <nome> <senha>
 * 
 * Exemplo:
 * node create-admin.js admin@teodonto.com "Administrador" "SenhaForte123!"
 */

const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL;
// Para operações administrativas precisamos da service_role key
const supabaseKey =
  process.env.SUPABASE_SERVICE_ROLE_KEY ||
  process.env.SUPABASE_SERVICE_KEY ||
  process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY ||
  process.env.SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error('❌ Erro: variáveis de ambiente do Supabase não estão definidas.');
  process.exit(1);
}

const isServiceRole = Boolean(process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_KEY);
if (!isServiceRole) {
  console.warn('⚠️ Aviso: usando chave anônima em modo admin. Isso pode falhar se não tiver privilégios.');
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function criarAdmin(email, nome, senha) {
  try {
    console.log('🔄 Criando usuário admin...\n');

    // 1. Criar usuário no Supabase Auth
    let authData = null;
    let authError = null;
    try {
      const res = await supabase.auth.admin.createUser({
        email,
        password: senha,
        email_confirm: true, // Confirmar email automaticamente
        user_metadata: {
          nome,
          tipo: 'admin',
        },
      });
      authData = res.data;
      authError = res.error;
    } catch (e) {
      authError = e;
    }

    if (authError) {
      console.log('DEBUG authError:', authError.message || authError);
      // se já existe, buscar o usuário existente e atualizar senha
      const msg = authError.message || authError.error || authError;
      if (
        authError.code === 'email_exists' ||
        /already.*registered/i.test(msg) ||
        /email.*exists/i.test(msg)
      ) {
        console.warn('⚠️ Usuário já registrado, atualizando dados e senha...');
        const listRes = await supabase.auth.admin.listUsers();
        const found = listRes.data?.users?.find(u => u.email?.toLowerCase() === email.toLowerCase());
        if (!found) {
          throw new Error(`Erro ao obter usuário existente: ${listRes.error?.message || 'Usuário não encontrado na lista'}`);
        }
        await supabase.auth.admin.updateUserById(found.id, {
          password: senha,
          email_confirm: true,
          user_metadata: {
            nome,
            tipo: 'admin',
          },
        });
        authData = { user: found };
        console.log('✅ Senha e metadata atualizados com sucesso no Supabase Auth.');
      } else {
        throw new Error(`Erro ao criar usuário auth: ${msg}`);
      }
    }

    console.log('✅ Usuário auth OK:', authData.user.id);

    // 2. Criar ou atualizar o perfil com tipo 'admin' (upsert para evitar conflito de chave primaria)
    let profileError = null;
    // dados base do perfil
    const perfilBase = {
      id: authData.user.id,
      email,
      nome,
      tipo: 'admin',
      senha_alterada: true, // Admin não é forçado a alterar; dentista é
      created_at: new Date().toISOString(),
    };

    try {
      const res = await supabase
        .from('profiles')
        .upsert([perfilBase], { onConflict: 'id' });
      profileError = res.error;
    } catch (e) {
      profileError = e;
    }

    // Se falhou porque coluna 'senha_alterada' não existe, tente novamente sem ela
    if (profileError && /senha_alterada/.test(profileError.message)) {
      const { senha_alterada, ...semSenhaAlterada } = perfilBase;
      const res2 = await supabase
        .from('profiles')
        .upsert([semSenhaAlterada], { onConflict: 'id' });
      profileError = res2.error;
    }
    if (profileError) {
      throw new Error(`Erro ao criar perfil: ${profileError.message}`);
    }

    console.log('✅ Perfil admin criado no banco de dados\n');

    // 3. Tentar enviar email de boas-vindas via função edge (se disponível)
    try {
      const payload = {
        to: email,
        subject: 'TeOdonto Angola - Bem-vindo!',
        type: 'dentist_welcome', // reusa mesmo tipo, não existe tipo específico para admin
        data: {
          nome,
          senhaTemporaria: senha,
        },
      };
      const fnRes = await supabase.functions.invoke('send-email', { body: payload });
      if (fnRes.error) {
        console.warn('⚠️ Falha ao enviar email de boas-vindas:', fnRes.error.message);
      } else {
        console.log('📧 Email de boas-vindas disparado com sucesso');
      }
    } catch (e) {
      console.warn('⚠️ Exceção ao chamar função de email:', e.message || e);
    }

    // 4. Exibir resumo
    console.log('=' .repeat(50));
    console.log('🎉 ADMIN CRIADO COM SUCESSO!\n');
    console.log('Detalhes da Conta:');
    console.log('-'.repeat(50));
    console.log(`📧 Email: ${email}`);
    console.log(`👤 Nome: ${nome}`);
    console.log(`🔑 Senha: ${senha}`);
    console.log(`🆔 User ID: ${authData.user.id}`);
    console.log(`👑 Tipo: admin`);
    console.log(`🔄 Precisa alterar senha na 1ª login: NÃO (opcional)`);
    console.log('-'.repeat(50));
    console.log('\n⚠️  IMPORTANTE:');
    console.log('1. Compartilhe essas credenciais com o admin com segurança');
    console.log('2. O admin pode alterar a senha quando quiser (opcional)');
    console.log('3. Acesso ao AdminDashboard é imediato (sem tela de alterar senha)\n');
    console.log('=' .repeat(50));

  } catch (error) {
    console.error('❌ Erro:', error.message);
    process.exit(1);
  }
}

// Obter argumentos da linha de comando
const args = process.argv.slice(2);

if (args.length < 3) {
  console.log('\n📝 Uso:');
  console.log('   node create-admin.js <email> <nome> <senha>\n');
  console.log('Exemplo:');
  console.log('   node create-admin.js admin@teodonto.com "Administrador" "SenhaForte123!"\n');
  process.exit(1);
}

const [email, nome, senha] = args;

// Validar email
if (!email.includes('@')) {
  console.error('❌ Email inválido');
  process.exit(1);
}

// Validar senha (mínimo 8 caracteres)
if (senha.length < 8) {
  console.error('❌ Senha deve ter no mínimo 8 caracteres');
  process.exit(1);
}

criarAdmin(email, nome, senha);
