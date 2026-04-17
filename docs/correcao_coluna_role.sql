-- =================================================================
-- SCRIPT DE CORREÇÃO PARA RELATÓRIOS E PERMISSÕES (TEODONTO ANGOLA)
-- Execute este script no SQL Editor do Supabase para corrigir os zeros nos relatórios.
-- =================================================================

-- 1. CRIAR COLUNAS (Caso não existam)
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS role TEXT;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS two_step_enabled BOOLEAN DEFAULT FALSE;
UPDATE public.profiles SET role = tipo WHERE role IS NULL;

-- 2. GARANTIR RLS PARA MENSAGENS E CONVERSAS (Admins precisam ler tudo para o contador)
DROP POLICY IF EXISTS "admins_read_all_messages" ON public.messages;
CREATE POLICY "admins_read_all_messages" ON public.messages FOR SELECT 
USING (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND tipo = 'admin'));

DROP POLICY IF EXISTS "admins_read_all_conversations" ON public.conversations;
CREATE POLICY "admins_read_all_conversations" ON public.conversations FOR SELECT 
USING (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND tipo = 'admin'));

-- 3. FUNÇÃO RPC MELHORADA PARA ESTATÍSTICAS (SECURITY DEFINER bypassa RLS)
DROP FUNCTION IF EXISTS public.admin_report_stats() CASCADE;

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
    (SELECT count(*) FROM public.profiles WHERE tipo = 'paciente')::BIGINT,
    (SELECT count(*) FROM public.profiles WHERE tipo IN ('dentista', 'medico'))::BIGINT,
    (SELECT count(*) FROM public.profiles WHERE tipo = 'secretario')::BIGINT,
    (SELECT count(*) FROM public.appointments)::BIGINT,
    (SELECT count(*) FROM public.messages)::BIGINT,
    COALESCE((SELECT sum(valor) FROM public.procedimentos_tratamento), 0)::DECIMAL,
    COALESCE((SELECT sum(valor_pago) FROM public.procedimentos_tratamento), 0)::DECIMAL,
    (SELECT count(*) FROM public.profiles WHERE tipo = 'paciente' AND created_at >= date_trunc('month', now()))::BIGINT,
    (SELECT count(*) FROM public.profiles WHERE tipo IN ('dentista', 'medico') AND created_at >= date_trunc('month', now()))::BIGINT,
    (SELECT count(*) FROM public.profiles WHERE tipo = 'secretario' AND created_at >= date_trunc('month', now()))::BIGINT;
END;
$$;

-- 4. ATUALIZAÇÃO DO TRIGGER DE NOVOS USUÁRIOS
CREATE OR REPLACE FUNCTION public.handle_new_user() 
RETURNS TRIGGER 
LANGUAGE plpgsql 
SECURITY DEFINER 
SET search_path = public AS $$
DECLARE
  v_provincia_id INTEGER;
BEGIN
  SELECT id INTO v_provincia_id FROM public.provincias WHERE nome = 'Luanda' LIMIT 1;
  INSERT INTO public.profiles (id, email, nome, tipo, role, provincia_id, created_at, updated_at)
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'nome', 'Usuario'),
    COALESCE(NEW.raw_user_meta_data->>'tipo', 'paciente'),
    COALESCE(NEW.raw_user_meta_data->>'tipo', 'paciente'),
    v_provincia_id,
    NOW(),
    NOW()
  );
  RETURN NEW;
END;
$$;

GRANT EXECUTE ON FUNCTION public.admin_report_stats() TO authenticated;

SELECT 'Correção concluída com sucesso!' as status;
