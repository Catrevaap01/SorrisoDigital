
const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
const path = require('path');

async function patchPatient() {
  try {
    const appConfigPath = path.join(__dirname, 'app.json');
    const appConfig = JSON.parse(fs.readFileSync(appConfigPath, 'utf8'));
    const { SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY } = appConfig.expo.extra;

    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
    
    // Set a known password for this patient so the user can test
    const newPass = 'PioTati2026!';
    
    const { data, error } = await supabase
      .from('profiles')
      .update({
        observacoes_gerais: `[SENHA]: ${newPass}`
      })
      .eq('email', 'antiniotati11@gmail.com')
      .select();

    if (error) {
      console.error('Error patching patient:', error);
      return;
    }

    console.log('--- PATIENT PATCHED ---');
    console.log(`New temporary password for antiniotati11@gmail.com: ${newPass}`);
    console.log(JSON.stringify(data, null, 2));
    console.log('-----------------------');
    
    // ALSO update the auth user password to match
    const { error: authError } = await supabase.auth.admin.updateUserById(
      data[0].id,
      { password: newPass }
    );
    
    if (authError) {
      console.error('Error updating auth password:', authError.message);
    } else {
      console.log('Auth password also updated successfully!');
    }
    
  } catch (err) {
    console.error('Script Error:', err.message);
  }
}

patchPatient();
