<!-- gerado por scripts/gerar_diagramas.py -->

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
