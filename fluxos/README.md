# Fluxos decisórios do PROCON

Entrega da frente **Fluxos do PROCON** (Pessoa 3) — Sprint 1.

Este módulo transforma o material de dúvidas frequentes do PROCON Jacareí-SP em dados
estruturados que o motor de conversa consome. Nenhum texto de orientação ao cidadão
está codificado no backend: tudo vive aqui, em JSON, e pode ser alterado sem mexer
em código.

## Estrutura

```
data/
  menu.json                  Menu inicial, textos globais e tipos de encaminhamento
  fluxos/*.json              Um arquivo por caso de consumo
schema/
  fluxo.schema.json          Contrato formal (JSON Schema draft 2020-12)
scripts/
  validar_fluxos.py          Validador de estrutura e de integridade do grafo
```

## Conteúdo atual

9 fluxos, 71 nós, 46 orientações finais.

| Fluxo | Assunto | Origem no material do PROCON |
|---|---|---|
| `cobranca-servico-nao-contratado` | Cobrança de serviço não contratado ou já cancelado | caso 1 |
| `descontos-folha-beneficio` | Desconto na folha, consignado, RMC e RCC | casos 2, 3, 6 |
| `dificuldade-cancelamento` | Recusa de cancelamento, multa e fidelidade | casos 5, 9, 10 |
| `garantia-produto` | Defeito, garantia legal, vício oculto, opções após 30 dias | casos 16–22, 28–37, 44, 45 |
| `atraso-entrega` | Descumprimento do prazo de entrega | caso 15 |
| `direito-arrependimento` | Desistência em 7 dias | casos 11–14, 23, 43 |
| `divergencia-preco` | Preço divergente e recusa em cumprir a oferta | casos 38–42 |
| `recusa-entrega-documentos` | Contrato e nota fiscal não entregues | casos 4, 46 |
| `atendimento-procon` | Documentos, prazos, duplicidade e competência | casos 7, 8, 26, 27, 47 |

## Modelo de dados

Cada fluxo é uma **máquina de estados**. O motor guarda apenas o id do fluxo e o id
do nó atual na sessão; não precisa de variáveis nem de lógica condicional.

Existem dois tipos de nó.

**`pergunta`** — apresenta um texto e de 2 a 3 opções. Cada opção aponta para o
próximo nó através de `proximo`.

```json
"tem_faturas": {
  "tipo": "pergunta",
  "texto": "Você tem em mãos as faturas...?",
  "opcoes": [
    { "id": "sim", "rotulo": "Sim, tenho", "proximo": "orienta_com_faturas" },
    { "id": "nao", "rotulo": "Não tenho", "proximo": "orienta_sem_faturas" }
  ]
}
```

**`orientacao`** — nó terminal. Não tem `proximo`. É a resposta orientadora que fecha
a conversa (RF04).

```json
"orienta_com_faturas": {
  "tipo": "orientacao",
  "texto": "Pelo que você descreveu...",
  "documentos": ["RG com CPF", "..."],
  "ressalvas": ["Cada caso tem particularidades..."],
  "base_legal": [
    { "norma": "CDC", "dispositivo": "Art. 42, parágrafo único", "resumo": "..." }
  ],
  "encaminhamento": "agendamento_presencial"
}
```

### Campos de `orientacao`

| Campo | Uso |
|---|---|
| `texto` | O que o cidadão lê. Linguagem simples, sem juridiquês (RNF01). |
| `documentos` | Lista para levar ao atendimento. Renderizar como bullets. |
| `ressalvas` | Limites e exceções. Renderizar depois dos documentos. |
| `base_legal` | **Metadado interno.** Não enviar ao cidadão por padrão. |
| `encaminhamento` | Define o que o motor faz depois. Ver abaixo. |

`base_legal` fica separado de propósito. Os artigos do CDC servem para o atendente do
PROCON auditar a orientação e para o painel administrativo da Sprint 3, não para o
cidadão no WhatsApp. Se o PROCON pedir que apareça, é só o frontend passar a renderizar
o campo — sem tocar nos dados.

### Encaminhamentos

Valor de `encaminhamento` define o próximo passo do motor. Os textos correspondentes
estão em `menu.json` → `encaminhamentos`.

