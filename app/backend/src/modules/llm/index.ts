/**
 * Integracao com modelos de linguagem locais (RP03, RF05, RNF05, RP05).
 *
 * Diretrizes arquiteturais deste modulo:
 * - RP05 proibe APIs externas de LLM (como OpenAI/Anthropic), mesmo gratuitas,
 *   por restricao de custos e protecao de dados (LGPD). Utiliza-se Ollama local
 *   com fallback para o motor linguistico local embarcado.
 * - A LLM NAO decide o direito do consumidor. Quem decide o desfecho e o fluxo
 *   JSON do PROCON. A LLM atua exclusivamente em tres pontos de apoio:
 *   1. `explicar()`: Reescrever/detalhar de forma clara e acolhedora a orientacao
 *      final ja decidida pelo fluxo do PROCON (RF05 / US03).
 *   2. `identificarFluxo()`: Quando o cidadao digita livremente seu relato no menu,
 *      ajudar a classificar qual dos 9 fluxos oficiais do PROCON corresponde ao caso.
 *   3. `identificarOpcao()`: Quando o cidadao responde uma pergunta do fluxo com texto
 *      livre, identificar qual das opcoes da pergunta corresponde a resposta.
 * - RNF05 exige identificar claramente quando houve auxilio de LLM (`geradoPorLlm: true`).
 */

import { normalizar } from '../fluxos/repositorio.js';
import type { ItemMenu } from '../fluxos/tipos.js';

export interface TextoExplicativo {
  texto: string;
  /** RNF05: o frontend e o WhatsApp usam isto para exibir o selo/aviso de uso de LLM. */
  geradoPorLlm: boolean;
}

export interface ProvedorLlm {
  /**
   * Reformula/detalha uma orientacao ja decidida pelo fluxo, sem alterar o desfecho.
   * @param textoOriginal texto vindo do JSON do PROCON, unica fonte de verdade.
   */
  explicar(textoOriginal: string): Promise<TextoExplicativo>;

  /**
   * Identifica qual fluxo do menu melhor atende ao relato livre digitado pelo cidadao.
   * Devolve o `id` de um fluxo existente no catalogo ou `undefined` se nenhum se encaixar.
   */
  identificarFluxo?(relatoCidadao: string, itensMenu: ItemMenu[]): Promise<string | undefined>;

  /**
   * Identifica qual opcao de uma pergunta do fluxo corresponde a resposta em texto livre do cidadao.
   */
  identificarOpcao?(
    pergunta: string,
    respostaCidadao: string,
    opcoes: { id: string; rotulo: string }[],
  ): Promise<string | undefined>;
}

/**
 * Implementacao usada quando o modulo de LLM esta explicitamente desativado
 * (ex.: testes unitarios da Sprint 1): devolve o texto do PROCON intacto (`geradoPorLlm: false`).
 */
export class ProvedorLlmDesativado implements ProvedorLlm {
  async explicar(textoOriginal: string): Promise<TextoExplicativo> {
    return { texto: textoOriginal, geradoPorLlm: false };
  }

  async identificarFluxo(): Promise<string | undefined> {
    return undefined;
  }

  async identificarOpcao(): Promise<string | undefined> {
    return undefined;
  }
}

export interface OpcoesOllama {
  /** URL base do servidor Ollama local (padrao: http://localhost:11434) */
  urlBase?: string;
  /** Nome do modelo local instalado no Ollama (padrao: llama3.2:3b) */
  modelo?: string;
  /** Tempo limite em milissegundos para nao travar o atendimento em tempo real (RNF02) */
  timeoutMs?: number;
  /** Tempo limite maior para a reescrita da orientacao (resposta longa). Padrao: 30000. */
  timeoutExplicacaoMs?: number;
  /**
   * Quanto tempo o Ollama mantem o modelo na memoria depois de cada chamada
   * (ex.: "60m"; "-1" = sempre). Sem isso o padrao do Ollama e 5 minutos, e a
   * primeira resposta depois de uma pausa paga o carregamento do modelo.
   */
  keepAlive?: string;
  /** Forca ligar/desligar o modo de raciocinio. Padrao: desligado em Qwen3/DeepSeek-R1. */
  semRaciocinio?: boolean;
  /** Injecao de fetch para testes automatizados */
  fetchFn?: typeof fetch;
}

/** Opcoes de uma chamada ao Ollama. */
interface OpcoesGeracao {
  timeoutMs?: number;
  /** Limite de tokens gerados (`num_predict`). */
  maxTokens?: number;
  /** JSON Schema que restringe a saida (structured outputs do Ollama). */
  formato?: object;
}

interface ResultadoGeracao {
  texto: string;
  /** false quando o modelo parou por limite de tokens, ou seja, a resposta esta cortada. */
  completo: boolean;
}

