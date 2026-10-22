# GUIÃO COMPLETO: PERGUNTAS E RESPOSTAS PARA DEFESA (TCC)
**Tema:** Desenvolvimento de uma Aplicação Móvel para Gestão e Agendamento de Consultas Odontológicas (Sorriso Digital)  
**Autor:** António Pio Macaia Tati  

Este documento reúne todas as perguntas que os professores (banca examinadora de Engenharia Informática) poderão fazer, juntamente com as respostas fundamentadas diretamente no teu TCC.

---

## 🏛 1. Questões sobre Motivação e Problema
### Pergunta 1: O que o motivou a desenvolver este sistema especificamente para a área de Odontologia?
**Resposta:** Fui motivado pela constatação de um problema real. Durante a minha análise da clínica *One Smile Consultória Dentária*, verifiquei que grande parte dos fluxos eram feitos em papel ou em sistemas isolados que não comunicavam entre si. Isto gerava choques de agenda, perda de históricos clínicos e confusões financeiras. Decidi intervir usando os conhecimentos de engenharia para criar uma plataforma (Sorriso Digital) que centralizasse e automatizasse estes processos num só lugar.

### Pergunta 2: Na tua introdução referes a mudança do paradigma analógico para o digital. Na tua opinião, qual é o maior benefício dessa transição?
**Resposta:** A eliminação da redundância de dados e do extravio de informação. Num sistema tradicional de saúde, arquivos de papel deterioram-se e desorganizam-se. No digital, garantimos a persistência, integridade (com o PostgreSQL do Supabase) e alta disponibilidade de acesso pela equipa médica diretamente pelo telemóvel, independentemente de onde estiverem.

---

## 💻 2. Questões sobre Tecnologias Utilizadas
### Pergunta 3: Porquê a escolha da tecnologia React Native para a Interface em vez de linguagens nativas puras (Swift / Kotlin) ou de aplicações Web simples?
**Resposta:** A escolha do React Native alicerçou-se na produtividade e eficácia de recursos, um aspeto fundamental da Engenharia de Software preconizado por Sommerville*. React Native permite a compilação do código (escrito em JavaScript e TypeScript) convertendo-o para plataformas cruzadas (Android e iOS) a partir de apenas *uma base de código (single codebase)*. Isto resultou numa economia colossal de tempo de 1 para 2. Se usasse linguagens nativas, teria de refazer o trabalho em dobro. 

### Pergunta 4: Utilizaste o Supabase como serviço backend ao invés de soluções como o Firebase. Pode justificar técnica e estruturalmente o porquê?
**Resposta:** O Supabase, além das excelentes features como o *Realtime* (para o Chat) e a Autenticação (BaaS), assenta sobre **PostgreSQL**. Numa aplicação médica onde precisamos conectar Consultas aos Pacientes e aos Pagamentos, uma base estruturada relacional com forte integridade e "ACID Compliance" (Atomicidade, Consistência, Isolamento e Durabilidade) é superior aos sistemas *NoSQL* (como o Firebase), para garantir que um registo de tratamento vital não cria dependências "órfãs".

### Pergunta 5: O que é o TypeScript e de que modo este te ajudou durante o desenvolvimento tecnológico?
**Resposta:** O TypeScript acrescenta "Tipagem Estática" ao JavaScript. Isto obriga à estruturação exata das variáveis na "compile-time". Num projeto médico, um erro na tipagem dos miligramas de um medicamento pode ser desastroso. O TypeScript evita estes *bugs* e *crashes* durante a execução, parando e sublinhando o erro a vermelho para o desenvolvedor antes sequer do código seguir em diante.

---

## 🔒 3. Segurança da Informação e Dados Clínicos
### Pergunta 6: A aplicação lida com dados pessoais estritamente clínicos (segredo médico). Como a segurança destes dados e os requisitos RNF (LGPD/Segurança) foram atingidos no seu back-end?
**Resposta:** Ao modelar o sistema, empregamos o modelo **RBAC (Controle de Acesso Baseado em Funções)** cruzado com as políticas da **Row Level Security (RLS)** instaladas no Supabase. O RLS atua a nível de linha da base de dados. Isto significa que, por regra matemática, as sessões JWT asseguram que a consulta ou o raio-x só transita pela API caso a assinatura do token pertença àquele paciente ou ao dentista encarregue de o operar.

---

## 📐 4. Modelação e Enquadramento Metodológico
### Pergunta 7: Foste utilizador do Framework Scrum. Consegues justificar a vantagem prática da sua utilização? 
**Resposta:** Optei por um de método Ágil em vez do Modelo Tradicional (Cascata/Waterfall) porque os processos nas clínicas são mutáveis e havia necessidade de validação. O Scrum dividiu todo o processo num conjunto restrito de *Sprints*. Pude construir e isolar primeiro os módulos de Base de Dados, verificar o login e as permissões de utente, e depois avançar progressivamente até ao Prontuário Médico Digital. Mitigou muito a dificuldade que existe se tentássemos codificar logo 100% dos artefactos no dia um.

