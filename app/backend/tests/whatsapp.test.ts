import { createHmac } from 'node:crypto';
import path from 'node:path';
import fileUrl from 'node:url';
import request from 'supertest';
import { describe, expect, it, vi } from 'vitest';
import { criarAplicacao } from '../src/app.js';
import type { Mensagem } from '../src/modules/chatbot/sessao.js';
import {
  AdaptadorWhatsApp,
  TEXTO_TIPO_NAO_SUPORTADO,
  extrairMensagensRecebidas,
  mascararTelefone,
} from '../src/modules/whatsapp/adaptador.js';
import type { ClienteWhatsApp } from '../src/modules/whatsapp/cliente.js';
import { lerConfigWhatsApp } from '../src/modules/whatsapp/config.js';
import { formatarTurno } from '../src/modules/whatsapp/formatador.js';

const __filename = fileUrl.fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const FLUXOS_DIR = path.resolve(__dirname, '../../../fluxos');

const TELEFONE = '5512999990000';
const TOKEN_VERIFICACAO = 'token-de-teste';
const SEGREDO = 'segredo-de-teste';

class ClienteFalso implements ClienteWhatsApp {
  enviadas: { para: string; texto: string }[] = [];
  async enviarTexto(para: string, texto: string): Promise<void> {
    this.enviadas.push({ para, texto });
  }
  get ultima(): string {
    return this.enviadas.at(-1)?.texto ?? '';
  }
}

function montar(inatividadeMs?: number, agora?: () => number) {
  const cliente = new ClienteFalso();
  const aplicacao = criarAplicacao({ diretorioFluxos: FLUXOS_DIR });
  const adaptador = new AdaptadorWhatsApp({
    motor: aplicacao.motor,
    sessoes: aplicacao.sessoes,
    fluxos: aplicacao.fluxos,
    cliente,
    inatividadeMs,
    agora,
  });
  let contador = 0;
  const enviar = (texto: string, tipo = 'text') =>
    adaptador.receber({ id: `wamid.${++contador}`, telefone: TELEFONE, tipo, texto });
  return { cliente, adaptador, enviar, ...aplicacao };
}

function payload(texto: string, id = 'wamid.webhook') {
  return {
    object: 'whatsapp_business_account',
    entry: [
      {
        changes: [
          {
            value: {
              messages: [{ id, from: TELEFONE, type: 'text', text: { body: texto } }],
            },
          },
        ],
      },
    ],
  };
}

function assinar(corpo: string): string {
  return `sha256=${createHmac('sha256', SEGREDO).update(corpo).digest('hex')}`;
}

describe('WhatsApp - formatador', () => {
  it('numera as opcoes e descarta o eco do cidadao', () => {
    const base = { sessaoId: 's', geradoPorLlm: false, criadaEm: '' };
    const mensagens: Mensagem[] = [
      { ...base, id: '1', autor: 'cidadao', tipo: 'texto', texto: 'oi' },
      {
        ...base,
        id: '2',
        autor: 'bot',
        tipo: 'menu',
        texto: 'Escolha:',
        opcoes: [
          { id: 'a', rotulo: 'Primeira', descricao: 'desc A' },
          { id: 'b', rotulo: 'Segunda' },
        ],
      },
    ];

    const [texto, ...resto] = formatarTurno(mensagens);
    expect(resto).toHaveLength(0);
    expect(texto).not.toContain('oi');
    expect(texto).toContain('*1.* Primeira - desc A');
    expect(texto).toContain('*2.* Segunda');
  });

  it('respeita o limite de caracteres da Cloud API', () => {
    const grande: Mensagem = {
      id: 'x',
      sessaoId: 's',
      autor: 'bot',
      tipo: 'texto',
      texto: 'linha\n'.repeat(2000),
      geradoPorLlm: false,
      criadaEm: '',
    };
    const partes = formatarTurno([grande], 4096);
    expect(partes.length).toBeGreaterThan(1);
    expect(partes.every((parte) => parte.length <= 4096)).toBe(true);
  });
});

describe('WhatsApp - adaptador (RF01, RP01)', () => {
  it('primeira mensagem abre a conversa com saudacao e menu', async () => {
    const { cliente, enviar, fluxos } = montar();
    await enviar('oi');

    expect(cliente.enviadas).toHaveLength(1);
    expect(cliente.enviadas[0]!.para).toBe(TELEFONE);
    expect(cliente.ultima).toContain(fluxos.menu.textos_globais.saudacao);
    expect(cliente.ultima).toContain(`*1.* ${fluxos.menu.itens[0]!.rotulo}`);
  });

  it('identifica o usuario pelo telefone e responde pelo numero da opcao', async () => {
    const { enviar, sessoes, fluxos } = montar();
    await enviar('oi');
    await enviar('1');

    const [sessao, ...outras] = await sessoes.listar();
    expect(outras).toHaveLength(0);
    expect(sessao!.usuario).toBe(TELEFONE);
    expect(sessao!.etapa).toBe('em_fluxo');
    expect(sessao!.fluxoId).toBe(fluxos.menu.itens[0]!.fluxo);
  });

  it('comandos globais continuam funcionando (menu)', async () => {
    const { cliente, enviar, sessoes, fluxos } = montar();
    await enviar('oi');
    await enviar('1');
    await enviar('menu');

    const [sessao] = await sessoes.listar();
    expect(sessao!.etapa).toBe('menu');
    expect(cliente.ultima).toContain(fluxos.menu.textos_globais.texto_menu);
  });

  it('depois de encerrar, um novo "oi" recomeca a conversa', async () => {
    const { cliente, enviar, sessoes, fluxos } = montar();
    await enviar('oi');
    await enviar('sair');
    expect(cliente.ultima).toContain(fluxos.menu.textos_globais.encerramento);

    await enviar('oi');
    expect(cliente.ultima).toContain(fluxos.menu.textos_globais.saudacao);
    expect(await sessoes.listar()).toHaveLength(2);
  });

  it('apos muito tempo parado, a conversa recomeca', async () => {
    let agora = Date.now();
    const { cliente, enviar, fluxos } = montar(1000, () => agora);
    await enviar('oi');
    await enviar('1');

    agora += 5000;
    await enviar('2');
    expect(cliente.ultima).toContain(fluxos.menu.textos_globais.saudacao);
  });

  it('ignora reentregas da mesma mensagem (mesmo id)', async () => {
    const { cliente, adaptador } = montar();
    const mensagem = { id: 'wamid.repetida', telefone: TELEFONE, tipo: 'text', texto: 'oi' };
    await adaptador.receber(mensagem);
    await adaptador.receber(mensagem);
    expect(cliente.enviadas).toHaveLength(1);
  });

  it('avisa quando recebe audio, imagem etc.', async () => {
    const { cliente, enviar } = montar();
    await enviar('', 'audio');
    expect(cliente.ultima).toBe(TEXTO_TIPO_NAO_SUPORTADO);
  });

  it('mascara o telefone nos logs (LGPD)', () => {
    expect(mascararTelefone(TELEFONE)).toBe('*********0000');
  });
});

