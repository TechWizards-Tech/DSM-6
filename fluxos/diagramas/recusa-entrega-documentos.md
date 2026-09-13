<!-- gerado por scripts/gerar_diagramas.py -->

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
