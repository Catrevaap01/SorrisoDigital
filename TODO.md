# TODO - Fix Secretaria Messages Tab

## Plan Approved
Secretary messages tab must work like patient/dentist tabs but allow 1:1 convos with BOTH dentists AND patients.

## Steps:
1. [x] Create src/screens/secretario/SecretarioMensagensScreen.tsx (copy DentistaMensagensScreen, add dual dentists+patients new chat modal)
2. [x] Update src/navigation/AppNavigator.tsx: change Mensagens component to new screen
3. [ ] Update ConversationsListScreen modal for secretary (load dentists + patients)
4. [ ] Test secretary login → messages tab → new chat with dentist/patient
5. [ ] attempt_completion
