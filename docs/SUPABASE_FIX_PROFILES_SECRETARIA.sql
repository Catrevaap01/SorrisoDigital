-- Permite que secretario, medico, dentista e admin leiam perfis
-- de pacientes quando o sistema precisar mostrar o nome do paciente.

DROP POLICY IF EXISTS "profiles_staff_read_all" ON public.profiles;

CREATE POLICY "profiles_staff_read_all" ON public.profiles
FOR SELECT
USING (
  public.is_healthcare_pro() OR public.is_admin()
);
