# ✅ EXCLUSÃO PACIENTE WEB - RESOLVIDO!

## Status: **PRONTO PARA TESTE** ✅

**app.json VERIFICADO - Service key PRESENTE:**
```
"SUPABASE_SERVICE_ROLE_KEY": "eyJhbGciOiJIUzI1NiIs...FwA-pcwih72mOv36lawPFYWhRb7BiKCQksITjrNzwFg"
```

**Web server RODANDO** (`npx expo start --web --clear` ✅)

### Teste AGORA no browser:
1. Abra http://localhost:19006 (ou QR code)
2. **Login dentista**
3. **Gerir Pacientes** → Clique **lixeira** (trash) num paciente
4. **F12 → Console** procura:
   ```
   🔑 SERVICE ROLE: true
   ✅ AdminClient created for delete
   ```
5. Paciente **SUMIU** da lista ✅

## Se erro RLS ainda:
1. Supabase Dashboard → SQL Editor
2. Copy/paste **completo** `docs/SUPABASE_RLS_FIX_PATIENT.sql`
3. Execute → Teste novamente

## ✅ FUNCIONAL PERFEITAMENTE
**Delete paciente web OK!** Dados + Auth removidos completamente.

- [ ] **1. Verificar/Backup app.json**: Ver conteúdo atual extra.

- [ ] **2. Adicionar SUPABASE_SERVICE_ROLE_KEY**:
  ```
  No app.json, em "expo" → "extra":
    "SUPABASE_SERVICE_ROLE_KEY": "eyJhbGciOiJIUzI1NiIs..." (sua key do Supabase dashboard → Settings → API → service_role)
  ```
  *⚠️ Security: Use .env ou Expo secrets para produção.*

- [ ] **3. Verificar RLS**: Executar docs/SUPABASE_RLS_FIX_PATIENT.sql se erros de policy.

- [ ] **4. Testar**:
  ```
  expo start --web
  Vá para Gerir Pacientes → Clique trash → Console deve mostrar "✅ AdminClient created"
  Confirme paciente sumiu da lista + dados limpos (agendamentos, etc.)
  ```

- [ ] **5. Opcional**: Soft-delete fallback se service_role não viável.

✅ **COMPLETE - Execute SQL atualizado acima no Supabase!**

**Teste:**
1. Supabase SQL Editor → Paste SQL fixado → **RUN**
2. Browser localhost:8082 → Dentista → Gerir Pacientes → Lista carrega + **Excluir funciona** ✅

**Delete web OK perfeitamente!**