| Valor | Comportamento esperado |
|---|---|
| `agendamento_presencial` | Oferecer agendamento (RF07). É o caso mais comum. |
| `procon_online` | Direcionar ao canal online. |
| `informativo` | Só orienta. Oferecer agendamento como opcional. |
| `fora_de_competencia` | PROCON não atua. Não oferecer agendamento. |

## Como o motor consome isso

```
1. Carregar menu.json  → enviar saudacao + texto_menu + itens
2. Cidadão escolhe     → carregar fluxos/{fluxo}.json
3. Estado = no_inicial → enviar texto + opcoes do nó
4. Cidadão responde    → estado = opcao.proximo
5. Repetir 3–4 até o nó ser do tipo "orientacao"
6. Enviar texto + documentos + ressalvas
7. Enviar aviso_orientativo (RNF04)
8. Aplicar encaminhamento
```

O estado de sessão que precisa ser persistido é mínimo: `fluxo_id`, `no_atual` e o
histórico de opções escolhidas (útil para o RF06 e para o relatório de fluxos mais
usados).

### Textos globais

`menu.json` → `textos_globais` centraliza saudação, aviso de caráter orientativo
(RNF04), aviso de uso de LLM (RNF05) e mensagem de opção inválida. Eles não se repetem
dentro de cada fluxo justamente para poderem ser ajustados em um único lugar quando o
PROCON revisar a redação.

`comandos_globais` lista as palavras que devem funcionar em qualquer ponto da conversa
(`menu`, `voltar`, `atendente`, `sair`). Elas não aparecem como opções nos nós para não
consumir um dos 3 botões disponíveis.

## Limites do WhatsApp respeitados

O schema e o validador impõem os limites da Cloud API, para que os mesmos dados
funcionem tanto no simulador quanto na integração real:

- máximo de **3 opções** por pergunta (reply buttons)
- rótulo de opção com até **20 caracteres**
- corpo da mensagem com até **1024 caracteres**
- menu com até **10 itens**, título de até 24 e descrição de até 72 caracteres

## Validação

```bash
python3 scripts/validar_fluxos.py
```

Sem dependências externas. Retorna código 0 se tudo estiver válido, 1 caso contrário —
pronto para entrar no pipeline de CI (RNF08).

Além de checar a estrutura, o validador verifica:

- `no_inicial` existe
- toda `opcao.proximo` aponta para um nó existente
- não há nós inalcançáveis a partir do nó inicial
- todo fluxo tem ao menos uma orientação final
- nós de orientação são terminais e têm encaminhamento válido
- ids únicos entre arquivos e coerentes com o nome do arquivo
- todo fluxo referenciado no menu existe, e vice-versa

Quem preferir validar em Node pode apontar o `ajv` para `schema/fluxo.schema.json`.
O schema cobre a estrutura; as checagens de grafo só existem no script Python.

## Como adicionar um caso novo

1. Criar `data/fluxos/{id}.json` com o id igual ao nome do arquivo.
2. Registrar o caso em `data/menu.json` → `itens`.
3. Rodar o validador.
4. Manter o campo `fonte` apontando para o item do material do PROCON. Sem isso não dá
   para auditar de onde a orientação veio.

## Decisões e pendências

**Fonte única.** Todo o conteúdo veio do arquivo de dúvidas frequentes do PROCON.
Nenhuma regra jurídica foi acrescentada por fora. Os textos foram reescritos em
linguagem acessível, mas o conteúdo normativo é o do material original.

**Independência de LLM.** Como o RP05 proíbe APIs externas de LLM, cada orientação é
autossuficiente e legível como está. Se uma LLM local for adicionada na Sprint 2, ela
deve apenas reformular ou explicar esse texto, nunca decidir o desfecho.

**Conflito de escopo a resolver.** O README do repositório coloca RF04 (resposta
orientadora) e RNF04 (aviso orientativo) na Sprint 2, mas o checklist do Plano da
Sprint 1 exige orientação final ainda na Sprint 1. Os dados aqui já contemplam as duas
leituras. Vale alinhar na daily.

**Ponto para validar com o PROCON.** O caso do consignado usado (`orienta_consignado_usado`)
informa ao cidadão que só cabe proposta de quitação. Isso segue o material, mas é a
orientação mais delicada do conjunto e merece revisão do parceiro antes da demo.
