#!/usr/bin/env python3
"""
Gera os fluxogramas em Mermaid a partir dos JSONs dos fluxos.

Os diagramas sao derivados dos dados, nunca escritos a mao. Alterou um fluxo,
roda de novo e a documentacao acompanha.

Uso:
    python3 scripts/gerar_diagramas.py
    python3 scripts/gerar_diagramas.py --dir data --out docs

Saida:
    docs/fluxogramas.md              todos os fluxos em um arquivo
    docs/fluxogramas/{id}.md         um arquivo por fluxo
"""

import argparse
import json
import os
import re
import sys

# Cores por tipo de encaminhamento. Tons suaves para leitura no GitHub,
# claro ou escuro.
ESTILOS = {
    "pergunta":               ("#e8f0fe", "#4a7ebb", "#1a1a1a"),
    "agendamento_presencial": ("#fde8e8", "#c0392b", "#1a1a1a"),
    "procon_online":          ("#e8f5e9", "#2e7d32", "#1a1a1a"),
    "informativo":            ("#fff8e1", "#f39c12", "#1a1a1a"),
    "fora_de_competencia":    ("#eceff1", "#607d8b", "#1a1a1a"),
}

LEGENDA = {
    "agendamento_presencial": "Encaminha para agendamento presencial",
    "procon_online":          "Encaminha para o PROCON online",
    "informativo":            "Apenas orienta",
    "fora_de_competencia":    "Fora da competencia do PROCON",
}

LIMITE_NO = 68
LIMITE_ROTULO = 22


def limpar(texto):
    """Remove caracteres que quebram o parser do Mermaid."""
    texto = texto.replace('"', "'")
    texto = texto.replace("(", "-").replace(")", "-")
    texto = texto.replace("[", "").replace("]", "")
    texto = texto.replace("{", "").replace("}", "")
    texto = texto.replace("#", "no ").replace(";", ",")
    texto = re.sub(r"\s+", " ", texto)
    return texto.strip()


def encurtar(texto, limite):
    texto = limpar(texto)
    if len(texto) <= limite:
        return texto
    corte = texto[:limite].rsplit(" ", 1)[0]
    return corte + "..."


def rotulo_pergunta(no):
    """A ultima linha do texto costuma ser a pergunta em si."""
    linhas = [l for l in no.get("texto", "").split("\n") if l.strip()]
    return encurtar(linhas[-1] if linhas else "?", LIMITE_NO)


ACENTOS = {
    "pos": "pós", "servico": "serviço", "opcao": "opção", "nao": "não",
    "orientacao": "orientação", "restituicao": "restituição",
    "substituicao": "substituição", "rescisao": "rescisão",
    "cancelamento": "cancelamento", "beneficio": "benefício",
    "duplicidade": "duplicidade", "imobiliario": "imobiliário",
    "competencia": "competência", "vicio": "vício",
    "documentos": "documentos", "recebido": "recebido",
    "generico": "genérico", "usado": "usado", "sistema": "sistema",
    "invalida": "inválida", "extrato": "extrato",
    "devolucao": "devolução", "fisica": "física", "preco": "preço",
    "rmc": "RMC", "rcc": "RCC",
}


def rotulo_orientacao(nome):
    """Rotulo curto derivado do id do no.

    A primeira frase do texto seria mais descritiva, mas varias orientacoes
    do mesmo fluxo comecam igual, o que geraria nos indistinguiveis no
    diagrama. O id ja e descritivo e unico por construcao. O texto completo
    aparece na tabela de desfechos, abaixo de cada diagrama.
    """
    bruto = re.sub(r"^(orienta|orientacao)_", "", nome)
    palavras = [ACENTOS.get(p, p) for p in bruto.split("_")]
    rotulo = " ".join(palavras)
    return encurtar(rotulo[:1].upper() + rotulo[1:], LIMITE_NO)


def frase_resumo(no):
    """Primeira frase da orientacao, usada na tabela de desfechos."""
    texto = " ".join(l for l in no.get("texto", "").split("\n") if l.strip())
    frase = re.split(r"(?<=[.!?])\s", texto)[0] if texto else "Orientação"
    return frase.strip()


def diagrama(fluxo):
    nos = fluxo["nos"]
    linhas = ["flowchart TD"]
    classes_usadas = set()

    linhas.append(f'    inicio_marcador(["Inicio"]) --> {fluxo["no_inicial"]}')

    for nome, no in nos.items():
        if no.get("tipo") == "pergunta":
            linhas.append(f'    {nome}{{{{"{rotulo_pergunta(no)}"}}}}')
            classes_usadas.add("pergunta")
        else:
            enc = no.get("encaminhamento", "informativo")
            linhas.append(f'    {nome}["{rotulo_orientacao(nome)}"]')
            classes_usadas.add(enc)

    linhas.append("")

    for nome, no in nos.items():
        for opt in no.get("opcoes", []):
            rot = encurtar(opt.get("rotulo", ""), LIMITE_ROTULO)
            linhas.append(f'    {nome} -->|"{rot}"| {opt["proximo"]}')

    linhas.append("")

    for chave in sorted(classes_usadas):
        fundo, borda, texto = ESTILOS[chave]
        linhas.append(
            f"    classDef {chave} fill:{fundo},stroke:{borda},"
            f"stroke-width:2px,color:{texto}"
        )

    por_classe = {}
    for nome, no in nos.items():
        chave = "pergunta" if no.get("tipo") == "pergunta" else no.get(
            "encaminhamento", "informativo"
        )
        por_classe.setdefault(chave, []).append(nome)

    for chave, membros in sorted(por_classe.items()):
        linhas.append(f"    class {','.join(sorted(membros))} {chave}")

    linhas.append(
        "    classDef marcador fill:#ffffff,stroke:#9e9e9e,"
        "stroke-width:1px,color:#616161"
    )
    linhas.append("    class inicio_marcador marcador")

    return "\n".join(linhas)


