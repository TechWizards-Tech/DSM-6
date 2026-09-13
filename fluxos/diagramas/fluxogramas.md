# Fluxogramas dos fluxos decisorios do PROCON

Diagramas gerados automaticamente a partir de `data/fluxos/*.json`.
Nao edite este arquivo a mao: altere o JSON e rode
`python3 scripts/gerar_diagramas.py`.

9 fluxos, 71 nos.

## Como ler os diagramas

| Forma | Significado |
|---|---|
| Hexagono azul | Pergunta ao cidadao. As setas sao as opcoes de resposta. |
| Retangulo vermelho | Orientacao final que encaminha para agendamento presencial. |
| Retangulo amarelo | Orientacao final apenas informativa. |
| Retangulo verde | Orientacao final que encaminha para o PROCON online. |
| Retangulo cinza | Assunto fora da competencia do PROCON. |

Cada caminho da raiz ate um retangulo e uma conversa completa possivel,
e serve como caso de teste para a frente de QA.

---

## Como funciona o atendimento do PROCON

`atendimento-procon` · Informações sobre abertura de reclamação, documentos exigidos, prazos de resposta e limites de atuação do PROCON.

**3 perguntas · 5 orientacoes finais** · Fonte: Dúvidas Frequentes PROCON Jacareí — casos 7, 8, 26, 27 e 47

```mermaid
flowchart TD
    inicio_marcador(["Inicio"]) --> inicio
    inicio{{"Sobre o que você quer saber?"}}
    ja_registrou{{"Você já registrou uma reclamação sobre esse mesmo assunto no PROCON..."}}
    tipo_problema{{"Seu problema é sobre o quê?"}}
    orienta_documentos["Documentos"]
    orienta_prazo["Prazo"]
    orienta_duplicidade["Duplicidade"]
    orienta_plataforma["Plataforma"]
    orienta_imobiliario["Imobiliário"]

    inicio -->|"Como reclamar"| ja_registrou
    inicio -->|"Prazos e andamento"| orienta_prazo
    inicio -->|"Meu caso se aplica?"| tipo_problema
    ja_registrou -->|"Sim, já registrei"| orienta_duplicidade
    ja_registrou -->|"Não registrei"| orienta_documentos
    tipo_problema -->|"Aluguel ou imóvel"| orienta_imobiliario
    tipo_problema -->|"Compra em site"| orienta_plataforma
    tipo_problema -->|"Outro consumo"| orienta_documentos

    classDef agendamento_presencial fill:#fde8e8,stroke:#c0392b,stroke-width:2px,color:#1a1a1a
    classDef fora_de_competencia fill:#eceff1,stroke:#607d8b,stroke-width:2px,color:#1a1a1a
    classDef informativo fill:#fff8e1,stroke:#f39c12,stroke-width:2px,color:#1a1a1a
    classDef pergunta fill:#e8f0fe,stroke:#4a7ebb,stroke-width:2px,color:#1a1a1a
    class orienta_documentos,orienta_plataforma agendamento_presencial
    class orienta_imobiliario fora_de_competencia
    class orienta_duplicidade,orienta_prazo informativo
    class inicio,ja_registrou,tipo_problema pergunta
    classDef marcador fill:#ffffff,stroke:#9e9e9e,stroke-width:1px,color:#616161
    class inicio_marcador marcador
```

Desfechos: Encaminha para agendamento presencial, Fora da competencia do PROCON, Apenas orienta.

<details><summary>O que cada desfecho responde</summary>

| Nó | Início da orientação | Encaminhamento |
|---|---|---|
| `orienta_documentos` | Cada caso exige uma análise própria, mas três documentos são sempre essenciais para abrir uma reclamação: o seu documento pessoal, o CNPJ da matriz do fornecedor e os comprovantes do problema. | Encaminha para agendamento presencial |
| `orienta_prazo` | Funciona assim: depois que a reclamação é aberta, chamada de CIP, o fornecedor tem até 10 dias corridos para apresentar a resposta no sistema. | Apenas orienta |
| `orienta_duplicidade` | Nesse caso não é possível abrir uma nova reclamação no posto de atendimento, porque não podemos registrar reclamações em duplicidade sobre o mesmo assunto. | Apenas orienta |
| `orienta_plataforma` | Sim, vale acionar os dois. | Encaminha para agendamento presencial |
| `orienta_imobiliario` | Preciso ser transparente: casos de direito imobiliário, como locação de imóveis, não são regidos pelo Código de Defesa do Consumidor. | Fora da competencia do PROCON |

