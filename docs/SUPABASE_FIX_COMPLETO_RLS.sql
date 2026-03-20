-- =====================================================
-- TEODONTO ANGOLA - FIX COMPLETO (SCHEMA + RLS)
-- =====================================================
-- Objetivo:
-- 1) Eliminar erros de RLS: "new row violates row-level security policy"
-- 2) Eliminar erros de colunas ausentes em conversations/messages/profiles
-- 3) Garantir compatibilidade com o código atual do app
--
-- ATENCAO:
-- - Este script faz reset controlado das tabelas principais.
-- - Execute no SQL Editor do Supabase em ambiente de desenvolvimento.
-- =====================================================

CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- =====================================================
-- RESET CONTROLADO
-- =====================================================

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
DROP FUNCTION IF EXISTS public.handle_new_user CASCADE;
DROP FUNCTION IF EXISTS public.is_admin CASCADE;
DROP FUNCTION IF EXISTS public.current_user_tipo CASCADE;
DROP FUNCTION IF EXISTS public.can_read_patient_profiles CASCADE;
DROP FUNCTION IF EXISTS public.admin_report_stats CASCADE;
DROP FUNCTION IF EXISTS public.contar_triagens CASCADE;
DROP FUNCTION IF EXISTS public.listar_dentistas_publicos CASCADE;
DROP FUNCTION IF EXISTS public.cancelar_agendamento_dentista CASCADE;
DROP FUNCTION IF EXISTS public.admin_delete_dentista_full CASCADE;

DROP TABLE IF EXISTS public.messages CASCADE;
DROP TABLE IF EXISTS public.conversations CASCADE;
DROP TABLE IF EXISTS public.respostas_triagem CASCADE;
DROP TABLE IF EXISTS public.agendamentos CASCADE;
DROP TABLE IF EXISTS public.triagens CASCADE;
DROP TABLE IF EXISTS public.triagem CASCADE;
DROP TABLE IF EXISTS public.dentistas CASCADE;
DROP TABLE IF EXISTS public.profiles CASCADE;
DROP TABLE IF EXISTS public.provincias CASCADE;

-- =====================================================
-- PROVINCIAS
-- =====================================================

CREATE TABLE public.provincias (
  id SERIAL PRIMARY KEY,
  nome TEXT UNIQUE NOT NULL
);

INSERT INTO public.provincias (nome) VALUES
('Luanda'), ('Benguela'), ('Huambo'), ('Huila'),
('Bie'), ('Malanje'), ('Uige'), ('Zaire'),
('Cabinda'), ('Cunene'), ('Cuando Cubango'),
('Cuanza Norte'), ('Cuanza Sul'),
('Lunda Norte'), ('Lunda Sul'),
('Moxico'), ('Namibe'), ('Bengo');

-- =====================================================
-- PROFILES
-- =====================================================

CREATE TABLE public.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  nome TEXT NOT NULL DEFAULT 'Usuario',
  email TEXT NOT NULL,
  tipo TEXT NOT NULL DEFAULT 'paciente'
    CHECK (tipo IN ('paciente', 'admin', 'dentista', 'medico')),
  telefone TEXT,
  provincia_id INTEGER REFERENCES public.provincias(id) ON DELETE SET NULL,
  provincia TEXT,
  senha_alterada BOOLEAN DEFAULT FALSE,
  crm TEXT,
  cro TEXT,
  numero_registro TEXT,
  especialidade TEXT,
  historico_medico TEXT,
  alergias TEXT,
  medicamentos_atuais TEXT,
  observacoes_gerais TEXT,
  documentos_urls TEXT[] DEFAULT '{}',
  foto_url TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_profiles_tipo ON public.profiles(tipo);
CREATE INDEX idx_profiles_provincia ON public.profiles(provincia_id);

ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

-- =====================================================
-- DENTISTAS (compatibilidade)
-- =====================================================