describe('WhatsApp - payload da Meta', () => {
  it('extrai mensagens e ignora notificacoes de status', () => {
    expect(extrairMensagensRecebidas(payload('oi'))).toEqual([
      { id: 'wamid.webhook', telefone: TELEFONE, tipo: 'text', texto: 'oi' },
    ]);
    const status = {
      object: 'whatsapp_business_account',
      entry: [{ changes: [{ value: { statuses: [{ id: 'x', status: 'read' }] } }] }],
    };
    expect(extrairMensagensRecebidas(status)).toEqual([]);
    expect(extrairMensagensRecebidas({ object: 'page' })).toEqual([]);
  });
});

describe('WhatsApp - webhook HTTP', () => {
  function app() {
    const cliente = new ClienteFalso();
    const aplicacao = criarAplicacao({
      diretorioFluxos: FLUXOS_DIR,
      whatsapp: { cliente, tokenVerificacao: TOKEN_VERIFICACAO, segredoApp: SEGREDO },
    });
    return { cliente, ...aplicacao };
  }

  it('responde o desafio de verificacao da Meta', async () => {
    const resposta = await request(app().app).get('/api/whatsapp/webhook').query({
      'hub.mode': 'subscribe',
      'hub.verify_token': TOKEN_VERIFICACAO,
      'hub.challenge': '12345',
    });
    expect(resposta.status).toBe(200);
    expect(resposta.text).toBe('12345');
  });

  it('recusa verificacao com token errado', async () => {
    const resposta = await request(app().app).get('/api/whatsapp/webhook').query({
      'hub.mode': 'subscribe',
      'hub.verify_token': 'errado',
      'hub.challenge': '12345',
    });
    expect(resposta.status).toBe(403);
  });

  it('recusa webhook sem assinatura valida', async () => {
    const resposta = await request(app().app)
      .post('/api/whatsapp/webhook')
      .set('Content-Type', 'application/json')
      .set('X-Hub-Signature-256', 'sha256=00')
      .send(JSON.stringify(payload('oi')));
    expect(resposta.status).toBe(401);
  });

  it('aceita webhook assinado e responde o cidadao', async () => {
    const { app: servidor, cliente, fluxos } = app();
    const corpo = JSON.stringify(payload('oi'));

    const resposta = await request(servidor)
      .post('/api/whatsapp/webhook')
      .set('Content-Type', 'application/json')
      .set('X-Hub-Signature-256', assinar(corpo))
      .send(corpo);

    expect(resposta.status).toBe(200);
    await vi.waitFor(() => expect(cliente.enviadas).toHaveLength(1));
    expect(cliente.ultima).toContain(fluxos.menu.textos_globais.saudacao);
  });

  it('as rotas existentes continuam funcionando com o WhatsApp ligado', async () => {
    const resposta = await request(app().app).post('/api/conversas').send({ usuario: TELEFONE });
    expect(resposta.status).toBe(201);
  });

  it('sem configuracao, o webhook nao existe (comportamento anterior)', async () => {
    const { app: servidor } = criarAplicacao({ diretorioFluxos: FLUXOS_DIR });
    const resposta = await request(servidor).get('/api/whatsapp/webhook');
    expect(resposta.status).toBe(404);
  });
});

describe('WhatsApp - configuracao', () => {
  it('fica desligado sem as variaveis obrigatorias', () => {
    expect(lerConfigWhatsApp({})).toBeUndefined();
    expect(lerConfigWhatsApp({ WHATSAPP_ACCESS_TOKEN: 'x' })).toBeUndefined();
  });

  it('le as variaveis quando presentes', () => {
    const config = lerConfigWhatsApp({
      WHATSAPP_ACCESS_TOKEN: 'tok',
      WHATSAPP_PHONE_NUMBER_ID: '123',
      WHATSAPP_VERIFY_TOKEN: 'ver',
    });
    expect(config).toMatchObject({ tokenAcesso: 'tok', idNumeroTelefone: '123', versaoApi: 'v21.0' });
    expect(config?.segredoApp).toBeUndefined();
  });
});