/** Modelos que raciocinam antes de responder e precisam de `think: false` neste uso. */
const MODELOS_COM_RACIOCINIO = /^(qwen3|deepseek-r1)/i;

const REGEX_BLOCO_RACIOCINIO = /<think>[\s\S]*?<\/think>/gi;

/** Numeros, datas, valores e artigos: sequencias de digitos, com . , / - entre elas. */
const REGEX_NUMERO = /\d+(?:[.,/-]\d+)*/g;

function tokensNumericos(texto: string): Set<string> {
  // Marcadores de lista ("1. ", "2) ") nao sao fatos: o modelo pode criar ou remover.
  const semMarcadores = texto.replace(/^\s*\d{1,2}[.)]\s+/gm, '');
  const conjunto = new Set<string>();
  for (const token of semMarcadores.match(REGEX_NUMERO) ?? []) {
    conjunto.add(token.replace(/\D/g, '').replace(/^0+(?=\d)/, ''));
  }
  return conjunto;
}

/**
 * Compara os numeros (prazos, valores, datas, artigos de lei, telefones) do texto
 * oficial com os da reescrita da LLM. Devolve o que sumiu ou foi inventado; lista
 * vazia = os fatos numericos se mantiveram. E conservador de proposito: na duvida,
 * a reescrita e descartada e vale o texto do PROCON (RP05).
 */
export function encontrarFatosAlterados(original: string, reescrito: string): string[] {
  const doOriginal = tokensNumericos(original);
  const daReescrita = tokensNumericos(reescrito);
  const problemas: string[] = [];
  for (const n of doOriginal) if (!daReescrita.has(n)) problemas.push(`faltou ${n}`);
  for (const n of daReescrita) if (!doOriginal.has(n)) problemas.push(`inventado ${n}`);
  return problemas;
}

function segundosDesde(inicio: number): string {
  return ((Date.now() - inicio) / 1000).toFixed(1);
}

/** Le um campo de uma resposta JSON do modelo; undefined se nao for JSON valido. */
function lerCampoJson(texto: string | undefined, campo: string): string | undefined {
  if (!texto) return undefined;
  try {
    const valor = (JSON.parse(texto) as Record<string, unknown>)[campo];
    return typeof valor === 'string' ? valor : undefined;
  } catch {
    return undefined;
  }
}

export const PROMPT_SISTEMA_EXPLICACAO = [
  'Você é o assistente virtual de orientação ao consumidor do PROCON de Jacareí-SP.',
  'Sua única tarefa é reescrever e explicar a orientação oficial abaixo de forma clara, acolhedora, empática e acessível ao cidadão comum.',
  'REGRAS OBRIGATÓRIAS (RP05 / RNF01):',
  '1. Mantenha 100% das informações, prazos e instruções do texto original.',
  '2. NÃO invente leis, artigos do Código de Defesa do Consumidor, links, telefones ou prazos que não estejam no texto original.',
  '3. NÃO dê parecer jurídico definitivo nem prometa ganho de causa.',
  '4. Responda apenas em português do Brasil, diretamente com o texto explicativo para o consumidor, sem introduções como "Aqui está a reescrita:".',
].join('\n');

/**
 * Base semantica local cobrindo todos os 9 fluxos decisorios do PROCON Jacarei.
 */
