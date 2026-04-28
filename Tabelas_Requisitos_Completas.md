# Tabelas de Requisitos do Sistema TeOdonto

### Tabela 1: Requisitos Funcionais (RF)

| Código | Nome do Requisito | Descrição |
| :--- | :--- | :--- |
| **RF01** | Gestão de Usuários e Perfis | O sistema deve permitir o cadastro e edição de perfis com diferentes níveis de acesso (Paciente, Dentista, Secretário e Admin). |
| **RF02** | Autenticação de Acesso | O sistema deve permitir o login seguro dos usuários, definindo permissões baseadas no tipo de perfil. |
| **RF03** | Triagem Digital (Paciente) | O sistema deve possuir um módulo onde pacientes possam realizar uma pré-triagem digital, relatando sintomas e intensidade da dor. |
| **RF04** | Agendamento de Consultas | O sistema deve permitir que pacientes solicitem agendamentos, escolhendo a data e o motivo da consulta através do aplicativo. |
| **RF05** | Gestão de Recepção e Agendamentos | O sistema deve fornecer à Secretaria a capacidade de gerenciar, confirmar, cancelar ou reagendar todos os agendamentos da clínica. |
| **RF06** | Gestão de Fila e Status | O sistema deve permitir que a Secretaria acompanhe o status de cada paciente em tempo real (ex: aguardando, em atendimento, finalizado). |
| **RF07** | Atribuição Profissional | O sistema deve permitir que a Secretaria atribua um Dentista específico para atender a triagem ou o agendamento de um paciente. |
| **RF08** | Painel Exclusivo do Profissional | O sistema deve garantir que cada Dentista visualize apenas as triagens e os agendamentos de pacientes que lhe foram atribuídos. |
| **RF09** | Prontuário Eletrônico | O sistema deve centralizar o histórico do paciente, permitindo que profissionais acessem a anamnese e os registros de tratamentos passados. |
| **RF10** | Evolução Clínica | O sistema deve permitir que o Dentista registre, consulte e atualize as evoluções clínicas do paciente detalhadamente após cada atendimento. |
| **RF11** | Emissão de Prescrições | O sistema deve permitir que o Dentista crie e gerencie receitas digitais (prescrições) para os pacientes de forma rápida. |
| **RF12** | Lançamento de Procedimentos | O sistema deve permitir o registro dos tratamentos e procedimentos odontológicos realizados, gerando o custo correspondente. |
| **RF13** | Controle de Pagamentos | O sistema deve possuir um módulo que permita à Secretaria registrar o recebimento de valores e acompanhar o status (Pendente, Parcial ou Pago). |
| **RF14** | Geração de Relatórios e Extratos | O sistema deve permitir a emissão e visualização de relatórios de tratamentos, incluindo a geração de faturas (PDF) para o paciente. |
| **RF15** | Comunicação Interna (Chat) | O sistema deve fornecer um chat interno para a troca de mensagens diretas e seguras entre os pacientes e a clínica. |
| **RF16** | Dashboard Administrativo | O sistema deve fornecer ao Administrador um painel (dashboard) com métricas gerais da clínica (total de pacientes, receita, profissionais ativos). |
| **RF17** | Atualização em Tempo Real | O sistema deve refletir mudanças críticas de forma instantânea nas telas dos usuários (ex: alteração de status) através de Websockets. |
| **RF18** | Controle de Segurança (LGPD) | O sistema deve aplicar regras de proteção (RLS) para garantir que informações clínicas e dados sensíveis sejam acessados apenas por usuários autorizados. |
| **RF19** | Acesso Multiplataforma | O sistema deve permitir que os usuários acessem todas as funcionalidades tanto em navegadores web quanto em dispositivos móveis (React Native). |

<br>

### Tabela 2: Requisitos Não Funcionais (RNF)

| Código | Categoria | Descrição |
| :--- | :--- | :--- |
| **RNF01** | Usabilidade (UX) | O sistema deve possuir interfaces limpas e painéis específicos para cada tipo de usuário, diminuindo a curva de aprendizado. |
| **RNF02** | Disponibilidade em Nuvem | O sistema deve utilizar uma arquitetura baseada em nuvem (Supabase) para garantir estabilidade e acesso centralizado de qualquer local com internet. |
| **RNF03** | Integridade de Dados | O banco de dados relacional (PostgreSQL) deve assegurar regras de consistência, impedindo exclusões acidentais de registros que possuam dependências. |
