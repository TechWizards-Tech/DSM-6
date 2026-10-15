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

  rotas.get('/webhook', (req, res) => {
    const modo = req.query['hub.mode'];
    const token = req.query['hub.verify_token'];
    const desafio = req.query['hub.challenge'];

    console.log(`[WhatsApp Webhook] GET de verificacao recebido (modo=${modo})`);

    if (modo === 'subscribe' && token === tokenVerificacao && typeof desafio === 'string') {
      console.log('[WhatsApp Webhook] Verificacao aceita com sucesso!');
      return res.status(200).type('text/plain').send(desafio);
    }
    console.warn('[WhatsApp Webhook] Verificacao rejeitada (token invalido ou modo incorreto)');
    return res.sendStatus(403);
  });

  // Corpo bruto: a assinatura da Meta e calculada sobre os bytes exatos recebidos.
  rotas.post('/webhook', express.raw({ type: '*/*', limit: '1mb' }), (req, res) => {
    const bruto = Buffer.isBuffer(req.body) ? req.body : Buffer.alloc(0);

    if (segredoApp && !assinaturaValida(bruto, req.get('x-hub-signature-256'), segredoApp)) {
      console.warn('[WhatsApp Webhook] Assinatura HMAC rejeitada');
      return res.sendStatus(401);
    }

    let payload: unknown;
    try {
      payload = JSON.parse(bruto.toString('utf8'));
    } catch {
      return res.sendStatus(400);
    }

    // A Meta espera 200 rapido; se demorar, ela reenvia. O processamento segue
    // em segundo plano e reentregas sao descartadas pelo id da mensagem.
    res.sendStatus(200);
    const msgs = extrairMensagensRecebidas(payload);
    console.log(`[WhatsApp Webhook] POST recebido com ${msgs.length} mensagem(ns)`);
    const mudancas = (payload as any)?.entry?.[0]?.changes?.[0]?.value;
    if (mudancas?.statuses) {
      console.log('[WhatsApp Webhook Status]:', JSON.stringify(mudancas.statuses));
    }
    for (const mensagem of msgs) {
      void adaptador.receber(mensagem);
    }
  });

  return rotas;
}
