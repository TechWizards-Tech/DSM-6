# 📄 Análise Técnica do Projeto e Planejamento de Próximos Passos
**Projeto**: Chatbot de Orientação ao Consumidor — PROCON Jacareí (FATEC Jacareí)  
**Equipe**: TechWizards  
**Data da Análise**: 13/09/2026  

---

## 📌 1. Resumo Executivo do Projeto

O objetivo da solução é automatizar o primeiro atendimento do **PROCON de Jacareí-SP**, permitindo que os cidadãos tirem dúvidas sobre seus direitos do consumidor via **WhatsApp** e **Interface Web**, navegando por fluxos decisórios pré-definidos. 

Quando a dúvida não puder ser resolvida pelo assistente virtual, o sistema encaminha o cidadão para o **agendamento de um atendimento presencial**. Além disso, o PROCON contará com um **Painel Web Administrativo** para visualizar as métricas e gerenciar os agendamentos.

---

## 🔍 2. Diagnóstico Técnico do Estado Atual (Conclusão da Sprint 1)

A **Sprint 1 (10/08/2026 a 14/09/2026)** focou em construir a base arquitetural e o motor de simulação.

### 🟢 Back-end (Node.js 20 + TypeScript + Express)
* **Motor de Decisão (`backend/src/modules/chatbot/motor.ts`)**: Lê e processa os 9 fluxos JSON do PROCON com validação estrita.
* **Gerenciamento de Sessão (`backend/src/modules/chatbot/sessao.ts`)**: Em memória (`RepositorioSessoesMemoria`), preparado para substituição por banco relacional.
* **Arquitetura Desacoplada (`backend/src/app.ts`)**: Injeção de dependências transparente, permitindo trocar componentes sem alterar regras de negócio.
* **Integração LLM (`backend/src/modules/llm/index.ts`)**: Interface `ProvedorLlm` pronta com implementação dummy (`ProvedorLlmDesativado`) cumprindo o requisito de isolamento.
* **Testes Automatizados**: **26 casos de testes** no Vitest cobrindo fluxo principal, entradas inválidas e isolamento entre sessões.

### 🟢 Front-end (React 18 + Vite + TypeScript)
* **Interface do Simulador**: Componentização com `TelaEntrada`, `JanelaChat`, `BolhaMensagem`, `PainelOpcoes`.
* **Design System**: Paleta de cores customizada em **Branco e Azul** (`frontend/src/estilos.css`), sem dependência de tema escuro do SO, com sombras fortes e excelente acessibilidade.

### 🟢 DevOps & Repositório
* **Docker & Docker Compose**: Configurado para rodar front-end, back-end e proxy Nginx simultaneamente.
* **Versionamento Git**: Commits sincronizados no repositório remoto (`https://github.com/TechWizards-Tech/DSM-6.git`), branch `Dev`.

---

## 🎯 3. Planejamento Detalhado — Sprint 2 (15/09/2026 a 19/10/2026)

Foco da Sprint 2: **Orientação inteligente, registro persistente, IA local e agendamento presencial**.

### 📋 Detalhamento das Tarefas da Sprint 2

#### ✅ 1️⃣ Persistência em Banco de Dados (RF06, RNF02) — CONCLUÍDO
* **O que foi feito**:
  * **PostgreSQL 16** configurado via Docker Compose (`docker-compose.yml`) com healthcheck e volume persistente.
  * **Schema SQL** criado em `app/backend/db/schema.sql` com as tabelas `interacoes` e `agendamentos`, índices e constraint de unicidade de slot de horário.
  * **`RepositorioInteracoesPostgres`** (`app/backend/src/modules/registro/postgres.ts`): persiste cada evento de conversa na tabela `interacoes`.
  * **`RepositorioAgendamentosPostgres`** (`app/backend/src/modules/agendamento/postgres.ts`): persiste e consulta agendamentos na tabela `agendamentos`.
  * **`criarPool`** (`app/backend/src/db/pool.ts`): gerencia o pool de conexões com o banco via variável de ambiente `DATABASE_URL`.
  * **Modo duplo em `app.ts`**: se `DATABASE_URL` estiver definida usa PostgreSQL; caso contrário, usa repositórios em memória (para testes e desenvolvimento local sem Docker).
  * **Validado**: queries executadas diretamente no container confirmaram que fluxos de conversa e agendamentos são persistidos corretamente.

