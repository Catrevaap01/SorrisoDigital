# 🎓 ROTEIRO PROFISSIONAL DE DEFESA DE TCC
## Licenciatura em Engenharia Informática — ISPI Lubango

**Instituição:** Instituto Superior Politécnico Independente (ISPI) — Lubango, Angola  
**Coordenação:** Curso de Engenharia Informática  
**Autor:** António Pio Macaia Tati  
**Orientador:** Eng.º Judilson Nambalo  
**Coorientador:** Eng.º Marcelo Linguenha  
**Título do Trabalho:** *Desenvolvimento de uma Aplicação Móvel para Gestão e Agendamento de Consultas Odontológicas (Sorriso Digital)*  

---

## 🧭 Dicas Práticas para o Apresentador
- **Tempo estimado:** 15 a 20 minutos de exposição oral + 15 minutos para arguição da banca.
- **Postura:** Firme, voz pausada, contacto visual distribuído por todos os membros da banca examinadora.
- **Regra de ouro:** Comece sempre saudando o Presidente do Júri, os Vogais, o Orientador e o público presente.

---

## 📽️ SLIDE 1 — Acolhimento e Abertura Oficial

> **O que dizer:**  
> *"Magnífico Presidente da Mesa, Distintos Membros do Júri, Estimado Orientador Eng.º Judilson Nambalo, caros docentes, colegas e presentes: Muito boa tarde.*  
>  
> *O meu nome é **António Pio Macaia Tati**, finalista do curso de Engenharia Informática do Instituto Superior Politécnico Independente (ISPI). Venho hoje submeter à vossa criteriosa avaliação a minha monografia intitulada: **'Desenvolvimento de uma Aplicação Móvel para Gestão e Agendamento de Consultas Odontológicas'**, materializada no ecossistema de software **Sorriso Digital**."*

---

## 📽️ SLIDE 2 — Motivação, Contexto e Justificativa

> **O que dizer:**  
> *"No panorama sanitário de Angola, a medicina dentária enfrenta ainda grandes barreiras organizacionais. Historicamente, os consultórios e clínicas odontológicas gerem os seus processos por meio de fichas em papel ou de softwares genéricos fragmentados.*  
>  
> *Essa realidade acarreta perda de históricos clínicos, filas de espera desorganizadas, erros de faturação e, acima de tudo, o afastamento entre a clínica e o utente.*  
>  
> *Conforme fundamenta **Daniel (2020)** na sua pesquisa sobre a adoção de TIC na saúde em Angola, a computação móvel e a saúde digital (mHealth) constituem a via estratégica mais viável para quebrar barreiras geográficas e democratizar o acesso a cuidados diferenciados.*  
>  
> *Portanto, o **Sorriso Digital** nasce para preencher esta lacuna, unificando a triagem digital, o agendamento em tempo real, o prontuário eletrónico e a faturação numa plataforma única, moderna e adaptada à realidade angolana."*

---

## 📽️ SLIDE 3 — O Problema e a Ideia a Defender

> **O que dizer:**  
> *"Diante deste cenário, formulámos o seguinte problema de investigação:*  
> **'Como uma plataforma digital integrada pode ajudar a melhorar a gestão clínica, administrativa e financeira da clínica odontológica?'**  
>  
> *A **Ideia Básica a Defender** sustenta que a centralização dos fluxos clínico-administrativos sob uma arquitetura móvel e multiplataforma elimina a redundância operacional, agiliza a tomada de decisão médica e garante a conformidade com a segurança dos dados clínicos sensíveis."*

---

## 📽️ SLIDE 4 — Objetivos do Trabalho

> **O que dizer:**  
> *"Para materializar esta proposta, estabelecemos como **Objetivo Geral**:*  
> *Criar uma plataforma digital completa para gestão de clínicas dentárias, desmaterializando os processos clínicos, administrativos e financeiros.*  
>  
> *Dentre os **Objetivos Específicos**, destacam-se:*  
> 1. *Levantar e mapear 19 requisitos funcionais e requisitos de integridade e usabilidade;*  
> 2. *Modelar a arquitetura através de Diagramas UML (Casos de Uso, Classes) e DER;*  
> 3. *Implementar módulos de autenticação segura com múltiplos níveis de acesso (RBAC) e 2FA;*  
> 4. *Construir o módulo inovador de Triagem Digital com odontograma interativo;*  
> 5. *Garantir o funcionamento homogéneo e responsivo em **Mobile (APK Android), Web e PWA**."*

---

## 📽️ SLIDE 5 — Fundamentação Teórica e Citações Científicas

> **O que dizer:**  
> *"A fundamentação científica do trabalho apoia-se em quatro pilares:*  
>  
> 1. **Saúde Oral e Saúde Digital:** *A **FDI World Dental Federation (2016)** e a **OMS (2022)** definem a saúde oral como um direito humano inalienável e recomendam o uso da tecnologia para promoção universal da assistência. Como afirmam **Schwendicke et al. (2020)**, a transição para fluxos clínicos digitais é o percurso contemporâneo inevitável para a odontologia.*  
> 2. **Sistemas de Informação em Saúde:** ***Laudon e Laudon (2014)** e **O'Brien e Marakas (2013)** demonstram que os SIS transformam dados brutos em decisões clínicas de alta precisão, reduzindo a falha humana inerente ao papel.*  
> 3. **Engenharia de Software:** ***Sommerville (2019)** e **Pressman e Maxim (2016)** preconizam que a modularidade e o reuso de código via frameworks multiplataforma reduzem o custo e elevam a fiabilidade.*  
> 4. **Segurança da Informação:** *Seguindo a norma **ISO/IEC 27001 (2013)** e **Stallings e Brown (2015)**, estruturámos a segurança na tríade: Confidencialidade, Integridade e Disponibilidade, usando Row Level Security (RLS) e RBAC."*

