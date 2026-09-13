<!-- gerado por scripts/gerar_diagramas.py -->

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
