/**
 * Testes do motor de conversa.
 *
 * Cobrem a fatia vertical que a Sprint 1 precisa demonstrar:
 * mensagem -> sessao -> fluxo -> pergunta -> resposta -> orientacao final -> registro.
 */
import { beforeEach, describe, expect, it } from 'vitest';
import { fileURLToPath } from 'node:url';

import { MotorConversa, OPCAO_MENU, OPCAO_OUTRO } from '../src/modules/chatbot/motor.js';
import { RepositorioSessoesMemoria } from '../src/modules/chatbot/sessao.js';
import { carregarCatalogo, RepositorioFluxos } from '../src/modules/fluxos/repositorio.js';
import { ProvedorLlmDesativado } from '../src/modules/llm/index.js';
import {
  calcularEstatisticas,
  RepositorioInteracoesMemoria,
} from '../src/modules/registro/index.js';
import { mensagemParaDTO } from '../src/http/dto.js';

const DIRETORIO_FLUXOS = fileURLToPath(new URL('../../fluxos', import.meta.url));
const fluxos = new RepositorioFluxos(carregarCatalogo(DIRETORIO_FLUXOS));

let sessoes: RepositorioSessoesMemoria;
let interacoes: RepositorioInteracoesMemoria;
let motor: MotorConversa;

beforeEach(() => {
  sessoes = new RepositorioSessoesMemoria();
  interacoes = new RepositorioInteracoesMemoria();
  motor = new MotorConversa(fluxos, sessoes, interacoes, new ProvedorLlmDesativado());
});

describe('inicio da conversa', () => {
  it('envia saudacao e menu de assuntos', async () => {
    const { sessao, novasMensagens } = await motor.iniciar('+5512999990000');

    expect(sessao.etapa).toBe('menu');
    expect(sessao.usuario).toBe('+5512999990000');
    expect(novasMensagens.map((m) => m.tipo)).toEqual(['texto', 'menu']);

    const menu = novasMensagens[1]!;
    expect(menu.texto).toBe(fluxos.menu.textos_globais.texto_menu);
    expect(menu.opcoes).toHaveLength(fluxos.itensMenu.length + 1);
    expect(menu.opcoes?.at(-1)?.id).toBe(OPCAO_OUTRO);
  });
});

describe('navegacao pelo fluxo decisorio (RF03)', () => {
  it('avanca do menu ate a orientacao final', async () => {
    const { sessao } = await motor.iniciar('+5512999990000');

    const passo1 = await motor.responder(sessao.id, {
      tipo: 'opcao',
      opcaoId: 'cobranca-servico-nao-contratado',
    });
    expect(passo1.sessao.etapa).toBe('em_fluxo');
    expect(passo1.sessao.noAtual).toBe('inicio');

    const pergunta = passo1.novasMensagens.find((m) => m.tipo === 'pergunta');
    expect(pergunta?.opcoes?.map((o) => o.id)).toEqual(['nunca', 'cancelei', 'nao_sei']);

    const passo2 = await motor.responder(sessao.id, { tipo: 'opcao', opcaoId: 'nunca' });
    expect(passo2.sessao.noAtual).toBe('tem_faturas');

    const passo3 = await motor.responder(sessao.id, { tipo: 'opcao', opcaoId: 'sim' });
    expect(passo3.sessao.etapa).toBe('finalizada');

    const tipos = passo3.novasMensagens.map((m) => m.tipo);
    expect(tipos).toContain('orientacao');
    // RNF04: o aviso de carater orientativo acompanha toda orientacao.
    expect(tipos).toContain('aviso');
    expect(tipos).toContain('encaminhamento');

    const orientacao = passo3.novasMensagens.find((m) => m.tipo === 'orientacao')!;
    expect(orientacao.documentos).toContain('RG com CPF');
    expect(orientacao.ressalvas?.length).toBeGreaterThan(0);
    // RNF05: nada passou por LLM na Sprint 1.
    expect(orientacao.geradoPorLlm).toBe(false);

    const encaminhamento = passo3.novasMensagens.find((m) => m.tipo === 'encaminhamento')!;
    expect(encaminhamento.encaminhamento).toBe('agendamento_presencial');
  });

  it('guarda o caminho percorrido na sessao', async () => {
    const { sessao } = await motor.iniciar('+5512999990000');
    await motor.responder(sessao.id, { tipo: 'opcao', opcaoId: 'cobranca-servico-nao-contratado' });
    await motor.responder(sessao.id, { tipo: 'opcao', opcaoId: 'cancelei' });

    const atual = await sessoes.buscar(sessao.id);
    expect(atual?.historico).toHaveLength(1);
    expect(atual?.historico[0]).toMatchObject({ noId: 'inicio', opcaoId: 'cancelei' });
  });
});

