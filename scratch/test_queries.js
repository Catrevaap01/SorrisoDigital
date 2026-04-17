
const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_ANON_KEY;
const supabase = createClient(supabaseUrl, supabaseKey);

async function testQueries() {
  console.log('Testing queries from generarRelatorioGeral...');
  
  try {
    const q1 = await supabase.from('profiles').select('id, nome, email, especialidade, crm, created_at').eq('tipo', 'dentista').limit(1);
    console.log('Profiles (dentista):', q1.error ? q1.error.message : 'OK');

    const q2 = await supabase.from('profiles').select('*', { count: 'exact', head: true }).eq('tipo', 'paciente');
    console.log('Profiles (paciente count):', q2.error ? q2.error.message : 'OK');

    const q3 = await supabase.from('triagens').select('dentista_id, status, updated_at').limit(1);
    console.log('Triagens:', q3.error ? q3.error.message : 'OK');

    const q4 = await supabase.from('appointments').select('symptoms,status,appointment_date,id').limit(1);
    console.log('Appointments (estimativa):', q4.error ? q4.error.message : 'OK');

    const q5 = await supabase.from('procedimentos_tratamento').select('*, plano:planos_tratamento(dentista_id)').limit(1);
    console.log('Procedimentos:', q5.error ? q5.error.message : 'OK');

    const q6 = await supabase.from('appointments').select('id, appointment_date, appointment_time, symptoms, status, valor_pago, patient_id, paciente:profiles!patient_id(nome)').limit(1);
    console.log('Appointments (financeiro):', q6.error ? q6.error.message : 'OK');

  } catch (err) {
    console.error('Crash:', err.message);
  }
}

testQueries();
