
import { supabase } from '../src/config/supabase';

async function testInsert() {
  const testData = {
    patient_id: 'd9e0b1a0-0000-0000-0000-000000000000', // Dummy
    appointment_date: '2026-04-14',
    appointment_time: '08:30:00',
    symptoms: 'Teste de inserção',
    status: 'agendamento_pendente_secretaria'
  };

  const { data, error } = await supabase.from('appointments').insert([testData]);
  console.log('Result:', { data, error });
}

testInsert();
