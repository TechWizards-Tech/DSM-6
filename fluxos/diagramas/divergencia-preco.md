<!-- gerado por scripts/gerar_diagramas.py -->

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