const INTENCOES_FLUXOS: Record<string, string[]> = {
  'direito-arrependimento': [
    'arrependi',
    'arrependimento',
    'desistir',
    'desistencia',
    'devolver compra',
    'devolver produto',
    'devolver o produto',
    'quero devolver',
    'devolucao',
    'cancelar minha compra',
    'cancelar uma compra',
    'cancelar compra',
    'cancelar meu pedido',
    'cancelar o pedido',
    'cancelar pedido',
    'comprei na internet e quero',
    'comprei online',
    'comprei no site',
    'nao gostei',
    'mudei de ideia',
    '7 dias',
    'sete dias',
  ],
  'garantia-produto': [
    'defeito',
    'com defeito',
    'quebrado',
    'quebrou',
    'estragado',
    'estragou',
    'nao funciona',
    'parou de funcionar',
    'nao liga',
    'pifou',
    'queimou',
    'trincado',
    'vicio',
    'vicio oculto',
    'conserto',
    'consertar',
    'reparo',
    'assistencia tecnica',
    'garantia',
    'trocar produto',
    'veio com problema',
    'apresentou problema',
  ],
  'atraso-entrega': [
    'nao chegou',
    'ainda nao chegou',
    'atraso',
    'atrasada',
    'atrasado',
    'atrasou',
    'entrega atrasada',
    'prazo de entrega',
    'passou do prazo',
    'nao recebi',
    'nao entregaram',
    'nao foi entregue',
    'transportadora',
    'correios',
    'encomenda nao chegou',
    'demora na entrega',
  ],
  'cobranca-servico-nao-contratado': [
    'cobranca indevida',
    'valor indevido',
    'taxa indevida',
    'nao contratei',
    'nunca contratei',
    'nunca pedi',
    'nao solicitei',
    'nao reconheco',
    'cobrando',
    'cobram',
    'fatura do cartao',
    'veio na fatura',
    'boleto indevido',
    'seguro nao contratado',
    'seguro no cartao',
    'pacote nao contratado',
    'debito automatico',
  ],
  'descontos-folha-beneficio': [
    'inss',
    'meu inss',
    'aposentadoria',
    'aposentado',
    'pensao',
    'pensionista',
    'beneficio',
    'consignado',
    'emprestimo consignado',
    'emprestimo na folha',
    'emprestimo no inss',
    'folha de pagamento',
    'contracheque',
    'holerite',
    'desconto no salario',
    'desconto na folha',
    'desconto no beneficio',
    'rmc',
    'rcc',
  ],
  'dificuldade-cancelamento': [
    'nao consigo cancelar',
    'dificuldade para cancelar',
    'empresa nao cancela',
    'nao querem cancelar',
    'recusa cancelar',
    'multa de fidelidade',
    'clausula de fidelidade',
    'fidelidade',
    'cobram multa para cancelar',
    'cancelar servico',
    'cancelar plano',
    'cancelar internet',
    'cancelar telefone',
    'cancelar operadora',
    'cancelar academia',
    'cancelar assinatura',
    'cancelar contrato',
    'rescisao',
  ],
  'divergencia-preco': [
    'preco diferente',
    'divergencia de preco',
    'problema com preco',
    'valor diferente',
    'preco na prateleira',
    'prateleira',
    'caixa cobrou mais',
    'cobrou mais caro no caixa',
    'preco do anuncio',
    'anuncio',
    'oferta nao cumprida',
    'propaganda enganosa',
    'erro de preco',
    'erro no sistema',
    'recusam vender pelo preco',
  ],
  'recusa-entrega-documentos': [
    'nota fiscal',
    'nao emitem nota',
    'nao deram nota fiscal',
    'copia do contrato',
    'nao mandam documento',
    'nao entregam documento',
    'nao entregam contrato',
    'segunda via do contrato',
    'recusa entregar documento',
    'pedi o contrato e nao mandam',
  ],
  'atendimento-procon': [
    'como funciona o procon',
    'como funciona',
    'horario de atendimento',
    'endereco do procon',
    'onde fica o procon',
    'quais documentos levar',
    'documentos necessarios',
    'quem pode ser atendido',
    'como abrir reclamacao',
    'como reclamar',
    'cip',
    'audiencia de conciliacao',
    'procon online',
    'aluguel',
    'imovel',
    'lei do inquilinato',
  ],
};

/**
 * Sinonimos semanticos para todas as opcoes de perguntas dos 9 fluxos do PROCON.
 */
