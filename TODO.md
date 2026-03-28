# Task: Adicionar QR de Acesso nas Fichas do Histórico

## ✅ Status: Em Progresso

### 1. ✅ Criar utilitário QR (src/utils/qrUtils.ts)
### 2. ✅ Atualizar gerarFichaHistorico.ts (3 QRs no PDF)
### 3. ✅ src/screens/paciente/HistoricoScreen.tsx (QR nos modais)
### 4. ✅ src/screens/dentista/PacienteHistoricoScreen.tsx (QR na tela)
### 5. [] Testar geração PDF + scan QR
### 6. [] Testar deep links no app
### 7. [] ✅ Concluir task

**Detalhes**: 
- QR1: Instalação genérica app
- QR2: Histórico específico pacienteId 
- QR3: Auto-login email/password

**Como testar**:
1. `npx expo start`
2. Login dentista → Gerir Pacientes → Paciente → PDF (ver 3 QRs)
3. Paciente → Histórico → Abrir modal (ver QRs)
4. Escanear QRs com celular (câmera → abrir URLs corretas)

