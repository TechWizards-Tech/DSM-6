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
  extrairMensagemTwilio,
  gerarTwiml,
  mascararTelefone,
} from '../src/modules/whatsapp/adaptador.js';
import { ClienteTwilio, type ClienteWhatsApp } from '../src/modules/whatsapp/cliente.js';

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
    agendamentos: aplicacao.agendamentos,
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

  it('habilita com variaveis da Twilio', () => {
    const config = lerConfigWhatsApp({
      TWILIO_ACCOUNT_SID: 'AC123',
      TWILIO_AUTH_TOKEN: 'token123',
    });
    expect(config).toMatchObject({
      twilioAccountSid: 'AC123',
      twilioAuthToken: 'token123',
      twilioNumero: 'whatsapp:+14155238886',
    });
  });
});

describe('WhatsApp - Twilio Sandbox', () => {
  it('extrai mensagem do corpo urlencoded da Twilio', () => {
    const extraida = extrairMensagemTwilio({
      From: 'whatsapp:+5512991466308',
      Body: 'Olá PROCON',
      MessageSid: 'SM123456',
    });
    expect(extraida).toEqual({
      id: 'SM123456',
      telefone: '5512991466308',
      tipo: 'text',
      texto: 'Olá PROCON',
    });
  });

  it('gera TwiML XML valido', () => {
    const xml = gerarTwiml(['Primeira linha', 'Segunda linha']);
    expect(xml).toContain('<Response>');
    expect(xml).toContain('<Message><Body><![CDATA[Primeira linha]]></Body></Message>');
    expect(xml).toContain('<Message><Body><![CDATA[Segunda linha]]></Body></Message>');
    expect(xml).toContain('</Response>');
  });

  it('gera TwiML vazio quando nao ha mensagens', () => {
    expect(gerarTwiml([])).toBe('<?xml version="1.0" encoding="UTF-8"?>\n<Response/>');
  });

  it('responde requisicao webhook da Twilio com TwiML e inicia conversa', async () => {
    const aplicacao = criarAplicacao({
      diretorioFluxos: FLUXOS_DIR,
      whatsapp: { tokenVerificacao: 'teste' },
    });

    const resposta = await request(aplicacao.app)
      .post('/api/whatsapp/twilio')
      .type('form')
      .send({
        From: 'whatsapp:+5512991466308',
        Body: 'oi',
        MessageSid: 'SM-teste-1',
      });

    expect(resposta.status).toBe(200);
    expect(resposta.headers['content-type']).toContain('xml');
    expect(resposta.text).toContain('<Response>');
    expect(resposta.text).toContain(aplicacao.fluxos.menu.textos_globais.saudacao);
    expect(resposta.text).toContain('*1.*');
  });

  it('avanca opcao selecionada pelo cidadao via Twilio', async () => {
    const aplicacao = criarAplicacao({
      diretorioFluxos: FLUXOS_DIR,
      whatsapp: { tokenVerificacao: 'teste' },
    });

    // Inicia
    await request(aplicacao.app)
      .post('/api/whatsapp/twilio')
      .type('form')
      .send({ From: 'whatsapp:+5512991466308', Body: 'oi', MessageSid: 'SM-t1' });

    // Envia opcao 1
    const resposta2 = await request(aplicacao.app)
      .post('/api/whatsapp/twilio')
      .type('form')
      .send({ From: 'whatsapp:+5512991466308', Body: '1', MessageSid: 'SM-t2' });

    expect(resposta2.status).toBe(200);
    expect(resposta2.text).toContain('<Response>');
    const sessoes = await aplicacao.sessoes.listar();
    expect(sessoes[0]?.etapa).toBe('em_fluxo');
    expect(sessoes[0]?.usuario).toBe('5512991466308');
  });

  it('ClienteTwilio envia POST correto para API REST', async () => {
    let chamadaUrl = '';
    let chamadaBody = '';
    let chamadaAuth = '';

    const fakeFetch: typeof fetch = (url, init) => {
      chamadaUrl = String(url);
      chamadaBody = String(init?.body);
      chamadaAuth = String((init?.headers as Record<string, string>)?.Authorization);
      return Promise.resolve({
        ok: true,
        json: () => Promise.resolve({ sid: 'SMok' }),
      } as any);
    };

    const cliente = new ClienteTwilio(
      {
        accountSid: 'ACteste',
        authToken: 'tokenteste',
        numeroTwilio: 'whatsapp:+14155238886',
      },
      fakeFetch,
    );

    await cliente.enviarTexto('5512991466308', 'Mensagem teste');

    expect(chamadaUrl).toBe('https://api.twilio.com/2010-04-01/Accounts/ACteste/Messages.json');
    expect(chamadaAuth).toContain('Basic ');
    expect(chamadaBody).toContain('To=whatsapp%3A%2B5512991466308');
    expect(chamadaBody).toContain('From=whatsapp%3A%2B14155238886');
    expect(chamadaBody).toContain('Body=Mensagem+teste');
  });

  describe('WhatsApp - Agendamento Presencial Conversacional (RF07)', () => {
    it('permite agendar atendimento presencial conversando pelo WhatsApp quando fluxo indica agendamento_presencial', async () => {
      const { cliente, enviar, agendamentos } = montar();

      // 1. Inicia conversa ("oi")
      await enviar('oi');
      expect(cliente.ultima).toContain('Sou o assistente virtual do PROCON');

      // 2. Escolhe opcao 1: Cobrança indevida
      await enviar('1');
      expect(cliente.ultima).toContain('Você chegou a contratar esse serviço');

      // 3. Escolhe opcao 1: Nunca contratei
      await enviar('1');
      expect(cliente.ultima).toContain('Você tem em mãos as faturas');

      // 4. Escolhe opcao 1: Sim, tenho -> Leva a orientacao com agendamento_presencial
      await enviar('1');
      expect(cliente.ultima).toContain('*1.* Solicitar Agendamento Presencial Agora');
      expect(cliente.ultima).toContain('comparecer presencialmente ao PROCON');

      // 5. Escolhe "1" para solicitar o agendamento
      await enviar('1');
      expect(cliente.ultima).toContain('Agendamento Presencial');
      expect(cliente.ultima).toContain('Nome Completo');

      // 6. Envia Nome
      await enviar('Maria Eduarda');
      expect(cliente.ultima).toContain('Maria Eduarda');
      expect(cliente.ultima).toContain('CPF');

      // 7. Envia CPF com formato
      await enviar('123.456.789-00');
      expect(cliente.ultima).toContain('Para qual *data* você gostaria de agendar?');

      // 8. Envia Data futura em dia util (ex: 2026-10-20, terça-feira)
      await enviar('2026-10-20');
      expect(cliente.ultima).toContain('Horários disponíveis para');
      expect(cliente.ultima).toContain('*1.* 08:00');

      // 9. Escolhe o horario 1 (08:00)
      await enviar('1');
      expect(cliente.ultima).toContain('Agendamento Confirmado com Sucesso!');
      expect(cliente.ultima).toContain('Protocolo:');
      expect(cliente.ultima).toContain('Maria Eduarda');

      // 10. Verifica no repositorio de agendamentos que foi persistido
      const lista = await agendamentos.listar();
      expect(lista.length).toBeGreaterThan(0);
      const ag = lista.find((item) => item.nome === 'Maria Eduarda');
      expect(ag).toBeDefined();
      expect(ag?.cpf).toBe('123.456.789-00');
      expect(ag?.data).toBe('2026-10-20');
      expect(ag?.horario).toBe('08:00');
      expect(ag?.usuario).toBe(TELEFONE);
      expect(ag?.status).toBe('agendado');
    });

    it('permite cancelar o agendamento em andamento a qualquer momento digitando cancelar', async () => {
      const { cliente, enviar } = montar();

      // Navega ate a solicitacao de nome
      await enviar('oi');
      await enviar('1');
      await enviar('1');
      await enviar('1');
      await enviar('1');
      expect(cliente.ultima).toContain('Nome Completo');

      // Cancela
      await enviar('cancelar');
      expect(cliente.ultima).toContain('Agendamento cancelado');
    });

    it('valida CPF invalido e solicita correcao', async () => {
      const { cliente, enviar } = montar();

      await enviar('oi');
      await enviar('1');
      await enviar('1');
      await enviar('1');
      await enviar('1'); // quer agendar
      await enviar('Maria Eduarda'); // nome
      await enviar('123'); // CPF curto
      expect(cliente.ultima).toContain('CPF inválido');

      await enviar('12345678900'); // CPF correto
      expect(cliente.ultima).toContain('Para qual *data* você gostaria de agendar?');
    });
  });
});


