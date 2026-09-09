/**
 * Testes da gestao dos fluxos decisorios.
 *
 * Estes testes rodam contra os JSON reais do PROCON, nao contra fixtures. Se a
 * Pessoa 3 publicar um fluxo com um no orfao ou um rotulo grande demais para o
 * WhatsApp, o CI reprova antes de chegar na demo.
 */
import { describe, expect, it } from 'vitest';
import { fileURLToPath } from 'node:url';
import { carregarCatalogo, RepositorioFluxos, normalizar } from '../src/modules/fluxos/repositorio.js';

const DIRETORIO_FLUXOS = fileURLToPath(new URL('../../fluxos', import.meta.url));

const fluxos = new RepositorioFluxos(carregarCatalogo(DIRETORIO_FLUXOS));

describe('catalogo de fluxos', () => {
  it('carrega todos os fluxos do PROCON sem erro de integridade', () => {
    expect(fluxos.listarFluxos().length).toBeGreaterThanOrEqual(9);
  });

  it('mantem menu e fluxos em sincronia', () => {
    for (const item of fluxos.itensMenu) {
      expect(fluxos.buscarFluxo(item.fluxo), `menu aponta para ${item.fluxo}`).toBeDefined();
    }
  });

  it('respeita os limites de mensagem do WhatsApp', () => {
    for (const fluxo of fluxos.listarFluxos()) {
      for (const [noId, no] of Object.entries(fluxo.nos)) {
        expect(no.texto.length, `${fluxo.id}/${noId}: corpo da mensagem`).toBeLessThanOrEqual(1024);
        if (no.tipo === 'pergunta') {
          expect(no.opcoes.length, `${fluxo.id}/${noId}: numero de botoes`).toBeLessThanOrEqual(3);
          for (const opcao of no.opcoes) {
            expect(opcao.rotulo.length, `${fluxo.id}/${noId}/${opcao.id}`).toBeLessThanOrEqual(20);
          }
        }
      }
    }
  });

  it('toda orientacao tem encaminhamento valido', () => {
    const validos = Object.keys(fluxos.menu.encaminhamentos);
    for (const fluxo of fluxos.listarFluxos()) {
      for (const [noId, no] of Object.entries(fluxo.nos)) {
        if (no.tipo !== 'orientacao') continue;
        expect(validos, `${fluxo.id}/${noId}`).toContain(no.encaminhamento);
      }
    }
  });

  it('todo caminho a partir do no inicial termina em uma orientacao', () => {
    for (const fluxo of fluxos.listarFluxos()) {
      const visitados = new Set<string>();
      const percorrer = (noId: string, caminho: string[]): void => {
        const no = fluxo.nos[noId];
        expect(no, `${fluxo.id}: no "${noId}" citado em ${caminho.join(' > ')}`).toBeDefined();
        if (!no) return;
        if (no.tipo === 'orientacao') return;
        // Ciclo: o cidadao ficaria preso em um loop de perguntas.
        expect(visitados.has(noId), `${fluxo.id}: ciclo em ${caminho.join(' > ')}`).toBe(false);
        visitados.add(noId);
        for (const opcao of no.opcoes) percorrer(opcao.proximo, [...caminho, noId]);
        visitados.delete(noId);
      };
      percorrer(fluxo.no_inicial, []);
    }
  });
});

describe('roteamento por texto livre', () => {
  it('encontra o fluxo pelas palavras-chave', () => {
    const achado = fluxos.rotearPorTexto('estao cobrando um seguro no meu cartao');
    expect(achado?.id).toBe('cobranca-servico-nao-contratado');
  });

  it('nao inventa fluxo quando nada casa', () => {
    expect(fluxos.rotearPorTexto('qual a previsao do tempo amanha')).toBeUndefined();
  });
});

describe('normalizacao de texto', () => {
  it('ignora acento, caixa e pontuacao', () => {
    expect(normalizar('  Não  TENHO!  ')).toBe('nao tenho');
  });
});
