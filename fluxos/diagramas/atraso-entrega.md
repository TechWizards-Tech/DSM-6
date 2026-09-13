<!-- gerado por scripts/gerar_diagramas.py -->

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