</details>

---

## O produto não foi entregue no prazo

`atraso-entrega` · Fornecedor descumpre o prazo de entrega prometido. Consumidor escolhe entre cumprimento, produto equivalente ou rescisão.

**2 perguntas · 5 orientacoes finais** · Fonte: Dúvidas Frequentes PROCON Jacareí — caso 15

```mermaid
flowchart TD
    inicio_marcador(["Inicio"]) --> inicio
    inicio{{"O prazo de entrega prometido pela empresa já venceu?"}}
    escolha{{"O que você prefere?"}}
    orienta_cumprimento["Cumprimento"]
    orienta_equivalente["Equivalente"]
    orienta_rescisao["Rescisão"]
    orienta_aguardar["Aguardar"]
    orienta_verificar_prazo["Verificar prazo"]

    inicio -->|"Sim, já venceu"| escolha
    inicio -->|"Ainda não venceu"| orienta_aguardar
    inicio -->|"Não sei o prazo"| orienta_verificar_prazo
    escolha -->|"Receber o produto"| orienta_cumprimento
    escolha -->|"Produto equivalente"| orienta_equivalente
    escolha -->|"Cancelar e reembolso"| orienta_rescisao

    classDef agendamento_presencial fill:#fde8e8,stroke:#c0392b,stroke-width:2px,color:#1a1a1a
    classDef informativo fill:#fff8e1,stroke:#f39c12,stroke-width:2px,color:#1a1a1a
    classDef pergunta fill:#e8f0fe,stroke:#4a7ebb,stroke-width:2px,color:#1a1a1a
    class orienta_cumprimento,orienta_equivalente,orienta_rescisao agendamento_presencial
    class orienta_aguardar,orienta_verificar_prazo informativo
    class escolha,inicio pergunta
    classDef marcador fill:#ffffff,stroke:#9e9e9e,stroke-width:1px,color:#616161
    class inicio_marcador marcador
```

Desfechos: Encaminha para agendamento presencial, Apenas orienta.

<details><summary>O que cada desfecho responde</summary>

| Nó | Início da orientação | Encaminhamento |
|---|---|---|
| `orienta_cumprimento` | Você optou por exigir a entrega do produto que comprou. | Encaminha para agendamento presencial |
| `orienta_equivalente` | Você optou por aceitar outro produto ou serviço equivalente no lugar do que foi comprado. | Encaminha para agendamento presencial |
| `orienta_rescisao` | Você optou por cancelar a compra e receber o dinheiro de volta. | Encaminha para agendamento presencial |
| `orienta_aguardar` | Como o prazo prometido ainda não venceu, por ora não há descumprimento por parte da empresa e não é possível abrir uma reclamação por atraso. | Apenas orienta |
| `orienta_verificar_prazo` | Para saber se houve descumprimento, primeiro é preciso identificar qual prazo foi prometido. | Apenas orienta |

</details>

---

## Cobrança de serviço que eu não contratei

`cobranca-servico-nao-contratado` · Cobrança recorrente de serviço não contratado ou já cancelado, geralmente em fatura de cartão de crédito.

**3 perguntas · 4 orientacoes finais** · Fonte: Dúvidas Frequentes PROCON Jacareí — caso 1 (seguro no cartão de crédito)

