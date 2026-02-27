# Guia de Atualização de Perfil - Pacientes

## Funcionalidade Implementada

A funcionalidade de atualização de perfil para pacientes foi completamente implementada e melhorada com os seguintes recursos:

### 1. Campos Editáveis para Pacientes

- **Nome** - Campo obrigatório, validado
- **Email** - Campo somente leitura (segurança)
- **Telefone** - Campo opcional com validação de formato
- **Província** - Seleção de lista (18 províncias de Angola)
- **Data de Nascimento** - Formato YYYY-MM-DD, opcional
- **Gênero** - Seleção entre Masculino, Feminino, Outro
- **Membro Desde** - Data de criação da conta (somente leitura)

### 2. Recursos de Validação

#### Validação de Nome
- Não pode estar vazio
- Trimmed automaticamente

#### Validação de Telefone
- Apenas números, espaços, hífens e +
- Mínimo 9 dígitos
- Campo opcional

#### Validação de Data de Nascimento
- Formato esperado: YYYY-MM-DD
- Não pode ser uma data futura
- Campo opcional

#### Validação de Gênero
- Seleção de três opções pré-definidas
- Campo opcional

### 3. Interface de Edição

#### Modo de Visualização
- Todos os campos exibem seus valores
- Botão "Editar" para entrar em modo de edição
- Icons ilustrativos para cada seção

#### Modo de Edição
- Campos tornam-se editáveis com inputs
- Mensagens de erro aparecem sob campos com problemas
- Campos obrigatórios são claramente indicados
- Modal para seleção de províncias

#### Validação em Tempo Real
- Erros são exibidos imediatamente
- Feedback visual com cores (vermelho para erros)
- Campo nome obrigatório

### 4. Fluxo de Salvamento

```
1. Usuário clica em "Editar"
   ↓
2. Campos tornam-se editáveis
   ↓
3. Usuário modifica dados
   ↓
4. Usuário clica em "Salvar"
   ↓
5. Validação de campos
   - Se há erros → Mostrar mensagens de erro
   - Se OK → Enviar para servidor
   ↓
6. Atualização no Supabase
   ↓
7. Toast de sucesso
   ↓
8. Perfil local atualizado
   ↓
9. Modo de visualização restaurado
```

## Implementação Técnica

### Arquivos Modificados

#### `/src/screens/paciente/PerfilScreen.tsx`
- Adicionada validação de campos
- Novos estados para data de nascimento e gênero
- Exibição de mensagens de erro
- Interface melhorada com campo de gênero em botões

### Arquivos Criados

#### `/src/services/pacienteService.ts`
Serviço completo para gerenciar perfis de pacientes com funções:
- `buscarPaciente()` - Buscar dados de um paciente
- `atualizarPerfil()` - Atualizar dados do paciente
- `validarEmail()` - Validar email
- `validarTelefone()` - Validar telefone
- `validarData()` - Validar data YYYY-MM-DD
- `calcularIdade()` - Calcular idade baseada em data de nascimento
- `listarPacientes()` - Listar pacientes (para admin/dentista)

#### `/src/components/ProfileEditModal.tsx`
Componente modal reutilizável para editar perfil:
- Suporte a múltiplos campos configuráveis
- Validação integrada
- Modal para seleção de províncias
- Loading state durante envio
- Podem ser usados em outras telas se necessário

## Como Usar

### Para Pacientes

1. Navegue para a aba "Perfil" na navegação inferior
2. Clique no ícone de edição (lápis) ao lado do título "Informações Pessoais"
3. Modifique os campos desejados
4. Clique em "Salvar" para salvar as alterações
5. Se houver erros de validação, eles serão exibidos em vermelho
6. Clique em "Cancelar" para descartar as alterações

### Para Desenvolvedores

#### Usar o PerfilScreen
```tsx
import PerfilScreen from '../screens/paciente/PerfilScreen';

// O componente já integra automaticamente com AuthContext
```

#### Usar o Serviço de Paciente
```tsx
import { atualizarPerfil, validarTelefone } from '../services/pacienteService';

// Validar telefone
if (validarTelefone(telefone)) {
  // Atualizar perfil
  const resultado = await atualizarPerfil(usuarioId, {
    telefone,
    provincia: 'Luanda'
  });
}
```

#### Usar o Modal de Edição
```tsx
import ProfileEditModal from '../components/ProfileEditModal';
import { useAuth } from '../contexts/AuthContext';

const MyComponent = () => {
  const { profile, updateProfile, loading } = useAuth();
  const [showModal, setShowModal] = useState(false);

  const handleSave = async (updates) => {
    await updateProfile(updates);
    setShowModal(false);
  };

  return (
    <>
      <Button onPress={() => setShowModal(true)}>Editar</Button>
      <ProfileEditModal
        visible={showModal}
        profile={profile}
        onClose={() => setShowModal(false)}
        onSave={handleSave}
        loading={loading}
        campos={['nome', 'telefone', 'provincia']}
      />
    </>
  );
};
```

## Schema do Banco de Dados

Os campos estendidos são salvos na tabela `profiles`:

```sql
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS data_nascimento DATE;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS genero VARCHAR(50);
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS historico_medico TEXT;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS alergias TEXT;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS medicamentos_atuais TEXT;
```

## Testes

### Teste de Validação de Nome
1. Tente deixar o campo de nome vazio
2. Verifique se o botão "Salvar" fica desabilitado
3. Verifique se a mensagem de erro aparece

### Teste de Validação de Telefone
1. Tente adicionar caracteres inválidos (ex: @, #)
2. Verifique se a mensagem de erro aparece

### Teste de Validação de Data
1. Tente adicionar uma data no futuro
2. Verifique se a mensagem de erro aparece
3. Tente adicionar uma data em formato errado
4. Verifique se a mensagem de erro aparece

### Teste de Salvamento
1. Modifique os campos
2. Clique em Salvar
3. Verifique se o Toast de sucesso aparece
4. Atualize a tela e verifique se os dados foram salvos

### Teste de Cancelamento
1. Modifique os campos
2. Clique em Cancelar
3. Verifique se os campos retornam aos valores anteriores

## Segurança

- **Email não é editável** - Protege contra mudanças não autorizadas
- **Validação no frontend** - Feedback rápido para o usuário
- **Validação no backend** - Feita pelo Supabase automaticamente
- **RLS Policies** - Usuário só pode editar seu próprio perfil
- **Timestamp atualizado** - `updated_at` é atualizado automaticamente

## Próximas Melhorias Sugeridas

1. **Foto de Perfil** - Adicionar upload de avatar
2. **Histórico de Alterações** - Registrar quem alterou o quê e quando
3. **Exportar Dados** - Permitir export dos dados do paciente
4. **Autenticação de Dois Fatores** - Para alteração de email/senha
5. **Sincronização** - Real-time sync com outros dispositivos
