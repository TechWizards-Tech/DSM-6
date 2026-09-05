#!/usr/bin/env python3
"""
Valida os fluxos decisorios do PROCON.

Alem da estrutura, verifica integridade do grafo: referencias quebradas,
nos inalcancaveis e becos sem saida. Sem dependencias externas.

Uso:
    python3 scripts/validar_fluxos.py
    python3 scripts/validar_fluxos.py --dir data

Saida: 0 se tudo valido, 1 se houver erro.
"""

import argparse
import json
import os
import sys

CATEGORIAS = {
    "cobranca-indevida", "contrato", "produto",
    "servico", "entrega", "oferta", "institucional",
}
ENCAMINHAMENTOS = {
    "agendamento_presencial", "procon_online",
    "informativo", "fora_de_competencia",
}

# Limites da WhatsApp Cloud API (mensagens interativas)
MAX_OPCOES = 3          # reply buttons por mensagem
MAX_ROTULO = 20         # caracteres no titulo do botao
MAX_TEXTO_PERGUNTA = 1024
MAX_TEXTO_ORIENTACAO = 1500
MAX_ROTULO_MENU = 24    # titulo de item de lista
MAX_DESCRICAO_MENU = 72


class Relatorio:
    def __init__(self):
        self.erros = []
        self.avisos = []

    def erro(self, arquivo, msg):
        self.erros.append(f"{arquivo}: {msg}")

    def aviso(self, arquivo, msg):
        self.avisos.append(f"{arquivo}: {msg}")


def carregar(caminho, rel):
    try:
        with open(caminho, encoding="utf-8") as fh:
            return json.load(fh)
    except json.JSONDecodeError as exc:
        rel.erro(os.path.basename(caminho), f"JSON invalido: {exc}")
    except OSError as exc:
        rel.erro(os.path.basename(caminho), f"nao foi possivel ler: {exc}")
    return None


def validar_no_pergunta(nome, no, nos, arq, rel):
    texto = no.get("texto", "")
    if not texto:
        rel.erro(arq, f"no '{nome}': pergunta sem texto")
    if len(texto) > MAX_TEXTO_PERGUNTA:
        rel.erro(arq, f"no '{nome}': texto com {len(texto)} chars (limite {MAX_TEXTO_PERGUNTA})")

    opcoes = no.get("opcoes")
    if not isinstance(opcoes, list) or not opcoes:
        rel.erro(arq, f"no '{nome}': pergunta sem opcoes")
        return
    if len(opcoes) < 2:
        rel.erro(arq, f"no '{nome}': pergunta precisa de ao menos 2 opcoes")
    if len(opcoes) > MAX_OPCOES:
        rel.erro(arq, f"no '{nome}': {len(opcoes)} opcoes (limite {MAX_OPCOES} para botoes do WhatsApp)")

    vistos = set()
    for opt in opcoes:
        oid = opt.get("id", "")
        rotulo = opt.get("rotulo", "")
        proximo = opt.get("proximo", "")
        if not oid:
            rel.erro(arq, f"no '{nome}': opcao sem id")
        elif oid in vistos:
            rel.erro(arq, f"no '{nome}': id de opcao duplicado '{oid}'")
        vistos.add(oid)

        if not rotulo:
            rel.erro(arq, f"no '{nome}': opcao '{oid}' sem rotulo")
        elif len(rotulo) > MAX_ROTULO:
            rel.erro(arq, f"no '{nome}': rotulo '{rotulo}' tem {len(rotulo)} chars (limite {MAX_ROTULO})")

        if proximo not in nos:
            rel.erro(arq, f"no '{nome}': opcao '{oid}' aponta para no inexistente '{proximo}'")


def validar_no_orientacao(nome, no, arq, rel):
    texto = no.get("texto", "")
    if not texto:
        rel.erro(arq, f"no '{nome}': orientacao sem texto")
    if len(texto) > MAX_TEXTO_ORIENTACAO:
        rel.erro(arq, f"no '{nome}': texto com {len(texto)} chars (limite {MAX_TEXTO_ORIENTACAO})")

    enc = no.get("encaminhamento")
    if enc not in ENCAMINHAMENTOS:
        rel.erro(arq, f"no '{nome}': encaminhamento invalido '{enc}'")

    if enc == "agendamento_presencial" and not no.get("documentos"):
        rel.aviso(arq, f"no '{nome}': encaminha para atendimento presencial sem listar documentos")

    for chave in ("documentos", "ressalvas"):
        if chave in no and not isinstance(no[chave], list):
            rel.erro(arq, f"no '{nome}': '{chave}' deve ser lista")

    for item in no.get("base_legal", []):
        if not item.get("norma") or not item.get("dispositivo"):
            rel.erro(arq, f"no '{nome}': base_legal exige 'norma' e 'dispositivo'")


def alcancaveis(nos, inicial):
    vistos, pilha = set(), [inicial]
    while pilha:
        atual = pilha.pop()
        if atual in vistos or atual not in nos:
            continue
        vistos.add(atual)
        for opt in nos[atual].get("opcoes", []):
            pilha.append(opt.get("proximo"))
    return vistos