```mermaid
flowchart TD
    inicio_marcador(["Inicio"]) --> inicio
    inicio{{"Você chegou a contratar esse serviço em algum momento?"}}
    tem_faturas{{"Você tem em mãos as faturas ou extratos que mostram desde quando..."}}
    tem_protocolo{{"Quando você pediu o cancelamento, a empresa forneceu um número de..."}}
    orienta_com_faturas["Com faturas"]
    orienta_sem_faturas["Sem faturas"]
    orienta_pos_cancelamento["Pós cancelamento"]
    orienta_sem_protocolo["Sem protocolo"]

    inicio -->|"Nunca contratei"| tem_faturas
    inicio -->|"Contratei e cancelei"| tem_protocolo
    inicio -->|"Não tenho certeza"| tem_faturas
    tem_faturas -->|"Sim, tenho"| orienta_com_faturas
    tem_faturas -->|"Não tenho"| orienta_sem_faturas
    tem_protocolo -->|"Sim, tenho"| orienta_pos_cancelamento
    tem_protocolo -->|"Não tenho"| orienta_sem_protocolo

    classDef agendamento_presencial fill:#fde8e8,stroke:#c0392b,stroke-width:2px,color:#1a1a1a
    classDef pergunta fill:#e8f0fe,stroke:#4a7ebb,stroke-width:2px,color:#1a1a1a
    class orienta_com_faturas,orienta_pos_cancelamento,orienta_sem_faturas,orienta_sem_protocolo agendamento_presencial
    class inicio,tem_faturas,tem_protocolo pergunta
    classDef marcador fill:#ffffff,stroke:#9e9e9e,stroke-width:1px,color:#616161
    class inicio_marcador marcador
```

Desfechos: Encaminha para agendamento presencial.

<details><summary>O que cada desfecho responde</summary>

| Nó | Início da orientação | Encaminhamento |
|---|---|---|
| `orienta_com_faturas` | Pelo que você descreveu, trata-se de uma cobrança por serviço não contratado. | Encaminha para agendamento presencial |
| `orienta_sem_faturas` | Pelo que você descreveu, trata-se de uma cobrança por serviço não contratado. | Encaminha para agendamento presencial |
| `orienta_pos_cancelamento` | Se o serviço foi cancelado e a cobrança continuou, os valores descontados depois do cancelamento também são indevidos. | Encaminha para agendamento presencial |
| `orienta_sem_protocolo` | Sem o número de protocolo fica mais difícil provar a data do seu pedido de cancelamento, mas isso não impede a reclamação. | Encaminha para agendamento presencial |

</details>

---

## Desconto indevido na folha de pagamento ou no benefício

`descontos-folha-beneficio` · Descontos de empréstimo já quitado, empréstimo não contratado ou reserva de margem (RMC/RCC) em folha ou benefício.

**4 perguntas · 6 orientacoes finais** · Fonte: Dúvidas Frequentes PROCON Jacareí — casos 2, 3 e 6

```mermaid
flowchart TD
    inicio_marcador(["Inicio"]) --> inicio
    inicio{{"O desconto aparece em qual lugar?"}}
    tipo_folha{{"E qual é a situação desse empréstimo descontado na sua folha?"}}
    tipo_beneficio{{"Qual é a natureza do desconto no seu benefício?"}}
    recebeu_valor{{"O dinheiro desse empréstimo chegou a cair na sua conta?"}}
    orienta_quitado["Quitado"]
    orienta_folha_nao_contratado["Folha não contratado"]
    orienta_consignado_nao_recebido["Consignado não recebido"]
    orienta_consignado_usado["Consignado usado"]
    orienta_rmc_rcc["RMC RCC"]
    orienta_extrato["Extrato"]

    inicio -->|"Folha de pagamento"| tipo_folha
    inicio -->|"Benefício do INSS"| tipo_beneficio
    inicio -->|"Não sei dizer"| orienta_extrato
    tipo_folha -->|"Já quitei"| orienta_quitado
    tipo_folha -->|"Nunca contratei"| orienta_folha_nao_contratado
    tipo_beneficio -->|"Empréstimo"| recebeu_valor
    tipo_beneficio -->|"RMC ou RCC"| orienta_rmc_rcc
    tipo_beneficio -->|"Não sei identificar"| orienta_extrato
    recebeu_valor -->|"Não recebi nada"| orienta_consignado_nao_recebido
    recebeu_valor -->|"Recebi e usei"| orienta_consignado_usado
    recebeu_valor -->|"Não sei"| orienta_extrato

    classDef agendamento_presencial fill:#fde8e8,stroke:#c0392b,stroke-width:2px,color:#1a1a1a
    classDef pergunta fill:#e8f0fe,stroke:#4a7ebb,stroke-width:2px,color:#1a1a1a
    class orienta_consignado_nao_recebido,orienta_consignado_usado,orienta_extrato,orienta_folha_nao_contratado,orienta_quitado,orienta_rmc_rcc agendamento_presencial
    class inicio,recebeu_valor,tipo_beneficio,tipo_folha pergunta
    classDef marcador fill:#ffffff,stroke:#9e9e9e,stroke-width:1px,color:#616161
    class inicio_marcador marcador
```

