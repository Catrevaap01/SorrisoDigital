### 2.3.1 Diagrama de Casos de Uso

O diagrama de casos de uso representa as interações entre os diferentes tipos de utilizadores e a plataforma de gestão odontológica TeOdonto. Foram identificados quatro atores principais: o Paciente, a Secretaria, o Dentista e o Administrador.

O Paciente, após autenticação, tem acesso à sua área reservada, onde pode realizar pré-triagem digital, solicitar agendamentos de consultas e interagir através do chat da clínica. A Secretaria atua como o ponto central de controle da recepção, sendo responsável por gerenciar e confirmar agendamentos, monitorar a fila de espera em tempo real, atribuir pacientes aos dentistas e registrar recebimentos financeiros.

O Dentista possui um painel exclusivo focado no atendimento clínico, onde visualiza apenas os pacientes atribuídos a si, consulta o prontuário eletrônico completo, registra as evoluções clínicas, lança procedimentos realizados e emite prescrições médicas. O Administrador, por fim, é responsável pela gestão global do sistema, possuindo acesso ao cadastro de todos os usuários e perfis, além de visualizar um dashboard com métricas de receita, produtividade e fluxo da clínica. 

Este diagrama permitiu identificar claramente as funcionalidades do sistema e os rígidos níveis de acesso associados a cada ator.

Figura 1 - Diagrama de Casos de Uso *(inserir imagem do diagrama aqui)*

### 2.3.2 Descrição dos Casos de Uso

| Código | Nome do Caso de Uso | Descrição | Pré-condição | Pós-condição |
| :--- | :--- | :--- | :--- | :--- |
| **UC01** | Efetuar Login | Permite que o paciente acesse o aplicativo de forma segura. | Possuir cadastro ativo | O paciente é redirecionado para a tela inicial. |
| **UC02** | Realizar Triagem Digital | Permite ao paciente relatar seus sintomas e intensidade da dor antes da consulta. | Paciente autenticado | A triagem é salva e enviada para a Secretaria. |
| **UC03** | Solicitar Agendamento | Permite ao paciente escolher uma data e motivo para agendar uma consulta. | Paciente autenticado | A solicitação de agendamento fica pendente de aprovação. |
| **UC04** | Enviar Mensagem no Chat | Permite ao paciente trocar mensagens diretas com a clínica. | Paciente autenticado | A mensagem é enviada e notificada à clínica. |

**Tabela 3 - Casos de Uso – Ator Paciente (fonte: autor)**

<br>

| Código | Nome do Caso de Uso | Descrição | Pré-condição | Pós-condição |
| :--- | :--- | :--- | :--- | :--- |
| **UC05** | Gerenciar Agendamentos | Permite à secretaria confirmar, cancelar ou reagendar solicitações de consultas. | Secretaria autenticada | O status do agendamento é atualizado no sistema. |
| **UC06** | Acompanhar Fila de Espera | Permite visualizar e alterar o status de atendimento do paciente (ex: aguardando, finalizado). | Secretaria autenticada | A fila é atualizada em tempo real para todos. |
| **UC07** | Atribuir Dentista | Permite à secretaria direcionar um paciente específico para a agenda de um dentista. | Paciente na fila de espera | O paciente aparece no painel do dentista escolhido. |
| **UC08** | Registrar Pagamentos | Permite dar baixa financeira e acompanhar o status de pagamento (Pendente/Pago). | Secretaria autenticada | O saldo do paciente e o fluxo de caixa são atualizados. |

**Tabela 4 - Casos de Uso – Ator Secretaria (fonte: autor)**

<br>

| Código | Nome do Caso de Uso | Descrição | Pré-condição | Pós-condição |
| :--- | :--- | :--- | :--- | :--- |
| **UC09** | Visualizar Painel Exclusivo | Permite ao dentista ver apenas as consultas que lhe foram atribuídas para o dia. | Dentista autenticado | A lista de pacientes do dia é exibida. |
| **UC10** | Consultar Prontuário | Permite ao dentista acessar a anamnese e o histórico médico do paciente. | Paciente selecionado | Os dados clínicos são exibidos para leitura. |
| **UC11** | Registrar Evolução Clínica | Permite detalhar o atendimento realizado no paciente. | Dentista em atendimento | A evolução é salva permanentemente no prontuário. |
| **UC12** | Emitir Prescrição | Permite criar receitas digitais com medicamentos e observações. | Dentista autenticado | O PDF da prescrição é gerado para o paciente. |
| **UC13** | Lançar Procedimentos | Permite registrar os tratamentos efetuados para posterior cobrança. | Atendimento finalizado | Uma fatura é gerada para o controle da Secretaria. |

**Tabela 5 - Casos de Uso – Ator Dentista (fonte: autor)**

<br>

| Código | Nome do Caso de Uso | Descrição | Pré-condição | Pós-condição |
| :--- | :--- | :--- | :--- | :--- |
| **UC14** | Gerenciar Usuários | Permite ao administrador cadastrar ou editar Pacientes, Dentistas e Secretários. | Administrador autenticado | O novo perfil de usuário é criado ou modificado. |
| **UC15** | Visualizar Dashboard | Permite ao administrador consultar métricas financeiras e produtividade geral. | Administrador autenticado | Os gráficos e totais de receita são exibidos. |

**Tabela 6 - Casos de Uso – Ator Administrador (fonte: autor)**

<br>

### 2.3.3 Diagrama de Classes

O diagrama de classes é um dos principais diagramas da UML (*Unified Modeling Language*), utilizado para representar a estrutura estática do sistema TeOdonto. Ele descreve as classes que compõem a plataforma, seus atributos, métodos e os relacionamentos entre elas (como Paciente, Dentista, Agendamento e Pagamento), permitindo visualizar como as entidades do sistema odontológico se organizam e interagem no banco de dados.

Figura 2 - Diagrama de Classes *(inserir imagem do diagrama aqui)*
