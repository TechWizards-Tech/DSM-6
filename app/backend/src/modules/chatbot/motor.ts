/**
 * Logica do chatbot (RP03).
 *
 * O motor e uma maquina de estados sobre os fluxos do PROCON. Ele nao conhece
 * WhatsApp, HTTP nem banco: recebe uma entrada, avanca o estado da sessao e
 * devolve as mensagens a enviar. E isso que permite trocar o simulador pela
 * Cloud API na Sprint 2 sem reescrever nada aqui.
 *
 * Sequencia coberta (criterio de sucesso da Sprint 1):
 * mensagem -> sessao -> fluxo -> pergunta -> resposta -> proxima etapa ->
 * orientacao final -> registro
 */
import type { RepositorioFluxos } from '../fluxos/repositorio.js';
import { normalizar } from '../fluxos/repositorio.js';
import type { ChaveEncaminhamento, ComandoGlobal, No } from '../fluxos/tipos.js';
import type { ProvedorLlm } from '../llm/index.js';
import type { RepositorioInteracoes } from '../registro/index.js';
import type {
  Mensagem,
  OpcaoApresentada,
  RepositorioSessoes,
  Sessao,
  TipoMensagem,
} from './sessao.js';

/** Opcoes de controle, prefixadas para nunca colidir com um id vindo dos JSON. */
export const OPCAO_OUTRO = '__outro';
export const OPCAO_MENU = '__menu';
export const OPCAO_ENCERRAR = '__encerrar';

export type Entrada =
  | { tipo: 'opcao'; opcaoId: string }
  | { tipo: 'texto'; texto: string };

export interface ResultadoTurno {
  sessao: Sessao;
  /** So o que foi produzido neste turno. O historico completo fica na sessao. */
  novasMensagens: Mensagem[];
}

export class SessaoNaoEncontrada extends Error {
  constructor(id: string) {
    super(`Sessao "${id}" nao encontrada`);
    this.name = 'SessaoNaoEncontrada';
  }
}

interface ParcialMensagem {
  tipo: TipoMensagem;
  texto: string;
  opcoes?: OpcaoApresentada[];
  documentos?: string[];
  ressalvas?: string[];
  encaminhamento?: ChaveEncaminhamento;
  geradoPorLlm?: boolean;
  fluxoId?: string;
  noId?: string;
}

export class MotorConversa {
  constructor(
    private readonly fluxos: RepositorioFluxos,
    private readonly sessoes: RepositorioSessoes,
    private readonly interacoes: RepositorioInteracoes,
    private readonly llm: ProvedorLlm,
  ) {}

  /** Abre a conversa: saudacao + menu de assuntos (RF02). */
  async iniciar(usuario: string): Promise<ResultadoTurno> {
    const sessao = await this.sessoes.criar(usuario);
    const novasMensagens: Mensagem[] = [
      this.emitir(sessao, { tipo: 'texto', texto: this.fluxos.menu.textos_globais.saudacao }),
      this.emitirMenu(sessao),
    ];

    await this.interacoes.registrar({
      sessaoId: sessao.id,
      usuario: sessao.usuario,
      evento: 'conversa_iniciada',
    });
    await this.sessoes.salvar(sessao);
    return { sessao, novasMensagens };
  }

  /** Processa uma entrada do cidadao e avanca a conversa. */
  async responder(sessaoId: string, entrada: Entrada): Promise<ResultadoTurno> {
    const sessao = await this.sessoes.buscar(sessaoId);
    if (!sessao) throw new SessaoNaoEncontrada(sessaoId);

    const novasMensagens: Mensagem[] = [];
    const eco = this.textoDoCidadao(sessao, entrada);
    novasMensagens.push(this.emitir(sessao, { tipo: 'texto', texto: eco }, 'cidadao'));

    if (entrada.tipo === 'texto') {
      const comando = this.identificarComando(entrada.texto);
      if (comando) {
        novasMensagens.push(...(await this.executarComando(sessao, comando)));
        await this.sessoes.salvar(sessao);
        return { sessao, novasMensagens };
      }
    }

    const opcaoId =
      entrada.tipo === 'opcao' ? entrada.opcaoId : this.resolverOpcaoPorTexto(sessao, entrada.texto);

    if (opcaoId === null) {
      // Texto livre no menu ainda pode achar um fluxo pelas palavras-chave.
      if (sessao.etapa === 'menu' && entrada.tipo === 'texto') {
        const fluxo = this.fluxos.rotearPorTexto(entrada.texto);
        if (fluxo) {
          novasMensagens.push(...(await this.entrarNoFluxo(sessao, fluxo.id)));
          await this.sessoes.salvar(sessao);
          return { sessao, novasMensagens };
        }
      }
      novasMensagens.push(...(await this.tratarEntradaInvalida(sessao)));
      await this.sessoes.salvar(sessao);
      return { sessao, novasMensagens };
    }

    novasMensagens.push(...(await this.processarOpcao(sessao, opcaoId)));
    await this.sessoes.salvar(sessao);
    return { sessao, novasMensagens };
  }

