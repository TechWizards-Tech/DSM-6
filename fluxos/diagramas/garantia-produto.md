<!-- gerado por scripts/gerar_diagramas.py -->

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
