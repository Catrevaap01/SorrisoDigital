# 🛡️ GUIA DE PERGUNTAS TÉCNICAS DA BANCA EXAMINADORA
## Preparação para Arguição em Engenharia Informática — ISPI Lubango
**Trabalho:** *Desenvolvimento de uma Aplicação Móvel para Gestão e Agendamento de Consultas Odontológicas (Sorriso Digital)*  
**Autor:** António Pio Macaia Tati | **Orientador:** Eng.º Judilson Nambalo  

---

### 1. ARQUITETURA DE SOFTWARE & ENGENHARIA DE DESENVOLVIMENTO

#### **P1: Por que razão escolheu React Native em vez de desenvolvimento nativo puro (Kotlin para Android e Swift para iOS)?**
* **Resposta Técnica:**  
  > *"A escolha baseou-se nos princípios de engenharia de software preconizados por **Sommerville (2019)** e **Pressman e Maxim (2016)**: maximização da taxa de reuso de código e redução do 'time-to-market'. O desenvolvimento nativo duplicaria o esforço de engenharia, exigindo duas equipas e duas linguagens distintas (Kotlin e Swift), aumentando o custo de manutenção. O React Native permite compilar para código nativo através da bridge/JSI (JavaScript Interface), alcançando 60 FPS e mantendo mais de 90% da lógica e componentes partilhados entre Android (APK), iOS, Web e PWA, sem prejuízo à experiência do utilizador."*

#### **P2: Qual é o padrão arquitetural predominante na aplicação e como é feita a separação de responsabilidades?**
* **Resposta Técnica:**  
  > *"A aplicação adota uma arquitetura em camadas orientada a serviços e componentes:  
  > 1. **Camada de Apresentação (UI/View):** Componentes React Native estilizados e organizados por perfis de utilizador (`/screens/paciente`, `/screens/dentista`, `/screens/secretario`, `/screens/admin`).  
  > 2. **Camada de Estado e Contexto (Controllers/Contexts):** Gerida via React Context API (`AuthContext`, `PresenceContext`), garantindo fluxo unidirecional de dados e injeção de dependências.  
  > 3. **Camada de Serviços (Service Layer):** Módulos desacoplados (`agendamentoService.ts`, `messagesService.ts`, `authService.ts`) que encapsulam chamadas à API, regras de negócio e sanitização de dados.  
  > 4. **Camada de Persistência:** PostgreSQL gerido via Supabase client, isolando completamente a interface da estrutura física das tabelas."*

#### **P3: Como funciona a compilação cruzada para APK, Web e PWA a partir do mesmo repositório?**
* **Resposta Técnica:**  
  > *"Utilizamos o ecossistema Expo com Metro Bundler:  
  > - Para **Android APK**: O Metro compila o código TypeScript/JSX para um bundle JavaScript interpretado pela engine nativa (Hermes), gerando o binário APK empacotado com as APIs nativas do Android.  
  > - Para **Web & PWA**: O Expo converte as tags universais (`<View>`, `<Text>`) em elementos HTML5 semânticos (`<div>`, `<span>`) através do `react-native-web`. Integramos um Service Worker personalizado (`service-worker.js`) e um manifesto W3C (`manifest.json`), permitindo instalação local, cache de assets e execução offline controlada."*

---

### 2. BASE DE DADOS, MODELAÇÃO & INTEGRIDADE REFERENCIAL

#### **P4: Qual foi o critério para a normalização da base de dados e como evitou anomalias de atualização?**
* **Resposta Técnica:**  
  > *"A modelação da base de dados relacional (PostgreSQL) obedeceu rigorosamente às **Terceira Forma Normal (3FN)** conforme a teoria de **Date (2004)** e **Elmasri e Navathe (2011)**:  
  > - **1FN:** Todos os atributos contêm valores atómicos (sem atributos multivalorados ou compostos).  
  > - **2FN:** Todos os atributos não-chave dependem funcionalmente da totalidade da chave primária (UUID).  
  > - **3FN:** Não existem dependências transitivas entre atributos não-chave; por exemplo, dados do dentista não ficam duplicados na tabela de consultas, mas sim indexados por foreign key `dentist_id REFERENCES profiles(id)`. Isso elimina redundâncias e mitiga anomalias de inserção, alteração e eliminação."*

#### **P5: O que acontece na base de dados se tentarmos eliminar um paciente com consultas e faturamentos existentes?**
* **Resposta Técnica:**  
  > *"O sistema aplica o princípio da integridade referencial com restrição declarativa (`ON DELETE RESTRICT` ou tratamento preventivo a nível de triggers e serviços). Como sustentam Elmasri e Navathe (2011), dados clínicos e fiscais possuem valor probatório e de auditoria e jamais devem sofrer exclusão física (hard delete). Aplicamos o conceito de 'soft delete' (marcação de status inativo) e regras de integridade referencial que impedem a exclusão de qualquer registo que possua entidades dependentes em `appointments`, `evolucoes_clinicas` ou `pagamentos`."*

---