describe('entrada por texto livre', () => {
  it('aceita o numero da opcao, como as pessoas respondem no WhatsApp', async () => {
    const { sessao } = await motor.iniciar('+5512999990000');
    const turno = await motor.responder(sessao.id, { tipo: 'texto', texto: '1' });

    expect(turno.sessao.fluxoId).toBe(fluxos.itensMenu[0]!.fluxo);
  });

  it('aceita o rotulo escrito por extenso, com ou sem acento', async () => {
    const { sessao } = await motor.iniciar('+5512999990000');
    await motor.responder(sessao.id, { tipo: 'opcao', opcaoId: 'cobranca-servico-nao-contratado' });
    const turno = await motor.responder(sessao.id, { tipo: 'texto', texto: 'nunca contratei' });

    expect(turno.sessao.noAtual).toBe('tem_faturas');
  });

  it('roteia por palavra-chave quando o texto nao e uma opcao', async () => {
    const { sessao } = await motor.iniciar('+5512999990000');
    const turno = await motor.responder(sessao.id, {
      tipo: 'texto',
      texto: 'apareceu um seguro na minha fatura que eu nao contratei',
    });

    expect(turno.sessao.fluxoId).toBe('cobranca-servico-nao-contratado');
  });
});

describe('entradas invalidas', () => {
  it('avisa e reapresenta a pergunta em vez de travar', async () => {
    const { sessao } = await motor.iniciar('+5512999990000');
    await motor.responder(sessao.id, { tipo: 'opcao', opcaoId: 'cobranca-servico-nao-contratado' });

    const turno = await motor.responder(sessao.id, { tipo: 'texto', texto: 'talvez, sei la' });

    expect(turno.novasMensagens.some((m) => m.texto === fluxos.menu.textos_globais.opcao_invalida)).toBe(true);
    // A pergunta volta com as opcoes, entao o cidadao nao fica sem saida.
    expect(turno.novasMensagens.some((m) => m.tipo === 'pergunta')).toBe(true);
    expect(turno.sessao.noAtual).toBe('inicio');
  });

  it('avisa e reapresenta o menu quando a entrada invalida acontece no menu', async () => {
    const { sessao } = await motor.iniciar('+5512999990000');
    const turno = await motor.responder(sessao.id, { tipo: 'opcao', opcaoId: 'fluxo-inexistente' });

    expect(turno.sessao.etapa).toBe('menu');
    expect(turno.novasMensagens.some((m) => m.tipo === 'menu')).toBe(true);
  });
});

describe('comandos globais', () => {
  it('"menu" volta ao inicio de qualquer ponto da conversa', async () => {
    const { sessao } = await motor.iniciar('+5512999990000');
    await motor.responder(sessao.id, { tipo: 'opcao', opcaoId: 'garantia-produto' });

    const turno = await motor.responder(sessao.id, { tipo: 'texto', texto: 'MENU' });

    expect(turno.sessao.etapa).toBe('menu');
    expect(turno.sessao.fluxoId).toBeUndefined();
    expect(turno.sessao.historico).toHaveLength(0);
  });

  it('"voltar" desfaz o ultimo passo', async () => {
    const { sessao } = await motor.iniciar('+5512999990000');
    await motor.responder(sessao.id, { tipo: 'opcao', opcaoId: 'cobranca-servico-nao-contratado' });
    await motor.responder(sessao.id, { tipo: 'opcao', opcaoId: 'nunca' });

    const turno = await motor.responder(sessao.id, { tipo: 'texto', texto: 'voltar' });

    expect(turno.sessao.noAtual).toBe('inicio');
    expect(turno.sessao.historico).toHaveLength(0);
  });

  it('"voltar" no primeiro passo devolve ao menu', async () => {
    const { sessao } = await motor.iniciar('+5512999990000');
    await motor.responder(sessao.id, { tipo: 'opcao', opcaoId: 'atraso-entrega' });

    const turno = await motor.responder(sessao.id, { tipo: 'texto', texto: 'voltar' });

    expect(turno.sessao.etapa).toBe('menu');
  });

  it('"atendente" encaminha para o atendimento presencial', async () => {
    const { sessao } = await motor.iniciar('+5512999990000');
    const turno = await motor.responder(sessao.id, { tipo: 'texto', texto: 'atendente' });

    const encaminhamento = turno.novasMensagens.find((m) => m.tipo === 'encaminhamento');
    expect(encaminhamento?.encaminhamento).toBe('agendamento_presencial');
  });

  it('"sair" encerra a conversa', async () => {
    const { sessao } = await motor.iniciar('+5512999990000');
    const turno = await motor.responder(sessao.id, { tipo: 'texto', texto: 'sair' });

    expect(turno.sessao.etapa).toBe('finalizada');
    expect(turno.novasMensagens.at(-1)?.texto).toBe(fluxos.menu.textos_globais.encerramento);
  });
});

