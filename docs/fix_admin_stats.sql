-- SCRIPT PARA NORMALIZAR ESTATÍSTICAS DO ADMIN
-- Garante que o Admin possa ver todos os contadores e cria uma função RPC robusta.

-- 1. Garantir que a função is_admin() é robusta
CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS boolean AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM profiles 
    WHERE id = auth.uid() AND (tipo = 'admin' OR role = 'admin')
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 2. Garantir políticas de leitura global para o Admin na tabela de perfis
DROP POLICY IF EXISTS "profiles_admin_all" ON profiles;
CREATE POLICY "profiles_admin_all" ON profiles
    FOR SELECT
    TO authenticated
    USING (public.is_admin());

-- 3. Criar ou Atualizar a função de estatísticas (RPC)
-- Esta função retorna os totais para o Dashboard sem expor dados sensíveis
DROP FUNCTION IF EXISTS public.admin_report_stats();

CREATE OR REPLACE FUNCTION public.admin_report_stats()
RETURNS JSON AS $$
DECLARE
    result JSON;
    now_ts TIMESTAMP := now();
    month_start TIMESTAMP := date_trunc('month', now());
BEGIN
    SELECT json_build_object(
        'total_cadastros', (SELECT count(*) FROM profiles),
        'total_dentistas', (SELECT count(*) FROM profiles WHERE tipo IN ('dentista', 'medico')),
        'total_pacientes', (SELECT count(*) FROM profiles WHERE tipo = 'paciente'),
        'total_secretarios', (SELECT count(*) FROM profiles WHERE tipo = 'secretario'),
        'total_consultas', (SELECT count(*) FROM appointments),
        'total_mensagens', (SELECT count(*) FROM messages),
        'cadastros_mes_atual', (SELECT count(*) FROM profiles WHERE created_at >= month_start),
        'dentistas_mes_atual', (SELECT count(*) FROM profiles WHERE tipo IN ('dentista', 'medico') AND created_at >= month_start),
        'pacientes_mes_atual', (SELECT count(*) FROM profiles WHERE tipo = 'paciente' AND created_at >= month_start),
        'secretarios_mes_atual', (SELECT count(*) FROM profiles WHERE tipo = 'secretario' AND created_at >= month_start)
    ) INTO result;
    
    RETURN result;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 4. Abrir permissão para o Admin ver agendas e mensagens
DROP POLICY IF EXISTS "admin_see_all_appointments" ON appointments;
CREATE POLICY "admin_see_all_appointments" ON appointments 
    FOR SELECT TO authenticated USING (public.is_admin());

DROP POLICY IF EXISTS "admin_see_all_messages" ON messages;
CREATE POLICY "admin_see_all_messages" ON messages 
    FOR SELECT TO authenticated USING (public.is_admin());

GRANT EXECUTE ON FUNCTION public.admin_report_stats() TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_report_stats() TO service_role;
