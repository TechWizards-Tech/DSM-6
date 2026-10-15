/**
 * Adaptador WhatsApp -> motor de conversa (RF01, RP01).
 *
 * Cumpre o que o RP01 pede da integracao: recebimento e envio de mensagens,
 * identificacao do usuario (o telefone) e controle de sessoes. Ele NAO decide
 * nada sobre os fluxos: so traduz a mensagem recebida em uma `Entrada` e
 * chama os mesmos metodos que o simulador web usa (`iniciar` / `responder`).
 */
import type { Entrada, MotorConversa } from '../chatbot/motor.js';
import type { Mensagem, OpcaoApresentada, RepositorioSessoes, Sessao } from '../chatbot/sessao.js';
import { normalizar, type RepositorioFluxos } from '../fluxos/repositorio.js';
import type { ClienteWhatsApp } from './cliente.js';
import { formatarTurno } from './formatador.js';

/** Depois desse tempo sem mensagens, o proximo "oi" abre uma conversa nova. */
export const INATIVIDADE_PADRAO_MS = 30 * 60 * 1000;

export const TEXTO_TIPO_NAO_SUPORTADO =
  'Por enquanto consigo ler apenas mensagens de texto. Digite *menu* para ver os assuntos.';

/** Mensagem recebida, ja extraida do payload do webhook. */
export interface MensagemRecebida {
  /** Id da mensagem na Meta (wamid). Usado para ignorar reentregas. */
  id: string;
  /** Telefone do cidadao, no formato enviado pela Meta (ex.: 5512999990000). */
  telefone: string;
  tipo: string;
  texto?: string;
}

export interface OpcoesAdaptador {
  motor: MotorConversa;
  sessoes: RepositorioSessoes;
  fluxos: RepositorioFluxos;
  cliente: ClienteWhatsApp;
  inatividadeMs?: number;
  agora?: () => number;
}

interface Conversa {
  sessaoId: string;
  /** Opcoes da ultima mensagem enviada: e a elas que "1", "2", "3" se referem. */
  opcoesPendentes: OpcaoApresentada[];
}

const MAXIMO_IDS_LEMBRADOS = 1000;

/** LGPD (RNF03): logs nunca recebem o telefone completo. */
export function mascararTelefone(telefone: string): string {
  if (telefone.length <= 4) return '****';
  return `${'*'.repeat(telefone.length - 4)}${telefone.slice(-4)}`;
}

export class AdaptadorWhatsApp {
  private readonly conversas = new Map<string, Conversa>();
  private readonly filas = new Map<string, Promise<void>>();
  private readonly idsProcessados = new Set<string>();
  private readonly inatividadeMs: number;
  private readonly agora: () => number;

  constructor(private readonly opcoes: OpcoesAdaptador) {
    this.inatividadeMs = opcoes.inatividadeMs ?? INATIVIDADE_PADRAO_MS;
    this.agora = opcoes.agora ?? Date.now;
  }

  /**
   * Ponto de entrada. Mensagens do mesmo telefone sao processadas em fila,
   * para duas mensagens rapidas nao avancarem a mesma sessao ao mesmo tempo.
   */
  receber(mensagem: MensagemRecebida): Promise<void> {
    console.log(`[whatsapp] receber chamado: id=${mensagem.id} de=${mascararTelefone(mensagem.telefone)} tipo=${mensagem.tipo}`);
    if (this.jaProcessada(mensagem.id)) {
      console.log(`[whatsapp] mensagem ${mensagem.id} ja processada, ignorando.`);
      return Promise.resolve();
    }

    const anterior = this.filas.get(mensagem.telefone) ?? Promise.resolve();
    const atual = anterior
      .then(() => this.processar(mensagem))
      .catch((erro) => {
        console.error(
          `[whatsapp] falha ao processar mensagem de ${mascararTelefone(mensagem.telefone)}:`,
          erro,
        );
      });

    this.filas.set(mensagem.telefone, atual);
    void atual.then(() => {
      if (this.filas.get(mensagem.telefone) === atual) this.filas.delete(mensagem.telefone);
    });
    return atual;
  }