### 3. SEGURANÇA DA INFORMAÇÃO & CONFORMIDADE ÉTICA (LGPD / PRIVACIDADE)

#### **P6: Como é garantido que um dentista não veja os dados clínicos dos pacientes de outro dentista?**
* **Resposta Técnica:**  
  > *"A segurança não depende apenas de filtros no frontend. Aplicamos a nível do PostgreSQL o mecanismo de **Row Level Security (RLS)**, conjugado com o modelo **RBAC (Role-Based Access Control)** conforme recomendado por **Stallings e Brown (2015)** e a norma **ISO/IEC 27001 (2013)**:  
  > No momento em que uma consulta à tabela `appointments` ou `evolucoes_clinicas` é disparada, o motor do PostgreSQL avalia a política RLS com base no token JWT criptografado da sessão:  
  > `auth.uid() = dentist_id OR auth.uid() = patient_id`.  
  > Mesmo que um utilizador mal-intencionado intercepte a API e tente manipular os parâmetros da query, o próprio banco de dados bloqueia o acesso e retorna zero registos."*

#### **P7: Como foi arquitetada a autenticação e por que implementou 2FA via WhatsApp e TOTP?**
* **Resposta Técnica:**  
  > *"A autenticação apoia-se em senhas protegidas com algoritmo de hash criptográfico e emissão de tokens JWT com expiração controlada. Para perfis com acesso a dados confidenciais de saúde (Administrador, Secretário e Dentista), tornámos obrigatória a **Autenticação em Duas Etapas (2FA/MFA)**:  
  > 1. Factor de Conhecimento: Senha mestre do utilizador.  
  > 2. Factor de Posse: Código de verificação de 6 dígitos gerado temporariamente e enviado ao terminal móvel via WhatsApp (utilizando a API oficial do WhatsApp/Evolution) ou aplicação autenticadora TOTP.  
  > Além disso, implementámos validação de sessão única (Single Session Control) via token local e tabela `profiles.last_session_id`, impedindo que contas partilhadas sejam abertas simultaneamente em vários dispositivos sem autorização."*

---

### 4. SINCRONIZAÇÃO EM TEMPO REAL & OPERAÇÃO OFFLINE

#### **P8: Como o sistema atualiza a agenda e o chat sem que o utilizador precise recarregar a página (F5)?**
* **Resposta Técnica:**  
  > *"A atualização assíncrona utiliza o protocolo **WebSockets** através da biblioteca `Supabase Realtime`:  
  > O PostgreSQL escuta os eventos transacionais no Write-Ahead Log (WAL) através da extensão `logical replication`. Sempre que ocorre um `INSERT` ou `UPDATE` nas tabelas `messages` ou `appointments`, o servidor transmite uma mensagem em formato JSON via canal WebSocket aberto para os clientes subscritos, disparando re-renderização instantânea na interface do React Native sem necessidade de polling constante."*

#### **P9: Como a aplicação reage se a ligação à internet falhar durante a utilização?**
* **Resposta Técnica:**  
  > *"Desenvolvemos um mecanismo de tolerância a falhas assente em três componentes:  
  > 1. **NetInfo:** Monitoriza o estado da conectividade do dispositivo em tempo real.  
  > 2. **Offline Queue (Fila Offline):** Ações críticas (como cancelamento ou confirmação de agendamento) são serializadas em armazenamento local seguro (`universalStorage` / `AsyncStorage`).  
  > 3. **Sync Handlers:** Assim que o dispositivo restabelece conectividade, a fila é descarregada sequencialmente contra os endpoints do banco de dados, garantindo consistência eventual sem perda de dados para o utilizador."*

---

### 5. VALIDAÇÃO, TESTES & LIMITAÇÕES DO TRABALHO

#### **P10: Que tipo de testes de software foram realizados para validar o sistema?**
* **Resposta Técnica:**  
  > *"Seguindo as diretrizes de **Pressman e Maxim (2016)**, aplicámos:  
  > - **Testes de Unidade e Serviços:** Validação das regras de negócio de agendamento, cálculo de idade por data de nascimento e formatação de valores em Kwanzas (Kz).  
  > - **Testes de Integração:** Validação das políticas de segurança RLS no Supabase e envio de mensagens e notificações via WebSocket.  
  > - **Testes de Usabilidade e Multiplataforma:** Testes práticos de interface e responsividade executados em ambiente Web (Google Chrome), PWA e em dispositivos físicos Android (APK)."*

#### **P11: Quais foram as maiores dificuldades e limitações encontradas durante a elaboração do projeto?**
* **Resposta Técnica:**  
  > *"A principal limitação relacionou-se com a integração de meios de pagamento em Angola: devido à indisponibilidade de APIs públicas abertas e gratuitas da rede EMIS / Multicaixa Express para ambientes académicos, o sistema foi estruturado com lançamento manual e controlo de faturas na secretaria, deixando a arquitetura modular pronta para conexão a gateways assim que a homologação comercial for realizada. Outro desafio foi balancear a riqueza gráfica de um odontograma SVG interativo com o desempenho de renderização em telemóveis de gama de entrada."*