Desfechos: Encaminha para agendamento presencial.

<details><summary>O que cada desfecho responde</summary>

| Nó | Início da orientação | Encaminhamento |
|---|---|---|
| `orienta_quitado` | Se o empréstimo já foi quitado, os descontos que continuaram sendo feitos são indevidos. | Encaminha para agendamento presencial |
| `orienta_folha_nao_contratado` | Um empréstimo que você não contratou não pode ser descontado da sua folha. | Encaminha para agendamento presencial |
| `orienta_consignado_nao_recebido` | Se o valor nunca caiu na sua conta e mesmo assim há desconto no benefício, a situação é de empréstimo não reconhecido. | Encaminha para agendamento presencial |
| `orienta_consignado_usado` | Preciso ser transparente com você sobre esse ponto. | Encaminha para agendamento presencial |
| `orienta_rmc_rcc` | RMC e RCC são reservas de margem ligadas a um cartão de crédito consignado. | Encaminha para agendamento presencial |
| `orienta_extrato` | Para orientar você com precisão, primeiro é preciso identificar exatamente qual é o desconto. | Encaminha para agendamento presencial |

</details>

---

## Dificuldade para cancelar um serviço

`dificuldade-cancelamento` · Empresa dificulta ou recusa o cancelamento de serviço contratado, com ou sem cobrança de multa por fidelidade.

**3 perguntas · 5 orientacoes finais** · Fonte: Dúvidas Frequentes PROCON Jacareí — casos 5, 9 e 10

```mermaid
flowchart TD
    inicio_marcador(["Inicio"]) --> inicio
    inicio{{"Você já solicitou o cancelamento diretamente à empresa?"}}
    tem_multa{{"A empresa está cobrando alguma multa ou alegando cláusula de..."}}
    motivo_cancelamento{{"O que levou você a querer cancelar?"}}
    orienta_solicitar["Solicitar"]
    orienta_recusa["Recusa"]
    orienta_multa_indevida["Multa indevida"]
    orienta_multa_proporcional["Multa proporcional"]
    orienta_arrependimento["Arrependimento"]

    inicio -->|"Sim, já pedi"| tem_multa
    inicio -->|"Ainda não pedi"| orienta_solicitar
    tem_multa -->|"Sim, cobra multa"| motivo_cancelamento
    tem_multa -->|"Não, só não cancela"| orienta_recusa
    tem_multa -->|"Não sei dizer"| orienta_recusa
    motivo_cancelamento -->|"Falha da empresa"| orienta_multa_indevida
    motivo_cancelamento -->|"Decisão minha"| orienta_multa_proporcional
    motivo_cancelamento -->|"Contratei há 7 dias"| orienta_arrependimento

    classDef agendamento_presencial fill:#fde8e8,stroke:#c0392b,stroke-width:2px,color:#1a1a1a
    classDef informativo fill:#fff8e1,stroke:#f39c12,stroke-width:2px,color:#1a1a1a
    classDef pergunta fill:#e8f0fe,stroke:#4a7ebb,stroke-width:2px,color:#1a1a1a
    class orienta_arrependimento,orienta_multa_indevida,orienta_multa_proporcional,orienta_recusa agendamento_presencial
    class orienta_solicitar informativo
    class inicio,motivo_cancelamento,tem_multa pergunta
    classDef marcador fill:#ffffff,stroke:#9e9e9e,stroke-width:1px,color:#616161
    class inicio_marcador marcador
```

Desfechos: Encaminha para agendamento presencial, Apenas orienta.

<details><summary>O que cada desfecho responde</summary>

