<!-- gerado por scripts/gerar_diagramas.py -->

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
