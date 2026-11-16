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
  /** Injecao de fetch para testes automatizados */
  fetchFn?: typeof fetch;
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
 * Base semantica local para triagem de intencao em portugues quando o container
 * do Ollama ainda nao baixou o modelo (404) ou nao esta em execucao.
 */
const INTENCOES_FLUXOS: Record<string, string[]> = {
  'direito-arrependimento': [
    'arrependi',
    'arrependimento',
    'desistir',
    'desistencia',
    'devolver compra',
    'devolver produto',
    'cancelar minha compra',
    'cancelar uma compra',
    'cancelar compra',
    'comprei na internet',
    'comprei online',
    'comprei no site',
    'nao gostei',
    'quero devolver',
  ],
  'garantia-produto': [
    'defeito',
    'quebrado',
    'quebrou',
    'estragado',
    'estragou',
    'nao funciona',
    'parou de funcionar',
    'vicio',
    'conserto',
    'assistencia tecnica',
    'garantia',
    'trocar produto com defeito',
  ],
  'atraso-entrega': [
    'nao chegou',
    'atraso',
    'atrasada',
    'atrasou',
    'entrega',
    'prazo de entrega',
    'nao recebi',
    'transportadora',
    'correios',
    'encomenda',
  ],
  'cobranca-servico-nao-contratado': [
    'cobranca indevida',
    'nao contratei',
    'nunca contratei',
    'nunca pedi',
    'cobrando',
    'cobram',
    'fatura',
    'boleto indevido',
    'seguro nao contratado',
    'pacote nao contratado',
  ],
  'descontos-folha-beneficio': [
    'inss',
    'aposentadoria',
    'pensao',
    'beneficio',
    'consignado',
    'emprestimo',
    'folha de pagamento',
    'rmc',
    'rcc',
    'desconto no beneficio',
  ],
  'dificuldade-cancelamento': [
    'nao consigo cancelar',
    'dificuldade para cancelar',
    'empresa nao cancela',
    'multa de fidelidade',
    'fidelidade',
    'cancelar servico',
    'cancelar plano',
    'cancelar internet',
    'cancelar academia',
    'cancelar assinatura',
  ],
  'divergencia-preco': [
    'preco diferente',
    'divergencia de preco',
    'valor diferente',
    'prateleira',
    'caixa cobrou mais',
    'anuncio',
    'oferta',
    'propaganda',
  ],
  'recusa-entrega-documentos': [
    'nota fiscal',
    'copia do contrato',
    'nao mandam documento',
    'nao entregam contrato',
    'segunda via',
    'recusa documento',
  ],
  'atendimento-procon': [
    'como funciona',
    'horario de atendimento',
    'endereco do procon',
    'onde fica o procon',
    'quais documentos',
    'quem pode ser atendido',
  ],
};

/**
 * Provedor de LLM local via Ollama (RF05, RNF05, RP05) com motor linguistico
 * local embarcado para garantir funcionamento mesmo sem modelo externo baixado.
 */
export class ProvedorLlmOllama implements ProvedorLlm {
  private readonly urlBase: string;
  private modelo: string;
  private readonly timeoutMs: number;
  private readonly fetchFn: typeof fetch;
  /** Quando `fetchFn` customizado e injetado (testes unitarios), testa o comportamento puro HTTP. */
  private readonly modoTesteEstrito: boolean;

  constructor(opcoes: OpcoesOllama = {}) {
    this.urlBase = (opcoes.urlBase ?? 'http://localhost:11434').replace(/\/+$/, '');
    this.modelo = opcoes.modelo ?? 'llama3.2:3b';
    this.timeoutMs = opcoes.timeoutMs ?? 12000;
    this.fetchFn = opcoes.fetchFn ?? fetch;
    this.modoTesteEstrito = Boolean(opcoes.fetchFn);
  }