| Nó | Início da orientação | Encaminhamento |
|---|---|---|
| `orienta_solicitar` | Antes de abrir uma reclamação, o primeiro passo é registrar o pedido de cancelamento junto à empresa e guardar a prova disso. | Apenas orienta |
| `orienta_recusa` | A empresa não pode criar obstáculos para o cancelamento de um serviço que você contratou. | Encaminha para agendamento presencial |
| `orienta_multa_indevida` | Quando o cancelamento acontece porque a empresa falhou na prestação do serviço, a cobrança de multa por fidelidade é indevida. | Encaminha para agendamento presencial |
| `orienta_multa_proporcional` | Cláusula de fidelidade é permitida. | Encaminha para agendamento presencial |
| `orienta_arrependimento` | Se você contratou o serviço fora da loja física, por telefone, internet ou com vendedor em casa, e ainda está dentro dos 7 dias, existe um caminho mais simples: o direito de arrependimento. | Encaminha para agendamento presencial |

</details>

---

## Quero devolver uma compra da qual me arrependi

`direito-arrependimento` · Desistência de compra dentro de 7 dias, aplicável a contratações feitas fora do estabelecimento comercial.

**3 perguntas · 5 orientacoes finais** · Fonte: Dúvidas Frequentes PROCON Jacareí — casos 11 a 14, 23 e 43

```mermaid
flowchart TD
    inicio_marcador(["Inicio"]) --> inicio
    inicio{{"Como você comprou esse produto?"}}
    prazo{{"Há quantos dias você recebeu?"}}
    estado_produto{{"E como está o produto hoje?"}}
    orienta_devolucao["Devolução"]
    orienta_testado["Testado"]
    orienta_usado["Usado"]
    orienta_loja_fisica["Loja física"]
    orienta_fora_prazo["Fora prazo"]

    inicio -->|"Internet ou telefone"| prazo
    inicio -->|"Loja física"| orienta_loja_fisica
    inicio -->|"Vendedor em casa"| prazo
    prazo -->|"Até 7 dias"| estado_produto
    prazo -->|"Mais de 7 dias"| orienta_fora_prazo
    estado_produto -->|"Ainda lacrado"| orienta_devolucao
    estado_produto -->|"Abri e testei"| orienta_testado
    estado_produto -->|"Usado ou danificado"| orienta_usado

    classDef agendamento_presencial fill:#fde8e8,stroke:#c0392b,stroke-width:2px,color:#1a1a1a
    classDef informativo fill:#fff8e1,stroke:#f39c12,stroke-width:2px,color:#1a1a1a
    classDef pergunta fill:#e8f0fe,stroke:#4a7ebb,stroke-width:2px,color:#1a1a1a
    class orienta_devolucao,orienta_testado,orienta_usado agendamento_presencial
    class orienta_fora_prazo,orienta_loja_fisica informativo
    class estado_produto,inicio,prazo pergunta
    classDef marcador fill:#ffffff,stroke:#9e9e9e,stroke-width:1px,color:#616161
    class inicio_marcador marcador
```

Desfechos: Encaminha para agendamento presencial, Apenas orienta.

<details><summary>O que cada desfecho responde</summary>

| Nó | Início da orientação | Encaminhamento |
|---|---|---|
| `orienta_devolucao` | Você está dentro do prazo e tem direito de desistir da compra. | Encaminha para agendamento presencial |
| `orienta_testado` | Ter aberto a embalagem e testado o produto não elimina o seu direito de desistir. | Encaminha para agendamento presencial |
| `orienta_usado` | Aqui é preciso separar duas coisas. | Encaminha para agendamento presencial |
| `orienta_loja_fisica` | Preciso ser direto com você: o direito de arrependimento não se aplica a compras feitas presencialmente na loja. | Apenas orienta |
| `orienta_fora_prazo` | O prazo de 7 dias para desistir da compra já passou, então o direito de arrependimento não se aplica mais ao seu caso. | Apenas orienta |

</details>

---

## Problema com o preço anunciado

`divergencia-preco` · Divergência entre preço anunciado e cobrado, ou recusa da loja em cumprir a oferta divulgada.

**2 perguntas · 5 orientacoes finais** · Fonte: Dúvidas Frequentes PROCON Jacareí — casos 38 a 42

