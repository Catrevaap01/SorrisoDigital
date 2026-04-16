-- SUPABASE RLS Fix for Patient Login/Profile Access
-- Run in Supabase SQL Editor after core fixes

-- 1. SECURE RLS: Patients/Dentists read OWN profile only (idempotent)
DROP POLICY IF EXISTS "Patients can view own profile" ON public.profiles;
DROP POLICY IF EXISTS "Users can view own profile" ON public.profiles;

CREATE POLICY "Users can view own profile"
  ON public.profiles FOR SELECT
  USING (auth.uid() = id);

-- 2. Users INSERT own profile (idempotent)
DROP POLICY IF EXISTS "Users can insert own profile" ON public.profiles;
CREATE POLICY "Users can insert own profile"
  ON public.profiles FOR INSERT 
  WITH CHECK (auth.uid() = id);

-- 3. Users UPDATE own profile (idempotent)  
DROP POLICY IF EXISTS "Users can update own profile" ON public.profiles;
CREATE POLICY "Users can update own profile"
  ON public.profiles FOR UPDATE
  USING (auth.uid() = id) WITH CHECK (auth.uid() = id);

DROP POLICY IF EXISTS "Dentists read own patients" ON public.profiles;

CREATE POLICY "Dentists read own patients"
  ON public.profiles FOR SELECT
  USING (
    tipo = 'paciente' AND 
    (dentista_criador = auth.uid() OR tipo_usuario(auth.uid()) = 'dentista')
  );

-- Dentists delete patients they manage (service role bypass já feito no código)

-- 4. Verify
SELECT schemaname, tablename, policyname, cmd, roles, qual 
FROM pg_policies 
WHERE tablename = 'profiles' 
  AND policyname LIKE '%profile%';

-- Test: SELECT * FROM profiles WHERE tipo = 'paciente' LIMIT 1; (as anon/patient)
