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
import type { RepositorioAgendamentos } from '../agendamento/index.js';
import type { ClienteWhatsApp } from './cliente.js';
import { formatarTurno } from './formatador.js';

/** Depois desse tempo sem mensagens, o proximo "oi" abre uma conversa nova. */
export const INATIVIDADE_PADRAO_MS = 30 * 60 * 1000;

export const TEXTO_TIPO_NAO_SUPORTADO =
  'Por enquanto consigo ler apenas mensagens de texto. Digite *menu* para ver os assuntos.';

export const OPCAO_AGENDAR = 'opcao_agendar';

export interface EstadoAgendamentoWhatsApp {
  etapa: 'aguardando_nome' | 'aguardando_cpf' | 'aguardando_data' | 'aguardando_horario';
  nome?: string;
  cpf?: string;
  data?: string;
  assunto?: string;
  horariosDisponiveis?: string[];
}

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
  agendamentos?: RepositorioAgendamentos;
  cliente?: ClienteWhatsApp;
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
  private readonly agendamentosEmAndamento = new Map<string, EstadoAgendamentoWhatsApp>();
  private readonly inatividadeMs: number;
  private readonly agora: () => number;

  constructor(private readonly opcoes: OpcoesAdaptador) {
    this.inatividadeMs = opcoes.inatividadeMs ?? INATIVIDADE_PADRAO_MS;
    this.agora = opcoes.agora ?? Date.now;
  }

  /**
   * Ponto de entrada Meta Cloud API. Mensagens do mesmo telefone sao processadas em fila,
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
      .then(async () => {
        const partes = await this.executarTurno(mensagem);
        if (this.opcoes.cliente) {
          for (const parte of partes) {
            await this.opcoes.cliente.enviarTexto(mensagem.telefone, parte);
            console.log(`[whatsapp] Parte enviada com sucesso para ${mascararTelefone(mensagem.telefone)}!`);
          }
        }
      })
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

  /**
   * Ponto de entrada Twilio. Processa a mensagem na fila do telefone e retorna
   * o array de textos gerados para resposta sincrona via TwiML.
   */
  async receberTwilio(mensagem: MensagemRecebida): Promise<string[]> {
    console.log(`[whatsapp] receberTwilio chamado: id=${mensagem.id} de=${mascararTelefone(mensagem.telefone)}`);
    if (this.jaProcessada(mensagem.id)) {
      console.log(`[whatsapp] mensagem ${mensagem.id} ja processada, ignorando.`);
      return [];
    }

    const anterior = this.filas.get(mensagem.telefone) ?? Promise.resolve();
    let partes: string[] = [];
    const atual = anterior
      .then(async () => {
        partes = await this.executarTurno(mensagem);
      })
      .catch((erro) => {
        console.error(
          `[whatsapp] falha ao processar mensagem Twilio de ${mascararTelefone(mensagem.telefone)}:`,
          erro,
        );
      });

    this.filas.set(mensagem.telefone, atual);
    await atual;
    if (this.filas.get(mensagem.telefone) === atual) this.filas.delete(mensagem.telefone);
    return partes;
  }

  /**
   * Executa a logica de negocio do turno (motor de conversa + formatacao + agendamento),
   * isolada do meio de transporte (Meta REST, Twilio TwiML, etc).
   */
  async executarTurno(mensagem: MensagemRecebida): Promise<string[]> {
    const { motor, sessoes } = this.opcoes;
    const { telefone } = mensagem;
    console.log(`[whatsapp] Iniciando processamento para ${mascararTelefone(telefone)}: "${mensagem.texto}"`);

    if (mensagem.tipo !== 'text' || !mensagem.texto?.trim()) {
      console.log('[whatsapp] Tipo nao suportado, enviando aviso.');
      return [TEXTO_TIPO_NAO_SUPORTADO];
    }

    const texto = mensagem.texto.trim();

    // Se o usuario ja estiver em um fluxo de agendamento presencial no WhatsApp (RF07)
    if (this.agendamentosEmAndamento.has(telefone)) {
      const respAgendamento = await this.processarAgendamento(telefone, texto);
      if (respAgendamento) return respAgendamento;
    }

    const conversa = this.conversas.get(telefone);
    const sessao = conversa ? await sessoes.buscar(conversa.sessaoId) : undefined;

    // Verifica se o cidadao escolheu a opcao de agendar atendimento presencial
    const opcao = conversa ? this.opcaoPorNumero(texto, conversa) : undefined;
    const querAgendar =
      opcao?.id === OPCAO_AGENDAR ||
      (normalizar(texto) === 'agendar' && Boolean(this.opcoes.agendamentos));

    if (querAgendar && this.opcoes.agendamentos) {
      this.agendamentosEmAndamento.set(telefone, {
        etapa: 'aguardando_nome',
        assunto: 'Atendimento Presencial PROCON Jacareí',
      });
      return [
        `📅 *Agendamento Presencial - PROCON Jacareí*\n\n` +
          `Vamos realizar o agendamento do seu atendimento presencial.\n\n` +
          `Por favor, digite seu *Nome Completo*:\n` +
          `_(Ou digite *cancelar* para voltar ao menu)_`,
      ];
    }

    const resultado =
      !conversa || !sessao || this.deveReiniciar(sessao, conversa, texto)
        ? await motor.iniciar(telefone)
        : await motor.responder(sessao.id, this.interpretar(texto, conversa));

    // Se o encaminhamento for para atendimento presencial, adiciona a opcao de agendamento (RF07)
    if (this.opcoes.agendamentos) {
      const msgEnc = resultado.novasMensagens.find(
        (m) => m.tipo === 'encaminhamento' && m.encaminhamento === 'agendamento_presencial',
      );
      if (msgEnc) {
        msgEnc.opcoes = [
          { id: OPCAO_AGENDAR, rotulo: 'Solicitar Agendamento Presencial Agora' },
          ...(msgEnc.opcoes ?? []),
        ];
      }
    }

    this.conversas.set(telefone, {
      sessaoId: resultado.sessao.id,
      opcoesPendentes: ultimasOpcoes(resultado.novasMensagens),
    });

    const partes = formatarTurno(resultado.novasMensagens);
    console.log(`[whatsapp] Motor respondeu. Turno com ${partes.length} parte(s).`);
    return partes;
  }

  /** Coleta conversacional dos dados para agendamento presencial no WhatsApp (RF07) */
  private async processarAgendamento(telefone: string, texto: string): Promise<string[] | undefined> {
    const estado = this.agendamentosEmAndamento.get(telefone);
    if (!estado) return undefined;

    const textoLimpo = texto.trim();
    const textoNorm = normalizar(textoLimpo);

    if (textoNorm === 'cancelar' || textoNorm === 'sair' || textoNorm === 'menu') {
      this.agendamentosEmAndamento.delete(telefone);
      return [
        'Agendamento cancelado. Digite *menu* para ver os assuntos ou *sair* para finalizar.',
      ];
    }

    if (estado.etapa === 'aguardando_nome') {
      if (textoLimpo.length < 3) {
        return ['Por favor, informe seu nome completo (mínimo de 3 letras):'];
      }
      estado.nome = textoLimpo;
      estado.etapa = 'aguardando_cpf';
      return [
        `Obrigado, *${estado.nome}*!\n\nAgora digite o seu *CPF* (apenas números ou com pontos e traço):`,
      ];
    }

    if (estado.etapa === 'aguardando_cpf') {
      const digitos = textoLimpo.replace(/\D/g, '');
      if (digitos.length !== 11) {
        return [
          '⚠️ CPF inválido. O CPF deve conter 11 dígitos numéricos.\n\nPor favor, digite seu *CPF* novamente:',
        ];
      }
      const cpfFormatado = `${digitos.slice(0, 3)}.${digitos.slice(3, 6)}.${digitos.slice(6, 9)}-${digitos.slice(9)}`;
      estado.cpf = cpfFormatado;
      estado.etapa = 'aguardando_data';

      const proximoDia = obterProximoDiaUtil();
      return [
        `CPF registrado: *${cpfFormatado}*.\n\nPara qual *data* você gostaria de agendar?\n_(Atendimentos de segunda a sexta-feira)_\n\nDigite a data no formato *DD/MM/AAAA* (exemplo: *${proximoDia}*):`,
      ];
    }

    if (estado.etapa === 'aguardando_data') {
      const dataIso = normalizarData(textoLimpo);
      if (!dataIso) {
        return [
          `⚠️ Formato de data não reconhecido.\n\nPor favor, digite a data no formato *DD/MM/AAAA* (exemplo: *${obterProximoDiaUtil()}*):`,
        ];
      }

      const [ano, mes, dia] = dataIso.split('-').map(Number);
      const dataObj = new Date(ano!, mes! - 1, dia!);
      const diaSemana = dataObj.getDay();
      if (diaSemana === 0 || diaSemana === 6) {
        return [
          '⚠️ O PROCON Jacareí não realiza atendimentos aos sábados e domingos.\n\nPor favor, escolha uma data de *segunda a sexta-feira* (DD/MM/AAAA):',
        ];
      }

      const agendamentosRepo = this.opcoes.agendamentos;
      if (!agendamentosRepo) {
        this.agendamentosEmAndamento.delete(telefone);
        return ['Serviço de agendamento indisponível no momento.'];
      }

      const slots = await agendamentosRepo.listarHorarios(dataIso);
      const disponiveis = slots.filter((s) => s.disponivel).map((s) => s.horario);

      if (disponiveis.length === 0) {
        return [
          `⚠️ Todos os horários para o dia *${formatarDataBr(dataIso)}* já estão ocupados.\n\nPor favor, informe outra data (DD/MM/AAAA):`,
        ];
      }

      estado.data = dataIso;
      estado.horariosDisponiveis = disponiveis;
      estado.etapa = 'aguardando_horario';

      const lista = disponiveis.map((h, i) => `*${i + 1}.* ${h}`).join('\n');
      return [
        `Horários disponíveis para *${formatarDataBr(dataIso)}*:\n\n${lista}\n\n_Digite o número do horário desejado:_`,
      ];
    }

    if (estado.etapa === 'aguardando_horario') {
      const disponiveis = estado.horariosDisponiveis ?? [];
      let horarioEscolhido: string | undefined;

      if (/^\d+$/.test(textoLimpo)) {
        const indice = Number(textoLimpo) - 1;
        horarioEscolhido = disponiveis[indice];
      } else {
        horarioEscolhido = disponiveis.find((h) => h === textoLimpo);
      }

      if (!horarioEscolhido) {
        const lista = disponiveis.map((h, i) => `*${i + 1}.* ${h}`).join('\n');
        return [
          `⚠️ Opção inválida. Por favor, digite o número correspondente ao horário:\n\n${lista}`,
        ];
      }

      const agendamentosRepo = this.opcoes.agendamentos;
      if (!agendamentosRepo) {
        this.agendamentosEmAndamento.delete(telefone);
        return ['Serviço de agendamento indisponível no momento.'];
      }

      try {
        const novo = await agendamentosRepo.criar({
          usuario: telefone,
          nome: estado.nome!,
          cpf: estado.cpf!,
          data: estado.data!,
          horario: horarioEscolhido,
          assunto: estado.assunto || 'Atendimento Presencial PROCON Jacareí',
        });

        this.agendamentosEmAndamento.delete(telefone);

        const cpfExibicao =
          novo.cpf.length === 11
            ? `${novo.cpf.slice(0, 3)}.${novo.cpf.slice(3, 6)}.${novo.cpf.slice(6, 9)}-${novo.cpf.slice(9)}`
            : novo.cpf;

        return [
          `✅ *Agendamento Confirmado com Sucesso!*\n\n` +
            `📋 *Protocolo:* ${novo.protocolo}\n` +
            `👤 *Nome:* ${novo.nome}\n` +
            `📄 *CPF:* ${cpfExibicao}\n` +
            `🗓️ *Data:* ${formatarDataBr(novo.data)} às ${novo.horario}\n` +
            `📍 *Local:* PROCON de Jacareí\n\n` +
            `📌 *Importante:* Compareça com 15 minutos de antecedência munido de documento oficial com foto, comprovante de residência e documentos do seu caso.\n\n` +
            `_Digite *menu* para iniciar uma nova consulta ou *sair* para finalizar._`,
        ];
      } catch (erro: any) {
        return [
          `⚠️ Não foi possível confirmar: ${erro.message ?? 'Horário indisponível'}.\nPor favor, escolha outro horário ou informe outra data:`,
        ];
      }
    }

    return undefined;
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

/**
 * Extrai os dados de uma mensagem recebida via webhook da Twilio
 * (Content-Type: application/x-www-form-urlencoded).
 */
export function extrairMensagemTwilio(corpo: Record<string, any>): MensagemRecebida | undefined {
  if (!corpo || !corpo.From) return undefined;
  const rawFrom = String(corpo.From).trim();
  const rawBody = corpo.Body !== undefined ? String(corpo.Body) : '';
  const id = String(corpo.MessageSid || corpo.SmsMessageSid || `twilio-${Date.now()}`);
  // Remove o prefixo whatsapp: e caracteres nao numericos (ex.: whatsapp:+5512991466308 -> 5512991466308)
  const telefone = rawFrom.replace(/^whatsapp:/i, '').replace(/\D/g, '');
  if (!telefone) return undefined;

  return {
    id,
    telefone,
    tipo: 'text',
    texto: rawBody,
  };
}

/**
 * Gera o documento XML TwiML para resposta sincrona ao webhook da Twilio.
 * Suporta multiplas tags <Message> para entregar mensagens particionadas.
 */
export function gerarTwiml(mensagens: string[]): string {
  if (mensagens.length === 0) {
    return '<?xml version="1.0" encoding="UTF-8"?>\n<Response/>';
  }
  const tags = mensagens
    .map((msg) => `<Message><Body><![CDATA[${msg}]]></Body></Message>`)
    .join('\n  ');
  return `<?xml version="1.0" encoding="UTF-8"?>\n<Response>\n  ${tags}\n</Response>`;
}

export function obterProximoDiaUtil(): string {
  const d = new Date();
  d.setDate(d.getDate() + 1);
  while (d.getDay() === 0 || d.getDay() === 6) {
    d.setDate(d.getDate() + 1);
  }
  const dia = String(d.getDate()).padStart(2, '0');
  const mes = String(d.getMonth() + 1).padStart(2, '0');
  const ano = d.getFullYear();
  return `${dia}/${mes}/${ano}`;
}

export function normalizarData(texto: string): string | undefined {
  const matchBr = texto.match(/^(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{4})$/);
  if (matchBr) {
    const dia = matchBr[1]!.padStart(2, '0');
    const mes = matchBr[2]!.padStart(2, '0');
    const ano = matchBr[3]!;
    return `${ano}-${mes}-${dia}`;
  }
  const matchIso = texto.match(/^(\d{4})[\/\-](\d{1,2})[\/\-](\d{1,2})$/);
  if (matchIso) {
    const ano = matchIso[1]!;
    const mes = matchIso[2]!.padStart(2, '0');
    const dia = matchIso[3]!.padStart(2, '0');
    return `${ano}-${mes}-${dia}`;
  }
  return undefined;
}

export function formatarDataBr(dataIso: string): string {
  const [ano, mes, dia] = dataIso.split('-');
  return `${dia}/${mes}/${ano}`;
}


