import { createServer, type Server } from 'node:http';
import type { AddressInfo } from 'node:net';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { encontrarFatosAlterados, ProvedorLlmOllama } from '../src/modules/llm/index.js';

/** Ollama de mentira: guarda o que o backend manda e devolve a resposta combinada. */
interface RespostaFalsa {
  status?: number;
  corpo: Record<string, unknown>;
}

let servidor: Server;
let urlBase: string;
let requisicoes: { caminho: string; corpo: any }[];
let responder: (corpo: any, caminho: string) => RespostaFalsa;

beforeEach(async () => {
  requisicoes = [];
  responder = () => ({ corpo: { response: 'ok', done_reason: 'stop' } });
  servidor = createServer((req, res) => {
    let bruto = '';
    req.on('data', (parte) => (bruto += parte));
    req.on('end', () => {
      const corpo = bruto ? JSON.parse(bruto) : undefined;
      requisicoes.push({ caminho: req.url ?? '', corpo });
      const { status = 200, corpo: resposta } = responder(corpo, req.url ?? '');
      res.writeHead(status, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify(resposta));
    });
  });
  await new Promise<void>((ok) => servidor.listen(0, '127.0.0.1', ok));
  urlBase = `http://127.0.0.1:${(servidor.address() as AddressInfo).port}`;
});

afterEach(async () => {
  await new Promise((ok) => servidor.close(ok));
  vi.restoreAllMocks();
});

const ORIGINAL =
  'Você tem 7 dias corridos para desistir da compra feita fora da loja, conforme o art. 49 do CDC.\n\nO prazo conta a partir do recebimento do produto.';

describe('aquecer()', () => {
  it('carrega o modelo sem gerar texto: manda so o modelo e o keep_alive', async () => {
    const llm = new ProvedorLlmOllama({ urlBase, modelo: 'qwen3:8b' });
    expect(await llm.aquecer()).toBe(true);
    expect(requisicoes).toHaveLength(1);
    expect(requisicoes[0]?.caminho).toBe('/api/generate');
    expect(requisicoes[0]?.corpo).toEqual({ model: 'qwen3:8b', keep_alive: '60m' });
  });

  it('devolve false, sem lancar erro, quando o Ollama nao esta no ar', async () => {
    const porta = (servidor.address() as AddressInfo).port;
    await new Promise((ok) => servidor.close(ok));
    const llm = new ProvedorLlmOllama({ urlBase: `http://127.0.0.1:${porta}` });
    expect(await llm.aquecer(2000)).toBe(false);
    // devolve o servidor para o afterEach nao falhar ao fechar
    servidor = createServer().listen(0, '127.0.0.1');
    await new Promise((ok) => servidor.once('listening', ok));
  });

  it('usa o modelo instalado quando o configurado nao existe', async () => {
    responder = (corpo, caminho) => {
      if (caminho === '/api/tags') return { corpo: { models: [{ name: 'llama3.1:8b' }] } };
      return corpo.model === 'llama3.1:8b' ? { corpo: {} } : { status: 404, corpo: {} };
    };
    const llm = new ProvedorLlmOllama({ urlBase, modelo: 'inexistente:1b' });
    expect(await llm.aquecer()).toBe(true);
    expect(llm.modeloEmUso).toBe('llama3.1:8b');
  });
});

describe('parametros enviados ao Ollama', () => {
  it('Qwen3: desliga o raciocinio, limita tokens e mantem o modelo carregado', async () => {
    responder = () => ({ corpo: { response: ORIGINAL, done_reason: 'stop' } });
    await new ProvedorLlmOllama({ urlBase, modelo: 'qwen3:8b' }).explicar(ORIGINAL);
    const corpo = requisicoes[0]?.corpo;
    expect(corpo).toMatchObject({
      model: 'qwen3:8b',
      stream: false,
      think: false,
      keep_alive: '60m',
      options: { temperature: 0.2, num_predict: 800 },
    });
  });

  it('modelos sem raciocinio (llama3.2) nao recebem o parametro think', async () => {
    await new ProvedorLlmOllama({ urlBase, modelo: 'llama3.2:3b' }).explicar(ORIGINAL);
    expect(requisicoes[0]?.corpo).not.toHaveProperty('think');
  });

  it('keep_alive "-1" vai como numero (manter para sempre)', async () => {
    await new ProvedorLlmOllama({ urlBase, keepAlive: '-1' }).aquecer();
    expect(requisicoes[0]?.corpo.keep_alive).toBe(-1);
  });
});

