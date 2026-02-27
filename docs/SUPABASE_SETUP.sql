/**
 * Script SQL para criar a estrutura de admin no Supabase
 * 
 * Instruções:
 * 1. Acesse seu projeto Supabase (https://app.supabase.com)
 * 2. Vá em "SQL Editor" > "+ New Query"
 * 3. Copie o conteúdo deste script
 * 4. Clique em "Run"
 */

-- ============================================
-- 1. ADICIONAR COLUNA 'tipo' NA TABELA PROFILES
-- ============================================
-- Se a coluna ainda não existe, descomente:
-- ALTER TABLE profiles ADD COLUMN tipo TEXT DEFAULT 'paciente';

-- ============================================
-- 2. CRIAR FUNÇÃO PARA ATUALIZAR PERFIL APÓS AUTH
-- ============================================
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger AS $$
BEGIN
  INSERT INTO public.profiles (id, email, tipo, created_at)
  VALUES (
    new.id,
    new.email,
    COALESCE(new.raw_user_meta_data->>'tipo', 'paciente'),
    now()
  );
  RETURN new;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- Remover trigger anterior se existir
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;

-- Criar novo trigger
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- ============================================
-- 3. HABILITAR RLS (ROW LEVEL SECURITY)
-- ============================================
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

-- Política para usuários lerem seu próprio perfil
DROP POLICY IF EXISTS "Users can view own profile" ON public.profiles;
CREATE POLICY "Users can view own profile"
  ON public.profiles
  FOR SELECT
  USING (auth.uid() = id);

-- Política para usuários atualizarem seu próprio perfil
DROP POLICY IF EXISTS "Users can update own profile" ON public.profiles;
CREATE POLICY "Users can update own profile"
  ON public.profiles
  FOR UPDATE
  USING (auth.uid() = id);

-- Política para admin ver todos os perfis
DROP POLICY IF EXISTS "Admins can view all profiles" ON public.profiles;
CREATE POLICY "Admins can view all profiles"
  ON public.profiles
  FOR SELECT
  USING (
    auth.uid() IN (
      SELECT id FROM public.profiles WHERE tipo = 'admin'
    )
  );

-- Política para admin atualizar qualquer perfil
DROP POLICY IF EXISTS "Admins can update any profile" ON public.profiles;
CREATE POLICY "Admins can update any profile"
  ON public.profiles
  FOR UPDATE
  USING (
    auth.uid() IN (
      SELECT id FROM public.profiles WHERE tipo = 'admin'
    )
  );

-- ============================================
-- 4. CRIAR PRIMEIRO ADMIN (OPCIONAL)
-- ============================================
-- Via SQL direto (não é recomendado, role-based auth é melhor)
-- INSERT INTO public.profiles (id, email, nome, tipo, created_at)
-- VALUES (
--   'seu-user-id-aqui',
--   'admin@example.com',
--   'Admin Nome',
--   'admin',
--   now()
-- );

-- ============================================
-- 5. ADICIONAR COLUNA senha_alterada SE NÃO EXISTIR
-- ============================================
-- ALTER TABLE profiles ADD COLUMN senha_alterada BOOLEAN DEFAULT FALSE;
-- ALTER TABLE profiles ADD COLUMN crm TEXT;
-- ALTER TABLE profiles ADD COLUMN cro TEXT;
-- ALTER TABLE profiles ADD COLUMN especialidade TEXT;

-- ============================================
-- FIM DO SCRIPT
-- ============================================
