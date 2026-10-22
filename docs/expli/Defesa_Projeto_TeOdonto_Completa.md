# Defesa do Projeto de Fim de Curso: TeOdonto Angola
**Sistema Integrado de Gestão e Triagem Odontológica**

---

## 1. Introdução e Visão Geral
O **TeOdonto Angola** é um ecossistema digital inteligente de saúde (eHealth/Dentary), desenhado sob a vertente *Mobile-First* e *Cross-Platform* (Web, Mobile iOS/Android, PWA). O sistema visa digitalizar e modernizar o fluxo de atendimento em clínicas odontológicas, eliminando processos em papel e descentralizando a gestão.

O seu eixo base é a orquestração e gestão integral da clínica, dividida em quatro grandes atores:
1. **Paciente**: Consulta histórico, submete triagens médicas, cria agendamentos.
2. **Secretário(a)**: Gere as filas de alocação de triagens/consultas e supervisiona a vertente financeira básica.
3. **Dentista**: Realiza as avaliações clínicas, prescreve planos de tratamento e executa procedimentos.
4. **Administrador**: Tem a panorâmica analítica do negócio (Estatísticas, Faturação e Usuários).

---

## 2. O Problema e a Justificativa
As clínicas odontológicas em Angola (e muitas outras regiões) sofrem com problemas crónicos de gestão:
* **Dependência de Papel**: Processos manuais, perda de fichas e arquivos físicos desorganizados.
* **Falta de Integração**: Sistemas de agendamento desconectados do registo clínico e do financeiro.
* **Comunicação Ineficiente**: Pacientes não conseguem comunicar urgências rapidamente; secretarias ficam sobrecarregadas com chamadas.
* **Falta de Transparência Financeira**: Dificuldade em rastrear dívidas, pagamentos parciais e comissões de dentistas.

O TeOdonto surge para resolver estes problemas através de uma plataforma integrada, segura e em tempo real.

---

## 3. Arquitetura e Stack Tecnológico
O projeto segue o paradigma de **Componentes Reativos Funcionais**, com injeção de dependência simplificada e regras de negócios isoladas.

* **Frontend / Mobile**: **React Native** com **Expo**. Permite gerar nativamente aplicações Android (APK/AAB), iOS (IPA) e Web/PWA a partir do mesmo código base.
* **Linguagem**: **TypeScript** garante tipagem estática e segurança de código, evitando erros de execução.
* **Backend as a Service (BaaS)**: **Supabase** (PostgreSQL). Fornece:
  * Autenticação Segura.
  * Base de Dados Relacional.
  * Funções RPC (Remote Procedure Calls) para relatórios pesados.
  * WebSockets para sincronização *Real-Time*.
  * Armazenamento (Storage) para imagens/radiografias.

### O Sistema Inteligente de Real-Time
Através do protocolo **WebSockets (`postgres_changes`)**, as abas administrativas mantêm-se em estado de "escuta". Quando um paciente submete uma triagem no telemóvel, o painel da secretária é atualizado de forma autônoma (sem necessidade de *refresh*), conferindo atendimento em tempo real.

---

## 4. Segurança e Privacidade (RLS)
Um dos pilares do sistema é a segurança dos dados médicos. Utilizamos **Row Level Security (RLS)** do PostgreSQL:
* O sistema transaciona fluxos na engine Postgres com segurança estrita.
* O dentista **não pode** espiar as comissões de outro dentista.
* O paciente **só tem acesso** ao seu próprio histórico.
* A secretaria não altera diagnósticos médicos, apenas encaminha.
* As permissões são validadas a nível de banco de dados, tornando o sistema imune a falhas no Frontend.

---

