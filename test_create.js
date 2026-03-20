
const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
const path = require('path');

async function testCreate() {
  try {
    const appConfigPath = path.join(__dirname, 'app.json');
    const appConfig = JSON.parse(fs.readFileSync(appConfigPath, 'utf8'));
    const { SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY } = appConfig.expo.extra;

    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
    
    const testEmail = `test_${Date.now()}@example.com`;
    console.log(`Creating test patient: ${testEmail}`);

    // This simulates the logic in pacienteService.ts
    const tempPassword = 'TestPass123!';
    
    // 1. Create Auth User
    const { data: authData, error: authError } = await supabase.auth.admin.createUser({
      email: testEmail,
      password: tempPassword,
      email_confirm: true,
      user_metadata: { tipo: 'paciente' }
    });

    if (authError) throw authError;
    const userId = authData.user.id;

    // 2. Upsert Profile (simulating the failure of temp_password)
    const payload = {
      id: userId,
      email: testEmail,
      nome: 'Test Patient',
      tipo: 'paciente',
      temp_password: tempPassword, // This column likely doesn't exist
      observacoes_gerais: `[SENHA]: ${tempPassword}`,
      updated_at: new Date().toISOString()
    };

    console.log('Attempting upsert with temp_password...');
    const result1 = await supabase.from('profiles').upsert([payload]).select().single();
    
    if (result1.error) {
       console.log('Expected error:', result1.error.message);
       if (result1.error.message.includes('temp_password')) {
         console.log('Retrying without temp_password column...');
         const { temp_password, ...cleanPayload } = payload;
         const result2 = await supabase.from('profiles').upsert([cleanPayload]).select().single();
         if (result2.error) {
           console.error('Retry failed:', result2.error.message);
         } else {
           console.log('Retry SUCCESS! Data:', JSON.stringify(result2.data, null, 2));
         }
       }
    } else {
       console.log('Upsert worked? (Maybe column exists now?):', JSON.stringify(result1.data, null, 2));
    }

  } catch (err) {
    console.error('Test Error:', err.message);
  }
}

testCreate();
