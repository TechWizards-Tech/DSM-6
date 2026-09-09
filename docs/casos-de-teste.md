# Casos de teste — Sprint 1

Chatbot de orientação ao consumidor · PROCON Jacareí-SP · ABP 2026-2

Os casos **CT-01 a CT-12** estão automatizados em `backend/tests/` e rodam com
`npm test` a partir de `backend/`. Os casos **CT-13 a CT-18** são de execução
manual na interface, para a evidência da Review.

## Ambiente

| Item | Valor |
|---|---|
| Back-end | `http://localhost:3333` |
| Front-end | `http://localhost:5173` |
| Fluxos | `fluxos/` — 9 fluxos, 71 nós, 46 orientações finais |
| Sessão | Em memória (reiniciar o back-end zera as conversas) |

## Casos automatizados

| ID | Objetivo | Passos | Resultado esperado | Requisito | Status |
|---|---|---|---|---|---|
| CT-01 | Carga dos fluxos | Subir o back-end | Os 9 fluxos carregam; nenhum erro de integridade | RF02 | ✅ |
| CT-02 | Menu e fluxos em sincronia | Comparar `menu.json` com os arquivos de fluxo | Todo item do menu aponta para um fluxo existente e vice-versa | RF02 | ✅ |
| CT-03 | Limites do WhatsApp | Percorrer todos os nós | Máx. 3 opções por pergunta, rótulo ≤ 20 caracteres, corpo ≤ 1024 | RP01 | ✅ |
| CT-04 | Nenhum beco sem saída | Percorrer todos os caminhos de cada fluxo | Todo caminho termina em uma orientação; não há ciclos | RF03 | ✅ |
| CT-05 | Início da conversa | `POST /api/conversas` | Saudação + menu com 10 opções; sessão em `menu` | RF02 | ✅ |
| CT-06 | Fatia vertical completa | Menu → "Cobrança indevida" → "Nunca contratei" → "Sim, tenho" | Orientação com documentos e ressalvas, aviso orientativo e encaminhamento | RF03, RF04, RNF04 | ✅ |
| CT-07 | Resposta por número | Digitar `1` no menu | Entra no primeiro fluxo do menu | RNF01 | ✅ |
| CT-08 | Resposta por extenso | Digitar `nunca contratei` numa pergunta | Avança como se o botão tivesse sido clicado (ignora acento e caixa) | RNF01 | ✅ |
| CT-09 | Roteamento por palavra-chave | Digitar "apareceu um seguro na minha fatura que eu não contratei" | Entra no fluxo de cobrança indevida | RF02 | ✅ |
| CT-10 | Entrada inválida | Digitar "talvez, sei lá" durante uma pergunta | Mensagem de opção inválida **e** a pergunta reapresentada; sessão intacta | RNF01 | ✅ |
| CT-11 | Comandos globais | Digitar `menu`, `voltar`, `atendente`, `sair` | Cada comando funciona em qualquer ponto da conversa | RF03 | ✅ |
| CT-12 | Registro das interações | Concluir duas conversas | `GET /api/registros/estatisticas` mostra os fluxos mais utilizados | RF06 | ✅ |
| CT-12b | Isolamento entre sessões | Duas conversas simultâneas em fluxos diferentes | Nenhuma interferência entre as sessões | RP01 | ✅ |
| CT-12c | Proteção de `base_legal` | Concluir um fluxo e inspecionar a resposta HTTP | Os artigos do CDC **não** aparecem na resposta ao cidadão | LGPD / decisão da frente de fluxos | ✅ |

## Casos manuais (interface)

| ID | Objetivo | Passos | Resultado esperado | Requisito |
|---|---|---|---|---|
| CT-13 | Identificação do usuário | Informar um número e iniciar a conversa | O número aparece no cabeçalho do chat | RP01 |
| CT-14 | Legibilidade da orientação | Concluir um fluxo | Documentos e ressalvas em listas separadas, com títulos | RNF01 |
| CT-15 | Aviso orientativo visível | Concluir um fluxo | Faixa de aviso destacada, distinta da orientação | RNF04 |
| CT-16 | Trilha do caminho | Responder duas perguntas | As respostas escolhidas aparecem como etiquetas no topo | RF03 |
| CT-17 | Retomada da sessão | Recarregar a página (F5) no meio da conversa | A conversa volta do ponto onde parou | RP01 |
| CT-18 | Back-end fora do ar | Parar o back-end e enviar uma mensagem | Mensagem de erro clara, sem tela branca | RNF02 |

## Bugs e observações registrados

| ID | Descrição | Onde | Situação |
|---|---|---|---|
| BUG-01 | `fluxo.schema.json` estava fora de sincronia com os dados: o enum de `categoria` usava `_` enquanto os fluxos usam `-`, e o campo `encaminhamento` não existia no schema, que é `additionalProperties: false`. Nenhum dos 9 fluxos validava contra o próprio schema. | `fluxos/fluxo.schema.json` | Corrigido — os 9 fluxos validam |
| BUG-02 | `validar_fluxos.py` procurava `data/fluxos/`, mas os arquivos foram publicados achatados em `fluxos/`. O script abortava com "diretorio nao encontrado". | `fluxos/validar_fluxos.py` | Corrigido com detecção do layout achatado. Vale alinhar com a frente de fluxos qual layout fica valendo |
| OBS-01 | O README do repositório coloca RF04 e RNF04 na Sprint 2, mas o checklist do Plano da Sprint 1 exige orientação final ainda na Sprint 1. A implementação seguiu o Plano. | Escopo | A alinhar na daily |
| OBS-02 | O caso do consignado usado (`orienta_consignado_usado`) informa que só cabe proposta de quitação. É a orientação mais delicada do conjunto. | `fluxos/descontos-folha-beneficio.json` | Pendente de revisão do PROCON |

## Checklist da Review (Plano da Sprint 1, seção 10)

| Item | Situação |
|---|---|
| O projeto sobe localmente seguindo o README | ✅ |
| O chatbot inicia uma conversa | ✅ |
| Existe pelo menos um fluxo decisório completo | ✅ 9 fluxos |
| O usuário consegue escolher opções e avançar | ✅ |
| O sistema gera uma orientação final | ✅ 46 orientações |
| A interação é registrada | ✅ Em memória + espelho em `interacoes.jsonl` |
| WhatsApp ou simulador demonstra o conceito | ✅ Simulador web com identificação de usuário e sessão |
| Existe uma interface simples para teste | ✅ |
| Existem casos de teste e bugs registrados | ✅ Este documento |
| Docker está configurado | ✅ `docker compose up --build` |
| README explica instalação e execução | ✅ |
| O grupo consegue explicar as regras de negócio | Depende da equipe — os fluxos estão em `fluxos/` com o campo `fonte` apontando para o material do PROCON |
