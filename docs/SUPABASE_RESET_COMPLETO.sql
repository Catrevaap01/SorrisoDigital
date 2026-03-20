-- ========================================
-- RESET
-- ========================================

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
DROP FUNCTION IF EXISTS public.handle_new_user CASCADE;
DROP FUNCTION IF EXISTS public.is_admin CASCADE;
DROP TABLE IF EXISTS public.profiles CASCADE;
DROP TABLE IF EXISTS public.provincias CASCADE;
DROP TABLE IF EXISTS public.messages CASCADE;
DROP TABLE IF EXISTS public.conversations CASCADE;

-- ========================================
-- TABELA DE PROVINCIAS
-- ========================================

CREATE TABLE public.provincias (
    id SERIAL PRIMARY KEY,
    nome TEXT UNIQUE NOT NULL
);

INSERT INTO public.provincias (nome) VALUES
('Luanda'),
('Benguela'),
('Huambo'),
('Huila'),
('Bie'),
('Malanje'),
('Uige'),
('Zaire'),
('Cabinda'),
('Cunene'),
('Cuando Cubango'),
('Cuanza Norte'),
('Cuanza Sul'),
('Lunda Norte'),
('Lunda Sul'),
('Moxico'),
('Namibe'),
('Bengo');

-- ========================================
-- TABELA DE CONVERSAS E MENSAGENS
-- ========================================

CREATE TABLE public.conversations (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    participant_1_id uuid REFERENCES public.profiles(id) ON DELETE CASCADE,
    participant_1_name text,
    participant_1_avatar text,
    participant_2_id uuid REFERENCES public.profiles(id) ON DELETE CASCADE,
    participant_2_name text,
    participant_2_avatar text,
    last_message text,
    last_message_at timestamptz,
    created_at timestamptz NOT NULL DEFAULT NOW(),
    updated_at timestamptz NOT NULL DEFAULT NOW()
);

CREATE TABLE public.messages (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    conversation_id uuid REFERENCES public.conversations(id) ON DELETE CASCADE,
    sender_id uuid REFERENCES public.profiles(id) ON DELETE CASCADE,
    sender_name text,
    sender_avatar text,
    content text,
    read boolean NOT NULL DEFAULT FALSE,
    created_at timestamptz NOT NULL DEFAULT NOW(),
    updated_at timestamptz
);

-- ========================================
-- TABELA PROFILES
-- ========================================

CREATE TABLE public.profiles (
    id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,

    nome TEXT NOT NULL DEFAULT 'Usuario',

    email TEXT NOT NULL,

    tipo TEXT NOT NULL DEFAULT 'paciente'
        CHECK (tipo IN ('paciente', 'admin', 'medico', 'dentista')),

    telefone TEXT,

    -- campos extras para dentistas e futuros requisitos
    crm TEXT,
    numero_registro TEXT,
    especialidade TEXT,
    historico_medico TEXT,
    alergias TEXT,
    medicamentos_atuais TEXT,
    observacoes_gerais TEXT,
    documentos_urls TEXT[] DEFAULT '{}',
    foto_url TEXT,
    senha_alterada BOOLEAN DEFAULT FALSE,

    provincia_id INTEGER
        REFERENCES public.provincias(id)
        ON DELETE SET NULL,

    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ========================================
-- INDICES
-- ========================================

CREATE INDEX idx_profiles_tipo ON public.profiles(tipo);
CREATE INDEX idx_profiles_provincia ON public.profiles(provincia_id);

-- ========================================
-- RLS
-- ========================================

ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

-- ========================================
-- FUNCAO ADMIN
-- ========================================

CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.profiles p
    WHERE p.id = auth.uid()
      AND lower(coalesce(p.tipo, '')) = 'admin'
  );
$$;

-- ========================================
-- POLICIES
-- ========================================

-- SELECT
CREATE POLICY "Users can view their own profile"
ON public.profiles
FOR SELECT
TO authenticated
USING (auth.uid() = id OR public.is_admin());

-- UPDATE
CREATE POLICY "Users can update their own profile"
ON public.profiles
FOR UPDATE
TO authenticated
USING (auth.uid() = id OR public.is_admin())
WITH CHECK (auth.uid() = id OR public.is_admin());

-- DELETE
CREATE POLICY "Users can delete their own profile"
ON public.profiles
FOR DELETE
TO authenticated
USING (auth.uid() = id OR public.is_admin());

-- INSERT: administradores podem criar perfis
CREATE POLICY "Admins can insert profiles"
ON public.profiles
FOR INSERT
TO authenticated
WITH CHECK (public.is_admin());

-- ========================================
-- FUNCAO AUTO CRIAR PERFIL
-- ========================================

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

    INSERT INTO public.profiles (
        id,
        nome,
        email,
        tipo,
        provincia_id
    )
    VALUES (
        NEW.id,
        COALESCE(NEW.raw_user_meta_data->>'nome', 'Usuario'),
        NEW.email,
        COALESCE(NEW.raw_user_meta_data->>'tipo', 'paciente'),
        provincia_padrao
    );

    RETURN NEW;
END;
$$;

-- ========================================
-- TRIGGER
-- ========================================

CREATE TRIGGER on_auth_user_created
AFTER INSERT ON auth.users
FOR EACH ROW
EXECUTE FUNCTION public.handle_new_user();

-- ========================================
-- STORAGE: BUCKET TRIAGENS
-- ========================================
-- Se o bucket nao existir, cria.

INSERT INTO storage.buckets (id, name, public)
VALUES ('triagens', 'triagens', true)
ON CONFLICT (id) DO NOTHING;

-- RLS do storage.objects ja e gerenciado pelo Supabase.
-- Nao usar ALTER TABLE aqui para evitar erro de ownership:
-- ERROR: must be owner of table objects

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

-- ========================================
-- COMPATIBILIDADE TRIAGENS
-- ========================================
-- Garante colunas em snake_case usadas pelo app.

ALTER TABLE IF EXISTS public.triagens
  ADD COLUMN IF NOT EXISTS paciente_id UUID,
  ADD COLUMN IF NOT EXISTS dentista_id UUID,
  ADD COLUMN IF NOT EXISTS sintoma_principal TEXT,
  ADD COLUMN IF NOT EXISTS descricao TEXT,
  ADD COLUMN IF NOT EXISTS duracao TEXT,
  ADD COLUMN IF NOT EXISTS localizacao TEXT,
  ADD COLUMN IF NOT EXISTS intensidade_dor INTEGER,
  ADD COLUMN IF NOT EXISTS imagens TEXT[],
  ADD COLUMN IF NOT EXISTS prioridade TEXT,
  ADD COLUMN IF NOT EXISTS status TEXT,
  ADD COLUMN IF NOT EXISTS data_agendamento TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS observacoes TEXT,
  ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW();

-- ========================================
-- CONFIRMACAO
-- ========================================

SELECT 'BANCO CONFIGURADO CORRETAMENTE' AS status;