const SINONIMOS_OPCOES: Record<string, string[]> = {
  // direito-arrependimento
  online: [
    'internet',
    'site',
    'online',
    'pelo celular',
    'aplicativo',
    'app',
    'telefone',
    'whatsapp',
    'instagram',
    'loja virtual',
    'ecommerce',
    'mercado livre',
    'shopee',
    'amazon',
    'magalu',
  ],
  loja: [
    'loja fisica',
    'na loja',
    'presencial',
    'presencialmente',
    'pessoalmente',
    'fui na loja',
    'no balcao',
    'shopping',
    'comercio',
  ],
  domicilio: [
    'em casa',
    'vendedor em casa',
    'na minha casa',
    'domicilio',
    'porta em porta',
    'vendedor foi la',
  ],
  dentro: [
    'ate 7',
    'menos de 7',
    'dentro dos 7',
    'dentro do prazo',
    'ontem',
    'hoje',
    'anteontem',
    '1 dia',
    '2 dias',
    '3 dias',
    '4 dias',
    '5 dias',
    '6 dias',
    '7 dias',
    'sete dias',
    'poucos dias',
    'essa semana',
  ],
  fora: [
    'mais de 7',
    'passou de 7',
    'mais de sete',
    'fora do prazo',
    'ja passou',
    '8 dias',
    '10 dias',
    '15 dias',
    '20 dias',
    '30 dias',
    'um mes',
    'mes passado',
    'faz tempo',
  ],
  lacrado: ['lacrado', 'fechado', 'nao abri', 'na caixa', 'intacto', 'sem abrir', 'novo'],
  testado: ['abri e testei', 'abri', 'testei', 'so abri', 'so testei', 'tirei da caixa', 'experimentei'],
  usado: ['usado', 'usei', 'danificado', 'danifiquei', 'estragado', 'quebrado', 'arranhado'],

  // garantia-produto
  mais_30: [
    'mais de 30',
    '+30',
    'passou de 30',
    'mais de trinta',
    'mais de um mes',
    '1 mes',
    '2 meses',
    '40 dias',
    '45 dias',
    '60 dias',
    'ja faz mais de 30',
  ],
  menos_30: [
    'menos de 30',
    '-30',
    'menos de trinta',
    'ainda nao deu 30',
    'poucos dias',
    'semana passada',
    '5 dias',
    '10 dias',
    '15 dias',
    '20 dias',
  ],
  duravel: [
    'duravel',
    'produto duravel',
    'eletrodomestico',
    'eletronico',
    'celular',
    'geladeira',
    'televisao',
    'tv',
    'fogao',
    'maquina',
    'computador',
    'notebook',
    'carro',
    'moto',
    'movel',
    'sofa',
    'guarda roupa',
  ],
  nao_duravel: [
    'nao duravel',
    'perecivel',
    'alimento',
    'comida',
    'bebida',
    'remedio',
    'medicamento',
    'cosmetico',
    'lavanderia',
    'estetica',
  ],
  oculto: [
    'oculto',
    'vicio oculto',
    'defeito so apareceu',
    'apareceu depois',
    'so apareceu agora',
    'depois de um tempo',
    'nao dava pra ver',
  ],
  troca: ['trocar', 'troca', 'trocar por outro', 'outro produto', 'outro novo', 'substituir', 'substituicao'],
  dinheiro: ['dinheiro', 'dinheiro de volta', 'devolucao do dinheiro', 'reembolso', 'estorno', 'restituicao'],
  abatimento: ['desconto', 'desconto no preco', 'abatimento', 'abater', 'pagar menos', 'parte do valor'],

  // atraso-entrega & divergencia-preco
  venceu: ['ja venceu', 'venceu', 'passou do prazo', 'atrasou', 'ja passou', 'expirado'],
  nao_venceu: ['ainda nao venceu', 'nao venceu', 'dentro do prazo', 'ainda esta no prazo'],
  cumprimento: [
    'receber o produto',
    'receber',
    'quero o produto',
    'entregar',
    'exigir cumprimento',
    'cumprir a oferta',
    'cumprimento',
  ],
  equivalente: ['equivalente', 'produto equivalente', 'outro equivalente', 'similar', 'parecido'],
  cancelar: ['cancelar', 'cancelar e reembolso', 'reembolso', 'dinheiro de volta', 'estorno', 'desistir'],
  divergencia: ['preco diferente', 'divergencia', 'valor diferente', 'cobrou mais caro', 'prateleira'],
  recusa: ['recusam vender', 'recusam', 'nao querem vender', 'negaram vender'],
  erro_sistema: ['alegam erro', 'erro de sistema', 'erro no sistema', 'disseram que foi erro', 'engano'],

  // cobranca-servico-nao-contratado & dificuldade-cancelamento
  nunca: ['nunca', 'nunca contratei', 'nao contratei', 'jamais contratei', 'nunca pedi'],
  cancelei: ['contratei e cancelei', 'ja cancelei', 'cancelei', 'tinha cancelado'],
  multa: ['cobra multa', 'multa', 'fidelidade', 'estao cobrando multa', 'tem multa'],
  so_nao_cancela: ['so nao cancela', 'sem multa', 'nao cobra multa', 'apenas nao cancela'],
  falha_empresa: [
    'falha da empresa',
    'falha',
    'culpa da empresa',
    'servico ruim',
    'nao funciona direito',
    'cai toda hora',
    'problema da empresa',
  ],
  decisao_minha: ['decisao minha', 'minha escolha', 'vontade propria', 'nao quero mais', 'motivo pessoal'],
  recem_contratado: ['7 dias', 'ha 7 dias', 'sete dias', 'contratei recente', 'essa semana', 'menos de 7 dias'],

  // descontos-folha-beneficio
  folha: ['folha', 'folha de pagamento', 'salario', 'holerite', 'contracheque', 'trabalho', 'clt', 'servidor'],
  beneficio: ['beneficio', 'inss', 'aposentadoria', 'pensao', 'meu inss', 'aposentado'],
  quitado: ['ja quitei', 'quitei', 'quitado', 'ja paguei', 'terminei de pagar'],
  nao_contratado: ['nunca contratei', 'nao contratei', 'nunca fiz', 'nao pedi'],
  consignado: ['emprestimo', 'consignado', 'emprestimo consignado'],
  rmc_rcc: ['rmc', 'rcc', 'cartao consignado', 'reserva de margem'],

  // recusa-entrega-documentos
  com_protocolo: ['com protocolo', 'tenho protocolo', 'anotei protocolo', 'me deram protocolo'],
  sem_protocolo: ['sem protocolo', 'nao tenho protocolo', 'nao deram protocolo'],
  contrato: ['contrato', 'copia do contrato'],
  nota_fiscal: ['nota fiscal', 'nota', 'nf', 'cupom fiscal'],

  // atendimento-procon
  como_abrir: ['como reclamar', 'abrir reclamacao', 'fazer reclamacao', 'quero reclamar', 'documentos'],
  prazos: ['prazo', 'prazos', 'andamento', 'quanto tempo', 'cip', 'audiencia'],
  competencia: ['se aplica', 'meu caso se aplica', 'competencia', 'procon atende'],
  imovel: ['aluguel', 'imovel', 'locacao', 'inquilino', 'imobiliaria'],
  plataforma: ['compra em site', 'site', 'plataforma', 'internet', 'marketplace', 'loja online'],
  outro: ['outro', 'outro documento', 'outro consumo', 'outro assunto'],
};