  // --------------------------------------------------------------- roteamento

  private async processarOpcao(sessao: Sessao, opcaoId: string): Promise<Mensagem[]> {
    if (opcaoId === OPCAO_MENU) return this.voltarAoMenu(sessao);
    if (opcaoId === OPCAO_ENCERRAR) return this.encerrar(sessao);

    if (sessao.etapa === 'menu') {
      if (opcaoId === OPCAO_OUTRO) return this.tratarOutroAssunto(sessao);
      if (this.fluxos.buscarFluxo(opcaoId)) return this.entrarNoFluxo(sessao, opcaoId);
      return this.tratarEntradaInvalida(sessao);
    }

    if (sessao.etapa === 'em_fluxo') return this.avancarNoFluxo(sessao, opcaoId);

    // Conversa ja finalizada: so sobra o controle (menu / encerrar).
    return this.tratarEntradaInvalida(sessao);
  }

  private async entrarNoFluxo(sessao: Sessao, fluxoId: string): Promise<Mensagem[]> {
    const fluxo = this.fluxos.buscarFluxo(fluxoId);
    if (!fluxo) return this.tratarEntradaInvalida(sessao);

    sessao.etapa = 'em_fluxo';
    sessao.fluxoId = fluxo.id;
    sessao.noAtual = fluxo.no_inicial;
    sessao.historico = [];

    await this.interacoes.registrar({
      sessaoId: sessao.id,
      usuario: sessao.usuario,
      evento: 'fluxo_escolhido',
      fluxoId: fluxo.id,
      noId: fluxo.no_inicial,
    });

    return this.emitirNoAtual(sessao);
  }

  private async avancarNoFluxo(sessao: Sessao, opcaoId: string): Promise<Mensagem[]> {
    const no = this.noAtual(sessao);
    if (!no || no.tipo !== 'pergunta') return this.tratarEntradaInvalida(sessao);

    const opcao = no.opcoes.find((candidata) => candidata.id === opcaoId);
    if (!opcao) return this.tratarEntradaInvalida(sessao);

    sessao.historico.push({
      fluxoId: sessao.fluxoId!,
      noId: sessao.noAtual!,
      opcaoId: opcao.id,
      rotulo: opcao.rotulo,
      em: new Date().toISOString(),
    });

    await this.interacoes.registrar({
      sessaoId: sessao.id,
      usuario: sessao.usuario,
      evento: 'opcao_escolhida',
      fluxoId: sessao.fluxoId,
      noId: sessao.noAtual,
      opcaoId: opcao.id,
    });

    sessao.noAtual = opcao.proximo;
    return this.emitirNoAtual(sessao);
  }

  /** Renderiza o no em que a sessao esta, seja ele pergunta ou orientacao final. */
  private async emitirNoAtual(sessao: Sessao): Promise<Mensagem[]> {
    const no = this.noAtual(sessao);
    if (!no) return this.tratarEntradaInvalida(sessao);

    if (no.tipo === 'pergunta') {
      return [
        this.emitir(sessao, {
          tipo: 'pergunta',
          texto: no.texto,
          opcoes: no.opcoes.map(({ id, rotulo }) => ({ id, rotulo })),
          fluxoId: sessao.fluxoId,
          noId: sessao.noAtual,
        }),
      ];
    }

    const textos = this.fluxos.menu.textos_globais;
    const mensagens: Mensagem[] = [];

    // O texto vem do JSON do PROCON. A LLM, quando existir, so reformula (RP05).
    const explicacao = await this.llm.explicar(no.texto);

    mensagens.push(
      this.emitir(sessao, {
        tipo: 'orientacao',
        texto: explicacao.texto,
        documentos: no.documentos,
        ressalvas: no.ressalvas,
        geradoPorLlm: explicacao.geradoPorLlm,
        fluxoId: sessao.fluxoId,
        noId: sessao.noAtual,
      }),
    );

    // RNF04: deixar explicito o carater orientativo da resposta.
    mensagens.push(this.emitir(sessao, { tipo: 'aviso', texto: textos.aviso_orientativo }));

    // RNF05: so aparece se algum texto tiver passado por LLM.
    if (explicacao.geradoPorLlm) {
      mensagens.push(
        this.emitir(sessao, { tipo: 'aviso', texto: textos.aviso_llm, geradoPorLlm: true }),
      );
    }

    mensagens.push(this.emitirEncaminhamento(sessao, no.encaminhamento));

    await this.interacoes.registrar({
      sessaoId: sessao.id,
      usuario: sessao.usuario,
      evento: 'orientacao_entregue',
      fluxoId: sessao.fluxoId,
      noId: sessao.noAtual,
      encaminhamento: no.encaminhamento,
    });

    sessao.etapa = 'finalizada';
    return mensagens;
  }

