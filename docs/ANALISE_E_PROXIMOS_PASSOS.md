# 📄 Análise do Projeto por Sprints e Próximos Passos
**Projeto**: Chatbot de Orientação ao Consumidor — PROCON Jacareí (6º DSM — FATEC Jacareí)  
**Equipe**: TechWizards  
**Atualizado em**: 18/11/2026  

---

## 📌 1. Visão Geral do Sistema Hoje

O sistema automatiza o atendimento inicial do **PROCON de Jacareí-SP** via **WhatsApp (Conexão direta por QR Code / Baileys)** e **Simulador Web**, guiando o consumidor pelos **9 fluxos decisórios oficiais do PROCON** com auxílio de **LLM Local (Ollama + Motor Linguístico Local Embarcado)**. Quando o caso exige atendimento presencial, o próprio chatbot realiza o **agendamento com emissão de protocolo**, gerenciado pelos funcionários do PROCON no **Painel Web Administrativo (`/painel`)** integrado ao **PostgreSQL**.

---

## ✅ Sprint 1 (10/08/2026 a 14/09/2026) — 100% Entregue

**Foco**: Base arquitetural, fluxos decisórios e funcionamento do chatbot.

* [x] **Modelagem dos 9 Fluxos Decisórios (`fluxos/*.json` + `menu.json`)**: Validação por JSON Schema e script Python (`validar_fluxos.py`).
* [x] **Motor de Conversa (`app/backend/src/modules/chatbot/motor.ts`)**: Navegação guiada entre perguntas, comandos globais (`menu`, `voltar`, `atendente`, `sair`) e entrega de orientação com lista de documentos e ressalvas (**RF02, RF03, RF04**).
* [x] **Avisos Obrigatórios (`RNF01, RNF04`)**: Linguagem acessível e aviso explícito sobre o caráter orientativo das respostas.
* [x] **Controle de Sessões e Registro Inicial em Memória (`sessao.ts` e `registro/index.ts`)**: Isolamento de conversas por usuário e cálculo de estatísticas dos fluxos (**RF06, RP01, RP03**).
* [x] **Interface Web do Chatbot (`app/frontend/`)**: Simulador em React 18 + Vite + TypeScript com tema acessível em Branco e Azul (`TelaEntrada`, `JanelaChat`, `BolhaMensagem`, `PainelOpcoes`).
* [x] **Docker Inicial e Testes Automatizados**: 26 testes unitários no Vitest + `Dockerfile` para backend e frontend (**RNF06, RNF08**).

---

## ✅ Sprint 2 (15/09/2026 a 19/10/2026) — 100% Entregue

**Foco**: Integração com WhatsApp, Banco de Dados PostgreSQL, Agendamento Presencial e LLM Local.

* [x] **Banco de Dados PostgreSQL (`app/backend/db/schema.sql` e `src/db/pool.ts`)**:
  * Container `postgres:16-alpine` no `docker-compose.yml` com tabelas `interacoes`, `agendamentos` e `usuarios_admin`.
  * Repositórios persistentes `RepositorioInteracoesPostgres` e `RepositorioAgendamentosPostgres` (com fallback em memória/JSON para rodar local sem Docker) (**RF06, RNF02**).
* [x] **Integração com WhatsApp via QR Code (`app/backend/src/modules/whatsapp/`)**:
  * Conexão real e gratuita via **Baileys QR Code** (`ConectorBaileys` em `baileys.ts`, acessível em `/api/whatsapp/qr`) com trava de segurança para responder apenas conversas do atendimento (`"oi procon"` ou chat consigo mesmo), além de manter os adaptadores de webhook no código (**RF01, RP01**).
* [x] **Agendamento de Atendimento Presencial (`app/backend/src/modules/agendamento/` e `JanelaAgendamento.tsx`)**:
  * Grade de horários (08h às 16h), bloqueio de fins de semana, validação de CPF (11 dígitos), controle de vagas ocupadas e geração de protocolo `PROCON-YYYYMMDD-XXXX`.
  * Funciona tanto no modal Web (`JanelaAgendamento.tsx`) quanto conversando direto pelo WhatsApp (`AdaptadorWhatsApp`) (**RF07, US04**).
* [x] **Módulo de LLM Local (`app/backend/src/modules/llm/index.ts` e `motor.ts`)**:
  * `ProvedorLlmOllama` integrado ao Ollama local (`OLLAMA_URL` / `OLLAMA_MODEL`) + **Motor Linguístico Local Embarcado** (sem uso de APIs externas pagas — **RP05**).
  * Identifica automaticamente os **9 fluxos** e todas as **opções de perguntas** quando o cidadão digita frases livres (ex.: *"quero cancelar meu pedido"*, *"comprei na internet"*, *"está lacrado"*).
  * Estrutura a orientação final e exibe a tag **`TEXTO APOIADO POR IA`** na Web e o aviso `🤖` no WhatsApp (**RF05, RNF05, US03**).

---

## 🔄 Sprint 3 (20/10/2026 a 23/11/2026) — Em Fase Final

**Foco**: Painel Web Administrativo, LGPD, Testes Finais, CI/CD e Documentação de Entrega.

