# Relatório Técnico Prático: Arquitetura e Estrutura do Sistema TeOdonto Angola

## 1. Visão Geral e Arquitetura do Sistema
O **TeOdonto Angola** é um ecossistema digital inteligente de saúde (eHealth/Dentary), desenhado sob a vertente *Mobile-First* e *Cross-Platform* (Web, Mobile iOS/Android, PWA). 
O seu eixo base é a orquestração e gestão integral do ecossistema de uma clínica dentária, dividida em quatro grandes atores:
1. **Paciente**: Consulta histórico, submete triagens médicas, cria agendamentos.
2. **Secretário(a)**: Gere as filas de alocação de triagens/consultas e supervisiona a vertente financeira básica.
3. **Dentista**: Realiza as avaliações clínicas, prescreve planos de tratamento e executa procedimentos.
4. **Administrador**: Tem a panorâmica analítica do negócio de toda a base da clínica (Estatísticas, Faturação e Usuários).

A arquitetura do projeto segue o paradigma de **Componentes Reativos Funcionais**, com injeção de dependência simplificada (Context API) e regra de negócios isolada da interface.

## 2. Tecnologias e Stack (Stack Tecnológico)
O projeto foi materializado recorrendo às melhores tecnologias modernas:
* **Frontend Framework**: **React Native** suportado pela infraestrutura do **Expo**, que permite gerar nativamente APKs/AABs (Android), IPAs (iOS) e pacotes transpilados para Aplicação Web.
* **Linguagem**: **TypeScript** garante tipagem estática e segurança do código, interceptando bugs antes mesmo da compilação.
* **Backend as a Service (BaaS)**: **Supabase** (que por debaixo dos panos provê um motor Base de Dados **PostgreSQL**). É responsável pela Autenticação, Base de Dados, Funções de Banco (`RPCs`), Notificações Real-Time (WebSockets) e Gestão de Imagens/Ficheiros (Storage).

## 3. Explicação da Estrutura de Diretórios (Codebase)
O coração da aplicação reside no diretório `/src`, que é fracionado por princípios de *Single Responsibility*:

* **/config**: Onde reside a subscrição direta do Backend (chaves da base de dados e URL de API).
* **/contexts**: O principal ficheiro é o `AuthContext.tsx`. Ele vigia a sessão e as hierarquias (Role do Utilizador). Evita o recarregamento de ecrãs.
* **/navigation**: O `AppNavigator.tsx` age como o controlador de rotas mestre, encaminhando cada tipo de funcionário/paciente para o seu ecrã destinado com segurança.
* **/screens**: Cada ator tem a sua respetiva pasta (`/admin`, `/dentista`, etc). Aqui ficam as lógicas de Views front-end.
* **/hooks**: Ciclos de vida da aplicação e fetch de dados automatizado (ex: Atualização da fila de pacientes periodicamente).
* **/services**: Lógica de Negócios e Backend. Ex: `relatorioService.ts` calcula tabelas financeiras e elabora páginas para emissão PDF oficial da clínica.
* **/components & /ui**: Módulos visuais recicláveis, como cartões de resumo, modais ou botões padronizados.
* **/utils & /styles**: A base de estilos de padronização, regras CSS da marca (System Design - `theme.ts`) e ajudantes de formatação formatadores.

## 4. O Sistema Inteligente de Real-Time e Resiliência
Através do protocolo **WebSockets (`postgres_changes`)**, as abas administrativas ficam num estado constante de "escuta". Assim que um paciente cria uma urgência no seu mobile app, o telemóvel da secretária processa de forma autônoma essa chegada, sem dar "refresh" obrigatório à folha. Isto cria a sensação de atendimento real-time.

---

# Levantamento de Requisitos

## 5. Requisitos Funcionais (RF)
*Descrevem o que o sistema deverá fazer, e as suas funcionalidades diretas.*