CREATE TABLE public.dentistas (
  id UUID PRIMARY KEY REFERENCES public.profiles(id) ON DELETE CASCADE,
  crm TEXT NOT NULL,
  especialidade TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE public.dentistas ENABLE ROW LEVEL SECURITY;

-- =====================================================
-- TRIAGENS (plural - usado no app)
-- =====================================================

CREATE TABLE public.triagens (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  paciente_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  dentista_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  sintoma_principal TEXT,
  descricao TEXT,
  duracao TEXT,
  localizacao TEXT,
  intensidade_dor INTEGER,
  imagens TEXT[],
  prioridade TEXT,
  status TEXT DEFAULT 'pendente',
  data_agendamento TIMESTAMPTZ,
  observacoes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_triagens_paciente ON public.triagens(paciente_id);
CREATE INDEX idx_triagens_dentista ON public.triagens(dentista_id);
CREATE INDEX idx_triagens_status ON public.triagens(status);

ALTER TABLE public.triagens ENABLE ROW LEVEL SECURITY;

-- Tabela singular como alias de compatibilidade
CREATE VIEW public.triagem AS
SELECT * FROM public.triagens;

-- =====================================================
-- RESPOSTAS TRIAGEM
-- =====================================================

CREATE TABLE public.respostas_triagem (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  triagem_id UUID NOT NULL REFERENCES public.triagens(id) ON DELETE CASCADE,
  dentista_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  orientacao TEXT,
  recomendacao TEXT,
  observacoes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_respostas_triagem_triagem ON public.respostas_triagem(triagem_id);
CREATE INDEX idx_respostas_triagem_dentista ON public.respostas_triagem(dentista_id);

ALTER TABLE public.respostas_triagem ENABLE ROW LEVEL SECURITY;

-- =====================================================
-- AGENDAMENTOS
-- =====================================================

CREATE TABLE public.agendamentos (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  paciente_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  dentista_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  data_agendamento TIMESTAMPTZ NOT NULL,
  tipo TEXT,
  observacoes TEXT,
  status TEXT DEFAULT 'pendente',
  prioridade TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_agendamentos_paciente ON public.agendamentos(paciente_id);
CREATE INDEX idx_agendamentos_dentista ON public.agendamentos(dentista_id);

ALTER TABLE public.agendamentos ENABLE ROW LEVEL SECURITY;

-- =====================================================
-- CONVERSATIONS
-- =====================================================

CREATE TABLE public.conversations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  participant_1_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE,
  participant_1_name TEXT,
  participant_1_avatar TEXT,
  participant_2_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE,
  participant_2_name TEXT,
  participant_2_avatar TEXT,
  last_message TEXT,
  last_message_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  -- compatibilidade para erro citado: conversation.profile_at
  profile_at TIMESTAMPTZ
);

CREATE INDEX idx_conversations_participants ON public.conversations(participant_1_id, participant_2_id);

ALTER TABLE public.conversations ENABLE ROW LEVEL SECURITY;

-- =====================================================
-- MESSAGES
-- =====================================================

CREATE TABLE public.messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id UUID REFERENCES public.conversations(id) ON DELETE CASCADE,
  sender_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE,
  sender_name TEXT,
  sender_avatar TEXT,
  content TEXT,
  read BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ
);

CREATE INDEX idx_messages_conversation ON public.messages(conversation_id);
CREATE INDEX idx_messages_sender ON public.messages(sender_id);

ALTER TABLE public.messages ENABLE ROW LEVEL SECURITY;

-- =====================================================
-- FUNCOES AUXILIARES
-- =====================================================

CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.profiles
    WHERE id = auth.uid()
      AND tipo = 'admin'
  );
$$;

GRANT EXECUTE ON FUNCTION public.is_admin() TO authenticated;

CREATE OR REPLACE FUNCTION public.current_user_tipo()
RETURNS TEXT
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT p.tipo
  FROM public.profiles p
  WHERE p.id = auth.uid()
  LIMIT 1;
$$;

GRANT EXECUTE ON FUNCTION public.current_user_tipo() TO authenticated;

CREATE OR REPLACE FUNCTION public.can_read_patient_profiles()
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT public.is_admin() OR public.current_user_tipo() IN ('dentista', 'medico');
$$;

GRANT EXECUTE ON FUNCTION public.can_read_patient_profiles() TO authenticated;

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  provincia_padrao INTEGER;
BEGIN
  SELECT id INTO provincia_padrao
  FROM public.provincias
  WHERE nome = 'Luanda'
  LIMIT 1;

  INSERT INTO public.profiles (id, email, nome, tipo, provincia_id, created_at, updated_at)
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'nome', 'Usuario'),
    COALESCE(NEW.raw_user_meta_data->>'tipo', 'paciente'),
    provincia_padrao,
    NOW(),
    NOW()
  );
  RETURN NEW;