describe('opcao "outro assunto"', () => {
  it('encaminha para atendimento presencial sem inventar orientacao', async () => {
    const { sessao } = await motor.iniciar('+5512999990000');
    const turno = await motor.responder(sessao.id, { tipo: 'opcao', opcaoId: OPCAO_OUTRO });

    expect(turno.sessao.etapa).toBe('finalizada');
    expect(turno.novasMensagens.find((m) => m.tipo === 'encaminhamento')?.encaminhamento).toBe(
      'agendamento_presencial',
    );
  });
});

describe('registro das interacoes (RF06)', () => {
  it('registra a conversa e permite ver os fluxos mais utilizados', async () => {
    const primeira = await motor.iniciar('+5512999990000');
    await motor.responder(primeira.sessao.id, {
      tipo: 'opcao',
      opcaoId: 'cobranca-servico-nao-contratado',
    });
    await motor.responder(primeira.sessao.id, { tipo: 'opcao', opcaoId: 'nunca' });
    await motor.responder(primeira.sessao.id, { tipo: 'opcao', opcaoId: 'sim' });

    const segunda = await motor.iniciar('+5512988887777');
    await motor.responder(segunda.sessao.id, {
      tipo: 'opcao',
      opcaoId: 'cobranca-servico-nao-contratado',
    });

    const estatisticas = calcularEstatisticas(await interacoes.listar());

    expect(estatisticas.conversasIniciadas).toBe(2);
    expect(estatisticas.orientacoesEntregues).toBe(1);
    expect(estatisticas.fluxosMaisUtilizados[0]).toMatchObject({
      fluxoId: 'cobranca-servico-nao-contratado',
      vezesEscolhido: 2,
      orientacoesEntregues: 1,
    });
  });
});

describe('protecao de dados na fronteira', () => {
  it('nao envia base_legal ao cidadao', async () => {
    const { sessao } = await motor.iniciar('+5512999990000');
    await motor.responder(sessao.id, { tipo: 'opcao', opcaoId: 'cobranca-servico-nao-contratado' });
    await motor.responder(sessao.id, { tipo: 'opcao', opcaoId: 'nunca' });
    const turno = await motor.responder(sessao.id, { tipo: 'opcao', opcaoId: 'sim' });

    const orientacao = turno.novasMensagens.find((m) => m.tipo === 'orientacao')!;
    const dto = mensagemParaDTO(orientacao, fluxos);

    expect(JSON.stringify(dto)).not.toContain('base_legal');
    expect(JSON.stringify(dto)).not.toContain('Art. 42');
  });
});

describe('isolamento entre sessoes (RP01)', () => {
  it('duas pessoas conversando ao mesmo tempo nao se misturam', async () => {
    const ana = await motor.iniciar('+5512900000001');
    const bruno = await motor.iniciar('+5512900000002');

    await motor.responder(ana.sessao.id, { tipo: 'opcao', opcaoId: 'garantia-produto' });
    await motor.responder(bruno.sessao.id, { tipo: 'opcao', opcaoId: 'atraso-entrega' });

    expect((await sessoes.buscar(ana.sessao.id))?.fluxoId).toBe('garantia-produto');
    expect((await sessoes.buscar(bruno.sessao.id))?.fluxoId).toBe('atraso-entrega');
  });
});

describe('sessao inexistente', () => {
  it('falha de forma explicita', async () => {
    await expect(
      motor.responder('nao-existe', { tipo: 'opcao', opcaoId: OPCAO_MENU }),
    ).rejects.toThrow(/nao encontrada/i);
  });
});