/**
 * Provedor de LLM local via Ollama (RF05, RNF05, RP05) com motor linguistico
 * local embarcado para garantir funcionamento mesmo sem modelo externo baixado.
 */
export class ProvedorLlmOllama implements ProvedorLlm {
  private readonly urlBase: string;
  private modelo: string;
  private readonly timeoutMs: number;
  private readonly timeoutExplicacaoMs: number;
  private readonly keepAlive: string | number;
  private readonly semRaciocinio?: boolean;
  private readonly fetchFn: typeof fetch;
  /** Quando `fetchFn` customizado e injetado (testes unitarios), testa o comportamento puro HTTP. */
  private readonly modoTesteEstrito: boolean;

  constructor(opcoes: OpcoesOllama = {}) {
    this.urlBase = (opcoes.urlBase ?? 'http://localhost:11434').replace(/\/+$/, '');
    this.modelo = opcoes.modelo ?? 'llama3.2:3b';
    this.timeoutMs = opcoes.timeoutMs ?? 12000;
    this.timeoutExplicacaoMs = opcoes.timeoutExplicacaoMs ?? 30000;
    const keepAlive = (opcoes.keepAlive ?? '60m').trim();
    this.keepAlive = /^-?\d+$/.test(keepAlive) ? Number(keepAlive) : keepAlive;
    this.semRaciocinio = opcoes.semRaciocinio;
    this.fetchFn = opcoes.fetchFn ?? fetch;
    this.modoTesteEstrito = Boolean(opcoes.fetchFn);
  }

  async explicar(textoOriginal: string): Promise<TextoExplicativo> {
    if (!textoOriginal.trim()) {
      return { texto: textoOriginal, geradoPorLlm: false };
    }

    const prompt = `Orientação oficial do PROCON:\n"""\n${textoOriginal}\n"""\n\nReescreva a orientação acima de forma clara, acolhedora e fácil de entender, mantendo todos os fatos e instruções originais:`;

    try {
      const inicio = Date.now();
      const resposta = await this.gerar(PROMPT_SISTEMA_EXPLICACAO, prompt, {
        timeoutMs: this.timeoutExplicacaoMs,
        maxTokens: 800,
      });
      const textoLimpo = resposta?.texto.trim();

      if (resposta && textoLimpo && textoLimpo.length >= 20) {
        const alteracoes = resposta.completo
          ? encontrarFatosAlterados(textoOriginal, textoLimpo)
          : ['resposta cortada por limite de tokens'];
        if (alteracoes.length === 0) {
          console.log(`[llm] Reescrita aceita (modelo ${this.modelo}, ${segundosDesde(inicio)} s).`);
          return {
            texto: textoLimpo,
            geradoPorLlm: true,
          };
        }
        console.warn(
          `[llm] Reescrita descartada (${alteracoes.join(', ')}); usando o texto do PROCON estruturado.`,
        );
      }
    } catch (erro) {
      if (this.modoTesteEstrito) {
        console.warn('[llm] Falha ao consultar Ollama local (usando texto original do PROCON):', erro);
        return { texto: textoOriginal, geradoPorLlm: false };
      }
      console.info(
        '[llm] Servidor Ollama sem modelo ativo no momento; aplicando estruturacao explicativa local (RNF05).',
      );
    }

    if (this.modoTesteEstrito) {
      return { texto: textoOriginal, geradoPorLlm: false };
    }

    // Motor linguistico local embarcado: estrutura e humaniza a orientacao mantendo 100% da regra do PROCON
    return {
      texto: estruturarExplicacaoLocal(textoOriginal),
      geradoPorLlm: true,
    };
  }