describe('explicar()', () => {
  it('aceita uma reescrita que preserva todos os numeros', async () => {
    const reescrita =
      'Fique tranquilo: você pode desistir em até 7 dias corridos, pelo art. 49 do CDC, contando do dia em que receber o produto.';
    responder = () => ({ corpo: { response: reescrita, done_reason: 'stop' } });
    const log = vi.spyOn(console, 'log').mockImplementation(() => undefined);
    const resultado = await new ProvedorLlmOllama({ urlBase, modelo: 'qwen3:8b' }).explicar(ORIGINAL);
    expect(resultado).toEqual({ texto: reescrita, geradoPorLlm: true });
    expect(log).toHaveBeenCalledWith(expect.stringMatching(/Reescrita aceita \(modelo qwen3:8b, \d+\.\d s\)/));
  });

  it('remove o bloco <think> que alguns modelos incluem no texto', async () => {
    const reescrita = 'Você pode desistir em até 7 dias corridos, conforme o art. 49 do CDC, após receber o produto.';
    responder = () => ({
      corpo: { response: `<think>vou reescrever com calma</think>\n${reescrita}`, done_reason: 'stop' },
    });
    const resultado = await new ProvedorLlmOllama({ urlBase }).explicar(ORIGINAL);
    expect(resultado.texto).toBe(reescrita);
  });

  it('descarta reescrita com prazo inventado e usa o texto do PROCON', async () => {
    const invenatada = 'Você tem 30 dias para desistir da compra, conforme o art. 49 do CDC, após receber o produto.';
    responder = () => ({ corpo: { response: invenatada, done_reason: 'stop' } });
    vi.spyOn(console, 'warn').mockImplementation(() => undefined);
    const resultado = await new ProvedorLlmOllama({ urlBase }).explicar(ORIGINAL);
    expect(resultado.texto).not.toContain('30 dias');
    expect(resultado.texto).toContain('7 dias corridos');
    expect(console.warn).toHaveBeenCalledWith(expect.stringContaining('inventado 30'));
  });

  it('descarta reescrita que perdeu um numero do original', async () => {
    const semArtigo = 'Você pode desistir da compra em até 7 dias corridos depois de receber o produto em casa.';
    responder = () => ({ corpo: { response: semArtigo, done_reason: 'stop' } });
    vi.spyOn(console, 'warn').mockImplementation(() => undefined);
    const resultado = await new ProvedorLlmOllama({ urlBase }).explicar(ORIGINAL);
    expect(resultado.texto).not.toBe(semArtigo);
    expect(console.warn).toHaveBeenCalledWith(expect.stringContaining('faltou 49'));
  });

  it('descarta resposta cortada por limite de tokens', async () => {
    responder = () => ({
      corpo: { response: 'Você pode desistir em até 7 dias corridos, conforme o art. 49 do', done_reason: 'length' },
    });
    vi.spyOn(console, 'warn').mockImplementation(() => undefined);
    const resultado = await new ProvedorLlmOllama({ urlBase }).explicar(ORIGINAL);
    expect(resultado.texto).toContain('O prazo conta a partir do recebimento');
    expect(console.warn).toHaveBeenCalledWith(expect.stringContaining('cortada'));
  });

  it('sem Ollama no ar, cai no motor local sem lancar erro', async () => {
    const porta = (servidor.address() as AddressInfo).port;
    await new Promise((ok) => servidor.close(ok));
    vi.spyOn(console, 'info').mockImplementation(() => undefined);
    const resultado = await new ProvedorLlmOllama({ urlBase: `http://127.0.0.1:${porta}` }).explicar(ORIGINAL);
    expect(resultado.texto).toContain('7 dias corridos');
    servidor = createServer().listen(0, '127.0.0.1');
    await new Promise((ok) => servidor.once('listening', ok));
  });
});