---

## 📽️ SLIDE 6 — Metodologia e Tecnologias Empregadas

> **O que dizer:**  
> *"Adotámos uma metodologia de **pesquisa aplicada**, com abordagem qualitativa e desenvolvimento ágil baseado no framework **Scrum** (Schwaber & Sutherland, 2020), dividido em sprints incrementais.*  
>  
> *Na pilha tecnológica (Stack):*  
> - **Frontend:** *React Native com TypeScript e Expo, garantindo compilação para Android (APK), iOS, Web e Progressive Web App (PWA) a partir de uma única base de código.*  
> - **Backend-as-a-Service (BaaS):** *Supabase, que nos permitiu abstrair a gestão manual de infraestrutura (Fowler, 2015), fornecendo autenticação, WebSockets em tempo real e APIs instantâneas.*  
> - **Base de Dados:** *PostgreSQL relacional, garantindo integridade referencial rigorosa (Date, 2004; Elmasri & Navathe, 2011).*  
> - **Modelagem:** *Draw.io para elaboração dos diagramas UML e DER."*

---

## 📽️ SLIDE 7 — Modelação do Sistema (UML e DER)

> **O que dizer:**  
> *"A modelação orientada a objetos foi o alicerce para evitar retrabalho de código:*  
> - **Diagrama de Casos de Uso:** *Delimita claramente as fronteiras dos 4 atores: Paciente, Secretária, Dentista e Administrador.*  
> - **Diagrama de Classes:** *Estabelece alta coesão e baixo acoplamento entre classes centrais como `Usuario`, `Paciente`, `Dentista`, `Consulta`, `Triagem`, `Prontuario`, `EvolucaoClinica`, `Prescricao` e `Pagamento`.*  
> - **Diagrama Entidade-Relacionamento (DER):** *Define cardinalidades precisas e regras de integridade (Foreign Keys e Cascade Constraints), impedindo, por exemplo, que um paciente seja apagado acidentalmente se possuir consultas ou faturamentos associados."*

---

## 📽️ SLIDE 8 — Demonstração das Funcionalidades Principais

> **O que dizer:**  
> *"O Sorriso Digital foi concebido com telas limpas e focadas na experiência do utilizador (UX):*  
>  
> 1. **Triagem Digital com Odontograma Interativo:** *O paciente não precisa de explicar de forma vaga; ele toca diretamente nos dentes afetados no odontograma SVG, indica o nível de dor (0 a 10) e anexa fotografias para avaliação preliminar do dentista.*  
> 2. **Painel Operacional da Secretária:** *Fila em tempo real para gerir agendamentos, confirmar horários, sugerir novas datas e encaminhar para o dentista de acordo com a especialidade.*  
> 3. **Painel Clínico do Dentista:** *Agenda visual por mês, gestão de pacientes com prontuário eletrónico, registo de Evolução Clínica a cada atendimento, emissão de prescrições farmacológicas em PDF e planos de tratamento.*  
> 4. **Governança Administrativa & Auditoria:** *O Administrador dispõe de um painel executivo com métricas de negócio, faturamento e um log de auditoria com rastreabilidade total de todas as ações sensíveis realizadas no sistema.*  
> 5. **Chat em Tempo Real:** *Comunicação direta e segura via WebSockets entre pacientes e profissionais, eliminando a dispersão de dados em canais informais."*

---

## 📽️ SLIDE 9 — Compatibilidade Multiplataforma (Web, PWA e Mobile APK)

> **O que dizer:**  
> *"Um dos maiores desafios técnicos superados foi assegurar 100% de compatibilidade entre ambientes:*  
> - *No **Mobile (Android APK)**: Execução nativa fluida com acesso direto à câmara e ao armazenamento seguro (SecureStore).*  
> - *Na **Web & PWA**: A aplicação instala-se diretamente pelo navegador em computadores ou telemóveis, possui Service Worker para carregamento instantâneo offline e adapta a navegação responsiva (Tabs vs. Drawer).*  
> - *Para garantir a proteção de dados confidenciais de saúde, implementámos 2FA via WhatsApp para perfis clínicos e administrativos e restrições granulares via RLS no banco de dados."*

---

## 📽️ SLIDE 10 — Conclusão e Trabalhos Futuros

> **O que dizer:**  
> *"Em conclusão, todos os objetivos gerais e específicos foram plenamente atingidos.*  
>  
> *O **Sorriso Digital** comprova que a transformação digital da odontologia em Angola é viável, financeiramente sustentável e capaz de elevar imediatamente o padrão de atendimento ao cidadão.*  
>  
> *Para trabalhos futuros, perspetiva-se:*  
> - *Integração com gateways de pagamentos eletrónicos locais (Multicaixa Express / EMIS);*  
> - *Módulos de teleodontologia com videoconferência síncrona;*  
> - *Apoio ao diagnóstico clínico através de Inteligência Artificial para análise de radiografias digitais.*  
>  
> *Agradeço a vossa distinta atenção e coloco-me inteiramente à disposição do Júri para a fase de perguntas e esclarecimentos. Muito obrigado!"*
