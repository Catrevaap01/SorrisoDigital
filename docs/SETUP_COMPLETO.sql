-- TEODONTO ANGOLA - SETUP COMPLETO DO BANCO DE DADOS
-- Executar este ficheiro no Supabase SQL Editor

CREATE EXTENSION IF NOT EXISTS "pgcrypto";
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

CREATE TABLE IF NOT EXISTS provincias (
  id SERIAL PRIMARY KEY,
  nome TEXT UNIQUE NOT NULL
);

INSERT INTO provincias (nome) VALUES
  ('Luanda'), ('Benguela'), ('Huambo'), ('Huila'), ('Bie'),
  ('Malanje'), ('Uige'), ('Zaire'), ('Cabinda'), ('Cunene'),
  ('Cuando Cubango'), ('Cuanza Norte'), ('Cuanza Sul'),
  ('Lunda Norte'), ('Lunda Sul'), ('Moxico'), ('Namibe'), ('Bengo')
ON CONFLICT DO NOTHING;

CREATE TABLE IF NOT EXISTS profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  nome TEXT NOT NULL DEFAULT 'Usuario',
  email TEXT NOT NULL,
  tipo TEXT NOT NULL DEFAULT 'paciente'
    CHECK (tipo IN ('paciente', 'dentista', 'medico', 'secretario', 'admin')),
  telefone TEXT,
  provincia_id INTEGER REFERENCES provincias(id) ON DELETE SET NULL,
  provincia TEXT,
  crm TEXT,
  cro TEXT,
  numero_registro TEXT,
  especialidade TEXT,
  historico_medico TEXT,
  alergias TEXT,
  medicamentos_atuais TEXT,
  data_nascimento DATE,
  genero TEXT,
  idade INTEGER,
  observacoes_gerais TEXT,
  documentos_urls TEXT[] DEFAULT '{}',
  foto_url TEXT,
  senha_alterada BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_profiles_tipo ON profiles(tipo);
CREATE INDEX IF NOT EXISTS idx_profiles_provincia ON profiles(provincia_id);
CREATE INDEX IF NOT EXISTS idx_profiles_email ON profiles(email);

CREATE TABLE IF NOT EXISTS triagens (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  paciente_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  dentista_id UUID REFERENCES profiles(id) ON DELETE SET NULL,
  secretario_id UUID REFERENCES profiles(id) ON DELETE SET NULL,
  sintoma_principal TEXT,
  descricao TEXT,
  duracao TEXT,
  localizacao TEXT,
  intensidade_dor INTEGER CHECK (intensidade_dor BETWEEN 0 AND 10),
  imagens TEXT[],
  prioridade TEXT CHECK (prioridade IN ('baixa','normal','alta','urgente')),
  status TEXT DEFAULT 'pendente'
    CHECK (status IN ('pendente','em_triagem','respondida','atribuida','recusada','cancelada')),
  data_agendamento TIMESTAMPTZ,
  observacoes TEXT,
  motivo_recusa TEXT,
  especialidade_sugerida TEXT,
  justificativa_especialidade TEXT,
  status_checkin TEXT DEFAULT 'pendente',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_triagens_paciente ON triagens(paciente_id);
CREATE INDEX IF NOT EXISTS idx_triagens_dentista ON triagens(dentista_id);
CREATE INDEX IF NOT EXISTS idx_triagens_secretario ON triagens(secretario_id);
CREATE INDEX IF NOT EXISTS idx_triagens_status ON triagens(status);

CREATE TABLE IF NOT EXISTS appointments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  patient_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  dentist_id UUID REFERENCES profiles(id) ON DELETE SET NULL,
  secretary_id UUID REFERENCES profiles(id) ON DELETE SET NULL,
  triagem_id UUID REFERENCES triagens(id) ON DELETE SET NULL,
  symptoms TEXT NOT NULL,
  urgency TEXT NOT NULL DEFAULT 'normal'
    CHECK (urgency IN ('baixa','normal','alta','urgente')),
  priority TEXT NOT NULL DEFAULT 'normal'
    CHECK (priority IN ('baixa','normal','alta','urgente')),
  reason TEXT,
  notes TEXT,
  appointment_date DATE,
  appointment_time TIME,
  status TEXT NOT NULL DEFAULT 'solicitado'
    CHECK (status IN (
      'solicitado','agendamento_pendente_secretaria','em_triagem','aguardando_dentista',
      'atribuido_dentista','confirmado_dentista','rejeitado_dentista','reagendamento_solicitado',
      'notificado_paciente','confirmado_paciente','realizado','cancelado'
    )),
  confirmed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT unique_dentist_slot UNIQUE (dentist_id, appointment_date, appointment_time)
);

