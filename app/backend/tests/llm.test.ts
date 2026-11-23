/**
 * Testes automatizados do modulo de LLM Local (RF05, RNF05, RP05, US03).
 *
 * Verifica:
 * 1. Explicacao de orientacoes finais com `ProvedorLlmOllama` e aviso explicito `aviso_llm` (RNF05).
 * 2. Fallback seguro quando a requisicao HTTP ao Ollama falha.
 * 3. Classificacao de linguagem natural para todos os 9 fluxos decisorios do PROCON (`identificarFluxo` / `classificarFluxoLocal`).
 * 4. Classificacao de respostas livres em perguntas dos fluxos (`identificarOpcao` / `classificarOpcaoLocal`).
 * 5. Protecao contra alucinacao de IDs de fluxos inexistentes (RP05).
 */
import { describe, expect, it } from 'vitest';
import { fileURLToPath } from 'node:url';

import { MotorConversa } from '../src/modules/chatbot/motor.js';
import { RepositorioSessoesMemoria } from '../src/modules/chatbot/sessao.js';
import { carregarCatalogo, RepositorioFluxos } from '../src/modules/fluxos/repositorio.js';
import {
  classificarFluxoLocal,
  classificarOpcaoLocal,
  PROMPT_SISTEMA_EXPLICACAO,
  ProvedorLlmOllama,
} from '../src/modules/llm/index.js';
import { RepositorioInteracoesMemoria } from '../src/modules/registro/index.js';

const DIRETORIO_FLUXOS = fileURLToPath(new URL('../../../fluxos', import.meta.url));
const fluxos = new RepositorioFluxos(carregarCatalogo(DIRETORIO_FLUXOS));

describe('ProvedorLlmOllama - explicacao e transparencia (RF05 / RNF05 / RP05)', () => {
  it('reformula a orientacao final via Ollama local e marca geradoPorLlm = true', async () => {
    let corpoEnviado: Record<string, unknown> | undefined;

    const fetchMock: typeof fetch = async (_url, init) => {
      corpoEnviado = JSON.parse(String(init?.body)) as Record<string, unknown>;
      return new Response(
        JSON.stringify({
          response:
            'Entendi o seu caso! Como a compra foi feita pela internet há menos de 7 dias, você tem direito de arrependimento garantido pelo PROCON.',
        }),
        { status: 200, headers: { 'Content-Type': 'application/json' } },
      );
    };

    const llm = new ProvedorLlmOllama({
      urlBase: 'http://localhost:11434',
      modelo: 'llama3.2:3b',
      fetchFn: fetchMock,
    });

    const resultado = await llm.explicar('Texto original da orientação do PROCON.');

    expect(resultado.geradoPorLlm).toBe(true);
    expect(resultado.texto).toContain('direito de arrependimento');
    expect(corpoEnviado?.model).toBe('llama3.2:3b');
    expect(corpoEnviado?.system).toBe(PROMPT_SISTEMA_EXPLICACAO);
    expect(corpoEnviado?.stream).toBe(false);
  });

  it('faz fallback seguro para o texto oficial do PROCON quando o HTTP falha em modo estrito', async () => {
    const fetchFalha: typeof fetch = async () => {
      throw new Error('ECONNREFUSED localhost:11434');
    };

    const llm = new ProvedorLlmOllama({ fetchFn: fetchFalha });
    const textoOficial = 'Orientação oficial do PROCON sem alteração.';
    const resultado = await llm.explicar(textoOficial);

    expect(resultado.geradoPorLlm).toBe(false);
    expect(resultado.texto).toBe(textoOficial);
  });

  it('ignora IDs de fluxos alucinados pela LLM que nao existam no catalogo oficial', async () => {
    const fetchAlucinado: typeof fetch = async () =>
      new Response(JSON.stringify({ response: 'fluxo-inventado-pela-ia' }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      });

    const llm = new ProvedorLlmOllama({ fetchFn: fetchAlucinado });
    const fluxoId = await llm.identificarFluxo('texto sem correspondencia xyz', fluxos.itensMenu);

    expect(fluxoId).toBeUndefined();
  });
});

describe('Classificacao de linguagem natural para todos os 9 fluxos do PROCON', () => {
  it.each([
    [
      'cobranca-servico-nao-contratado',
      'Veio uma cobrança indevida na fatura do meu cartão de um seguro que nunca contratei',
    ],
    [
      'descontos-folha-beneficio',
      'Apareceu um desconto de empréstimo consignado na minha aposentadoria do INSS',
    ],
    [
      'dificuldade-cancelamento',
      'Quero cancelar meu plano de internet mas a operadora não deixa e quer cobrar multa de fidelidade',
    ],
    [
      'garantia-produto',
      'Comprei uma geladeira nova e ela parou de funcionar, está com defeito e na garantia',
    ],
    [
      'atraso-entrega',
      'Minha encomenda está com a entrega atrasada, já passou do prazo e ainda não chegou',
    ],
    [
      'direito-arrependimento',
      'Comprei um produto na internet, me arrependi e quero cancelar meu pedido e devolver',
    ],
    [
      'divergencia-preco',
      'O preço na prateleira era um mas o caixa cobrou mais caro que o valor do anúncio',
    ],
    [
      'recusa-entrega-documentos',
      'A loja não quer emitir a nota fiscal nem me entregar a cópia do contrato',
    ],
    [
      'atendimento-procon',
      'Onde fica o endereço do PROCON, qual o horário de atendimento e quais documentos levar?',
    ],
  ])('identifica corretamente o fluxo "%s" a partir do relato livre do cidadao', (fluxoEsperado, relato) => {
    const identificado = classificarFluxoLocal(relato, fluxos.itensMenu);
    expect(identificado).toBe(fluxoEsperado);
  });
});