describe('classificacao com saida estruturada', () => {
  const MENU = [
    { fluxo: 'garantia-produto', rotulo: 'Garantia', descricao: 'Produto com defeito' },
    { fluxo: 'atraso-entrega', rotulo: 'Atraso', descricao: 'Entrega atrasada' },
  ];
  // Texto que o classificador local nao reconhece, para a LLM ser consultada.
  const RELATO = 'zzqx wvut plmk';

  it('pede JSON restrito aos ids do menu e le o campo "fluxo"', async () => {
    responder = () => ({ corpo: { response: '{"fluxo":"atraso-entrega"}', done_reason: 'stop' } });
    const log = vi.spyOn(console, 'log').mockImplementation(() => undefined);
    const id = await new ProvedorLlmOllama({ urlBase }).identificarFluxo(RELATO, MENU);
    expect(id).toBe('atraso-entrega');
    expect(log).toHaveBeenCalledWith(expect.stringContaining('Fluxo "atraso-entrega" identificado pelo modelo'));
    expect(requisicoes[0]?.corpo.format.properties.fluxo.enum).toEqual([
      'garantia-produto',
      'atraso-entrega',
      'nenhum',
    ]);
    expect(requisicoes[0]?.corpo.options.num_predict).toBe(40);
  });

  it('"nenhum" ou id desconhecido viram undefined', async () => {
    const llm = new ProvedorLlmOllama({ urlBase });
    responder = () => ({ corpo: { response: '{"fluxo":"nenhum"}', done_reason: 'stop' } });
    expect(await llm.identificarFluxo(RELATO, MENU)).toBeUndefined();
    responder = () => ({ corpo: { response: '{"fluxo":"outro-fluxo"}', done_reason: 'stop' } });
    expect(await llm.identificarFluxo(RELATO, MENU)).toBeUndefined();
  });

  it('continua aceitando resposta em texto puro (modelos que ignoram o formato)', async () => {
    responder = () => ({ corpo: { response: 'garantia-produto', done_reason: 'stop' } });
    expect(await new ProvedorLlmOllama({ urlBase }).identificarFluxo(RELATO, MENU)).toBe('garantia-produto');
  });

  it('identificarOpcao: restringe aos ids da pergunta e le o campo "opcao"', async () => {
    responder = () => ({ corpo: { response: '{"opcao":"nao"}', done_reason: 'stop' } });
    const log = vi.spyOn(console, 'log').mockImplementation(() => undefined);
    const opcoes = [
      { id: 'sim', rotulo: 'Sim' },
      { id: 'nao', rotulo: 'Não' },
    ];
    const id = await new ProvedorLlmOllama({ urlBase }).identificarOpcao('Já pediu o reembolso?', RELATO, opcoes);
    expect(id).toBe('nao');
    expect(requisicoes[0]?.corpo.format.properties.opcao.enum).toEqual(['sim', 'nao', 'nenhuma']);
    expect(log).toHaveBeenCalledWith(expect.stringContaining('Opção "nao" identificada pelo modelo'));
  });
});

describe('encontrarFatosAlterados()', () => {
  it('lista vazia quando os numeros se mantem, mesmo com texto reescrito', () => {
    expect(
      encontrarFatosAlterados('Prazo de 7 dias, art. 49, tel. 151.', 'Em até 7 dias (art. 49). Ligue 151.'),
    ).toEqual([]);
  });

  it('aponta numero que sumiu e numero inventado', () => {
    expect(encontrarFatosAlterados('Prazo de 7 dias.', 'Prazo de 30 dias.').sort()).toEqual([
      'faltou 7',
      'inventado 30',
    ]);
  });

  it('ignora marcadores de lista criados ou removidos pelo modelo', () => {
    expect(encontrarFatosAlterados('Leve o documento e a nota fiscal.', '1. Leve o documento.\n2. Leve a nota fiscal.')).toEqual([]);
  });

  it('compara datas e valores pelos digitos, ignorando pontuacao', () => {
    expect(encontrarFatosAlterados('Pague R$ 1.000,00 até 10/08/2026.', 'Pague R$ 1.000,00 até 10/08/2026!')).toEqual([]);
    expect(encontrarFatosAlterados('Pague R$ 1.000,00.', 'Pague R$ 100,00.')).not.toEqual([]);
  });
});