1. **RF01 - Autenticação e Perfis:** O registo e autenticação de utilizadores sob papéis de acesso estrito (Paciente, Dentista, Secretário, Administrador).
2. **RF02 - Triagem Digital:** O sistema deve permitir que pacientes submetam formulários de descrição médica online para orçamentação primária.
3. **RF03 - Gestão de Consultas:** Possibilidade de os pacientes solicitarem prazos médios de atendimento presencial e os visualizarem numa linha do tempo.
4. **RF04 - Orquestração de Fila (Secretaria):** A secretária precisa monitorizar, analisar e gerir uma fila consolidada com todos os encaminhamentos, em lista ou painel analítico.
5. **RF05 - Atribuição Clínica:** Delegar cada paciente não assistido a um Dentista específico que esteja livre.
6. **RF06 - Painel Médico:** O Dentista consegue visualizar informações do doente (sintomas reportados, histórico da clínica e prescrições).
7. **RF07 - Planos de Tratamentos (Procedimentos Práticos):** Criar pastas clínicas (Planos) englobando a prescrição de procedimentos a faturar e monitorizar o seu custo nominal.
8. **RF08 - Fluxo Financeiro (Caixa):** Marcar os procedimentos ou tratamentos como sendo Pagos totalmente, Parcialmente, e identificar Dívidas Pendentes.
9. **RF09 - Emissão Documental:** Extração de tabelas HTML complexas para exportação em formato PDF, como extratos mensais ou comissões dos Dentistas.

## 6. Requisitos Não Funcionais (RNF)
*Métrica de qualidade, conformidade técnica, restrições e performance.*

1. **RNF01 - Multiplataforma (Portabilidade):** O Frontend tem a obrigação arquitetónica baseada em React Native (Multi-Environment Setup).
2. **RNF02 - Responsividade Dinâmica:** Layout dinâmico que não sobrepõe divs mediante rotações do ecrã; auto-adaptação para visualização no computador através da técnica de `FlexBox` ajustável via Windows Dimensions.
3. **RNF03 - Sincronização *Real-Time*:** Operação baseada sobre WebSockets providos pelo BaaS.
4. **RNF04 - Banco Relacional com RLS:** O sistema transaciona fluxos na engine Postgres. Segurança estrita da Row Level Security não possibilita ao dentista espiar folhas de pagamentos ou relatórios da secretária na DB.
5. **RNF05 - Desempenho Funcional Remoto:** Consultas estatísticas não causam sobrecarga da RAM do aparelho recetor. Recorrem-se a construções SQL (`admin_report_stats`) acionadas como RPC (Remote Procedure Call).

---

# Modelação da Arquitetura

## 7. Atores e Casos de Uso (Interações Base)

1. **Ator: PACIENTE**
   * Realizar Registo/Login.
   * Solicitar Nova Triagem.
   * Criar Agendamento de Consulta.
   * Visualizar Histórico Pessoal.
2. **Ator: SECRETÁRIA**
   * Validar solicitações de contacto do paciente.
   * Atribuir Triagem/Consulta ao Dentista (Encaminhamento Diário).
   * Confirmar pagamentos de Procedimentos Recebidos ou Agendamentos.
   * Imprimir/Gerar Faturação dos Operacionais.
3. **Ator: DENTISTA**
   * Verificar Lista de Atribuições pendentes (Painel Base).
   * Emitir Diagnósticos e Adicionar Notas a Consultas (Triagem Respondida).
   * Criar Planos de Tratamentos (Procedimentais).
   * Finalizar e Validar Procedimentos Clínicos e Prescritivos.
4. **Ator: ADMINISTRADOR**
   * Supervisionar Indicadores da Clínica Computorizados (Dashboards).
   * Monitorar Ganhos e Performance por Dentista (Perspetiva Global).

## 8. Diagrama de Transações Base de Dados (Entity-Relationship)
As entidades cardinais do TeOdonto Angola circundam as definições nucleares de Perfil (`Profiles`) que controlam a camada base. Segue a relação modelada dos vetores transacionais:

* \`PROFILES (1)\` < ---- > \`(N) APPOINTMENTS\` (Registos de Tempo).
* \`PROFILES (1)\` < ---- > \`(N) PLANOS_TRATAMENTO\` (Dono Biológico do Trato de Saúde).
* \`PLANOS_TRATAMENTO (1)\` < ---- > \`(N) PROCEDIMENTOS_TRATAMENTO\` (O Recurso Atribuído de Valor Económico).
* \`PROFILES (1)\` < ---- > \`(N) TRIAGENS\` (Sintomatologia Desportada pelo Cliente).

*O Fluxograma de Arquitetura da Informação comprova que todo o dinheiro ganho (e gerido pelo negócio) detém um trilho auditável exato: Procedimento Nominal → Pertence ao Plano → Validado Pelo Dentista X → Pago pelo Paciente Y.*
