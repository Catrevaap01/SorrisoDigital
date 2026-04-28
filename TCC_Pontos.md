# Desenvolvimento dos Capítulos do TCC

## Capítulo I – Fundamentação Teórica

**Saúde Digital:** 
A saúde digital representa uma verdadeira revolução na forma como o cuidado médico e odontológico é entregue. Segundo a Organização Mundial da Saúde (OMS, 2019), a saúde digital consiste no uso de tecnologias de informação e comunicação para apoiar a saúde e os campos relacionados. Mais do que simplesmente substituir o papel por telas, trata-se de utilizar a tecnologia para integrar dados, facilitar diagnósticos e democratizar o acesso à informação (TACHINARDI, 2015). No contexto atual, a saúde digital permite um acompanhamento mais próximo e personalizado do paciente, otimizando o tempo dos profissionais e elevando a qualidade do atendimento.

**Sistemas de Informação em Saúde:** 
Os Sistemas de Informação em Saúde (SIS) são o coração da gestão clínica moderna. Conforme apontam Laudon e Laudon (2014), sistemas de informação são conjuntos de componentes inter-relacionados que coletam, processam, armazenam e distribuem informações para apoiar a tomada de decisão. O abandono dos antigos arquivos físicos em prol de prontuários eletrônicos garante que o histórico completo do paciente esteja sempre disponível, auxiliando os profissionais em decisões mais rápidas e precisas e evitando a perda de dados cruciais (O'BRIEN; MARAKAS, 2013).

**Aplicações Mobile na Saúde (mHealth):** 
A popularização dos smartphones transformou a mobilidade na área da saúde. A prática de saúde suportada por dispositivos móveis é frequentemente referida como mHealth (FREE et al., 2013). Ter um aplicativo móvel significa colocar a gestão da clínica na palma da mão. Para o paciente, traz conveniência. Para a equipe clínica e administrativa, traz a liberdade de consultar agendas, acessar evoluções e gerenciar tarefas de qualquer lugar, proporcionando agilidade ao fluxo de trabalho.

**Gestão Odontológica Digital:** 
Uma clínica odontológica é um ambiente complexo que une a área da saúde com as necessidades de uma organização empresarial. Segundo Chiavenato (2014), a gestão eficaz envolve planejamento, organização, direção e controle de recursos. A gestão odontológica digital atua nessa intersecção, modernizando processos, controlando o fluxo financeiro, o agendamento inteligente e o histórico de tratamentos. O resultado é um consultório mais rentável e focado no paciente.

**React Native:** 
Para viabilizar este projeto de forma eficiente, optou-se pelo React Native. Este framework, criado pelo Facebook (FACEBOOK, 2015), permite desenvolver aplicativos simultaneamente para Android e iOS utilizando uma única base de código. A reutilização de código é uma prática consolidada na engenharia de software para otimizar tempo e recursos (SOMMERVILLE, 2019). Essa escolha garante uma interface responsiva e com aparência nativa.

**Supabase:** 
Como "motor" por trás do sistema, utilizou-se o Supabase. Trata-se de uma plataforma Backend-as-a-Service (BaaS) de código aberto, baseada no banco de dados relacional PostgreSQL (SUPABASE, 2023). A adoção de soluções BaaS permite que desenvolvedores terceirizem o gerenciamento de infraestrutura (FOWLER, 2015). O Supabase assumiu o armazenamento de dados e a autenticação, permitindo foco exclusivo nas regras de negócio da clínica.

**Modelagem UML:** 
Assim como uma construção necessita de projeto arquitetônico, um software requer planejamento. A Linguagem de Modelagem Unificada (UML) é o padrão do setor para especificar, visualizar e documentar artefatos de software (BOOCH; RUMBAUGH; JACOBSON, 2005). Através da UML, desenhou-se a estrutura do sistema e o fluxo das informações, evitando retrabalhos na fase de programação.

**Segurança da Informação:** 
Ao lidar com dados clínicos, a segurança da informação é uma exigência ética e legal. A segurança é caracterizada pela preservação da confidencialidade, integridade e disponibilidade dos dados (ISO/IEC 27001, 2013). O sistema foi projetado utilizando criptografia e Controle de Acesso Baseado em Papéis (RBAC) (STALLINGS; BROWN, 2015), garantindo que os usuários acessem apenas informações pertinentes às suas funções.

## Capítulo II – Apresentação do Projeto

**Descrição do Projeto:** 
O presente projeto consiste no desenvolvimento do TeOdonto, uma plataforma integrada para a gestão de clínicas odontológicas. Nascido da necessidade de modernizar o fluxo de trabalho clínico (PRESSMAN; MAXIM, 2016), o sistema conecta recepção, consultórios e administração, automatizando cálculos financeiros e centralizando o histórico do paciente.

**Análise de Requisitos:** 
Para garantir que o sistema resolvesse as necessidades reais, realizou-se a engenharia de requisitos. Os requisitos funcionais definiram as ações do software (ex: agendar consultas), enquanto os requisitos não funcionais especificaram critérios de qualidade, como desempenho, usabilidade e segurança (SOMMERVILLE, 2019). 

**Modelagem UML:** 
A arquitetura do sistema foi documentada através de diagramas UML. Essa modelagem visual serve como ponte de comunicação entre os interessados no projeto e a equipe de desenvolvimento (BOOCH; RUMBAUGH; JACOBSON, 2005).

**Diagrama de Casos de Uso:** 
Este diagrama ilustrou as interações entre os "atores" e o sistema, definindo suas fronteiras (BEZERRA, 2015). Evidenciou-se o cenário onde a Secretária realiza o agendamento, o Dentista acessa a ficha clínica, e o Administrador visualiza relatórios financeiros.

**Diagrama de Classes:** 
Funcionando como a base estrutural, este diagrama mapeou as entidades do sistema. Destacaram-se classes como `Paciente`, `Consulta`, `Dentista` e `Pagamento`, definindo a lógica orientada a objetos da aplicação (FOWLER, 2004).

**Diagrama Entidade-Relacionamento (DER):** 
O DER foi fundamental para estruturar o banco de dados. Ele definiu o modelo conceitual (NAVATHE; ELMASRI, 2011), garantindo a integridade referencial ao mostrar que um Tratamento pertence unicamente a um Paciente específico.

**Arquitetura do Sistema:** 
O sistema baseia-se em uma arquitetura Cliente-Servidor, que separa as funções de interface do usuário do processamento e armazenamento (COULOURIS et al., 2013). O front-end em React Native comunica-se com o back-end Supabase através de APIs seguras.

## Capítulo III – Conclusão e Trabalhos Futuros

**Resultados Obtidos:** 
O projeto alcançou o objetivo de entregar uma solução funcional à realidade de uma clínica. A implementação de sistemas de informação contribui significativamente para a eficiência operacional (LAUDON; LAUDON, 2014). Criou-se uma interface limpa, um controle financeiro estável e um fluxo de prontuários eletrônicos acessível.

**Limitações:** 
Apesar dos resultados, o projeto apresenta limitações. A principal é a dependência contínua de conexão com a internet. Além disso, existe a barreira da curva de aprendizado, fenômeno comum na adoção de tecnologias em ambientes organizacionais (ROGERS, 2003).

**Melhorias Futuras:** 
O desenvolvimento de software é um processo evolutivo (SOMMERVILLE, 2019). Como propostas futuras, sugere-se a integração com APIs do WhatsApp para lembretes automáticos, criação de módulo de estoque e implementação de Inteligência Artificial para análise prévia de radiografias.

---
## Referências Bibliográficas

*   BEZERRA, E. **Princípios de Análise e Projeto de Sistemas com UML**. 3. ed. Rio de Janeiro: Elsevier, 2015.
*   BOOCH, G.; RUMBAUGH, J.; JACOBSON, I. **The Unified Modeling Language User Guide**. 2. ed. Addison-Wesley Professional, 2005.
*   CHIAVENATO, I. **Introdução à Teoria Geral da Administração**. 9. ed. Barueri: Manole, 2014.
*   COULOURIS, G. et al. **Sistemas Distribuídos: Conceitos e Projeto**. 5. ed. Porto Alegre: Bookman, 2013.
*   FACEBOOK. **React Native**. 2015. Disponível em: https://reactnative.dev.
*   FOWLER, M. **UML Distilled: A Brief Guide to the Standard Object Modeling Language**. 3. ed. Addison-Wesley, 2004.
*   FREE, C. et al. The effectiveness of mobile-health technology-based health behaviour change or disease management interventions for health care consumers: a systematic review. **PLoS medicine**, 2013.
*   ISO/IEC 27001. **Tecnologia da informação — Técnicas de segurança — Sistemas de gestão da segurança da informação — Requisitos**. 2013.
*   LAUDON, K. C.; LAUDON, J. P. **Sistemas de Informação Gerenciais**. 11. ed. São Paulo: Pearson Prentice Hall, 2014.
*   NAVATHE, S. B.; ELMASRI, R. **Sistemas de Banco de Dados**. 6. ed. São Paulo: Pearson Addison Wesley, 2011.
*   O'BRIEN, J. A.; MARAKAS, G. M. **Administração de Sistemas de Informação**. 15. ed. Porto Alegre: AMGH, 2013.
*   OMS - Organização Mundial da Saúde. **WHO guideline: recommendations on digital interventions for health system strengthening**. Genebra: WHO, 2019.
*   PRESSMAN, R. S.; MAXIM, B. R. **Engenharia de Software: Uma Abordagem Profissional**. 8. ed. Porto Alegre: AMGH, 2016.
*   ROGERS, E. M. **Diffusion of Innovations**. 5. ed. New York: Free Press, 2003.
*   SOMMERVILLE, I. **Engenharia de Software**. 10. ed. São Paulo: Pearson, 2019.
*   STALLINGS, W.; BROWN, L. **Segurança de Computadores: Princípios e Práticas**. 2. ed. Rio de Janeiro: Elsevier, 2015.
*   SUPABASE. **The Open Source Firebase Alternative**. 2023. Disponível em: https://supabase.com.
*   TACHINARDI, U. Saúde Digital: o futuro já começou. **Revista de Administração em Saúde**, 2015.
