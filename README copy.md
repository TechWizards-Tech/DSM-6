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

| Camada | Escolha | Restricao atendida |
|---|---|---|
| Back-end | Node.js 20 + TypeScript + Express | RP02 (Node.js ou Python) |
| Front-end | React 18 + TypeScript + Vite | HTML/CSS/TypeScript |
| Fluxos decisorios | JSON validado por JSON Schema | RF02, RF03 |
| Sessao | Em memoria na Sprint 1, atras de uma interface de repositorio | RP01 |
| LLM | Nenhuma. Modulo isolado, desligado | RP03, RP05 |
| Empacotamento | Docker + Docker Compose | RNF06 |
| Testes | Vitest (26 casos) + validador Python dos fluxos | RNF08 |
| Versionamento | Git / GitHub | RNF08 |

Fora da Sprint 1: WhatsApp Business Platform (Cloud API), banco de dados e LLM local.

# COMO EXECUTAR

## Requisitos

| Software | Versao minima | Observacao |
|---|---|---|
| Node.js | 20.x | inclui o npm 10 |
| Docker Engine | 24.x | opcional, so para subir tudo de uma vez |
| Python | 3.9 | opcional, so para o validador dos fluxos |

Hardware: qualquer maquina com 4 GB de RAM roda o projeto. Nao ha banco de dados
nem modelo de linguagem na Sprint 1.

## Execucao local (dois terminais)

Terminal 1 - back-end:

```bash
cd backend
npm install
npm run dev
```

O servidor sobe em `http://localhost:3333`. Confira em
`http://localhost:3333/api/saude` - deve responder com os 9 fluxos carregados.

Terminal 2 - front-end:

```bash
cd frontend
npm install
npm run dev
```

A interface abre em `http://localhost:5173`. O Vite repassa as chamadas `/api`
para o back-end, entao nao e preciso configurar nada.

## Execucao com Docker (RNF06)

```bash
docker compose up --build
```

- Interface: `http://localhost:8080`
- API: `http://localhost:3333/api/saude`

## Testes

```bash
cd backend
npm test
```

26 casos automatizados rodando contra os JSON reais do PROCON. Cobrem a navegacao
pelos fluxos, entradas invalidas, comandos globais, isolamento entre sessoes e o
registro das interacoes.

Validacao estrutural dos fluxos (opcional, exige Python):

```bash
cd fluxos
python validar_fluxos.py
```

## Variaveis de ambiente do back-end

| Variavel | Padrao | Para que serve |
|---|---|---|
| `PORT` | `3333` | Porta HTTP |
| `FLUXOS_DIR` | descoberto automaticamente | Diretorio dos fluxos do PROCON |
| `REGISTRO_JSONL` | `backend/dados/interacoes.jsonl` | Espelho em disco do registro (RF06) |
| `CORS_ORIGINS` | `http://localhost:5173` | Origens autorizadas |

# ARQUITETURA DA APLICACAO (SPRINT 1)

```
Navegador (simulador do WhatsApp)
        |  HTTP /api
        v
Camada HTTP (Express)          <- adaptador; na Sprint 2 entra o webhook da Cloud API
        v
Motor de conversa              <- maquina de estados; nao conhece HTTP nem WhatsApp
    |         |        |
    v         v        v
 Fluxos    Sessoes   Registro  <- modulos independentes (RP03)
    |
    v
 fluxos/*.json                 <- conteudo do PROCON, sem regra de negocio em codigo
```

O modulo de LLM (`backend/src/modules/llm`) existe e esta **desligado**: a Sprint 1
nao chama nenhum modelo. Ele fixa o contrato para a Sprint 2, quando um modelo
**local** podera reformular o texto ja decidido pelo fluxo - nunca decidir o
desfecho (RP05).

## Estrutura de pastas

```
backend/
  src/
    modules/
      chatbot/     motor de conversa e estado da sessao
      fluxos/      carga e validacao dos fluxos decisorios
      registro/    registro das interacoes (RF06)
      llm/         contrato da LLM, desligado nesta sprint
    http/          rotas e DTOs
  tests/           26 casos automatizados
frontend/
  src/
    components/    tela de entrada, janela de chat, bolhas, opcoes
    lib/           cliente HTTP e tipos do contrato
fluxos/            fluxos decisorios do PROCON (9 casos, 71 nos)
docs/              casos de teste da Sprint 1
```

## API

| Metodo | Rota | Para que serve |
|---|---|---|
| `GET` | `/api/saude` | Status e quantidade de fluxos carregados |
| `POST` | `/api/conversas` | Abre a conversa. Corpo: `{ "usuario": "+5512..." }` |
| `GET` | `/api/conversas/:id` | Recupera a conversa inteira |
| `POST` | `/api/conversas/:id/mensagens` | Avanca. Corpo: `{ "opcaoId": "..." }` ou `{ "texto": "..." }` |
| `GET` | `/api/fluxos` | Catalogo dos fluxos |
| `GET` | `/api/registros` | Eventos registrados (RF06) |
| `GET` | `/api/registros/estatisticas` | Fluxos mais utilizados (RF06) |

## O que a Sprint 1 entrega e o que ficou de fora

Entregue: inicio de conversa, menu de assuntos, navegacao pelos fluxos, orientacao
final com documentos e ressalvas, aviso de carater orientativo (RNF04), comandos
globais (`menu`, `voltar`, `atendente`, `sair`), registro das interacoes (RF06),
interface de teste e Docker.

Fora do escopo desta sprint, por decisao do Plano da Sprint 1: integracao real com
o WhatsApp (RF01), LLM (RF05), agendamento presencial (RF07), painel administrativo
(RF08) e persistencia em banco. As sessoes vivem em memoria - reiniciar o back-end
zera as conversas.

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
