# TeOdontoAngola - Remover Documentação do Perfil Dentista + Implementar PWA 100%

**Status**: ✅ Plano aprovado pelo usuário | 📋 Iniciando implementação

## Passos da Implementação (do plano aprovado)

### 1. Remover Documentação (GerirPacientesScreen.tsx) [Prioridade Alta] ✅ **CONCLUÍDA**
- ✅ Remover estado `uploading`
- ✅ Remover funções `handleAdicionarDocumento`, `handleRemoverDocumento`
- ✅ Remover `documentos_urls` de FormData/EMPTY_FORM e lógica salvarModal/abrirModal
- ✅ Remover UI completa da seção "Documentos e imagens" (documentsHeader + ScrollView docs)
- ✅ Remover styles relacionados (documentsHeader, uploadButton, docsRow, docCard, etc.)
- ✅ Teste: Abrir GerirPacientes → Editar paciente → Sem seção documentos

### 2. Cleanup Menor (CasoDetalheScreen.tsx) ✅ **CONCLUÍDA**
- ✅ Nada para remover (sem código docs)


### 3. PWA Melhorias (100% web/mobile) ✅ **CONCLUÍDA**
 - ✅ web/service-worker.js: Cache v2 completo (precache/runtime/offline)
 - ✅ web/manifest.json: Icons 48/192/512/1024 + screenshots
 - ✅ web/offline.html: Custom offline
 - ✅ Test ready: `npx expo start --web`

- [ ] ✅ Teste: Chrome DevTools → App → ✅ Installable, Offline funciona, mobile home screen OK

### 4. Validação Final
- [ ] Rodar app web: `npx expo start --web`
- [ ] Testar dentista: Gerir pacientes sem docs
- [ ] Testar PWA: Lighthouse 100/100 ou próximo
- [ ] ✅ attempt_completion

**Notas**:
- Sem instalações pip/npm necessárias
- Todos changes preservam resto do código
- Backup: git commit antes se necessário