### Pergunta 8: Qual é a diferença na modelação orientada ao Diagrama de Classes e ao DER (Diagrama Entidade-Relacionamento)?
**Resposta:** O Diagrama de Classes (focado na lógica Orientada a Objetos, ou front/backend) demonstra a identidade, atributos e "vínculos ativos / métodos" entre o Doutor, o Utente e a Consulta. Por sua vez, o DER (foco no Administrador de BD / PostgreSQL) traduz com o foco técnico da Cardinalidade: explicita como esses atributos irão figurar organicamente como "Key/Foreign Key" dentro das tabelas transacionais e semânticas. 

---

## 🤓 5. Funcionalidades de Domínio e "Tricks" (Perguntas Rasteira)
### Pergunta 9: No ecrã 'Triagem Digital', referes que esta fase é auto-gerida (...). A plataforma Sorriso Digital faz Diagnósticos aos utentes baseados em Algoritmos Inteligentes?
**Resposta:** Não. Existe um distanciamento deliberado que deve ficar claro na engenharia. Como descrevo, o Utente preenche uma Triagem referenciando os "Sintomas e Dores". Baseia-se apenas num levantamento referencial preliminar e auto-referido que auxilia e otimiza a triagem operatória da clínica. Cabe, no entanto, ética e unicamente, ao ator central Médico Dentista avaliar este *feed* e elaborar o diagnóstico verídico ao chegar o exame de raios-X e à fase de *Evolução Clínica* (UC10/11) na nossa arquitetura da sua App exclusiva.

### Pergunta 10: Ao definir perspetivas futuras (Capítulo 3), indicas o caminho da "Escalabilidade". O que pretendes dizer e o que esperas para a aplicação a longo prazo?
**Resposta:** Um sistema Escalável descreve o cenário em que a nossa modelagem original da Base de dados pode aceitar novos módulos com robustez e zero quebras sistémicas, conforme for requerido no mercado nacional angolano e pelas políticas de "Saúde 4.0". Um exemplo excelente será usar a camada modular disponível e incorporar Gateways/APIs Estatais que processem a comparticipação de seguros (via EMIS/Multicaixa) de modo estritamente direto na UI / fatura para o cidadão sem destruir o MVC pré-estabelecido.

---

## 🔐 6. Segurança Avançada, 2FA e Governança Clínica

### Pergunta 11: Por que razão a Autenticação em Duas Etapas (2FA) foi implementada via WhatsApp e é exclusiva para Admin, Secretários e Dentistas?
**Resposta:** Trata-se de um equilíbrio estratégico entre **Segurança Rigorosa e Usabilidade**. 
- **Exclusividade do Staff (Admin, Secretário, Dentista):** Estes perfis têm acesso a prontuários médicos confidenciais, prescrições e movimentações financeiras da clínica. Uma brecha numa destas contas colocaria em risco a privacidade de dezenas de pacientes. Por isso, a verificação em 2 etapas é mandatória para eles. Já o utente comum só vê a sua própria ficha e precisa de rapidez para marcar consultas sem atrito.
- **Canal WhatsApp:** No contexto angolano, o envio de SMS internacional é dispendioso e falha com frequência. O WhatsApp possui praticamente 100% de penetração em smartphones em Angola e não gera custos para o utilizador que recebe o código de 6 dígitos através dos planos de dados das operadoras nacionais (Unitel/Africell).

### Pergunta 12: Como está estruturado o Log de Auditoria (Audit Log) e por que ele é crucial numa clínica odontológica?
**Resposta:** Numa instituição de saúde, a rastreabilidade é lei. O Audit Log armazena de forma imutável quem realizou cada ação crítica (`user_id`, `email`, `ação`, `recurso`, `data/hora` e `metadados JSON`). Isto permite saber exatamente quem alterou o estado de um agendamento, quem emitiu uma fatura ou quando um prontuário foi atualizado, impedindo fraudes e garantindo conformidade médica.

### Pergunta 13: Como foi concebido o módulo de Relatórios Executivos e Finanças em Kwanzas (Kz)?
**Resposta:** O módulo foi arquitetado em 4 abas especializadas para facilitar a tomada de decisão da direção clínica:
1. **Visão Geral:** KPIs de pacientes, atendimentos, crescimento mensal e comparativo de *Receita Realizada* vs. *Estimada* em Kwanzas (Kz).
2. **Dentistas:** Estatísticas de triagens e procedimentos por profissional, com exportação de relatório individual em PDF.
3. **Secretários:** Acompanhamento da receção e atendimento, também com PDF individual.
4. **Central de PDFs:** Geração instantânea de relatório consolidado geral do sistema para prestação de contas.

### Pergunta 14: Como a interface do sistema se adapta a diferentes dispositivos (Mobile, Web, PWA) sem quebrar modais e formulários?
**Resposta:** Adotámos uma arquitetura de design responsivo com React Native:
- Uso de `KeyboardAvoidingView` e `ScrollView` dinâmico em modais para que o teclado virtual de dispositivos móveis nunca sobreponha os campos de inserção de código (como no 2FA) ou de dados clínicos.
- Centralização e padronização visual com containers de `maxWidth: 900` no Desktop/Web para que a experiência do usuário seja agradável tanto numa receção em computador Windows quanto num tablet ou smartphone Android.