describe('Classificacao de respostas livres nas perguntas dos fluxos (classificarOpcaoLocal)', () => {
  it('reconhece "comprei na internet" como opcao "online" (Internet ou telefone)', () => {
    const opcoes = [
      { id: 'online', rotulo: 'Internet ou telefone' },
      { id: 'domicilio', rotulo: 'Vendedor em domicílio' },
      { id: 'loja', rotulo: 'Em loja física' },
    ];

    expect(classificarOpcaoLocal('comprei na internet', opcoes)).toBe('online');
    expect(classificarOpcaoLocal('fui na loja física pessoalmente', opcoes)).toBe('loja');
    expect(classificarOpcaoLocal('foi um vendedor em casa', opcoes)).toBe('domicilio');
  });

  it('reconhece "está lacrado" como opcao "lacrado" (Ainda lacrado)', () => {
    const opcoes = [
      { id: 'lacrado', rotulo: 'Ainda lacrado' },
      { id: 'testado', rotulo: 'Abri e testei' },
      { id: 'usado', rotulo: 'Usado ou danificado' },
    ];

    expect(classificarOpcaoLocal('Está lacrado', opcoes)).toBe('lacrado');
    expect(classificarOpcaoLocal('eu só abri e testei', opcoes)).toBe('testado');
    expect(classificarOpcaoLocal('já foi usado', opcoes)).toBe('usado');
  });

  it('distingue corretamente afirmacao ("já pedi") de negacao ("ainda não pedi")', () => {
    const opcoes = [
      { id: 'sim', rotulo: 'Sim, já pedi' },
      { id: 'nao', rotulo: 'Ainda não pedi' },
    ];

    expect(classificarOpcaoLocal('já pedi o cancelamento', opcoes)).toBe('sim');
    expect(classificarOpcaoLocal('ainda não pedi', opcoes)).toBe('nao');
  });
});

describe('Integracao MotorConversa + ProvedorLlmOllama (fluxo ponta a ponta com IA)', () => {
  it('conduz o cidadao por texto livre ate a orientacao final e emite aviso_llm (RNF05)', async () => {
    const fetchMock: typeof fetch = async (_url, init) => {
      const corpo = JSON.parse(String(init?.body ?? '{}')) as { prompt?: string };
      const resposta = corpo.prompt?.includes('Identificador do fluxo:')
        ? 'direito-arrependimento'
        : 'Explicação gerada com apoio de IA mantendo todas as regras do PROCON Jacareí para direito de arrependimento.';

      return new Response(JSON.stringify({ response: resposta }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      });
    };

    const sessoes = new RepositorioSessoesMemoria();
    const interacoes = new RepositorioInteracoesMemoria();
    const llm = new ProvedorLlmOllama({ fetchFn: fetchMock });
    const motor = new MotorConversa(fluxos, sessoes, interacoes, llm);

    const { sessao } = await motor.iniciar('+5512988887777');

    // 1. Cidadao relata o problema em texto livre no menu
    const p1 = await motor.responder(sessao.id, {
      tipo: 'texto',
      texto: 'Eu quero cancelar meu pedido que comprei na internet',
    });
    expect(p1.sessao.fluxoId).toBe('direito-arrependimento');
    expect(p1.sessao.noAtual).toBe('inicio');

    // 2. Responde "comprei na internet" em texto livre
    const p2 = await motor.responder(sessao.id, {
      tipo: 'texto',
      texto: 'comprei na internet',
    });
    expect(p2.sessao.noAtual).toBe('prazo');

    // 3. Responde "faz 3 dias que recebi" (Até 7 dias)
    const p3 = await motor.responder(sessao.id, {
      tipo: 'texto',
      texto: 'faz 3 dias que recebi',
    });
    expect(p3.sessao.noAtual).toBe('estado_produto');

    // 4. Responde "Está lacrado" -> chega na orientacao final
    const p4 = await motor.responder(sessao.id, {
      tipo: 'texto',
      texto: 'Está lacrado',
    });
    expect(p4.sessao.etapa).toBe('finalizada');

    const orientacao = p4.novasMensagens.find((m) => m.tipo === 'orientacao');
    const avisoLlm = p4.novasMensagens.find((m) => m.tipo === 'aviso' && m.geradoPorLlm === true);

    expect(orientacao?.geradoPorLlm).toBe(true);
    expect(orientacao?.texto).toContain('Explicação gerada com apoio de IA');
    // RNF05: aviso explicito de uso de modelo de linguagem deve estar presente
    expect(avisoLlm).toBeDefined();
    expect(avisoLlm?.texto).toBe(fluxos.menu.textos_globais.aviso_llm);
  });
});
