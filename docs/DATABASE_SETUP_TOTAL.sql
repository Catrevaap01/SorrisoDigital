-- TEODONTO ANGOLA - SETUP COMPLETO E UNIFICADO DO BANCO DE DADOS
-- Executar este ficheiro no Supabase SQL Editor para um setup limpo e atualizado.

-- ============================================
-- 1. EXTENSÕES E CONFIGURAÇÃO
-- ============================================
CREATE EXTENSION IF NOT EXISTS "pgcrypto";
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ============================================
-- 2. TABELAS BASE
-- ============================================

-- Províncias
CREATE TABLE IF NOT EXISTS provincias (
  id SERIAL PRIMARY KEY,
  nome TEXT UNIQUE NOT NULL
);

INSERT INTO provincias (nome) VALUES
  ('Luanda'), ('Benguela'), ('Huambo'), ('Huila'), ('Bie'),
  ('Malanje'), ('Uige'), ('Zaire'), ('Cabinda'), ('Cunene'),
  ('Cuando Cubango'), ('Cuanza Norte'), ('Cuanza Sul'),
  ('Lunda Norte'), ('Lunda Sul'), ('Moxico'), ('Namibe'), ('Bengo'),
  ('Moxico leste'), ('Icoli e Bengo')
ON CONFLICT (nome) DO NOTHING;

-- Perfis de Usuário
CREATE TABLE IF NOT EXISTS profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  nome TEXT NOT NULL DEFAULT 'Usuario',
  email TEXT NOT NULL,
  tipo TEXT NOT NULL DEFAULT 'paciente'
    CHECK (tipo IN ('paciente', 'dentista', 'medico', 'secretario', 'admin')),
  role TEXT DEFAULT 'paciente'
    CHECK (role IN ('paciente', 'dentista', 'medico', 'secretario', 'admin')),
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
  two_step_enabled BOOLEAN DEFAULT FALSE,
  dentist_id UUID REFERENCES profiles(id) ON DELETE SET NULL, -- Dentista atribuído
  creator_id UUID REFERENCES profiles(id) ON DELETE SET NULL, -- Quem criou o perfil
  creator_role TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Garantir que a coluna role exista para compatibilidade
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS role TEXT;
UPDATE profiles SET role = tipo WHERE role IS NULL;

CREATE INDEX IF NOT EXISTS idx_profiles_tipo ON profiles(tipo);
CREATE INDEX IF NOT EXISTS idx_profiles_email ON profiles(email);
CREATE INDEX IF NOT EXISTS idx_profiles_dentist_id ON profiles(dentist_id);

-- Triagens
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
  especialidade_sugerida TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE triagens ADD COLUMN IF NOT EXISTS dentista_id UUID REFERENCES profiles(id) ON DELETE SET NULL;
ALTER TABLE triagens ADD COLUMN IF NOT EXISTS sintoma_principal TEXT;

-- Agendamentos
CREATE TABLE IF NOT EXISTS appointments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  patient_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  dentist_id UUID REFERENCES profiles(id) ON DELETE SET NULL,
  secretary_id UUID REFERENCES profiles(id) ON DELETE SET NULL,
  triagem_id UUID REFERENCES triagens(id) ON DELETE SET NULL,
  symptoms TEXT NOT NULL,
  tipo TEXT, -- Adicionado para compatibilidade legada
  urgency TEXT NOT NULL DEFAULT 'normal',
  priority TEXT NOT NULL DEFAULT 'normal',
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
  valor_pago DECIMAL(12,2) DEFAULT 0,
  confirmed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT unique_dentist_slot UNIQUE (dentist_id, appointment_date, appointment_time)
);

-- Garantir que as colunas legadas existem caso a tabela tenha sido criada anteriormente
ALTER TABLE appointments ADD COLUMN IF NOT EXISTS tipo TEXT;
ALTER TABLE appointments ADD COLUMN IF NOT EXISTS symptoms TEXT;
ALTER TABLE appointments ALTER COLUMN symptoms DROP NOT NULL;