def validar_fluxo(caminho, rel):
    arq = os.path.basename(caminho)
    fluxo = carregar(caminho, rel)
    if fluxo is None:
        return None

    obrigatorios = ["id", "versao", "titulo", "categoria", "fonte", "no_inicial", "nos"]
    for campo in obrigatorios:
        if campo not in fluxo:
            rel.erro(arq, f"campo obrigatorio ausente: '{campo}'")
    if "nos" not in fluxo or "no_inicial" not in fluxo:
        return fluxo

    esperado = arq[:-5]
    if fluxo.get("id") != esperado:
        rel.erro(arq, f"id '{fluxo.get('id')}' difere do nome do arquivo '{esperado}'")

    if fluxo.get("categoria") not in CATEGORIAS:
        rel.erro(arq, f"categoria invalida: '{fluxo.get('categoria')}'")

    nos = fluxo["nos"]
    inicial = fluxo["no_inicial"]
    if inicial not in nos:
        rel.erro(arq, f"no_inicial '{inicial}' nao existe em 'nos'")
        return fluxo

    if nos[inicial].get("tipo") != "pergunta":
        rel.aviso(arq, "o no inicial nao e uma pergunta")

    tem_orientacao = False
    for nome, no in nos.items():
        tipo = no.get("tipo")
        if tipo == "pergunta":
            validar_no_pergunta(nome, no, nos, arq, rel)
        elif tipo == "orientacao":
            tem_orientacao = True
            validar_no_orientacao(nome, no, arq, rel)
            if "opcoes" in no:
                rel.erro(arq, f"no '{nome}': orientacao e terminal e nao pode ter opcoes")
        else:
            rel.erro(arq, f"no '{nome}': tipo invalido '{tipo}'")

    if not tem_orientacao:
        rel.erro(arq, "o fluxo nao tem nenhum no de orientacao (nao gera resposta final)")

    orfaos = set(nos) - alcancaveis(nos, inicial)
    for nome in sorted(orfaos):
        rel.erro(arq, f"no '{nome}' e inalcancavel a partir de '{inicial}'")

    return fluxo


def validar_menu(caminho, ids, rel):
    arq = os.path.basename(caminho)
    menu = carregar(caminho, rel)
    if menu is None:
        return

    globais = menu.get("textos_globais", {})
    for chave in ("saudacao", "aviso_orientativo", "aviso_llm", "texto_menu"):
        if not globais.get(chave):
            rel.erro(arq, f"textos_globais.{chave} ausente ou vazio")

    referenciados = set()
    for item in menu.get("itens", []):
        fid = item.get("fluxo")
        rotulo = item.get("rotulo", "")
        descricao = item.get("descricao", "")
        if fid not in ids:
            rel.erro(arq, f"item aponta para fluxo inexistente '{fid}'")
        if fid in referenciados:
            rel.erro(arq, f"fluxo '{fid}' referenciado mais de uma vez")
        referenciados.add(fid)
        if len(rotulo) > MAX_ROTULO_MENU:
            rel.erro(arq, f"rotulo '{rotulo}' tem {len(rotulo)} chars (limite {MAX_ROTULO_MENU})")
        if len(descricao) > MAX_DESCRICAO_MENU:
            rel.erro(arq, f"descricao de '{fid}' tem {len(descricao)} chars (limite {MAX_DESCRICAO_MENU})")

    total = len(menu.get("itens", [])) + (1 if menu.get("opcao_outro") else 0)
    if total > 10:
        rel.erro(arq, f"{total} itens no menu (limite de 10 numa lista do WhatsApp)")

    for fid in sorted(ids - referenciados):
        rel.aviso(arq, f"fluxo '{fid}' existe mas nao aparece no menu")


def main():
    parser = argparse.ArgumentParser(description="Valida os fluxos decisorios do PROCON.")
    parser.add_argument("--dir", default="data", help="diretorio com menu.json e fluxos/ (padrao: data)")
    args = parser.parse_args()

    base = args.dir
    dir_fluxos = os.path.join(base, "fluxos")
    if not os.path.isdir(dir_fluxos):
        print(f"ERRO: diretorio nao encontrado: {dir_fluxos}", file=sys.stderr)
        return 1

    rel = Relatorio()
    ids = set()
    arquivos = sorted(f for f in os.listdir(dir_fluxos) if f.endswith(".json"))

    total_nos = 0
    total_orientacoes = 0
    for nome in arquivos:
        fluxo = validar_fluxo(os.path.join(dir_fluxos, nome), rel)
        if fluxo and "id" in fluxo:
            if fluxo["id"] in ids:
                rel.erro(nome, f"id duplicado entre arquivos: '{fluxo['id']}'")
            ids.add(fluxo["id"])
        if fluxo and "nos" in fluxo:
            total_nos += len(fluxo["nos"])
            total_orientacoes += sum(
                1 for n in fluxo["nos"].values() if n.get("tipo") == "orientacao"
            )

    caminho_menu = os.path.join(base, "menu.json")
    if os.path.isfile(caminho_menu):
        validar_menu(caminho_menu, ids, rel)
    else:
        rel.erro("menu.json", "arquivo nao encontrado")

    print(f"Fluxos analisados: {len(arquivos)}")
    print(f"Nos: {total_nos} (orientacoes finais: {total_orientacoes})")
    print()

    for aviso in rel.avisos:
        print(f"  AVISO  {aviso}")
    for erro in rel.erros:
        print(f"  ERRO   {erro}")

    if rel.erros:
        print(f"\nFALHOU: {len(rel.erros)} erro(s), {len(rel.avisos)} aviso(s).")
        return 1

    print(f"OK: nenhum erro. {len(rel.avisos)} aviso(s).")
    return 0


if __name__ == "__main__":
    sys.exit(main())
