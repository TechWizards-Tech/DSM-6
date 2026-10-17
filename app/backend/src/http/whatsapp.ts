/**
 * Webhook da WhatsApp Cloud API (RF01).
 *
 * Segundo adaptador HTTP, ao lado de `rotas.ts`: o simulador web e o WhatsApp
 * chamam o mesmo motor de conversa.
 *
 * - GET  /api/whatsapp/webhook  -> verificacao feita pela Meta ao cadastrar a URL
 * - POST /api/whatsapp/webhook  -> mensagens recebidas do cidadao
 */
import { createHmac, timingSafeEqual } from 'node:crypto';
import express, { Router } from 'express';
import {
  extrairMensagensRecebidas,
  extrairMensagemTwilio,
  gerarTwiml,
  mascararTelefone,
  type AdaptadorWhatsApp,
} from '../modules/whatsapp/adaptador.js';

export interface DependenciasWhatsApp {
  adaptador: AdaptadorWhatsApp;
  tokenVerificacao: string;
  /** Quando presente, webhooks sem assinatura valida da Meta sao recusados. */
  segredoApp?: string;
}

/** Confere o cabecalho X-Hub-Signature-256 (HMAC-SHA256 do corpo com o app secret). */
export function assinaturaValida(corpo: Buffer, cabecalho: string | undefined, segredo: string): boolean {
  if (!cabecalho?.startsWith('sha256=')) return false;
  const recebida = Buffer.from(cabecalho.slice('sha256='.length), 'hex');
  const esperada = createHmac('sha256', segredo).update(corpo).digest();
  return recebida.length === esperada.length && timingSafeEqual(recebida, esperada);
}

export function criarRotasWhatsApp({
  adaptador,
  tokenVerificacao,
  segredoApp,
}: DependenciasWhatsApp): Router {
  const rotas = Router();

  // ------------------------------------------------------------ Meta Cloud API
  rotas.get('/webhook', (req, res) => {
    const modo = req.query['hub.mode'];
    const token = req.query['hub.verify_token'];
    const desafio = req.query['hub.challenge'];

    console.log(`[WhatsApp Webhook Meta] GET de verificacao recebido (modo=${modo})`);

    if (modo === 'subscribe' && token === tokenVerificacao && typeof desafio === 'string') {
      console.log('[WhatsApp Webhook Meta] Verificacao aceita com sucesso!');
      return res.status(200).type('text/plain').send(desafio);
    }
    console.warn('[WhatsApp Webhook Meta] Verificacao rejeitada (token invalido ou modo incorreto)');
    return res.sendStatus(403);
  });

  // Corpo bruto: a assinatura da Meta e calculada sobre os bytes exatos recebidos.
  rotas.post('/webhook', express.raw({ type: '*/*', limit: '1mb' }), (req, res) => {
    const bruto = Buffer.isBuffer(req.body) ? req.body : Buffer.alloc(0);

    if (segredoApp && !assinaturaValida(bruto, req.get('x-hub-signature-256'), segredoApp)) {
      console.warn('[WhatsApp Webhook Meta] Assinatura HMAC rejeitada');
      return res.sendStatus(401);
    }

    let payload: unknown;
    try {
      payload = JSON.parse(bruto.toString('utf8'));
    } catch {
      return res.sendStatus(400);
    }

    res.sendStatus(200);
    const msgs = extrairMensagensRecebidas(payload);
    console.log(`[WhatsApp Webhook Meta] POST recebido com ${msgs.length} mensagem(ns)`);
    const mudancas = (payload as any)?.entry?.[0]?.changes?.[0]?.value;
    if (mudancas?.statuses) {
      console.log('[WhatsApp Webhook Meta Status]:', JSON.stringify(mudancas.statuses));
    }
    for (const mensagem of msgs) {
      void adaptador.receber(mensagem);
    }
  });

  // ------------------------------------------------------------ Twilio Sandbox
  rotas.get('/twilio', (_req, res) => {
    res.status(200).type('text/plain').send('Twilio WhatsApp Webhook ativo! Use POST para mensagens.');
  });

  rotas.post('/twilio', express.urlencoded({ extended: false }), async (req, res) => {
    console.log(
      `[WhatsApp Webhook Twilio] POST recebido de ${req.body.From ? mascararTelefone(String(req.body.From)) : 'desconhecido'}: "${req.body.Body}"`,
    );

    const mensagem = extrairMensagemTwilio(req.body);
    if (!mensagem) {
      console.warn('[WhatsApp Webhook Twilio] Payload invalido ou sem telefone.');
      return res.status(400).type('text/xml').send('<?xml version="1.0" encoding="UTF-8"?><Response/>');
    }

    try {
      const partes = await adaptador.receberTwilio(mensagem);
      const twiml = gerarTwiml(partes);
      console.log(`[WhatsApp Webhook Twilio] Respondendo via TwiML com ${partes.length} mensagem(ns)`);
      return res.status(200).type('text/xml').send(twiml);
    } catch (erro) {
      console.error('[WhatsApp Webhook Twilio] Erro ao processar:', erro);
      return res.status(500).type('text/xml').send('<?xml version="1.0" encoding="UTF-8"?><Response/>');
    }
  });

  return rotas;
}