## 5. Requisitos Funcionais Principais
1. **RF01 - Autenticação e Perfis**: Gestão de acesso baseada em roles (Paciente, Dentista, Secretário, Admin).
2. **RF02 - Triagem Digital**: Submissão de formulários de descrição médica online por pacientes.
3. **RF03 - Gestão de Consultas**: Agendamentos e linha do tempo de atendimentos.
4. **RF04 - Orquestração de Fila**: Monitorização e gestão de fila pela Secretaria.
5. **RF05 - Atribuição Clínica**: Delegação de pacientes não assistidos a Dentistas disponíveis.
6. **RF06 - Painel Médico**: Acesso do Dentista a sintomas, histórico e criação de evoluções clínicas.
7. **RF07 - Planos de Tratamentos**: Criação de pastas clínicas e prescrição de procedimentos com custo.
8. **RF08 - Fluxo Financeiro**: Gestão de pagamentos (Totais, Parciais) e controlo de dívidas e faturamento em Kwanzas (Kz).
9. **RF09 - Relatórios Executivos em 4 Eixos**: Painel de BI segmentado (Visão Geral de KPIs e Finanças Kz, Gestão de Dentistas, Secretários e Central de PDFs) com emissão de relatórios em PDF.
10. **RF10 - Autenticação em 2 Etapas (2FA) via WhatsApp**: Verificação de segurança obrigatória para cargos administrativos e clínicos (Admin, Secretário e Dentista) sem atrito para o paciente comum.
11. **RF11 - Log de Auditoria Imutável (Audit Log)**: Rastreabilidade cronológica completa de todas as ações de staff com filtros por categoria e metadados JSON.
12. **RF12 - Acolhimento Institucional**: Carrossel dinâmico na tela inicial com transição a cada 10 segundos e ilustrações odontológicas.

---

## 6. Requisitos Não Funcionais
1. **RNF01 - Multiplataforma**: Código base React Native a correr em Web, Android e iOS.
2. **RNF02 - Responsividade Dinâmica**: Adaptação perfeita de ecrãs para dispositivos móveis e computadores (FlexBox).
3. **RNF03 - Sincronização *Real-Time***: Alterações refletidas instantaneamente usando Supabase.
4. **RNF04 - Banco Relacional com RLS**: Integridade referencial e segurança profunda via políticas RLS.
5. **RNF05 - Desempenho (RPCs)**: Cálculos pesados estatísticos (dashboards) são processados no backend via RPC, poupando a bateria/memória do telemóvel.
6. **RNF06 - Disponibilidade Offline (Parcial)**: Uso de cache local (`AsyncStorage`) para funcionamento de componentes visuais base.

---

## 7. Modelagem de Dados
O coração do sistema gira à volta da tabela `profiles`, que se liga a todas as entidades vitais:
* `profiles` 1:N `appointments` (Agendamentos)
* `profiles` 1:N `triagens` (Sintomas Iniciais)
* `profiles` 1:N `planos_tratamento` (Pastas Clínicas)
* `planos_tratamento` 1:N `procedimentos_tratamento` (Intervenções e Custos)

**Rastreio Auditável:** Todo cêntimo que entra é rastreável. *Procedimento Nominal -> Pertence ao Plano -> Validado pelo Dentista -> Pago pelo Paciente.*

---

## 8. Guião / Roteiro de Apresentação (Passo-a-Passo)
*Utilize este guião durante a sua apresentação pública.*

**Slide 1: Introdução**
* "Bom dia/Boa tarde ao Júri e aos presentes."
* "Apresento-vos o TeOdonto Angola, um sistema integrado desenhado para resolver as falhas de comunicação e gestão nas clínicas odontológicas, onde o papel ainda predomina."

**Slide 2: A Problemática**
* "Identificámos clínicas a perder pacientes devido a agendamentos esquecidos, falta de clareza nas finanças (o que foi pago e o que deve) e dificuldade dos médicos terem acesso rápido ao histórico."

**Slide 3: A Solução Inovadora (TeOdonto)**
* "Criámos uma plataforma com foco no Paciente e na Clínica."
* "O paciente usa a App para reportar o seu problema (Triagem). A secretária recebe no ecrã em tempo real. Ela encaminha. O dentista diagnostica e cria o plano."

**Slide 4: Demonstração Rápida (Se aplicável)**
* Mostre a tela de login.
* Mostre a dashboard do Dentista e o módulo financeiro.
* Mostre como é fácil criar um tratamento.

**Slide 5: A Arquitetura Técnica**
* "Não queríamos criar três aplicações diferentes. Escolhemos React Native para partilhar 100% do código entre Android, Web e iOS."
* "Para garantir segurança absoluta, usámos PostgreSQL com Supabase, trancando dados sensíveis diretamente com RLS, o que significa que nem um hacker na web conseguiria contornar as regras da aplicação."