#### ⏳ 2️⃣ Módulo de LLM Local (RF04, RF05, RNF05) — PENDENTE
* **O que fazer**: Implementar a explicação humanizada das respostas orientadoras do PROCON via IA local.
* **Regra Importante (RP05)**: Proibido usar APIs externas pagas (como OpenAI). Deve-se utilizar um modelo local executado via **Ollama** (*Llama 3*, *Mistral* ou *Phi-3*).
* **Diretriz de Segurança**: A LLM **jamais toma decisões jurídicas**. Quem decide o resultado é a estrutura do fluxo JSON do PROCON. A LLM apenas reescreve a orientação para linguagem mais simples.
* **Sinalização (RNF05)**: O retorno deve marcar `geradoPorLlm: true` para que o front-end/WhatsApp exiba o selo de IA.
* **Ponto de extensão já pronto**: a interface `ProvedorLlm` existe em `app/backend/src/modules/llm/index.ts` com o `ProvedorLlmDesativado` como placeholder. Basta criar o `ProvedorLlmOllama` implementando essa interface.

#### ✅ 3️⃣ Agendamento de Atendimento Presencial (RF07, US04) — CONCLUÍDO
* **O que foi feito**:
  * **Backend**: módulo completo em `app/backend/src/modules/agendamento/index.ts` com regras de negócio (horários 08:00–16:00, bloqueio de finais de semana, protocolo `PROCON-YYYYMMDD-XXXX`, unicidade de slot).
  * **Endpoints implementados**:
    * `GET /api/agendamentos/horarios-disponiveis?data=YYYY-MM-DD`
    * `POST /api/agendamentos` (criação da reserva com validação de data/horário)
    * `GET /api/agendamentos` (listagem de todos os agendamentos)
  * **Persistência**: funciona tanto em memória quanto no PostgreSQL via `RepositorioAgendamentosPostgres`.
  * **Frontend**: componente `JanelaAgendamento.tsx` com seleção de data (calendário sem finais de semana), escolha de horário disponível e exibição do protocolo gerado.
  * **Testes**: 29 casos de teste no Vitest validando todas as regras de negócio (branch `feature/agendamento-presencial`).
  * **Pendente**: endpoint `POST /api/agendamentos/:id/cancelar` ainda não implementado.

#### ⏳ 4️⃣ Integração com WhatsApp Business Cloud API (RF01, US01) — PENDENTE
* **O que fazer**: Criar um webhook HTTP (`POST /api/webhooks/whatsapp`) para conectar a API do WhatsApp Meta ao motor do chatbot (`motor.ts`).
* **Fluxo de Mensagem**:
  1. Webhook recebe evento do WhatsApp contendo o número e texto/botão clicado.
  2. Chama `motor.responder(telefone, entrada)`.
  3. Envia os botões/respostas de volta via API da Meta.

---

## 🔮 4. Planejamento da Sprint 3 (20/10/2026 a 23/11/2026)

Foco da Sprint 3: **Gestão, LGPD, Testes E2E e Entrega Final**.

1. **Painel Web Administrativo (RF08, US05)**:
   - Interface em React para os funcionários do PROCON visualizarem agendamentos, confirmarem atendimentos e acompanharem estatísticas de uso.
2. **Adequação à LGPD (RNF03)**:
   - Termo de consentimento no WhatsApp/Web.
   - Rotina de anonimização e retenção temporária de dados pessoais.
3. **CI/CD e Automação (RNF06, RNF08)**:
   - Pipeline no GitHub Actions executando build e testes a cada commit na branch `Dev`.
   - Homologação final do ambiente Docker em produção.

---

## 📌 5. Checklist de Ação Imediata para o Time

- [x] **Sprint 1 Entregue**: Código sincronizado na branch `Dev` e tema do Front-end ajustado.
- [ ] **Criar Issues da Sprint 2 no GitHub Projects**:
  - Issue 1: Configurar PostgreSQL + Prisma no `backend`.
  - Issue 2: Criar repositório persistente de Sessões e Interações.
  - Issue 3: Configurar Ollama local e implementar `ProvedorLlmOllama`.
  - Issue 4: Desenvolver endpoints e regras do Agendamento Presencial.
  - Issue 5: Configurar Webhook do WhatsApp Business API.
