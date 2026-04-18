-- ATRIBUICAO DE DENTISTA E RASTREIO DE CRIACAO
-- Adiciona colunas para vincular pacientes a dentistas e rastrear quem criou o perfil

ALTER TABLE profiles 
ADD COLUMN IF NOT EXISTS dentist_id UUID REFERENCES profiles(id) ON DELETE SET NULL,
ADD COLUMN IF NOT EXISTS creator_id UUID REFERENCES profiles(id) ON DELETE SET NULL,
ADD COLUMN IF NOT EXISTS creator_role TEXT;

-- Indices para performance
CREATE INDEX IF NOT EXISTS idx_profiles_dentist_id ON profiles(dentist_id);
CREATE INDEX IF NOT EXISTS idx_profiles_creator_id ON profiles(creator_id);

COMMENT ON COLUMN profiles.dentist_id IS 'ID do dentista atribuído a este paciente';
COMMENT ON COLUMN profiles.creator_id IS 'ID do funcionário (secretário/dentista) que cadastrou este paciente';
COMMENT ON COLUMN profiles.creator_role IS 'Papel do criador (secretario/dentista) para lógica de ficha';