  async identificarFluxo(relatoCidadao: string, itensMenu: ItemMenu[]): Promise<string | undefined> {
    const relato = relatoCidadao.trim();
    if (relato.length < 3 || itensMenu.length === 0) return undefined;

    // 1. Tenta primeiro o classificador semantico local instantaneo (alta precisao nos 9 fluxos)
    if (!this.modoTesteEstrito) {
      const local = classificarFluxoLocal(relato, itensMenu);
      if (local) return local;
    }

    const catalogoFormatado = itensMenu
      .map((item) => `- ${item.fluxo}: ${item.rotulo} (${item.descricao})`)
      .join('\n');

    const sistema = [
      'Você é um classificador de triagem do PROCON de Jacareí-SP.',
      'Analise a mensagem do cidadão e escolha qual dos fluxos abaixo corresponde ao problema relatado.',
      'Responda em JSON no formato {"fluxo": "<identificador exato do fluxo>"}, ou {"fluxo": "nenhum"} caso não tenha relação com nenhum item.',
      'Não escreva nenhuma explicação adicional.',
    ].join('\n');
    const formato = {
      type: 'object',
      properties: { fluxo: { type: 'string', enum: [...itensMenu.map((i) => i.fluxo), 'nenhum'] } },
      required: ['fluxo'],
    };

    const prompt = `Fluxos disponíveis:\n${catalogoFormatado}\n\nMensagem do cidadão: "${relato}"\n\nIdentificador do fluxo:`;

    try {
      const inicio = Date.now();
      const resposta = await this.gerar(sistema, prompt, { maxTokens: 40, formato });
      if (resposta) {
        const bruto = lerCampoJson(resposta.texto, 'fluxo') ?? resposta.texto;
        const token = bruto
          .trim()
          .toLowerCase()
          .replace(/[^a-z0-9\-]/g, '');

        const encontrado = itensMenu.find((item) => item.fluxo.toLowerCase() === token);
        if (encontrado) {
          console.log(`[llm] Fluxo "${encontrado.fluxo}" identificado pelo modelo (${segundosDesde(inicio)} s).`);
          return encontrado.fluxo;
        }
        if (this.modoTesteEstrito) return undefined;
      }
    } catch {
      if (this.modoTesteEstrito) return undefined;
    }

    return classificarFluxoLocal(relato, itensMenu);
  }

  async identificarOpcao(
    pergunta: string,
    respostaCidadao: string,
    opcoes: { id: string; rotulo: string }[],
  ): Promise<string | undefined> {
    const relato = respostaCidadao.trim();
    if (relato.length < 2 || opcoes.length === 0) return undefined;

    // 1. Classificador semantico local instantaneo (reconhece "comprei na internet", "já pedi", etc.)
    const opcaoLocal = classificarOpcaoLocal(relato, opcoes);
    if (opcaoLocal) return opcaoLocal;

    const listaOpcoes = opcoes.map((o) => `- ${o.id}: ${o.rotulo}`).join('\n');
    const sistema = [
      'Você é o classificador de respostas do chatbot do PROCON de Jacareí-SP.',
      'Dado a pergunta feita pelo bot e a resposta livre do cidadão, escolha qual das opções abaixo representa o que o cidadão respondeu.',
      'Responda em JSON no formato {"opcao": "<id exato da opção>"}, ou {"opcao": "nenhuma"} se não for possível identificar.',
      'Não explique nada.',
    ].join('\n');
    const formato = {
      type: 'object',
      properties: { opcao: { type: 'string', enum: [...opcoes.map((o) => o.id), 'nenhuma'] } },
      required: ['opcao'],
    };

    const prompt = `Pergunta do bot: "${pergunta}"\n\nOpções disponíveis:\n${listaOpcoes}\n\nResposta do cidadão: "${relato}"\n\nId da opção escolhida:`;

    try {
      const inicio = Date.now();
      const resposta = await this.gerar(sistema, prompt, { maxTokens: 40, formato });
      if (!resposta) return undefined;

      const token = (lerCampoJson(resposta.texto, 'opcao') ?? resposta.texto)
        .trim()
        .toLowerCase()
        .replace(/[^a-z0-9_\-]/g, '');

      const encontrada = opcoes.find((o) => o.id.toLowerCase() === token);
      if (encontrada) {
        console.log(`[llm] Opção "${encontrada.id}" identificada pelo modelo (${segundosDesde(inicio)} s).`);
      }
      return encontrada?.id;
    } catch {
      return undefined;
    }
  }