END;
$$;

CREATE TRIGGER on_auth_user_created
AFTER INSERT ON auth.users
FOR EACH ROW
EXECUTE FUNCTION public.handle_new_user();

CREATE OR REPLACE FUNCTION public.admin_report_stats()
RETURNS TABLE (
  total_cadastros BIGINT,
  total_dentistas BIGINT,
  total_pacientes BIGINT,
  total_consultas BIGINT,
  total_mensagens BIGINT
)
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    (SELECT count(*) FROM public.profiles),
    (SELECT count(*) FROM public.profiles WHERE tipo IN ('dentista','medico')),
    (SELECT count(*) FROM public.profiles WHERE tipo = 'paciente'),
    (SELECT count(*) FROM public.agendamentos),
    (SELECT count(*) FROM public.messages);
$$;

GRANT EXECUTE ON FUNCTION public.admin_report_stats() TO authenticated;

CREATE OR REPLACE FUNCTION public.contar_triagens()
RETURNS TABLE (
  pendente BIGINT,
  urgente BIGINT,
  respondido BIGINT,
  total BIGINT
)
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    count(*) FILTER (WHERE status = 'pendente') AS pendente,
    count(*) FILTER (WHERE status = 'urgente') AS urgente,
    count(*) FILTER (WHERE status = 'respondido') AS respondido,
    count(*) AS total
  FROM public.triagens;
$$;

GRANT EXECUTE ON FUNCTION public.contar_triagens() TO authenticated;

CREATE OR REPLACE FUNCTION public.listar_dentistas_publicos()
RETURNS TABLE (
  id UUID,
  nome TEXT,
  email TEXT,
  tipo TEXT,
  telefone TEXT,
  provincia TEXT,
  provincia_id INTEGER,
  crm TEXT,
  numero_registro TEXT,
  especialidade TEXT,
  foto_url TEXT,
  created_at TIMESTAMPTZ,
  updated_at TIMESTAMPTZ
)
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    p.id,
    p.nome,
    p.email,
    p.tipo,
    p.telefone,
    p.provincia,
    p.provincia_id,
    p.crm,
    p.numero_registro,
    p.especialidade,
    p.foto_url,
    p.created_at,
    p.updated_at
  FROM public.profiles p
  WHERE p.tipo IN ('dentista', 'medico')
     OR p.crm IS NOT NULL
     OR p.numero_registro IS NOT NULL
     OR p.especialidade IS NOT NULL
  ORDER BY p.nome ASC;
$$;

GRANT EXECUTE ON FUNCTION public.listar_dentistas_publicos() TO authenticated;

CREATE OR REPLACE FUNCTION public.cancelar_agendamento_dentista(p_agendamento_id UUID)
RETURNS SETOF public.agendamentos
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  ag public.agendamentos%ROWTYPE;
BEGIN
  SELECT *
  INTO ag
  FROM public.agendamentos
  WHERE id = p_agendamento_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Agendamento nao encontrado';
  END IF;

  IF NOT (public.is_admin() OR auth.uid() = ag.dentista_id) THEN
    RAISE EXCEPTION 'Sem permissao para cancelar este agendamento';
  END IF;

  UPDATE public.agendamentos
  SET status = 'cancelado',
      updated_at = NOW()
  WHERE id = p_agendamento_id;

  IF ag.status IN ('agendado', 'confirmado') THEN
    INSERT INTO public.agendamentos (
      paciente_id,
      dentista_id,
      data_agendamento,
      tipo,
      observacoes,
      status,
      prioridade,
      created_at,
      updated_at
    )
    VALUES (
      ag.paciente_id,
      NULL,
      ag.data_agendamento,
      ag.tipo,
      ag.observacoes,
      'pendente',
      ag.prioridade,
      NOW(),
      NOW()
    );
  END IF;

  RETURN QUERY
  SELECT *
  FROM public.agendamentos
  WHERE id = p_agendamento_id;
END;
$$;

GRANT EXECUTE ON FUNCTION public.cancelar_agendamento_dentista(UUID) TO authenticated;

-- =====================================================
-- POLICIES (RLS) - DROP/CREATE
-- =====================================================

