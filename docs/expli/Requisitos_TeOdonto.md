# Requisitos do Sistema TeOdonto

### Tabela 1: Requisitos Funcionais (RF)

| Código | Nome do Requisito | Descrição |
| :--- | :--- | :--- |
| **RF01** | Gestão de Usuários e Perfis | O sistema deve permitir o cadastro, edição e autenticação de usuários com diferentes níveis de acesso (Paciente, Dentista, Secretário e Admin). |
| **RF02** | Triagem Digital | O sistema deve possuir um módulo onde pacientes possam realizar uma pré-triagem digital, relatando sintomas e intensidade da dor. |
| **RF03** | Agendamento de Consultas | O sistema deve permitir que pacientes solicitem agendamentos, escolhendo a data e o motivo da consulta. |
| **RF04** | Gestão de Recepção | O sistema deve fornecer à Secretaria a capacidade de gerenciar, confirmar, cancelar ou reagendar todos os agendamentos e triagens da clínica. |
| **RF05** | Atribuição Profissional | O sistema deve permitir que a Secretaria atribua um Dentista específico para atender a triagem ou o agendamento de um paciente. |
| **RF06** | Painel Exclusivo do Profissional | O sistema deve garantir que cada Dentista visualize apenas as triagens e os agendamentos de pacientes que lhe foram atribuídos. |
| **RF07** | Prontuário e Evolução Clínica | O sistema deve permitir que o Dentista registre, consulte e atualize as evoluções clínicas do paciente após cada atendimento. |
| **RF08** | Emissão de Prescrições | O sistema deve permitir que o Dentista crie e gerencie receitas digitais (prescrições) para os pacientes. |
| **RF09** | Controle Financeiro | O sistema deve possuir um módulo financeiro que permita registrar procedimentos e acompanhar o status de pagamento (Pendente, Parcial ou Pago). |
| **RF10** | Comunicação Interna (Chat) | O sistema deve fornecer um chat interno para a troca de mensagens diretas entre os pacientes e a clínica. |
| **RF11** | Painel Administrativo | O sistema deve fornecer ao Administrador um dashboard com métricas gerais da clínica (total de pacientes, receita, profissionais ativos). |

<br>

### Tabela 2: Requisitos Não Funcionais (RNF)

| Código | Categoria | Descrição |
| :--- | :--- | :--- |
| **RNF01** | Segurança (LGPD) | O sistema deve utilizar controle rigoroso de acesso (RLS) para garantir que informações clínicas sejam acessadas apenas por usuários autorizados. |
| **RNF02** | Multiplataforma | A interface do sistema deve ser construída (*React Native*) para funcionar de forma responsiva tanto em navegadores web quanto em dispositivos móveis. |
| **RNF03** | Desempenho (Tempo Real) | O sistema deve refletir mudanças críticas de forma instantânea (como alteração de pagamento), utilizando a tecnologia de Websockets do Supabase. |
| **RNF04** | Usabilidade (UX) | O sistema deve possuir interfaces limpas e painéis específicos para cada tipo de usuário, diminuindo a curva de aprendizado. |
| **RNF05** | Disponibilidade | O sistema deve utilizar uma arquitetura baseada em nuvem para garantir estabilidade e acesso online 24 horas por dia, 7 dias por semana. |
| **RNF06** | Integridade de Dados | O banco de dados relacional (PostgreSQL) deve assegurar regras de consistência, impedindo exclusões acidentais de registros que possuam dependências. |