  private async processar(mensagem: MensagemRecebida): Promise<void> {
    const { motor, sessoes, cliente } = this.opcoes;
    const { telefone } = mensagem;
    console.log(`[whatsapp] Iniciando processamento para ${mascararTelefone(telefone)}: "${mensagem.texto}"`);

    if (mensagem.tipo !== 'text' || !mensagem.texto?.trim()) {
      console.log('[whatsapp] Tipo nao suportado, enviando aviso.');
      await cliente.enviarTexto(telefone, TEXTO_TIPO_NAO_SUPORTADO);
      return;
    }

    const texto = mensagem.texto.trim();
    const conversa = this.conversas.get(telefone);
    const sessao = conversa ? await sessoes.buscar(conversa.sessaoId) : undefined;

    const resultado =
      !conversa || !sessao || this.deveReiniciar(sessao, conversa, texto)
        ? await motor.iniciar(telefone)
        : await motor.responder(sessao.id, this.interpretar(texto, conversa));

    this.conversas.set(telefone, {
      sessaoId: resultado.sessao.id,
      opcoesPendentes: ultimasOpcoes(resultado.novasMensagens),
    });

    const partes = formatarTurno(resultado.novasMensagens);
    console.log(`[whatsapp] Motor respondeu. Enviando ${partes.length} parte(s) para o WhatsApp...`);
    for (const parte of partes) {
      await cliente.enviarTexto(telefone, parte);
      console.log(`[whatsapp] Parte enviada com sucesso para ${mascararTelefone(telefone)}!`);
    }
  }

  /** Numero valido vira a opcao correspondente; o resto vai como texto para o motor. */
  private interpretar(texto: string, conversa: Conversa): Entrada {
    const opcao = this.opcaoPorNumero(texto, conversa);
    return opcao ? { tipo: 'opcao', opcaoId: opcao.id } : { tipo: 'texto', texto };
  }

  private opcaoPorNumero(texto: string, conversa: Conversa): OpcaoApresentada | undefined {
    if (!/^\d+$/.test(texto)) return undefined;
    return conversa.opcoesPendentes[Number(texto) - 1];
  }

  /**
   * No WhatsApp o cidadao volta dias depois e manda "oi". Nesses casos a
   * conversa recomeca do inicio em vez de responder "opcao invalida":
   * - sessao parada ha mais tempo que o limite de inatividade;
   * - conversa ja finalizada e a mensagem nao e uma das opcoes oferecidas
   *   (voltar ao menu / encerrar) nem um comando global.
   */
  private deveReiniciar(sessao: Sessao, conversa: Conversa, texto: string): boolean {
    const ultimaAtividade = Date.parse(sessao.atualizadaEm);
    if (Number.isFinite(ultimaAtividade) && this.agora() - ultimaAtividade > this.inatividadeMs) {
      return true;
    }

    if (sessao.etapa !== 'finalizada') return false;
    return !this.opcaoPorNumero(texto, conversa) && !this.ehComandoGlobal(texto);
  }

  private ehComandoGlobal(texto: string): boolean {
    const entrada = normalizar(texto);
    return Object.values(this.opcoes.fluxos.menu.comandos_globais)
      .flat()
      .some((sinonimo) => normalizar(sinonimo) === entrada);
  }

  private jaProcessada(id: string): boolean {
    if (!id) return false;
    if (this.idsProcessados.has(id)) return true;
    this.idsProcessados.add(id);
    if (this.idsProcessados.size > MAXIMO_IDS_LEMBRADOS) {
      const maisAntigo = this.idsProcessados.values().next().value;
      if (maisAntigo !== undefined) this.idsProcessados.delete(maisAntigo);
    }
    return false;
  }
}

function ultimasOpcoes(mensagens: Mensagem[]): OpcaoApresentada[] {
  const comOpcoes = [...mensagens].reverse().find((mensagem) => mensagem.opcoes?.length);
  return comOpcoes?.opcoes ?? [];
}

// ------------------------------------------------------------ payload da Meta

interface PayloadWebhook {
  object?: string;
  entry?: Array<{
    changes?: Array<{
      value?: {
        messages?: Array<{
          id?: string;
          from?: string;
          type?: string;
          text?: { body?: string };
        }>;
      };
    }>;
  }>;
}

/**
 * Extrai as mensagens de um webhook da Cloud API. Notificacoes de status
 * (entregue, lida...) chegam no mesmo endpoint e sao ignoradas aqui.
 */
export function extrairMensagensRecebidas(payload: unknown): MensagemRecebida[] {
  const corpo = payload as PayloadWebhook;
  if (corpo?.object !== 'whatsapp_business_account') return [];

  const recebidas: MensagemRecebida[] = [];
  for (const entrada of corpo.entry ?? []) {
    for (const mudanca of entrada.changes ?? []) {
      for (const mensagem of mudanca.value?.messages ?? []) {
        if (!mensagem.from) continue;
        recebidas.push({
          id: mensagem.id ?? '',
          telefone: mensagem.from,
          tipo: mensagem.type ?? 'desconhecido',
          texto: mensagem.text?.body,
        });
      }
    }
  }
  return recebidas;
}
