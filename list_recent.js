
const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
const path = require('path');

async function listRecentPatients() {
  try {
    const appConfigPath = path.join(__dirname, 'app.json');
    const appConfig = JSON.parse(fs.readFileSync(appConfigPath, 'utf8'));
    const { SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY } = appConfig.expo.extra;

    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

    const { data, error } = await supabase
      .from('profiles')
      .select('email, nome, created_at, observacoes_gerais')
      .eq('tipo', 'paciente')
      .order('created_at', { ascending: false })
      .limit(5);

    if (error) {
      console.error('Error fetching patients:', error);
      return;
    }

    console.log('--- RECENT PATIENTS ---');
    console.log(JSON.stringify(data, null, 2));
    console.log('--------------------');
  } catch (err) {
    console.error('Script Error:', err.message);
  }
}

listRecentPatients();