```mermaid
flowchart TD
    inicio_marcador(["Inicio"]) --> inicio
    inicio{{"Qual das situações abaixo é a sua?"}}
    escolha_oferta{{"O que você prefere?"}}
    orienta_menor_preco["Menor preço"]
    orienta_cumprimento["Cumprimento"]
    orienta_equivalente["Equivalente"]
    orienta_rescisao["Rescisão"]
    orienta_erro_sistema["Erro sistema"]

    inicio -->|"Preço diferente"| orienta_menor_preco
    inicio -->|"Recusam vender"| escolha_oferta
    inicio -->|"Alegam erro"| orienta_erro_sistema
    escolha_oferta -->|"Exigir cumprimento"| orienta_cumprimento
    escolha_oferta -->|"Produto equivalente"| orienta_equivalente
    escolha_oferta -->|"Cancelar e reembolso"| orienta_rescisao

    classDef agendamento_presencial fill:#fde8e8,stroke:#c0392b,stroke-width:2px,color:#1a1a1a
    classDef pergunta fill:#e8f0fe,stroke:#4a7ebb,stroke-width:2px,color:#1a1a1a
    class orienta_cumprimento,orienta_equivalente,orienta_erro_sistema,orienta_menor_preco,orienta_rescisao agendamento_presencial
    class escolha_oferta,inicio pergunta
    classDef marcador fill:#ffffff,stroke:#9e9e9e,stroke-width:1px,color:#616161
    class inicio_marcador marcador
```

Desfechos: Encaminha para agendamento presencial.

<details><summary>O que cada desfecho responde</summary>

| Nó | Início da orientação | Encaminhamento |
|---|---|---|
| `orienta_menor_preco` | Quando há dois preços diferentes para o mesmo produto, vale o menor. | Encaminha para agendamento presencial |
| `orienta_cumprimento` | Você optou por exigir que a loja cumpra a oferta nos termos em que foi anunciada. | Encaminha para agendamento presencial |
| `orienta_equivalente` | Você optou por aceitar outro produto ou serviço equivalente no lugar do que foi anunciado. | Encaminha para agendamento presencial |
| `orienta_rescisao` | Você optou por cancelar a compra e receber o dinheiro de volta. | Encaminha para agendamento presencial |
| `orienta_erro_sistema` | Em regra, não. | Encaminha para agendamento presencial |

</details>

---

## Produto ou serviço com defeito (garantia)

`garantia-produto` · Produto ou serviço apresentou defeito. Trata prazos de garantia legal, vício oculto e as opções após 30 dias sem reparo.

**3 perguntas · 7 orientacoes finais** · Fonte: Dúvidas Frequentes PROCON Jacareí — casos 16 a 22, 28 a 37, 44 e 45

```mermaid
flowchart TD
    inicio_marcador(["Inicio"]) --> inicio
    inicio{{"Você já levou o produto à assistência técnica ou à loja para reparo?"}}
    tipo_produto{{"Qual das opções descreve melhor a sua situação?"}}
    opcao_apos_30{{"O que você prefere?"}}
    orienta_aguardar_30["Aguardar 30"]
    orienta_garantia_90["Garantia 90"]
    orienta_garantia_30["Garantia 30"]
    orienta_vicio_oculto["Vício oculto"]
    orienta_substituicao["Substituição"]
    orienta_restituicao["Restituição"]
    orienta_abatimento["Abatimento"]

    inicio -->|"Sim, há +30 dias"| opcao_apos_30
    inicio -->|"Sim, há -30 dias"| orienta_aguardar_30
    inicio -->|"Ainda não levei"| tipo_produto
    tipo_produto -->|"Produto durável"| orienta_garantia_90
    tipo_produto -->|"Não durável"| orienta_garantia_30
    tipo_produto -->|"Defeito só apareceu"| orienta_vicio_oculto
    opcao_apos_30 -->|"Trocar por outro"| orienta_substituicao
    opcao_apos_30 -->|"Dinheiro de volta"| orienta_restituicao
    opcao_apos_30 -->|"Desconto no preço"| orienta_abatimento

    classDef agendamento_presencial fill:#fde8e8,stroke:#c0392b,stroke-width:2px,color:#1a1a1a
    classDef informativo fill:#fff8e1,stroke:#f39c12,stroke-width:2px,color:#1a1a1a
    classDef pergunta fill:#e8f0fe,stroke:#4a7ebb,stroke-width:2px,color:#1a1a1a
    class orienta_abatimento,orienta_garantia_30,orienta_garantia_90,orienta_restituicao,orienta_substituicao,orienta_vicio_oculto agendamento_presencial
    class orienta_aguardar_30 informativo
    class inicio,opcao_apos_30,tipo_produto pergunta
    classDef marcador fill:#ffffff,stroke:#9e9e9e,stroke-width:1px,color:#616161
    class inicio_marcador marcador
```