-- PROFILES
DROP POLICY IF EXISTS "Profiles Select" ON public.profiles;
DROP POLICY IF EXISTS "Profiles Insert" ON public.profiles;
DROP POLICY IF EXISTS "Profiles Update" ON public.profiles;
DROP POLICY IF EXISTS "Profiles Delete" ON public.profiles;

CREATE POLICY "Profiles Select"
ON public.profiles
FOR SELECT
TO authenticated
USING (auth.uid() = id OR public.is_admin());

-- Permite que qualquer usuário autenticado visualize perfis de dentistas,
-- necessário para a tela "Escolher Dentista" do paciente.
DROP POLICY IF EXISTS "Profiles Select Dentistas Publicos" ON public.profiles;
CREATE POLICY "Profiles Select Dentistas Publicos"
ON public.profiles
FOR SELECT
TO authenticated
USING (
  tipo IN ('dentista', 'medico')
);

DROP POLICY IF EXISTS "Profiles Select Pacientes Para Dentista" ON public.profiles;
CREATE POLICY "Profiles Select Pacientes Para Dentista"
ON public.profiles
FOR SELECT
TO authenticated
USING (
  tipo = 'paciente'
  AND public.can_read_patient_profiles()
);

CREATE POLICY "Profiles Insert"
ON public.profiles
FOR INSERT
TO authenticated
WITH CHECK (auth.uid() = id OR public.is_admin());

CREATE POLICY "Profiles Update"
ON public.profiles
FOR UPDATE
TO authenticated
USING (auth.uid() = id OR public.is_admin())
WITH CHECK (auth.uid() = id OR public.is_admin());

CREATE POLICY "Profiles Delete"
ON public.profiles
FOR DELETE
TO authenticated
USING (auth.uid() = id OR public.is_admin());

-- DENTISTAS
DROP POLICY IF EXISTS "Dentistas Select" ON public.dentistas;
DROP POLICY IF EXISTS "Dentistas Insert" ON public.dentistas;
DROP POLICY IF EXISTS "Dentistas Update" ON public.dentistas;
DROP POLICY IF EXISTS "Dentistas Delete" ON public.dentistas;

CREATE POLICY "Dentistas Select"
ON public.dentistas
FOR SELECT
TO authenticated
USING (public.is_admin() OR auth.uid() = id);

CREATE POLICY "Dentistas Insert"
ON public.dentistas
FOR INSERT
TO authenticated
WITH CHECK (public.is_admin());

CREATE POLICY "Dentistas Update"
ON public.dentistas
FOR UPDATE
TO authenticated
USING (public.is_admin() OR auth.uid() = id)
WITH CHECK (public.is_admin() OR auth.uid() = id);

CREATE POLICY "Dentistas Delete"
ON public.dentistas
FOR DELETE
TO authenticated
USING (public.is_admin());

-- TRIAGENS
DROP POLICY IF EXISTS "Triagens Select" ON public.triagens;
DROP POLICY IF EXISTS "Triagens Insert" ON public.triagens;
DROP POLICY IF EXISTS "Triagens Update" ON public.triagens;
DROP POLICY IF EXISTS "Triagens Delete" ON public.triagens;

CREATE POLICY "Triagens Select"
ON public.triagens
FOR SELECT
TO authenticated
USING (
  auth.uid() = paciente_id
  OR auth.uid() = dentista_id
  OR public.is_admin()
);

CREATE POLICY "Triagens Insert"
ON public.triagens
FOR INSERT
TO authenticated
WITH CHECK (
  auth.uid() = paciente_id
  OR public.is_admin()
);

CREATE POLICY "Triagens Update"
ON public.triagens
FOR UPDATE
TO authenticated
USING (
  auth.uid() = paciente_id
  OR auth.uid() = dentista_id
  OR public.is_admin()
)
WITH CHECK (
  auth.uid() = paciente_id
  OR auth.uid() = dentista_id
  OR public.is_admin()
);

CREATE POLICY "Triagens Delete"
ON public.triagens
FOR DELETE
TO authenticated
USING (auth.uid() = paciente_id OR public.is_admin());

-- RESPOSTAS TRIAGEM
DROP POLICY IF EXISTS "Respostas Select" ON public.respostas_triagem;
DROP POLICY IF EXISTS "Respostas Insert" ON public.respostas_triagem;
DROP POLICY IF EXISTS "Respostas Update" ON public.respostas_triagem;
DROP POLICY IF EXISTS "Respostas Delete" ON public.respostas_triagem;

