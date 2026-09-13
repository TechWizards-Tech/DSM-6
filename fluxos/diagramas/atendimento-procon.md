<!-- gerado por scripts/gerar_diagramas.py -->

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
