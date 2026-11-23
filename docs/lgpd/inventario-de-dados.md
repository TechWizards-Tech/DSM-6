# Inventário de Dados Pessoais

**Projeto:** Assistente Virtual do PROCON Jacareí (TechWizards — FATEC Jacareí DSM)
**Relacionado a:** Issue #11 · RNF03 (Adequação à LGPD) · Sprint 03
**Versão:** 1.0 · **Data:** 22/11/2026

Este documento mapeia quais dados pessoais o sistema coleta, para quê, com qual base legal e por
quanto tempo são mantidos (LGPD, Lei nº 13.709/2018, arts. 6º, III e 37).

## 1. Papéis

| Papel | Quem |
|---|---|
| Controlador | PROCON de Jacareí-SP / Prefeitura Municipal de Jacareí |
| Operador | Equipe TechWizards (FATEC Jacareí), responsável pelo desenvolvimento e operação do sistema |
| Encarregado (DPO) | Encarregado de proteção de dados designado pela Prefeitura Municipal de Jacareí, com contato divulgado no portal oficial |

## 2. Dados tratados

| # | Dado | Titular | Onde é coletado | Finalidade | Base legal (art. 7º) | Sensível? | Quem acessa | Retenção |
|---|---|---|---|---|---|---|---|---|
| 1 | Número de telefone (WhatsApp) | Cidadão | RF01 — webhook / sessão | Identificar a conversa e responder | III — execução de políticas públicas | Não | Sistema; admin (restrito) | 30 dias após a última interação |
| 2 | Nome | Cidadão | RF07 — agendamento | Identificar o cidadão no atendimento | III | Não | Funcionários PROCON | 12 meses após o atendimento |
| 3 | CPF (somente no agendamento presencial, quando necessário) | Cidadão | RF07 — agendamento | Identificação no atendimento presencial | III | Não | Funcionários PROCON (mascarado por padrão) | 12 meses após o atendimento |
| 4 | Relato/texto livre do problema de consumo | Cidadão (e eventualmente terceiros) | RF03/RF04 — conversa | Orientação e triagem | III | Risco: pode conter dado sensível | Admin (restrito e auditado) | 6 meses; depois anonimizado |
| 5 | Histórico de mensagens | Cidadão | RF06 — registro | Análise dos fluxos mais utilizados (US06) | III / estatística | Risco (ver item 4) | Admin (restrito) | 6 meses; depois anonimizado |
| 6 | Data, hora e motivo do agendamento | Cidadão | RF07 | Organizar atendimento presencial | III | Não | Funcionários PROCON | 12 meses após o atendimento |
| 7 | Aceite do termo (telefone em hash, data/hora, versão) | Cidadão | Primeira mensagem | Comprovar ciência e consentimento | I / art. 8º, §2º | Não | Admin | Enquanto houver tratamento |
| 8 | Usuário e senha (hash) dos funcionários | Funcionário | RF08 — painel | Autenticação | Execução da atividade pública | Não | Admin | Enquanto o acesso estiver ativo |
| 9 | Logs de acesso e auditoria | Funcionário | RF08 | Segurança e rastreabilidade | Art. 6º, VII e VIII | Não | Admin | 6 meses |

## 3. Fluxo dos dados e terceiros

| Etapa | Descrição | Terceiro envolvido |
|---|---|---|
| Entrada | Cidadão envia mensagem pelo WhatsApp | WhatsApp Business Platform (Meta) |
| Processamento | Fluxos decisórios + LLM executado localmente | Nenhum (infraestrutura própria do projeto) |
| Armazenamento | Banco de dados do sistema, em contêineres Docker | Infraestrutura do projeto |
| Consulta | Painel web de agendamentos | Funcionários autorizados do PROCON |

Por usar LLM local, o conteúdo das conversas não é enviado a APIs de IA de terceiros. Esta
característica deve ser mantida.

## 4. Riscos e mitigação

| Risco | Mitigação adotada |
|---|---|
| Texto livre pode conter dado sensível ou de terceiros | Acesso restrito, retenção de 6 meses e anonimização |
| RF06 não exige identificar a pessoa para medir fluxos | Registrar fluxo e opção escolhida sem o telefone, ou com o telefone em hash (HMAC) |
| CPF pode ser desnecessário | Coletar somente no agendamento presencial, quando exigido pelo atendimento (minimização, art. 6º, III) |
| Vazamento via logs | Não registrar CPF, tokens nem conteúdo completo das mensagens |
| Repositório público | Segredos somente em variáveis de ambiente; verificação do histórico do Git |

## 5. Direitos dos titulares (art. 18)

O sistema deve permitir, em até 15 dias após a solicitação:

- localizar todos os dados associados a um telefone;
- corrigir ou eliminar esses dados;
- exportar os dados (portabilidade) quando solicitado;
- registrar o atendimento do pedido (data, tipo e responsável).

**Canal de solicitação:** atendimento presencial no PROCON de Jacareí ou contato oficial divulgado
no portal da Prefeitura Municipal de Jacareí.