Desfechos: Encaminha para agendamento presencial, Apenas orienta.

<details><summary>O que cada desfecho responde</summary>

| Nó | Início da orientação | Encaminhamento |
|---|---|---|
| `orienta_aguardar_30` | O fornecedor tem até 30 dias para sanar o defeito. | Apenas orienta |
| `orienta_garantia_90` | Produtos duráveis, como eletrodomésticos, celulares, móveis e veículos, têm garantia legal de 90 dias, contados da entrega efetiva do produto. | Encaminha para agendamento presencial |
| `orienta_garantia_30` | Produtos e serviços não duráveis, como alimentos, serviços de estética e lavanderia, têm garantia legal de 30 dias, contados da entrega do produto ou da conclusão do serviço. | Encaminha para agendamento presencial |
| `orienta_vicio_oculto` | Quando o defeito não era visível no momento da compra e só apareceu com o uso, ele é chamado de vício oculto. | Encaminha para agendamento presencial |
| `orienta_substituicao` | Você optou pela substituição do produto por outro da mesma espécie, em perfeitas condições de uso. | Encaminha para agendamento presencial |
| `orienta_restituicao` | Você optou pela devolução do dinheiro. | Encaminha para agendamento presencial |
| `orienta_abatimento` | Você optou pelo abatimento proporcional do preço, ou seja, ficar com o produto e receber de volta parte do valor pago. | Encaminha para agendamento presencial |

</details>

---

## Empresa não entrega contrato ou nota fiscal

`recusa-entrega-documentos` · Fornecedor se recusa a entregar cópia do contrato, nota fiscal ou outro documento a que o consumidor tem direito.

**2 perguntas · 4 orientacoes finais** · Fonte: Dúvidas Frequentes PROCON Jacareí — casos 4 e 46

```mermaid
flowchart TD
    inicio_marcador(["Inicio"]) --> inicio
    inicio{{"Você já solicitou esse documento formalmente à empresa?"}}
    tipo_documento{{"Qual documento a empresa não está entregando?"}}
    orienta_solicitar["Solicitar"]
    orienta_contrato["Contrato"]
    orienta_nota_fiscal["Nota fiscal"]
    orienta_outro["Outro"]

    inicio -->|"Sim, com protocolo"| tipo_documento
    inicio -->|"Sim, sem protocolo"| tipo_documento
    inicio -->|"Ainda não pedi"| orienta_solicitar
    tipo_documento -->|"Contrato"| orienta_contrato
    tipo_documento -->|"Nota fiscal"| orienta_nota_fiscal
    tipo_documento -->|"Outro documento"| orienta_outro

    classDef agendamento_presencial fill:#fde8e8,stroke:#c0392b,stroke-width:2px,color:#1a1a1a
    classDef informativo fill:#fff8e1,stroke:#f39c12,stroke-width:2px,color:#1a1a1a
    classDef pergunta fill:#e8f0fe,stroke:#4a7ebb,stroke-width:2px,color:#1a1a1a
    class orienta_contrato,orienta_nota_fiscal,orienta_outro agendamento_presencial
    class orienta_solicitar informativo
    class inicio,tipo_documento pergunta
    classDef marcador fill:#ffffff,stroke:#9e9e9e,stroke-width:1px,color:#616161
    class inicio_marcador marcador
```

Desfechos: Encaminha para agendamento presencial, Apenas orienta.

<details><summary>O que cada desfecho responde</summary>

| Nó | Início da orientação | Encaminhamento |
|---|---|---|
| `orienta_solicitar` | O primeiro passo é solicitar o documento formalmente e guardar a prova do pedido. | Apenas orienta |
| `orienta_contrato` | O fornecedor é obrigado a entregar cópia do contrato. | Encaminha para agendamento presencial |
| `orienta_nota_fiscal` | Receber a nota fiscal é um direito seu. | Encaminha para agendamento presencial |
| `orienta_outro` | O direito à informação alcança os documentos ligados à sua relação de consumo: comprovantes, termos de garantia, extratos, demonstrativos e afins. | Encaminha para agendamento presencial |

</details>

---