  // ------------------------------------------------------ comandos e controle

  private identificarComando(texto: string): ComandoGlobal | undefined {
    const entrada = normalizar(texto);
    for (const [comando, sinonimos] of Object.entries(this.fluxos.menu.comandos_globais)) {
      if (sinonimos.some((sinonimo) => normalizar(sinonimo) === entrada)) {
        return comando as ComandoGlobal;
      }
    }
    return undefined;
  }

  private async executarComando(sessao: Sessao, comando: ComandoGlobal): Promise<Mensagem[]> {
    await this.interacoes.registrar({
      sessaoId: sessao.id,
      usuario: sessao.usuario,
      evento: 'comando_global',
      detalhe: comando,
      fluxoId: sessao.fluxoId,
      noId: sessao.noAtual,
    });

    switch (comando) {
      case 'menu':
        return this.voltarAoMenu(sessao);
      case 'encerrar':
        return this.encerrar(sessao);
      case 'atendente':
        // RF07 (agendamento) e da Sprint 2. Aqui a conversa apenas e encaminhada
        // para o atendimento presencial, que e o texto previsto no menu.json.
        sessao.etapa = 'finalizada';
        return [this.emitirEncaminhamento(sessao, 'agendamento_presencial')];
      case 'voltar':
        return this.voltarUmPasso(sessao);
    }
  }

  private async voltarUmPasso(sessao: Sessao): Promise<Mensagem[]> {
    const passo = sessao.historico.pop();
    if (!passo) return this.voltarAoMenu(sessao);

    sessao.etapa = 'em_fluxo';
    sessao.fluxoId = passo.fluxoId;
    sessao.noAtual = passo.noId;
    return this.emitirNoAtual(sessao);
  }

  private async voltarAoMenu(sessao: Sessao): Promise<Mensagem[]> {
    sessao.etapa = 'menu';
    sessao.fluxoId = undefined;
    sessao.noAtual = undefined;
    sessao.historico = [];
    return [this.emitirMenu(sessao)];
  }

  private async encerrar(sessao: Sessao): Promise<Mensagem[]> {
    sessao.etapa = 'finalizada';
    sessao.fluxoId = undefined;
    sessao.noAtual = undefined;

    await this.interacoes.registrar({
      sessaoId: sessao.id,
      usuario: sessao.usuario,
      evento: 'conversa_encerrada',
    });

    return [
      this.emitir(sessao, { tipo: 'texto', texto: this.fluxos.menu.textos_globais.encerramento }),
    ];
  }

  private async tratarOutroAssunto(sessao: Sessao): Promise<Mensagem[]> {
    const { opcao_outro: outro, textos_globais: textos } = this.fluxos.menu;
    sessao.etapa = 'finalizada';

    await this.interacoes.registrar({
      sessaoId: sessao.id,
      usuario: sessao.usuario,
      evento: 'orientacao_entregue',
      detalhe: 'opcao_outro',
      encaminhamento: outro.encaminhamento,
    });

    return [
      this.emitir(sessao, { tipo: 'orientacao', texto: outro.texto }),
      this.emitir(sessao, { tipo: 'aviso', texto: textos.aviso_orientativo }),
      this.emitirEncaminhamento(sessao, outro.encaminhamento),
    ];
  }