**Slide 6: Resultados e Conclusão**
* "O sistema garante zero papel, processos financeiros claros, rastreabilidade médica absoluta e um fluxo onde a receção não fica sobrecarregada."
* "Como trabalhos futuros, visamos IA para pré-diagnóstico com radiografias e integração com faturamentos SAFT."

---

## 9. Perguntas Típicas da Banca (E Respostas!)

**P: Porquê usar React Native e não Flutter ou Android Nativo?**
*R: Escolhemos React Native porque o ecossistema Web (TypeScript, React) é vastíssimo. Com o Expo, conseguimos criar a versão Web da Secretaria e a versão Mobile para os Dentistas e Pacientes a partir de um único repositório, poupando 70% de tempo de desenvolvimento e facilitando a manutenção.*

**P: O que acontece se a clínica ficar sem internet?**
*R: O sistema foi construído em nuvem, pelo que requer internet para sincronização real-time. No entanto, o front-end possui mecanismos de cache (CacheService) que guardam as últimas sessões lidas para não bloquear a interface caso haja quebras momentâneas. (Estratégia Offline-First parcial).*

**P: Como garante que o Dentista A não vê o ordenado do Dentista B?**
*R: Essa é uma das maiores valências da nossa arquitetura. Não usamos apenas validação de interface. Aplicamos Row Level Security (RLS) diretamente no motor PostgreSQL. O banco de dados sabe qual utilizador (Token JWT) está a pedir dados, e a base de dados em si rejeita a leitura, mesmo que se utilize o Postman ou scripts maliciosos.*

**P: Onde está alojado o Backend? É escalável?**
*R: O backend está gerido no Supabase, uma infraestrutura cloud que usa AWS sob os panos e fornece autoscaling do PostgreSQL.*

**P: Como funciona o indicador de presença Online/Offline dos dentistas e secretários no chat?**
*R: O sistema utiliza o protocolo de Presence do Supabase Realtime via WebSockets (`presence-global`). Ao abrir a aplicação, o dispositivo transmite a sua presença ativa. Em dispositivos móveis (Android/iOS), monitorizamos o `AppState` do React Native para disparar automaticamente a desconexão (`untrack`) quando a app entra em segundo plano ou o ecrã bloqueia. Na Web e PWA, os eventos de visibilidade do separador (`visibilitychange`) e foco da janela (`onblur/onfocus`) efetuam o rastreio automático. Isso garante um estado de Online/Offline 100% fiel e sincronizado em tempo real em todas as plataformas.*

**P: Porquê a escolha do WhatsApp para a Verificação em Duas Etapas (2FA) e por que ela é restrita ao staff?**
*R: Em Angola, o SMS tem alto custo e taxas de entrega instáveis, enquanto o WhatsApp possui adoção quase universal e trafega gratuitamente nos pacotes sociais das operadoras. A restrição aos perfis de Admin, Secretário e Dentista protege os dados clínicos confidenciais e a faturação da clínica onde o risco é crítico, ao mesmo tempo que mantém a marcação de consultas pelo paciente rápida e sem fricção.*

**P: Como o Log de Auditoria protege a integridade e governança da clínica?**
*R: Registando de forma imutável no PostgreSQL (`audit_logs`) cada login, emissão de prescrição, alteração de estado de consulta ou acesso a dados, associando o utilizador, timestamp e payload JSON do evento. Isso garante responsabilização (accountability) total e conformidade com normas éticas de saúde.*

---

## 10. Referencial Teórico Principal
*   BEZERRA, E. **Princípios de Análise e Projeto de Sistemas com UML**. 3. ed. Rio de Janeiro: Elsevier, 2015.
*   FACEBOOK. **React Native**. 2015. Disponível em: https://reactnative.dev.
*   LAUDON, K. C.; LAUDON, J. P. **Sistemas de Informação Gerenciais**. 11. ed. São Paulo: Pearson Prentice Hall, 2014.
*   OMS. **WHO guideline: recommendations on digital interventions for health system strengthening**. Genebra: WHO, 2019.
*   SOMMERVILLE, I. **Engenharia de Software**. 10. ed. São Paulo: Pearson, 2019.
*   SUPABASE. **The Open Source Firebase Alternative**. 2023. Disponível em: https://supabase.com.
