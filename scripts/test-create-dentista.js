const { createClient } = require('@supabase/supabase-js');

(async () => {
  const url = 'https://yyscwmcghokyzhtcluif.supabase.co';
  const key = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inl5c2N3bWNnaG9reXpodGNsdWlmIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzIwNjgyOTYsImV4cCI6MjA4NzY0NDI5Nn0.cgpvENp4tnmblre10I2x7PxqSKOtrOPUAEOIi5RyOeg';
  const supabase = createClient(url, key);

  try {
    const email = `testdentista${Date.now()}@example.com`;
    const senha = 'Senha123';
    const nome = 'Teste Dentista';
    const especialidade = 'Ortodontia';
    const crm = 'CRM' + Math.floor(Math.random()*100000);

    console.log('Signing up');
    const { data: authData, error: authError } = await supabase.auth.signUp({
      email,
      password: senha,
      options: {
        shouldCreateSession: false,
        data: {
          nome,
          tipo: 'dentista',
          role: 'dentista',
          especialidade,
          crm,
          force_password_change: true,
        },
      },
    });
    console.log('auth error', authError);
    console.log('auth data', authData);
    if (authError) return;
    const userId = authData.user.id;
    console.log('updating profile');
    const profilePayload = {
      id: userId,
      email,
      nome,
      tipo: 'dentista',
      especialidade,
      crm,
      numero_registro: crm,
      telefone: null,
      provincia: null,
      created_at: new Date().toISOString(),
    };
    const { data, error } = await supabase
      .from('profiles')
      .upsert([profilePayload], { onConflict: 'id' })
      .select()
      .single();
    console.log('upsert error', error);
    console.log('upsert data', data);
  } catch (e) {
    console.error('exception', e);
  }
})();
