-- =====================================================
-- TEODONTO ANGOLA - SCHEMA UPDATE (PROFILES)
-- =====================================================
-- Adiciona colunas ausentes no perfil para evitar erros 400
-- e cumprir requisitos de data de nascimento e gênero.

ALTER TABLE public.profiles 
ADD COLUMN IF NOT EXISTS data_nascimento DATE,
ADD COLUMN IF NOT EXISTS genero TEXT;

COMMENT ON COLUMN public.profiles.data_nascimento IS 'Data de nascimento do paciente';
COMMENT ON COLUMN public.profiles.genero IS 'Gênero do paciente (Masculino/Feminino/Outro)';

-- Garante que as novas colunas sejam visíveis nas políticas de RLS existentes
-- (As políticas SELECT * já cobrem novas colunas automaticamente)
