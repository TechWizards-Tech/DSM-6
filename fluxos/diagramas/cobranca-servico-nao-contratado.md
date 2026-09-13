<!-- gerado por scripts/gerar_diagramas.py -->

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