-- Planos e Procedimentos
CREATE TABLE IF NOT EXISTS planos_tratamento (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  paciente_id UUID REFERENCES profiles(id) ON DELETE CASCADE,
  dentista_id UUID REFERENCES profiles(id) ON DELETE SET NULL,
  triagem_id UUID REFERENCES triagens(id) ON DELETE SET NULL,
  status TEXT DEFAULT 'ativo' CHECK (status IN ('ativo','pausado','concluido','cancelado')),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS procedimentos_tratamento (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  plano_id UUID REFERENCES planos_tratamento(id) ON DELETE CASCADE,
  descricao TEXT NOT NULL,
  dente TEXT,
  status TEXT DEFAULT 'pendente' CHECK (status IN ('pendente','em_curso','concluido','cancelado')),
  valor DECIMAL(12,2) DEFAULT 0,
  valor_pago DECIMAL(12,2) DEFAULT 0,
  observacoes TEXT,
  sessao_numero INTEGER,
  status_financeiro TEXT DEFAULT 'sem_factura',
  numero_factura TEXT,
  factura_emitida_em TIMESTAMPTZ,
  pago_em TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Mensagens e Conversas
CREATE TABLE IF NOT EXISTS conversations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  participant_1_id UUID REFERENCES profiles(id) ON DELETE CASCADE,
  participant_1_name TEXT,
  participant_2_id UUID REFERENCES profiles(id) ON DELETE CASCADE,
  participant_2_name TEXT,
  last_message TEXT,
  last_message_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id UUID REFERENCES conversations(id) ON DELETE CASCADE,
  sender_id UUID REFERENCES profiles(id) ON DELETE CASCADE,
  sender_name TEXT,
  content TEXT,
  read BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ============================================
-- 3. FUNÇÕES UTILITÁRIAS
-- ============================================

DROP FUNCTION IF EXISTS public.is_admin() CASCADE;
DROP FUNCTION IF EXISTS public.is_secretario() CASCADE;
DROP FUNCTION IF EXISTS public.is_healthcare_pro() CASCADE;
DROP FUNCTION IF EXISTS public.current_user_tipo() CASCADE;

CREATE OR REPLACE FUNCTION public.is_admin() RETURNS BOOLEAN LANGUAGE sql STABLE SECURITY DEFINER AS $$
  SELECT EXISTS(SELECT 1 FROM profiles WHERE id = auth.uid() AND tipo = 'admin');
$$;

CREATE OR REPLACE FUNCTION public.is_secretario() RETURNS BOOLEAN LANGUAGE sql STABLE SECURITY DEFINER AS $$
  SELECT EXISTS(SELECT 1 FROM profiles WHERE id = auth.uid() AND tipo = 'secretario');
$$;

CREATE OR REPLACE FUNCTION public.is_healthcare_pro() RETURNS BOOLEAN LANGUAGE sql STABLE SECURITY DEFINER AS $$
  SELECT EXISTS(SELECT 1 FROM profiles WHERE id = auth.uid() AND tipo IN ('dentista','medico','secretario','admin'));
$$;

CREATE OR REPLACE FUNCTION public.current_user_tipo() RETURNS TEXT LANGUAGE sql STABLE SECURITY DEFINER AS $$
  SELECT tipo FROM profiles WHERE id = auth.uid() LIMIT 1;
$$;

-- ============================================
-- 4. TRIGGERS E AUTOMATIZAÇÃO
-- ============================================

DROP FUNCTION IF EXISTS public.handle_new_user() CASCADE;

CREATE OR REPLACE FUNCTION public.handle_new_user() RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_provincia_id INTEGER;
BEGIN
  SELECT id INTO v_provincia_id FROM provincias WHERE nome = 'Luanda' LIMIT 1;
  INSERT INTO public.profiles (id, email, nome, tipo, provincia_id, created_at, updated_at, two_step_enabled)
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'nome', 'Usuario'),
    COALESCE(NEW.raw_user_meta_data->>'tipo', 'paciente'),
    v_provincia_id,
    NOW(),
    NOW(),
    FALSE
  );
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created AFTER INSERT ON auth.users FOR EACH ROW EXECUTE FUNCTION handle_new_user();

-- ============================================
-- 5. POLÍTICAS DE SEGURANÇA (RLS)
-- ============================================

ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE triagens ENABLE ROW LEVEL SECURITY;
ALTER TABLE appointments ENABLE ROW LEVEL SECURITY;
ALTER TABLE planos_tratamento ENABLE ROW LEVEL SECURITY;
ALTER TABLE procedimentos_tratamento ENABLE ROW LEVEL SECURITY;
ALTER TABLE conversations ENABLE ROW LEVEL SECURITY;
ALTER TABLE messages ENABLE ROW LEVEL SECURITY;

