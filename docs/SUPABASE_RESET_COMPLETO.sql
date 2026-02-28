-- ========================================
-- RESET COMPLETO (ORDEM CORRETA)
-- ========================================

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
DROP FUNCTION IF EXISTS public.handle_new_user CASCADE;
DROP TABLE IF EXISTS public.profiles CASCADE;
DROP TABLE IF EXISTS public.provincias CASCADE;

-- ========================================
-- TABELA DE PROVINCIAS (NORMALIZACAO)
-- ========================================

CREATE TABLE public.provincias (
    id SERIAL PRIMARY KEY,
    nome TEXT UNIQUE NOT NULL
);

-- Inserir provincias de Angola
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
-- TABELA PROFILES
-- ========================================

CREATE TABLE public.profiles (
    id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,

    nome TEXT NOT NULL DEFAULT 'Usuario',

    email TEXT NOT NULL,

    tipo TEXT NOT NULL DEFAULT 'paciente'
        CHECK (tipo IN ('paciente', 'admin', 'medico', 'dentista')),

    telefone TEXT,

    provincia_id INTEGER
        REFERENCES public.provincias(id)
        ON DELETE SET NULL,

    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Indices uteis
CREATE INDEX idx_profiles_tipo ON public.profiles(tipo);
CREATE INDEX idx_profiles_provincia ON public.profiles(provincia_id);

-- ========================================
-- ATIVAR RLS
-- ========================================

ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

-- ========================================
-- POLICIES (PRODUCAO)
-- ========================================

-- SELECT: usuario ve apenas seu perfil
CREATE POLICY "Users can view their own profile"
ON public.profiles
FOR SELECT
TO authenticated
USING (auth.uid() = id);

-- UPDATE: usuario atualiza apenas seu perfil
CREATE POLICY "Users can update their own profile"
ON public.profiles
FOR UPDATE
TO authenticated
USING (auth.uid() = id)
WITH CHECK (auth.uid() = id);

-- DELETE: opcional
CREATE POLICY "Users can delete their own profile"
ON public.profiles
FOR DELETE
TO authenticated
USING (auth.uid() = id);

-- ========================================
-- FUNCAO PARA AUTO-CRIAR PERFIL
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
    -- Pega ID da provincia Luanda como padrao
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
-- CONFIRMACAO
-- ========================================

SELECT 'BANCO CONFIGURADO CORRETAMENTE' AS status;
