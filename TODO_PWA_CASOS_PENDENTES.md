# TODO: Resolver Casos Pendentes + Imagens Triagem + Botão Urgente (PWA)

## ✅ Plano Aprovado
- Dashboard: Lista preview "Casos Pendentes" (top 5 triagens)
- GerirPacientes: Imagens última triagem no modal + preview na lista
- PacienteHistorico: Imagens por linha de triagem
- HistoricoScreen: Preview imagens (paciente)

## 📋 Passos a Completar

### 1. ✅ DashboardScreen.tsx
- Adicionar card "Casos Pendentes" acima da lista
- Top 5 triagens pendentes/urgentes com botão abrir
- Filtrar pendentes priorizando triagens sem resposta

### 2. ✅ GerirPacientesScreen.tsx  
- Modal: Nova seção "Última Triagem" → buscarTriagensPaciente → mostrar imagens
- Card lista: Preview thumbnail se última triagem tem imagens

### 3. [ ] PacienteHistoricoScreen.tsx
- Linha triagem: Contador imagens + thumbnail se existe
- Navegação para CasoDetalhe mantém funcional

### 4. [ ] HistoricoScreen.tsx (paciente)
- Card triagem: Preview imagens horizontais se imagens.length > 0

### 5. [ ] Testes
- Testar web/mobile/PWA (offline/online)
- Verificar contadores vs lista no Dashboard  
- Confirmar imagens carregam do Supabase Storage

### 6. [ ] Finalizar
- Remover este TODO
- attempt_completion

**Progresso: 0/6**