def secao(fluxo):
    nos = fluxo["nos"]
    perguntas = sum(1 for n in nos.values() if n.get("tipo") == "pergunta")
    orientacoes = len(nos) - perguntas

    encs = sorted({
        n.get("encaminhamento")
        for n in nos.values()
        if n.get("tipo") == "orientacao"
    })

    partes = [
        f"## {fluxo['titulo']}",
        "",
        f"`{fluxo['id']}` · {fluxo.get('resumo', '')}",
        "",
        f"**{perguntas} perguntas · {orientacoes} orientacoes finais** · "
        f"Fonte: {fluxo.get('fonte', 'nao informada')}",
        "",
        "```mermaid",
        diagrama(fluxo),
        "```",
        "",
        "Desfechos: " + ", ".join(LEGENDA.get(e, e) for e in encs) + ".",
        "",
        "<details><summary>O que cada desfecho responde</summary>",
        "",
        "| Nó | Início da orientação | Encaminhamento |",
        "|---|---|---|",
    ]

    for nome, no in nos.items():
        if no.get("tipo") != "orientacao":
            continue
        resumo = frase_resumo(no).replace("|", "/")
        enc = LEGENDA.get(no.get("encaminhamento"), no.get("encaminhamento"))
        partes.append(f"| `{nome}` | {resumo} | {enc} |")

    partes += ["", "</details>", ""]
    return "\n".join(partes)


def cabecalho(total_fluxos, total_nos):
    return "\n".join([
        "# Fluxogramas dos fluxos decisorios do PROCON",
        "",
        "Diagramas gerados automaticamente a partir de `data/fluxos/*.json`.",
        "Nao edite este arquivo a mao: altere o JSON e rode",
        "`python3 scripts/gerar_diagramas.py`.",
        "",
        f"{total_fluxos} fluxos, {total_nos} nos.",
        "",
        "## Como ler os diagramas",
        "",
        "| Forma | Significado |",
        "|---|---|",
        "| Hexagono azul | Pergunta ao cidadao. As setas sao as opcoes de resposta. |",
        "| Retangulo vermelho | Orientacao final que encaminha para agendamento presencial. |",
        "| Retangulo amarelo | Orientacao final apenas informativa. |",
        "| Retangulo verde | Orientacao final que encaminha para o PROCON online. |",
        "| Retangulo cinza | Assunto fora da competencia do PROCON. |",
        "",
        "Cada caminho da raiz ate um retangulo e uma conversa completa possivel,",
        "e serve como caso de teste para a frente de QA.",
        "",
        "---",
        "",
    ])


def main():
    parser = argparse.ArgumentParser(description="Gera fluxogramas Mermaid dos fluxos.")
    parser.add_argument("--dir", default="data", help="diretorio dos dados (padrao: data)")
    parser.add_argument("--out", default="docs", help="diretorio de saida (padrao: docs)")
    args = parser.parse_args()

    dir_fluxos = os.path.join(args.dir, "fluxos")
    if not os.path.isdir(dir_fluxos):
        print(f"ERRO: diretorio nao encontrado: {dir_fluxos}", file=sys.stderr)
        return 1

    dir_individual = os.path.join(args.out, "fluxogramas")
    os.makedirs(dir_individual, exist_ok=True)

    fluxos = []
    for nome in sorted(os.listdir(dir_fluxos)):
        if not nome.endswith(".json"):
            continue
        with open(os.path.join(dir_fluxos, nome), encoding="utf-8") as fh:
            fluxos.append(json.load(fh))

    total_nos = sum(len(f["nos"]) for f in fluxos)

    partes = [cabecalho(len(fluxos), total_nos)]
    for fluxo in fluxos:
        corpo = secao(fluxo)
        partes.append(corpo)
        partes.append("---\n")

        caminho = os.path.join(dir_individual, f"{fluxo['id']}.md")
        with open(caminho, "w", encoding="utf-8") as fh:
            fh.write("<!-- gerado por scripts/gerar_diagramas.py -->\n\n")
            fh.write(corpo)
        print(f"  {caminho}")

    consolidado = os.path.join(args.out, "fluxogramas.md")
    with open(consolidado, "w", encoding="utf-8") as fh:
        fh.write("\n".join(partes))
    print(f"  {consolidado}")

    print(f"\n{len(fluxos)} fluxogramas gerados.")
    return 0


if __name__ == "__main__":
    sys.exit(main())