CREATE POLICY "Respostas Select"
ON public.respostas_triagem
FOR SELECT
TO authenticated
USING (
  public.is_admin()
  OR auth.uid() = dentista_id
  OR EXISTS (
    SELECT 1 FROM public.triagens t
    WHERE t.id = triagem_id
      AND auth.uid() = t.paciente_id
  )
);

CREATE POLICY "Respostas Insert"
ON public.respostas_triagem
FOR INSERT
TO authenticated
WITH CHECK (public.is_admin() OR auth.uid() = dentista_id);

CREATE POLICY "Respostas Update"
ON public.respostas_triagem
FOR UPDATE
TO authenticated
USING (public.is_admin() OR auth.uid() = dentista_id)
WITH CHECK (public.is_admin() OR auth.uid() = dentista_id);

CREATE POLICY "Respostas Delete"
ON public.respostas_triagem
FOR DELETE
TO authenticated
USING (public.is_admin() OR auth.uid() = dentista_id);

-- AGENDAMENTOS
DROP POLICY IF EXISTS "Agendamentos Select" ON public.agendamentos;
DROP POLICY IF EXISTS "Agendamentos Insert" ON public.agendamentos;
DROP POLICY IF EXISTS "Agendamentos Update" ON public.agendamentos;
DROP POLICY IF EXISTS "Agendamentos Delete" ON public.agendamentos;

CREATE POLICY "Agendamentos Select"
ON public.agendamentos
FOR SELECT
TO authenticated
USING (
  auth.uid() = paciente_id
  OR auth.uid() = dentista_id
  OR public.is_admin()
);

CREATE POLICY "Agendamentos Insert"
ON public.agendamentos
FOR INSERT
TO authenticated
WITH CHECK (
  auth.uid() = paciente_id
  OR public.is_admin()
);

CREATE POLICY "Agendamentos Update"
ON public.agendamentos
FOR UPDATE
TO authenticated
USING (
  auth.uid() = paciente_id
  OR auth.uid() = dentista_id
  OR public.is_admin()
)
WITH CHECK (
  auth.uid() = paciente_id
  OR auth.uid() = dentista_id
  OR public.is_admin()
);

CREATE POLICY "Agendamentos Delete"
ON public.agendamentos
FOR DELETE
TO authenticated
USING (auth.uid() = paciente_id OR public.is_admin());

-- CONVERSATIONS
DROP POLICY IF EXISTS "Conversations Select" ON public.conversations;
DROP POLICY IF EXISTS "Conversations Insert" ON public.conversations;
DROP POLICY IF EXISTS "Conversations Update" ON public.conversations;
DROP POLICY IF EXISTS "Conversations Delete" ON public.conversations;

CREATE POLICY "Conversations Select"
ON public.conversations
FOR SELECT
TO authenticated
USING (
  auth.uid() = participant_1_id
  OR auth.uid() = participant_2_id
  OR public.is_admin()
);

CREATE POLICY "Conversations Insert"
ON public.conversations
FOR INSERT
TO authenticated
WITH CHECK (
  auth.uid() = participant_1_id
  OR auth.uid() = participant_2_id
  OR public.is_admin()
);

CREATE POLICY "Conversations Update"
ON public.conversations
FOR UPDATE
TO authenticated
USING (
  auth.uid() = participant_1_id
  OR auth.uid() = participant_2_id
  OR public.is_admin()
)
WITH CHECK (
  auth.uid() = participant_1_id
  OR auth.uid() = participant_2_id
  OR public.is_admin()
);

CREATE POLICY "Conversations Delete"
ON public.conversations
FOR DELETE
TO authenticated
USING (
  auth.uid() = participant_1_id
  OR auth.uid() = participant_2_id
  OR public.is_admin()
);

-- MESSAGES
DROP POLICY IF EXISTS "Messages Select" ON public.messages;
DROP POLICY IF EXISTS "Messages Insert" ON public.messages;
DROP POLICY IF EXISTS "Messages Update" ON public.messages;
DROP POLICY IF EXISTS "Messages Delete" ON public.messages;

CREATE POLICY "Messages Select"
ON public.messages
FOR SELECT
TO authenticated
USING (
  public.is_admin()
  OR EXISTS (
    SELECT 1 FROM public.conversations c
    WHERE c.id = conversation_id
      AND (auth.uid() = c.participant_1_id OR auth.uid() = c.participant_2_id)
  )
);