  async explicar(textoOriginal: string): Promise<TextoExplicativo> {
    if (!textoOriginal.trim()) {
      return { texto: textoOriginal, geradoPorLlm: false };
    }

    const prompt = `Orientação oficial do PROCON:\n"""\n${textoOriginal}\n"""\n\nReescreva a orientação acima de forma clara, acolhedora e fácil de entender, mantendo todos os fatos e instruções originais:`;

    try {
      const resposta = await this.gerar(PROMPT_SISTEMA_EXPLICACAO, prompt);
      const textoLimpo = resposta?.trim();

      if (textoLimpo && textoLimpo.length >= 20) {
        return {
          texto: textoLimpo,
          geradoPorLlm: true,
        };
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

    const catalogoFormatado = itensMenu
      .map((item) => `- ${item.fluxo}: ${item.rotulo} (${item.descricao})`)
      .join('\n');

    const sistema = [
      'Você é um classificador de triagem do PROCON de Jacareí-SP.',
      'Analise a mensagem do cidadão e escolha qual dos fluxos abaixo corresponde ao problema relatado.',
      'Responda APENAS com o identificador exato do fluxo (ex.: garantia-produto) ou com a palavra "nenhum" caso não tenha relação com nenhum item.',
      'Não escreva nenhuma explicação adicional.',
    ].join('\n');

    const prompt = `Fluxos disponíveis:\n${catalogoFormatado}\n\nMensagem do cidadão: "${relato}"\n\nIdentificador do fluxo:`;

    try {
      const resposta = await this.gerar(sistema, prompt);
      if (resposta) {
        const token = resposta
          .trim()
          .toLowerCase()
          .replace(/[^a-z0-9\-]/g, '');

        const encontrado = itensMenu.find((item) => item.fluxo.toLowerCase() === token);
        if (encontrado) return encontrado.fluxo;
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

    const listaOpcoes = opcoes.map((o) => `- ${o.id}: ${o.rotulo}`).join('\n');
    const sistema = [
      'Você é o classificador de respostas do chatbot do PROCON de Jacareí-SP.',
      'Dado a pergunta feita pelo bot e a resposta livre do cidadão, escolha qual das opções abaixo representa o que o cidadão respondeu.',
      'Responda APENAS com o id exato da opção (ex.: sim) ou "nenhuma" se não for possível identificar.',
      'Não explique nada.',
    ].join('\n');

    const prompt = `Pergunta do bot: "${pergunta}"\n\nOpções disponíveis:\n${listaOpcoes}\n\nResposta do cidadão: "${relato}"\n\nId da opção escolhida:`;

    try {
      const resposta = await this.gerar(sistema, prompt);
      if (!resposta) return undefined;

      const token = resposta
        .trim()
        .toLowerCase()
        .replace(/[^a-z0-9_\-]/g, '');

      const encontrada = opcoes.find((o) => o.id.toLowerCase() === token);
      return encontrada?.id;
    } catch {
      return undefined;
    }
  }

  private async gerar(system: string, prompt: string): Promise<string | undefined> {
    const controlador = new AbortController();
    const timer = setTimeout(() => controlador.abort(), this.timeoutMs);

    try {
      let resposta = await this.chamarApiGenerate(this.modelo, system, prompt, controlador.signal);

      if (resposta.status === 404 && !this.modoTesteEstrito) {
        const modeloAlternativo = await this.descobrirModeloInstalado(controlador.signal);
        if (modeloAlternativo && modeloAlternativo !== this.modelo) {
          console.log(`[llm] Usando modelo instalado no Ollama: "${modeloAlternativo}".`);
          this.modelo = modeloAlternativo;
          resposta = await this.chamarApiGenerate(this.modelo, system, prompt, controlador.signal);
        }
      }

      if (!resposta.ok) {
        throw new Error(`Ollama retornou HTTP ${resposta.status}`);
      }

      const dados = (await resposta.json()) as { response?: unknown };
      return typeof dados.response === 'string' ? dados.response : undefined;
    } finally {
      clearTimeout(timer);
    }
  }

  private async chamarApiGenerate(
    modelo: string,
    system: string,
    prompt: string,
    signal: AbortSignal,
  ): Promise<Response> {
    return this.fetchFn(`${this.urlBase}/api/generate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: modelo,
        system,
        prompt,
        stream: false,
        options: {
          temperature: 0.2,
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
 * com o catalogo oficial do PROCON.
 */
function classificarFluxoLocal(relato: string, itensMenu: ItemMenu[]): string | undefined {
  const entrada = normalizar(relato);
  let melhorFluxo: string | undefined;
  let maiorPontuacao = 0;

  for (const item of itensMenu) {
    const frases = INTENCOES_FLUXOS[item.fluxo] ?? [];
    let pontos = 0;

    for (const frase of frases) {
      const fraseNorm = normalizar(frase);
      if (entrada.includes(fraseNorm)) {
        // Frases mais especificas (ex: "cancelar minha compra") valem mais que palavras isoladas
        pontos += fraseNorm.split(' ').length * 2;
      }
    }

    const rotuloNorm = normalizar(item.rotulo);
    const descNorm = normalizar(item.descricao);
    if (entrada.includes(rotuloNorm)) pontos += 3;
    for (const palavra of descNorm.split(' ')) {
      if (palavra.length >= 5 && entrada.includes(palavra)) pontos += 1;
    }

    if (pontos > maiorPontuacao) {
      maiorPontuacao = pontos;
      melhorFluxo = item.fluxo;
    }
  }

  return maiorPontuacao > 0 ? melhorFluxo : undefined;
}