  private async tratarEntradaInvalida(sessao: Sessao): Promise<Mensagem[]> {
    await this.interacoes.registrar({
      sessaoId: sessao.id,
      usuario: sessao.usuario,
      evento: 'entrada_invalida',
      fluxoId: sessao.fluxoId,
      noId: sessao.noAtual,
    });

    const aviso = this.emitir(sessao, {
      tipo: 'texto',
      texto: this.fluxos.menu.textos_globais.opcao_invalida,
    });

    // Reapresenta o ponto atual para o cidadao nunca ficar sem saida.
    if (sessao.etapa === 'em_fluxo') return [aviso, ...(await this.emitirNoAtual(sessao))];
    return [aviso, this.emitirMenu(sessao)];
  }

  // ----------------------------------------------------------------- emissoes

  private emitirMenu(sessao: Sessao): Mensagem {
    const { itens, opcao_outro: outro, textos_globais: textos } = this.fluxos.menu;
    const opcoes: OpcaoApresentada[] = itens.map((item) => ({
      id: item.fluxo,
      rotulo: item.rotulo,
      descricao: item.descricao,
    }));
    opcoes.push({ id: OPCAO_OUTRO, rotulo: outro.rotulo, descricao: outro.descricao });

    return this.emitir(sessao, { tipo: 'menu', texto: textos.texto_menu, opcoes });
  }

  private emitirEncaminhamento(sessao: Sessao, chave: ChaveEncaminhamento): Mensagem {
    const encaminhamento = this.fluxos.menu.encaminhamentos[chave];
    return this.emitir(sessao, {
      tipo: 'encaminhamento',
      texto: encaminhamento.texto,
      encaminhamento: chave,
      opcoes: [
        { id: OPCAO_MENU, rotulo: 'Voltar ao menu' },
        { id: OPCAO_ENCERRAR, rotulo: 'Encerrar' },
      ],
      fluxoId: sessao.fluxoId,
      noId: sessao.noAtual,
    });
  }

  private emitir(
    sessao: Sessao,
    parcial: ParcialMensagem,
    autor: 'bot' | 'cidadao' = 'bot',
  ): Mensagem {
    const mensagem: Mensagem = {
      id: crypto.randomUUID(),
      sessaoId: sessao.id,
      autor,
      geradoPorLlm: false,
      criadaEm: new Date().toISOString(),
      ...parcial,
    };
    sessao.mensagens.push(mensagem);
    return mensagem;
  }

  // ----------------------------------------------------------------- auxiliar

  private noAtual(sessao: Sessao): No | undefined {
    if (!sessao.fluxoId || !sessao.noAtual) return undefined;
    return this.fluxos.buscarNo(sessao.fluxoId, sessao.noAtual);
  }

  /** O que aparece como mensagem do cidadao na tela. */
  private textoDoCidadao(sessao: Sessao, entrada: Entrada): string {
    if (entrada.tipo === 'texto') return entrada.texto;

    const ultima = [...sessao.mensagens].reverse().find((mensagem) => mensagem.opcoes?.length);
    const rotulo = ultima?.opcoes?.find((opcao) => opcao.id === entrada.opcaoId)?.rotulo;
    return rotulo ?? entrada.opcaoId;
  }

  /**
   * Converte texto livre em um id de opcao do momento atual. Aceita o proprio id,
   * o rotulo escrito por extenso ou o numero da opcao ("1", "2", "3") - a forma
   * como as pessoas costumam responder no WhatsApp.
   */
  private resolverOpcaoPorTexto(sessao: Sessao, texto: string): string | null {
    const opcoes = this.opcoesDisponiveis(sessao);
    if (opcoes.length === 0) return null;

    const entrada = normalizar(texto);

    const porIdOuRotulo = opcoes.find(
      (opcao) => normalizar(opcao.id) === entrada || normalizar(opcao.rotulo) === entrada,
    );
    if (porIdOuRotulo) return porIdOuRotulo.id;

    if (/^\d+$/.test(entrada)) {
      const porNumero = opcoes[Number(entrada) - 1];
      if (porNumero) return porNumero.id;
    }

    return null;
  }

  private opcoesDisponiveis(sessao: Sessao): OpcaoApresentada[] {
    if (sessao.etapa === 'menu') {
      const opcoes: OpcaoApresentada[] = this.fluxos.itensMenu.map((item) => ({
        id: item.fluxo,
        rotulo: item.rotulo,
      }));
      opcoes.push({ id: OPCAO_OUTRO, rotulo: this.fluxos.menu.opcao_outro.rotulo });
      return opcoes;
    }

    const no = this.noAtual(sessao);
    if (no?.tipo === 'pergunta') return no.opcoes.map(({ id, rotulo }) => ({ id, rotulo }));
    return [];
  }
}