CREATE POLICY "Messages Insert"
ON public.messages
FOR INSERT
TO authenticated
WITH CHECK (
  public.is_admin()
  OR auth.uid() = sender_id
);

CREATE POLICY "Messages Update"
ON public.messages
FOR UPDATE
TO authenticated
USING (
  public.is_admin()
  OR auth.uid() = sender_id
  OR EXISTS (
    SELECT 1 FROM public.conversations c
    WHERE c.id = conversation_id
      AND (auth.uid() = c.participant_1_id OR auth.uid() = c.participant_2_id)
  )
)
WITH CHECK (
  public.is_admin()
  OR auth.uid() = sender_id
  OR EXISTS (
    SELECT 1 FROM public.conversations c
    WHERE c.id = conversation_id
      AND (auth.uid() = c.participant_1_id OR auth.uid() = c.participant_2_id)
  )
);

CREATE POLICY "Messages Delete"
ON public.messages
FOR DELETE
TO authenticated
USING (public.is_admin() OR auth.uid() = sender_id);

-- =====================================================
-- STORAGE (bucket triagens)
-- =====================================================

INSERT INTO storage.buckets (id, name, public)
VALUES ('triagens', 'triagens', true)
ON CONFLICT (id) DO NOTHING;

DROP POLICY IF EXISTS "Authenticated can read triagens images" ON storage.objects;
CREATE POLICY "Authenticated can read triagens images"
ON storage.objects
FOR SELECT
TO authenticated
USING (bucket_id = 'triagens');

DROP POLICY IF EXISTS "Authenticated can upload triagens images" ON storage.objects;
CREATE POLICY "Authenticated can upload triagens images"
ON storage.objects
FOR INSERT
TO authenticated
WITH CHECK (bucket_id = 'triagens');

DROP POLICY IF EXISTS "Authenticated can update triagens images" ON storage.objects;
CREATE POLICY "Authenticated can update triagens images"
ON storage.objects
FOR UPDATE
TO authenticated
USING (bucket_id = 'triagens')
WITH CHECK (bucket_id = 'triagens');

DROP POLICY IF EXISTS "Authenticated can delete triagens images" ON storage.objects;
CREATE POLICY "Authenticated can delete triagens images"
ON storage.objects
FOR DELETE
TO authenticated
USING (bucket_id = 'triagens');

-- =====================================================
-- FINAL
-- =====================================================

-- =====================================================
-- PATCH COMPLEMENTAR (SEM REMOVER LINHAS EXISTENTES)
-- =====================================================
-- Este bloco adiciona suporte para:
-- 1) Listagem pública de dentistas para paciente (RPC)
-- 2) Cancelamento de agendamento sem erro de RLS (RPC SECURITY DEFINER)
-- 3) Visibilidade de pacientes para dentistas (nome na agenda)
-- 4) Visibilidade de agendamentos pendentes para dentistas

CREATE OR REPLACE FUNCTION public.listar_dentistas_publicos()
RETURNS TABLE (
  id UUID,
  nome TEXT,
  email TEXT,
  tipo TEXT,
  telefone TEXT,
  provincia TEXT,
  provincia_id INTEGER,
  crm TEXT,
  numero_registro TEXT,
  especialidade TEXT,
  foto_url TEXT,
  created_at TIMESTAMPTZ,
  updated_at TIMESTAMPTZ
)
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    p.id,
    p.nome,
    p.email,
    p.tipo,
    p.telefone,
    p.provincia,
    p.provincia_id,
    p.crm,
    p.numero_registro,
    p.especialidade,
    p.foto_url,
    p.created_at,
    p.updated_at
  FROM public.profiles p
  WHERE p.tipo IN ('dentista', 'medico')
     OR p.crm IS NOT NULL
     OR p.numero_registro IS NOT NULL
     OR p.especialidade IS NOT NULL
  ORDER BY p.nome ASC;
$$;

GRANT EXECUTE ON FUNCTION public.listar_dentistas_publicos() TO authenticated;