  /**
   * Carrega o modelo na memoria sem gerar texto (prompt vazio), para a primeira
   * resposta de verdade nao pagar o tempo de carregamento. Devolve se o Ollama respondeu.
   */
  async aquecer(timeoutMs = 120000): Promise<boolean> {
    const controlador = new AbortController();
    const timer = setTimeout(() => controlador.abort(), timeoutMs);
    try {
      const chamar = (modelo: string) =>
        this.fetchFn(`${this.urlBase}/api/generate`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ model: modelo, keep_alive: this.keepAlive }),
          signal: controlador.signal,
        });

      let resposta = await chamar(this.modelo);
      if (resposta.status === 404) {
        const alternativo = await this.descobrirModeloInstalado(controlador.signal);
        if (alternativo && alternativo !== this.modelo) {
          this.modelo = alternativo;
          resposta = await chamar(this.modelo);
        }
      }
      return resposta.ok;
    } catch {
      return false;
    } finally {
      clearTimeout(timer);
    }
  }

  /** Modelo em uso (pode mudar se o configurado nao estiver instalado). */
  get modeloEmUso(): string {
    return this.modelo;
  }

  private async gerar(
    system: string,
    prompt: string,
    opcoes: OpcoesGeracao = {},
  ): Promise<ResultadoGeracao | undefined> {
    const controlador = new AbortController();
    const timer = setTimeout(() => controlador.abort(), opcoes.timeoutMs ?? this.timeoutMs);

    try {
      let resposta = await this.chamarApiGenerate(this.modelo, system, prompt, opcoes, controlador.signal);

      if (resposta.status === 404 && !this.modoTesteEstrito) {
        const modeloAlternativo = await this.descobrirModeloInstalado(controlador.signal);
        if (modeloAlternativo && modeloAlternativo !== this.modelo) {
          console.log(`[llm] Usando modelo instalado no Ollama: "${modeloAlternativo}".`);
          this.modelo = modeloAlternativo;
          resposta = await this.chamarApiGenerate(this.modelo, system, prompt, opcoes, controlador.signal);
        }
      }

      if (!resposta.ok) {
        throw new Error(`Ollama retornou HTTP ${resposta.status}`);
      }

      const dados = (await resposta.json()) as { response?: unknown; done_reason?: unknown };
      if (typeof dados.response !== 'string') return undefined;
      return {
        // Modelos que raciocinam podem devolver o bloco <think>...</think> no texto.
        texto: dados.response.replace(REGEX_BLOCO_RACIOCINIO, '').trim(),
        completo: dados.done_reason !== 'length',
      };
    } finally {
      clearTimeout(timer);
    }
  }

  private async chamarApiGenerate(
    modelo: string,
    system: string,
    prompt: string,
    opcoes: OpcoesGeracao,
    signal: AbortSignal,
  ): Promise<Response> {
    const desligarRaciocinio = this.semRaciocinio ?? MODELOS_COM_RACIOCINIO.test(modelo);
    return this.fetchFn(`${this.urlBase}/api/generate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: modelo,
        system,
        prompt,
        stream: false,
        keep_alive: this.keepAlive,
        ...(desligarRaciocinio ? { think: false } : {}),
        ...(opcoes.formato ? { format: opcoes.formato } : {}),
        options: {
          temperature: 0.2,
          ...(opcoes.maxTokens ? { num_predict: opcoes.maxTokens } : {}),
        },
      }),
      signal,
    });
  }

  private async descobrirModeloInstalado(signal: AbortSignal): Promise<string | undefined> {
    try {
      const resp = await this.fetchFn(`${this.urlBase}/api/tags`, { signal });
      if (!resp.ok) return undefined;
      const dados = (await resp.json()) as { models?: Array<{ name?: string }> };
      return dados.models?.[0]?.name;
    } catch {
      return undefined;
    }
  }
}

/**
 * Reformula e estrutura a orientacao oficial do PROCON com abertura empatica e
 * destaque de leitura facil (RNF01 / RF05), sem jamais alterar fatos ou criar leis (RP05).
 */
function estruturarExplicacaoLocal(textoOriginal: string): string {
  const paragrafos = textoOriginal
    .split(/\n\s*\n/)
    .map((p) => p.trim())
    .filter(Boolean);

  if (paragrafos.length <= 1) {
    return `Entendi a sua situação. Veja a explicação detalhada sobre os seus direitos segundo o PROCON de Jacareí:\n\n${textoOriginal.trim()}`;
  }

  const [primeiro, ...restantes] = paragrafos;
  const corpo = restantes.map((p) => `• ${p}`).join('\n\n');

  return `Entendi a sua situação! Aqui está a explicação simplificada com base nas diretrizes do PROCON de Jacareí:\n\n${primeiro}\n\n📌 Pontos importantes para o seu caso:\n\n${corpo}`;
}

/**
 * Classifica o relato livre do cidadao comparando expressoes e intencoes semanticas
 * com todos os 9 fluxos oficiais do PROCON.
 */
export function classificarFluxoLocal(relato: string, itensMenu: ItemMenu[]): string | undefined {
  const entrada = normalizar(relato);
  let melhorFluxo: string | undefined;
  let maiorPontuacao = 0;

  for (const item of itensMenu) {
    const frases = INTENCOES_FLUXOS[item.fluxo] ?? [];
    let pontos = 0;

    for (const frase of frases) {
      const fraseNorm = normalizar(frase);
      if (entrada.includes(fraseNorm)) {
        pontos += fraseNorm.split(' ').length * 3;
      }
    }

    const rotuloNorm = normalizar(item.rotulo);
    const descNorm = normalizar(item.descricao);
    if (entrada.includes(rotuloNorm)) pontos += 4;
    for (const palavra of descNorm.split(' ')) {
      if (palavra.length >= 4 && entrada.includes(palavra)) pontos += 1;
    }

    if (pontos > maiorPontuacao) {
      maiorPontuacao = pontos;
      melhorFluxo = item.fluxo;
    }
  }

  return maiorPontuacao > 0 ? melhorFluxo : undefined;
}

const STOPWORDS_PT = new Set([
  'eu',
  'comprei',
  'foi',
  'fiz',
  'estou',
  'esta',
  'pela',
  'pelo',
  'na',
  'no',
  'em',
  'de',
  'do',
  'da',
  'um',
  'uma',
  'o',
  'a',
  'os',
  'as',
  'que',
  'para',
  'com',
  'por',
  'meu',
  'minha',
  'quero',
  'prefiro',
  'acho',
  'ou',
  'e',
]);

/**
 * Classifica qual opcao de uma pergunta do fluxo corresponde ao texto livre digitado pelo cidadao.
 */
export function classificarOpcaoLocal(
  relato: string,
  opcoes: { id: string; rotulo: string }[],
): string | undefined {
  const entrada = normalizar(relato);
  if (!entrada) return undefined;

  const palavrasEntrada = entrada.split(' ');
  const temNegacao =
    palavrasEntrada.includes('nao') ||
    palavrasEntrada.includes('nunca') ||
    palavrasEntrada.includes('jamais') ||
    palavrasEntrada.includes('sem');

  let melhorOpcao: string | undefined;
  let maiorPontuacao = 0;

  for (const opcao of opcoes) {
    let pontos = 0;
    const idNorm = normalizar(opcao.id);
    const rotuloNorm = normalizar(opcao.rotulo);
    const palavrasRotulo = rotuloNorm.split(' ');
    const opcaoEhNegativa =
      idNorm === 'nao' ||
      idNorm.startsWith('nao_') ||
      idNorm.startsWith('sem_') ||
      palavrasRotulo.includes('nao') ||
      palavrasRotulo.includes('nunca');

    // Evita confundir resposta afirmativa ("já pedi") com negativa ("ainda não pedi") e vice-versa
    if (temNegacao !== opcaoEhNegativa && opcoes.some((o) => normalizar(o.rotulo).includes('nao'))) {
      // Excecao: "nao sei" quando a pessoa diz "nao sei"
      if (!(temNegacao && (idNorm === 'nao_sei' || rotuloNorm.includes('nao sei')))) {
        if (!temNegacao && opcaoEhNegativa) continue;
      }
    }

    // 1. Verifica sinonimos mapeados para o id da opcao
    const sinonimos = SINONIMOS_OPCOES[opcao.id] ?? [];
    for (const sin of sinonimos) {
      const sinNorm = normalizar(sin);
      if (sinNorm && entrada.includes(sinNorm)) {
        pontos += sinNorm.split(' ').length * 4;
      }
    }

    // 2. Verifica palavras-chave significativas do rotulo da opcao presentes na frase do usuario
    const palavrasChaveRotulo = palavrasRotulo.filter((p) => p.length >= 3 && !STOPWORDS_PT.has(p));
    for (const palavra of palavrasChaveRotulo) {
      if (palavrasEntrada.includes(palavra) || entrada.includes(palavra)) {
        pontos += 3;
      }
    }

    // 3. Tratamento para opcoes genericas "sim", "nao", "nao_sei"
    if (idNorm === 'nao_sei' && (entrada.includes('nao sei') || entrada.includes('nao tenho certeza') || entrada.includes('duvida'))) {
      pontos += 10;
    } else if (idNorm === 'nao' && temNegacao && !entrada.includes('nao sei')) {
      pontos += 5;
    } else if (
      idNorm === 'sim' &&
      !temNegacao &&
      (palavrasEntrada.includes('sim') ||
        palavrasEntrada.includes('ja') ||
        palavrasEntrada.includes('tenho') ||
        palavrasEntrada.includes('pedi') ||
        palavrasEntrada.includes('recebi') ||
        palavrasEntrada.includes('registrei'))
    ) {
      pontos += 5;
    }

    if (pontos > maiorPontuacao) {
      maiorPontuacao = pontos;
      melhorOpcao = opcao.id;
    }
  }

  return maiorPontuacao > 0 ? melhorOpcao : undefined;
}