### O que JÁ FOI FEITO na Sprint 3:
* [x] **Painel Web Administrativo de Agendamentos (`app/frontend/src/components/painel/` e `rotasPainel.ts`)**:
  * Login restrito aos funcionários do PROCON (`/painel`) com senha criptografada (`scrypt`) e token **JWT HS256**.
  * Visualização de agendamentos por data e status (Agendados, Atendidos, Cancelados), com botões para **Confirmar atendimento**, **Remarcar** e **Cancelar** (**RF08, US05**).
* [x] **Expansão dos Testes Automatizados**: Evolução de 26 para **81 testes automatizados** no Vitest cobrindo fluxos, motor, agendamento, WhatsApp e painel administrativo (**RNF08**).
* [x] **Manual de Instalação e Execução (`docs/COMO_RODAR_O_SISTEMA.md`)**: Guia completo de hardware, software e execução local/Docker para a equipe (**RNF07**).
* [x] **Proteção Inicial LGPD**: Mascaramento de telefone nos logs (`mascararTelefone`) e proteção por token JWT das rotas de agendamento (**RNF03**).

---

### 📋 O Que AINDA FALTA FAZER (Checklist Final para Entrega em 23/11/2026)

Para fechar 100% dos requisitos do edital (`docs/Desafio_6DSM.pdf`), faltam apenas estas **6 tarefas**:

- [ ] **Task 1 — Correções Técnicas Rápidas (Build TypeScript e Fim de Semana no Postgres)**:
  - Remover a diretiva `// @ts-expect-error` não utilizada em `app/backend/src/modules/whatsapp/baileys.ts` (linha 17) para o `npm run build` passar sem avisos.
  - Adicionar a validação de bloqueio de sábado e domingo em `RepositorioAgendamentosPostgres` (`app/backend/src/modules/agendamento/postgres.ts`, igual já existe no repositório em memória) e padronizar `import type { Pool } from 'pg'`.
- [ ] **Task 2 — Exibir Estatísticas dos Fluxos Mais Utilizados no Painel Web (`RF06` / `US06`)**:
  - O back-end já calcula o ranking em `GET /api/registros/estatisticas`. Falta adicionar uma seção/aba de **"Estatísticas dos Fluxos Mais Utilizados"** dentro do Painel Web (`/painel`) para o funcionário do PROCON visualizar quais assuntos são mais procurados.
- [ ] **Task 3 — Adequação Completa à LGPD (`RNF03`)**:
  - Exibir aviso/termo de consentimento LGPD na entrada do chat (`TelaEntrada.tsx`), no modal de agendamento (`JanelaAgendamento.tsx`) e no agendamento via WhatsApp antes de coletar Nome e CPF.
  - Mascarar o telefone do usuário ao gravar eventos estatísticos na tabela `interacoes`.
- [ ] **Task 4 — Testes Automatizados do Módulo LLM (`RNF08`)**:
  - Criar `app/backend/tests/llm.test.ts` testando a geração explicativa, a exibição do aviso de IA (`RNF05`), a classificação de fluxos/opções em texto livre e o fallback do Ollama.
- [ ] **Task 5 — Pipeline de CI/CD no GitHub Actions (`RNF08`)**:
  - Criar `.github/workflows/ci.yml` executando automaticamente o build, o validador Python dos fluxos e os testes do Vitest a cada `push` / `pull_request` no GitHub.
- [ ] **Task 6 — Atualizar `README.md` Principal e Documentação Final (`RNF07` / `RNF08`)**:
  - Atualizar a segunda metade do `README.md` (que ainda descreve apenas a Sprint 1) com a arquitetura final das Sprints 2 e 3, documentar os casos de teste das Sprints 2/3 em `docs/casos-de-teste-sprint-2.md` e inserir o Burndown/vídeo da Sprint 3.

---

## 📊 Resumo dos Requisitos do Edital (`Desafio_6DSM.pdf`)

| Requisito | Descrição Resumida | Status |
|---|---|---|
| **RF01 / RP01** | Interação via WhatsApp (QR Code Baileys + Webhooks) | ✅ Concluído |
| **RF02 / RF03** | Opções e navegação pelos 9 fluxos decisórios do PROCON | ✅ Concluído |
| **RF04 / RNF04** | Resposta orientadora consolidada + aviso de caráter orientativo | ✅ Concluído |
| **RF05 / RNF05 / RP05** | LLM local explicativa + identificação de frases livres + selo de IA | ✅ Concluído |
| **RF06 / US06** | Registro de interações e análise dos fluxos mais utilizados | 🟡 Falta exibir no Painel (Task 2) |
| **RF07 / US04** | Agendamento presencial com emissão de protocolo | ✅ Concluído (ajuste Postgres na Task 1) |
| **RF08 / US05** | Interface web (`/painel`) para gerenciamento dos agendamentos | ✅ Concluído |
| **RNF01 / RNF02** | Linguagem clara/acessível e resposta em tempo real | ✅ Concluído |
| **RNF03** | Adequação à LGPD | 🟡 Falta aviso de consentimento (Task 3) |
| **RNF06** | Execução em Docker (`docker-compose.yml`) | ✅ Concluído |
| **RNF07** | Documentação de instalação e requisitos de hardware/software | 🟡 `COMO_RODAR_O_SISTEMA.md` pronto; falta atualizar `README.md` (Task 6) |
| **RNF08** | Git, Scrum, Testes Automatizados e CI/CD | 🟡 Faltam testes da LLM (Task 4) e GitHub Actions (Task 5) |