CREATE OR REPLACE FUNCTION public.cancelar_agendamento_dentista(p_agendamento_id UUID)
RETURNS SETOF public.agendamentos
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  ag public.agendamentos%ROWTYPE;
BEGIN
  SELECT *
  INTO ag
  FROM public.agendamentos
  WHERE id = p_agendamento_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Agendamento nao encontrado';
  END IF;

  IF NOT (public.is_admin() OR auth.uid() = ag.dentista_id) THEN
    RAISE EXCEPTION 'Sem permissao para cancelar este agendamento';
  END IF;

  UPDATE public.agendamentos
  SET status = 'cancelado',
      updated_at = NOW()
  WHERE id = p_agendamento_id;

  -- Regra do app:
  -- se cancelar um agendado/confirmado, cria novo pendente para voltar ao pool.
  IF ag.status IN ('agendado', 'confirmado') THEN
    INSERT INTO public.agendamentos (
      paciente_id,
      dentista_id,
      data_agendamento,
      tipo,
      observacoes,
      status,
      prioridade,
      created_at,
      updated_at
    )
    VALUES (
      ag.paciente_id,
      NULL,
      ag.data_agendamento,
      ag.tipo,
      ag.observacoes,
      'pendente',
      ag.prioridade,
      NOW(),
      NOW()
    );
  END IF;

  RETURN QUERY
  SELECT *
  FROM public.agendamentos
  WHERE id = p_agendamento_id;
END;
$$;

GRANT EXECUTE ON FUNCTION public.cancelar_agendamento_dentista(UUID) TO authenticated;

DROP POLICY IF EXISTS "Profiles Select Pacientes Para Dentista" ON public.profiles;
CREATE POLICY "Profiles Select Pacientes Para Dentista"
ON public.profiles
FOR SELECT
TO authenticated
USING (
  tipo = 'paciente'
  AND public.can_read_patient_profiles()
);

DROP POLICY IF EXISTS "Agendamentos Select Dentistas Pendentes" ON public.agendamentos;
CREATE POLICY "Agendamentos Select Dentistas Pendentes"
ON public.agendamentos
FOR SELECT
TO authenticated
USING (
  status = 'pendente'
  AND EXISTS (
    SELECT 1
    FROM public.profiles me
    WHERE me.id = auth.uid()
      AND me.tipo IN ('dentista', 'medico', 'admin')
  )
);

SELECT 'BANCO ORGANIZADO E COMPATIVEL COM O APP - FIX COMPLETO' AS status;

-- =====================================================
-- PATCH EXTRA - EXCLUSAO COMPLETA DE DENTISTA
-- =====================================================
-- Remove dados relacionados do dentista e depois remove profile.
-- Tambem tenta remover o usuario em auth.users quando permitido.

CREATE OR REPLACE FUNCTION public.admin_delete_dentista_full(p_dentista_id UUID)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_is_admin BOOLEAN;
BEGIN
  SELECT public.is_admin() INTO v_is_admin;

  IF NOT v_is_admin THEN
    RAISE EXCEPTION 'Sem permissao para excluir dentista';
  END IF;

  DELETE FROM public.messages
  WHERE sender_id = p_dentista_id
     OR conversation_id IN (
       SELECT c.id
       FROM public.conversations c
       WHERE c.participant_1_id = p_dentista_id
          OR c.participant_2_id = p_dentista_id
     );

  DELETE FROM public.conversations
  WHERE participant_1_id = p_dentista_id
     OR participant_2_id = p_dentista_id;

  DELETE FROM public.respostas_triagem
  WHERE dentista_id = p_dentista_id;

  UPDATE public.triagens
  SET dentista_id = NULL,
      updated_at = NOW()
  WHERE dentista_id = p_dentista_id;

  UPDATE public.agendamentos
  SET dentista_id = NULL,
      status = CASE
        WHEN status IN ('agendado', 'confirmado') THEN 'pendente'
        ELSE status
      END,
      updated_at = NOW()
  WHERE dentista_id = p_dentista_id;

  DELETE FROM public.dentistas
  WHERE id = p_dentista_id;

  DELETE FROM public.profiles
  WHERE id = p_dentista_id;

  DELETE FROM auth.users
  WHERE id = p_dentista_id;

  RETURN TRUE;
END;
$$;

GRANT EXECUTE ON FUNCTION public.admin_delete_dentista_full(UUID) TO authenticated;

SELECT 'BANCO ORGANIZADO E COMPATIVEL COM O APP ' AS status;
