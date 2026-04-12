-- Corrige o erro "Database error creating new user" ao cadastrar secretario
-- Execute no SQL Editor do Supabase

CREATE EXTENSION IF NOT EXISTS "pgcrypto";

CREATE TABLE IF NOT EXISTS public.provincias (
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
  ('Bengo')
ON CONFLICT (nome) DO NOTHING;

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS telefone TEXT,
  ADD COLUMN IF NOT EXISTS provincia TEXT,
  ADD COLUMN IF NOT EXISTS provincia_id INTEGER REFERENCES public.provincias(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS data_nascimento DATE,
  ADD COLUMN IF NOT EXISTS genero TEXT,
  ADD COLUMN IF NOT EXISTS idade INTEGER,
  ADD COLUMN IF NOT EXISTS senha_alterada BOOLEAN DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW();

DO $$
DECLARE
  v_constraint_name TEXT;
BEGIN
  SELECT conname
  INTO v_constraint_name
  FROM pg_constraint
  WHERE conrelid = 'public.profiles'::regclass
    AND contype = 'c'
    AND pg_get_constraintdef(oid) ILIKE '%tipo%';

  IF v_constraint_name IS NOT NULL THEN
    EXECUTE format('ALTER TABLE public.profiles DROP CONSTRAINT %I', v_constraint_name);
  END IF;
END $$;

ALTER TABLE public.profiles
  ALTER COLUMN tipo SET DEFAULT 'paciente';

ALTER TABLE public.profiles
  DROP CONSTRAINT IF EXISTS profiles_tipo_check;

ALTER TABLE public.profiles
  ADD CONSTRAINT profiles_tipo_check
  CHECK (tipo IN ('paciente', 'dentista', 'medico', 'secretario', 'admin'));

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_provincia_id INTEGER;
BEGIN
  SELECT id
  INTO v_provincia_id
  FROM public.provincias
  WHERE nome = 'Luanda'
  LIMIT 1;

  INSERT INTO public.profiles (
    id,
    email,
    nome,
    tipo,
    provincia_id,
    created_at,
    updated_at
  )
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'nome', 'Usuario'),
    COALESCE(NEW.raw_user_meta_data->>'tipo', 'paciente'),
    v_provincia_id,
    NOW(),
    NOW()
  )
  ON CONFLICT (id) DO UPDATE
  SET
    email = EXCLUDED.email,
    nome = COALESCE(EXCLUDED.nome, public.profiles.nome),
    tipo = COALESCE(EXCLUDED.tipo, public.profiles.tipo),
    provincia_id = COALESCE(EXCLUDED.provincia_id, public.profiles.provincia_id),
    updated_at = NOW();

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;

CREATE TRIGGER on_auth_user_created
AFTER INSERT ON auth.users
FOR EACH ROW
EXECUTE FUNCTION public.handle_new_user();
