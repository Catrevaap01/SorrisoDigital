# Fixes Rápidos - Credenciais + QR + Logout Admin Web

## 1️⃣ Senha Temp Paciente (createPaciente)
- [ ] Usar adminClient.signup (service_role, sem email confirm)
- [ ] Teste: Criar paciente → login com tempPassword

## 2️⃣ QR Ficha Paciente  
- [ ] Fix modal QR GerirPacientesScreen (SVG → PNG)
- [ ] Teste: QR gera/imprime corretamente

## 3️⃣ Logout Admin Web
- [ ] Fix PerfilScreen logout web (confirm nativo)
- [ ] Teste: Admin web → termina sessão

```
Teste completo:
1. Dentista cria paciente → copia credenciais
2. Login paciente com tempPassword ✓
3. Ficha → QR visível/imprimível ✓
4. Admin web → logout funciona ✓
```