-- Profiles Policies
DROP POLICY IF EXISTS "profiles_self_access" ON profiles;
CREATE POLICY "profiles_self_access" ON profiles FOR ALL USING (auth.uid() = id OR public.is_admin());

DROP POLICY IF EXISTS "staff_read_profiles" ON profiles;
CREATE POLICY "staff_read_profiles" ON profiles FOR SELECT USING (public.is_healthcare_pro());

DROP POLICY IF EXISTS "dentists_manage_patients" ON profiles;
CREATE POLICY "dentists_manage_patients" ON profiles FOR ALL 
USING (tipo = 'paciente' AND (dentist_id = auth.uid() OR creator_id = auth.uid() OR public.is_healthcare_pro()));

-- Appointments Policies
DROP POLICY IF EXISTS "appointments_self" ON appointments;
CREATE POLICY "appointments_self" ON appointments FOR ALL USING (auth.uid() = patient_id OR public.is_admin());

DROP POLICY IF EXISTS "appointments_staff" ON appointments;
CREATE POLICY "appointments_staff" ON appointments FOR ALL USING (public.is_healthcare_pro());

-- Triagens Policies
DROP POLICY IF EXISTS "triagens_self" ON triagens;
CREATE POLICY "triagens_self" ON triagens FOR ALL USING (auth.uid() = paciente_id OR public.is_admin());

DROP POLICY IF EXISTS "triagens_staff" ON triagens;
CREATE POLICY "triagens_staff" ON triagens FOR ALL USING (public.is_healthcare_pro());

-- Relatório Estatístico do Admin (Versão Expandida)
CREATE OR REPLACE FUNCTION public.admin_report_stats()
RETURNS TABLE (
  total_pacientes BIGINT,
  total_dentistas BIGINT,
  total_secretarios BIGINT,
  total_consultas BIGINT,
  total_mensagens BIGINT,
  receita_estimada DECIMAL,
  receita_realizada DECIMAL,
  pacientes_mes BIGINT,
  dentistas_mes BIGINT,
  secretarios_mes BIGINT
) LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  RETURN QUERY
  SELECT
    (SELECT count(*) FROM profiles WHERE tipo = 'paciente')::BIGINT,
    (SELECT count(*) FROM profiles WHERE tipo IN ('dentista', 'medico'))::BIGINT,
    (SELECT count(*) FROM profiles WHERE tipo = 'secretario')::BIGINT,
    (SELECT count(*) FROM appointments)::BIGINT,
    (SELECT count(*) FROM messages)::BIGINT,
    COALESCE((SELECT sum(valor) FROM procedimentos_tratamento), 0)::DECIMAL,
    COALESCE((SELECT sum(valor_pago) FROM procedimentos_tratamento), 0)::DECIMAL,
    (SELECT count(*) FROM profiles WHERE tipo = 'paciente' AND created_at >= date_trunc('month', now()))::BIGINT,
    (SELECT count(*) FROM profiles WHERE tipo IN ('dentista', 'medico') AND created_at >= date_trunc('month', now()))::BIGINT,
    (SELECT count(*) FROM profiles WHERE tipo = 'secretario' AND created_at >= date_trunc('month', now()))::BIGINT;
END;
$$;

-- Busca de dentistas públicos (para pacientes)
CREATE OR REPLACE FUNCTION public.listar_dentistas_publicos()
RETURNS SETOF profiles LANGUAGE sql SECURITY DEFINER AS $$
  SELECT * FROM profiles WHERE tipo IN ('dentista', 'medico') ORDER BY nome ASC;
$$;

-- Exclusão completa de dentista
CREATE OR REPLACE FUNCTION public.admin_delete_dentista_full(p_dentista_id UUID)
RETURNS BOOLEAN LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  IF NOT public.is_admin() THEN RAISE EXCEPTION 'Apenas admins podem excluir dentistas'; END IF;
  
  DELETE FROM appointments WHERE dentist_id = p_dentista_id;
  DELETE FROM triagens WHERE dentista_id = p_dentista_id;
  DELETE FROM profiles WHERE id = p_dentista_id;
  DELETE FROM auth.users WHERE id = p_dentista_id;
  
  RETURN TRUE;
END;
$$;

GRANT EXECUTE ON ALL FUNCTIONS IN SCHEMA public TO authenticated;

SELECT 'SISTEMA TEODONTO UNIFICADO - SETUP CONCLUÍDO' AS status;