CREATE INDEX IF NOT EXISTS idx_appointments_patient ON appointments(patient_id);
CREATE INDEX IF NOT EXISTS idx_appointments_dentist ON appointments(dentist_id);
CREATE INDEX IF NOT EXISTS idx_appointments_secretary ON appointments(secretary_id);
CREATE INDEX IF NOT EXISTS idx_appointments_status ON appointments(status);

CREATE TABLE IF NOT EXISTS respostas_triagem (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  triagem_id UUID NOT NULL REFERENCES triagens(id) ON DELETE CASCADE,
  dentista_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  orientacao TEXT,
  recomendacao TEXT,
  observacoes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_respostas_triagem ON respostas_triagem(triagem_id);

CREATE TABLE IF NOT EXISTS anamneses (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  paciente_id UUID REFERENCES profiles(id) ON DELETE CASCADE,
  dentista_id UUID REFERENCES profiles(id) ON DELETE SET NULL,
  triagem_id UUID REFERENCES triagens(id) ON DELETE SET NULL,
  queixa_principal TEXT,
  hda TEXT,
  alergico BOOLEAN DEFAULT FALSE,
  alergias_desc TEXT,
  em_tratamento BOOLEAN DEFAULT FALSE,
  tratamento_desc TEXT,
  medicamentos TEXT,
  hipertensao BOOLEAN DEFAULT FALSE,
  diabetes BOOLEAN DEFAULT FALSE,
  cardiopatia BOOLEAN DEFAULT FALSE,
  coagulopatia BOOLEAN DEFAULT FALSE,
  hepatite BOOLEAN DEFAULT FALSE,
  hiv BOOLEAN DEFAULT FALSE,
  outras_doencas TEXT,
  fuma BOOLEAN DEFAULT FALSE,
  alcool BOOLEAN DEFAULT FALSE,
  gravida BOOLEAN DEFAULT FALSE,
  amamentando BOOLEAN DEFAULT FALSE,
  ultima_consulta TEXT,
  escovacoes_dia TEXT DEFAULT '2',
  usa_fio_dental BOOLEAN DEFAULT FALSE,
  observacoes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(paciente_id)
);

CREATE INDEX IF NOT EXISTS idx_anamneses_paciente ON anamneses(paciente_id);

CREATE TABLE IF NOT EXISTS planos_tratamento (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  paciente_id UUID REFERENCES profiles(id) ON DELETE CASCADE,
  dentista_id UUID REFERENCES profiles(id) ON DELETE SET NULL,
  triagem_id UUID REFERENCES triagens(id) ON DELETE SET NULL,
  status TEXT DEFAULT 'ativo' CHECK (status IN ('ativo','pausado','concluido','cancelado')),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_planos_paciente ON planos_tratamento(paciente_id);

CREATE TABLE IF NOT EXISTS procedimentos_tratamento (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  plano_id UUID REFERENCES planos_tratamento(id) ON DELETE CASCADE,
  descricao TEXT NOT NULL,
  dente TEXT,
  status TEXT DEFAULT 'pendente' CHECK (status IN ('pendente','em_curso','concluido','cancelado')),
  valor DECIMAL(12,2) DEFAULT 0,
  observacoes TEXT,
  sessao_numero INTEGER,
  status_financeiro TEXT DEFAULT 'sem_factura',
  numero_factura TEXT,
  factura_emitida_em TIMESTAMPTZ,
  pago_em TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_procedimentos_plano ON procedimentos_tratamento(plano_id);
ALTER TABLE IF EXISTS procedimentos_tratamento ADD COLUMN IF NOT EXISTS sessao_numero INTEGER;
ALTER TABLE IF EXISTS procedimentos_tratamento ADD COLUMN IF NOT EXISTS status_financeiro TEXT DEFAULT 'sem_factura';
ALTER TABLE IF EXISTS procedimentos_tratamento ADD COLUMN IF NOT EXISTS numero_factura TEXT;
ALTER TABLE IF EXISTS procedimentos_tratamento ADD COLUMN IF NOT EXISTS factura_emitida_em TIMESTAMPTZ;
ALTER TABLE IF EXISTS procedimentos_tratamento ADD COLUMN IF NOT EXISTS pago_em TIMESTAMPTZ;

CREATE TABLE IF NOT EXISTS evolucoes_clinicas (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  paciente_id UUID REFERENCES profiles(id) ON DELETE CASCADE,
  dentista_id UUID REFERENCES profiles(id) ON DELETE SET NULL,
  triagem_id UUID REFERENCES triagens(id) ON DELETE SET NULL,
  descricao TEXT,
  procedimento_realizado TEXT,
  observacoes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_evolucoes_paciente ON evolucoes_clinicas(paciente_id);

CREATE TABLE IF NOT EXISTS prescricoes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  paciente_id UUID REFERENCES profiles(id) ON DELETE CASCADE,
  dentista_id UUID REFERENCES profiles(id) ON DELETE SET NULL,
  triagem_id UUID REFERENCES triagens(id) ON DELETE SET NULL,
  medicamentos JSONB,
  observacoes TEXT,
  dentista_nome TEXT,
  dentista_crm TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_prescricoes_paciente ON prescricoes(paciente_id);

CREATE TABLE IF NOT EXISTS conversations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  participant_1_id UUID REFERENCES profiles(id) ON DELETE CASCADE,
  participant_1_name TEXT,
  participant_1_avatar TEXT,
  participant_2_id UUID REFERENCES profiles(id) ON DELETE CASCADE,
  participant_2_name TEXT,
  participant_2_avatar TEXT,
  last_message TEXT,
  last_message_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_conversations_participants ON conversations(participant_1_id, participant_2_id);

CREATE TABLE IF NOT EXISTS messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id UUID REFERENCES conversations(id) ON DELETE CASCADE,
  sender_id UUID REFERENCES profiles(id) ON DELETE CASCADE,
  sender_name TEXT,
  sender_avatar TEXT,
  content TEXT,
  read BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_messages_conversation ON messages(conversation_id);
CREATE INDEX IF NOT EXISTS idx_messages_sender ON messages(sender_id);

ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE triagens ENABLE ROW LEVEL SECURITY;
ALTER TABLE appointments ENABLE ROW LEVEL SECURITY;
ALTER TABLE respostas_triagem ENABLE ROW LEVEL SECURITY;
ALTER TABLE anamneses ENABLE ROW LEVEL SECURITY;
ALTER TABLE planos_tratamento ENABLE ROW LEVEL SECURITY;
ALTER TABLE procedimentos_tratamento ENABLE ROW LEVEL SECURITY;
ALTER TABLE evolucoes_clinicas ENABLE ROW LEVEL SECURITY;
ALTER TABLE prescricoes ENABLE ROW LEVEL SECURITY;
ALTER TABLE conversations ENABLE ROW LEVEL SECURITY;
ALTER TABLE messages ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION public.is_admin() RETURNS BOOLEAN LANGUAGE sql STABLE SECURITY DEFINER AS $$
  SELECT EXISTS(SELECT 1 FROM profiles WHERE id = auth.uid() AND tipo = 'admin');
$$;
GRANT EXECUTE ON FUNCTION public.is_admin() TO authenticated;

CREATE OR REPLACE FUNCTION public.is_secretario() RETURNS BOOLEAN LANGUAGE sql STABLE SECURITY DEFINER AS $$
  SELECT EXISTS(SELECT 1 FROM profiles WHERE id = auth.uid() AND tipo = 'secretario');
$$;
GRANT EXECUTE ON FUNCTION public.is_secretario() TO authenticated;

CREATE OR REPLACE FUNCTION public.is_healthcare_pro() RETURNS BOOLEAN LANGUAGE sql STABLE SECURITY DEFINER AS $$
  SELECT EXISTS(SELECT 1 FROM profiles WHERE id = auth.uid() AND tipo IN ('dentista','medico','secretario','admin'));
$$;
GRANT EXECUTE ON FUNCTION public.is_healthcare_pro() TO authenticated;

CREATE OR REPLACE FUNCTION public.current_user_tipo() RETURNS TEXT LANGUAGE sql STABLE SECURITY DEFINER AS $$
  SELECT tipo FROM profiles WHERE id = auth.uid() LIMIT 1;
$$;
GRANT EXECUTE ON FUNCTION public.current_user_tipo() TO authenticated;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE OR REPLACE FUNCTION public.handle_new_user() RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_provincia_id INTEGER;
BEGIN
  SELECT id INTO v_provincia_id FROM provincias WHERE nome = 'Luanda' LIMIT 1;
  INSERT INTO profiles (id, email, nome, tipo, provincia_id, created_at, updated_at)
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'nome', 'Usuario'),
    COALESCE(NEW.raw_user_meta_data->>'tipo', 'paciente'),
    v_provincia_id,
    NOW(),
    NOW()
  );
  RETURN NEW;
END;
$$;
CREATE TRIGGER on_auth_user_created AFTER INSERT ON auth.users FOR EACH ROW EXECUTE FUNCTION handle_new_user();

DROP POLICY IF EXISTS "profiles_own_access" ON profiles;
DROP POLICY IF EXISTS "profiles_pro_public" ON profiles;
DROP POLICY IF EXISTS "profiles_admin_all" ON profiles;
DROP POLICY IF EXISTS "profiles_staff_read_all" ON profiles;
CREATE POLICY "profiles_own_access" ON profiles FOR ALL USING (auth.uid() = id);
CREATE POLICY "profiles_pro_public" ON profiles FOR SELECT USING (tipo IN ('dentista', 'medico'));
CREATE POLICY "profiles_staff_read_all" ON profiles FOR SELECT USING (public.is_healthcare_pro() OR public.is_admin());
CREATE POLICY "profiles_admin_all" ON profiles FOR ALL USING (public.is_admin());

DROP POLICY IF EXISTS "triagens_paciente_own" ON triagens;
DROP POLICY IF EXISTS "triagens_secretario_all" ON triagens;
DROP POLICY IF EXISTS "triagens_dentista_assigned" ON triagens;
DROP POLICY IF EXISTS "triagens_admin_all" ON triagens;
CREATE POLICY "triagens_paciente_own" ON triagens FOR ALL USING (auth.uid() = paciente_id);
CREATE POLICY "triagens_secretario_all" ON triagens FOR ALL USING (public.is_secretario());
CREATE POLICY "triagens_dentista_assigned" ON triagens FOR ALL USING (auth.uid() = dentista_id);
CREATE POLICY "triagens_admin_all" ON triagens FOR ALL USING (public.is_admin());

DROP POLICY IF EXISTS "appointments_paciente_own" ON appointments;
DROP POLICY IF EXISTS "appointments_secretario_all" ON appointments;
DROP POLICY IF EXISTS "appointments_dentista_assigned" ON appointments;
DROP POLICY IF EXISTS "appointments_admin_all" ON appointments;
CREATE POLICY "appointments_paciente_own" ON appointments FOR ALL USING (auth.uid() = patient_id);
CREATE POLICY "appointments_secretario_all" ON appointments FOR ALL USING (public.is_secretario());
CREATE POLICY "appointments_dentista_assigned" ON appointments FOR ALL USING (auth.uid() = dentist_id);
CREATE POLICY "appointments_admin_all" ON appointments FOR ALL USING (public.is_admin());

DROP POLICY IF EXISTS "clinical_anamneses_paciente" ON anamneses;
DROP POLICY IF EXISTS "clinical_anamneses_pro" ON anamneses;
DROP POLICY IF EXISTS "clinical_anamneses_admin" ON anamneses;
CREATE POLICY "clinical_anamneses_paciente" ON anamneses FOR ALL USING (auth.uid() = paciente_id);
CREATE POLICY "clinical_anamneses_pro" ON anamneses FOR ALL USING (public.is_healthcare_pro());
CREATE POLICY "clinical_anamneses_admin" ON anamneses FOR ALL USING (public.is_admin());

DROP POLICY IF EXISTS "clinical_planos_paciente" ON planos_tratamento;
DROP POLICY IF EXISTS "clinical_planos_pro" ON planos_tratamento;
DROP POLICY IF EXISTS "clinical_planos_admin" ON planos_tratamento;
CREATE POLICY "clinical_planos_paciente" ON planos_tratamento FOR ALL USING (auth.uid() = paciente_id);
CREATE POLICY "clinical_planos_pro" ON planos_tratamento FOR ALL USING (public.is_healthcare_pro());
CREATE POLICY "clinical_planos_admin" ON planos_tratamento FOR ALL USING (public.is_admin());

DROP POLICY IF EXISTS "clinical_proc_paciente" ON procedimentos_tratamento;
DROP POLICY IF EXISTS "clinical_proc_pro" ON procedimentos_tratamento;
DROP POLICY IF EXISTS "clinical_proc_admin" ON procedimentos_tratamento;
CREATE POLICY "clinical_proc_paciente" ON procedimentos_tratamento FOR ALL USING (
  EXISTS(SELECT 1 FROM planos_tratamento WHERE id = plano_id AND paciente_id = auth.uid())
);
CREATE POLICY "clinical_proc_pro" ON procedimentos_tratamento FOR ALL USING (public.is_healthcare_pro());
CREATE POLICY "clinical_proc_admin" ON procedimentos_tratamento FOR ALL USING (public.is_admin());

DROP POLICY IF EXISTS "clinical_evol_paciente" ON evolucoes_clinicas;
DROP POLICY IF EXISTS "clinical_evol_pro" ON evolucoes_clinicas;
DROP POLICY IF EXISTS "clinical_evol_admin" ON evolucoes_clinicas;
CREATE POLICY "clinical_evol_paciente" ON evolucoes_clinicas FOR ALL USING (auth.uid() = paciente_id);
CREATE POLICY "clinical_evol_pro" ON evolucoes_clinicas FOR ALL USING (public.is_healthcare_pro());
CREATE POLICY "clinical_evol_admin" ON evolucoes_clinicas FOR ALL USING (public.is_admin());

DROP POLICY IF EXISTS "clinical_presc_paciente" ON prescricoes;
DROP POLICY IF EXISTS "clinical_presc_pro" ON prescricoes;
DROP POLICY IF EXISTS "clinical_presc_admin" ON prescricoes;
CREATE POLICY "clinical_presc_paciente" ON prescricoes FOR ALL USING (auth.uid() = paciente_id);
CREATE POLICY "clinical_presc_pro" ON prescricoes FOR ALL USING (public.is_healthcare_pro());
CREATE POLICY "clinical_presc_admin" ON prescricoes FOR ALL USING (public.is_admin());

DROP POLICY IF EXISTS "respostas_dentista" ON respostas_triagem;
DROP POLICY IF EXISTS "respostas_paciente" ON respostas_triagem;
DROP POLICY IF EXISTS "respostas_admin" ON respostas_triagem;
CREATE POLICY "respostas_dentista" ON respostas_triagem FOR ALL USING (auth.uid() = dentista_id OR public.is_secretario());
CREATE POLICY "respostas_paciente" ON respostas_triagem FOR SELECT USING (
  EXISTS(SELECT 1 FROM triagens WHERE id = triagem_id AND paciente_id = auth.uid())
);
CREATE POLICY "respostas_admin" ON respostas_triagem FOR ALL USING (public.is_admin());

DROP POLICY IF EXISTS "conversations_participants" ON conversations;
DROP POLICY IF EXISTS "conversations_admin_all" ON conversations;
CREATE POLICY "conversations_participants" ON conversations FOR ALL USING (auth.uid() IN (participant_1_id, participant_2_id));
CREATE POLICY "conversations_admin_all" ON conversations FOR ALL USING (public.is_admin());

DROP POLICY IF EXISTS "messages_via_conversation" ON messages;
DROP POLICY IF EXISTS "messages_admin_all" ON messages;
CREATE POLICY "messages_via_conversation" ON messages FOR ALL USING (
  EXISTS(
    SELECT 1 FROM conversations
    WHERE id = conversation_id
      AND (auth.uid() = participant_1_id OR auth.uid() = participant_2_id)
  )
);
CREATE POLICY "messages_admin_all" ON messages FOR ALL USING (public.is_admin());

SELECT 'SETUP COMPLETO EXECUTADO COM SUCESSO!' AS status;
SELECT count(*) AS tabelas_criadas
FROM (
  SELECT tablename
  FROM pg_tables
  WHERE schemaname = 'public'
    AND tablename IN (
      'profiles', 'provincias', 'triagens', 'appointments', 'respostas_triagem',
      'anamneses', 'planos_tratamento', 'procedimentos_tratamento',
      'evolucoes_clinicas', 'prescricoes', 'conversations', 'messages'
    )
) t;
SELECT 'Tipos de usuario:' AS info, string_agg(tipo, ', ' ORDER BY tipo) AS tipos
FROM (
  SELECT tipo FROM profiles WHERE tipo IS NOT NULL GROUP BY tipo
) t;
