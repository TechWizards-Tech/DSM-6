# FATEC JACAREÍ - DSM 6º SEMESTRE

# EQUIPE: TECHWIZARDS

## SOBRE O PROJETO

O projeto tem como objetivo desenvolver um chatbot para orientação ao consumidor,
integrado ao WhatsApp, em parceria com o PROCON de Jacareí-SP.

A solução permitirá que o cidadão tire dúvidas sobre seus direitos, procedimentos,
documentos e próximos passos por meio de um atendimento guiado.

O chatbot utilizará fluxos decisórios fornecidos pelo PROCON para conduzir a conversa
e apresentar uma orientação inicial ao usuário.

Quando a dúvida não puder ser solucionada pelo chatbot, o sistema deverá permitir
o agendamento de um atendimento presencial.

Além do chatbot, será desenvolvida uma interface web para gerenciamento dos
atendimentos agendados.

O projeto será desenvolvido utilizando metodologias ágeis, seguindo o framework Scrum.

## OBJETIVO

Facilitar o acesso dos cidadãos às orientações do PROCON, reduzir a quantidade de
atendimentos repetitivos e melhorar a eficiência do atendimento.

## GESTÃO DO PROJETO
GitHub Projects: Acompanhe o roadmap, tarefas em andamento e o progresso do desenvolvimento da nossa equipe no quadro oficial:

📍​ [Acessar o GitHub Project do TechWizards](https://github.com/users/TechWizards-Tech/projects/1)

## SPRINTS

| Sprint | Início | Entrega | Status |
|--------|--------|---------|--------|
| Sprint 01 | 10/08/2026 | 14/09/2026 | 🔄 |
| Sprint 02 | 15/09/2026 | 19/10/2026 | ⏳ |
| Sprint 03 | 20/10/2026 | 23/11/2026 | ⏳ |

# PRODUCT BACKLOG

| ID | Requisito | Sprint |
|----|-----------|--------|
| RF01 | Interação do usuário pelo WhatsApp | 01 |
| RF02 | Apresentação de opções com base nos fluxos do PROCON | 01 |
| RF03 | Navegação pelos fluxos decisórios | 01 |
| RF04 | Geração de resposta orientadora | 02 |
| RF05 | Utilização de LLM para explicação das respostas | 02 |
| RF06 | Registro das interações | 02 |
| RF07 | Agendamento de atendimento presencial | 02 |
| RF08 | Interface web para gerenciamento dos agendamentos | 03 |

# REQUISITOS NÃO FUNCIONAIS

| ID | Requisito | Sprint |
|----|-----------|--------|
| RNF01 | Linguagem clara, objetiva e acessível | 01 |
| RNF02 | Alta disponibilidade e resposta adequada | 02 |
| RNF03 | Adequação à LGPD | 03 |
| RNF04 | Informar que as respostas são orientativas | 02 |
| RNF05 | Informar quando houver auxílio de LLM | 02 |
| RNF06 | Utilização de Docker | 03 |
| RNF07 | Documentação de instalação e requisitos | 03 |
| RNF08 | Utilização de Git, testes e CI/CD | 03 |

# USER STORIES

## US01 — Orientação pelo WhatsApp

**Como** cidadão  
**Quero** conversar com o chatbot pelo WhatsApp  
**Para** receber orientações sobre meus direitos como consumidor.

## US02 — Fluxo de atendimento

**Como** cidadão  
**Quero** responder perguntas e selecionar opções  
**Para** receber uma orientação adequada ao meu caso.

## US03 — Resposta orientadora

**Como** cidadão  
**Quero** receber um resumo do meu caso e os próximos passos  
**Para** saber como devo proceder.

## US04 — Agendamento

**Como** cidadão  
**Quero** realizar um agendamento presencial quando o chatbot não solucionar minha dúvida  
**Para** receber atendimento do PROCON.

## US05 — Gerenciamento de agendamentos

**Como** funcionário do PROCON  
**Quero** visualizar e gerenciar os agendamentos  
**Para** organizar os atendimentos presenciais.

## US06 — Histórico

**Como** PROCON  
**Quero** registrar as interações realizadas  
**Para** analisar quais fluxos são mais utilizados.

# SPRINT 1

Na Sprint 1, o foco será estabelecer a estrutura inicial do sistema e desenvolver
o funcionamento básico do chatbot.

### Atividades

- Definição dos fluxos decisórios
- Definição da arquitetura do sistema
- Criação do banco de dados
- Desenvolvimento do chatbot
- Integração com WhatsApp
- Controle das sessões dos usuários

# SPRINT 2

Na Sprint 2, o foco será desenvolver as funcionalidades de orientação,
registro das conversas e agendamento.

### Atividades

- Respostas orientadoras
- Implementação do LLM
- Registro das interações
- Tratamento de erros
- Agendamento presencial
- Orientação sobre documentos
- Avisos sobre o caráter orientativo das respostas

# SPRINT 3

Na Sprint 3, o foco será finalizar o sistema, realizar os testes e preparar
a entrega do projeto.

### Atividades

- Desenvolvimento do painel web
- Gerenciamento dos agendamentos
- Implementação da LGPD e segurança
- Testes automatizados
- Testes de integração
- Docker
- CI/CD
- Deploy
- Documentação
- Validação com o PROCON

# ARQUITETURA

O sistema será dividido em módulos:

- Chatbot
- Fluxos decisórios
- Banco de dados
- Integração com WhatsApp
- Agendamento
- Painel web
- LLM
- Autenticação e segurança

# TECNOLOGIAS

- Git
- GitHub
- Docker
- Node.js ou Python
- Banco de dados
- WhatsApp Business Platform
- LLM local
- HTML
- CSS
- JavaScript/TypeScript

# EQUIPE

| Nome | Função | GitHub |
|------|--------|--------|
| Bruna Regra | Scrum Master | @regrabru |
| Pamela Freitas | Product Owner | @PaamFreitas18 |
| Raquel Massae | Developer | @nakamuraraquel |
| Pollyana Roberta | Developer | @Pollymeowth |
| Maria Eduarda | Developer | @ferreira-me |
| Felipe Correa | Developer | @turnupthetaste |
| Leandro Barbosa | Developer | @gmlebc |

# DOCUMENTAÇÃO

A documentação do projeto será mantida neste repositório, incluindo:

- Requisitos
- Arquitetura
- Diagramas
- Banco de dados
- Instalação
- Configuração
- Testes
- Sprints
- Manual de utilização

# PROJETO

**FATEC Jacareí — Desenvolvimento de Software Multiplataforma**

**Projeto ABP 2026-2**

**Parceiro: PROCON Jacareí-SP**
