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
import type { ConectorBaileys } from '../modules/whatsapp/baileys.js';

export interface DependenciasWhatsApp {
  adaptador: AdaptadorWhatsApp;
  tokenVerificacao: string;
  /** Quando presente, webhooks sem assinatura valida da Meta sao recusados. */
  segredoApp?: string;
  /** Conector opcional via QR Code (Baileys). */
  conectorBaileys?: ConectorBaileys;
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
  conectorBaileys,
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

  // ------------------------------------------------------------ QR Code (Baileys)
  rotas.get('/qr/status', (_req, res) => {
    if (!conectorBaileys) {
      return res.status(404).json({ erro: 'Modo QR Code (Baileys) nao esta habilitado.' });
    }
    return res.json(conectorBaileys.obterEstado());
  });

  rotas.post('/qr/reset', async (_req, res) => {
    if (!conectorBaileys) {
      return res.status(404).json({ erro: 'Modo QR Code (Baileys) nao esta habilitado.' });
    }
    await conectorBaileys.resetarSessao();
    return res.json(conectorBaileys.obterEstado());
  });

  rotas.get('/qr', (_req, res) => {
    if (!conectorBaileys) {
      return res
        .status(404)
        .type('text/plain')
        .send('Modo QR Code (Baileys) nao esta habilitado. Defina WHATSAPP_MODO=baileys no .env.');
    }

    const html = `<!DOCTYPE html>
<html lang="pt-BR">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Conexão WhatsApp — PROCON Jacareí</title>
  <style>
    body { font-family: system-ui, -apple-system, sans-serif; background: #0f172a; color: #f8fafc; display: flex; align-items: center; justify-content: center; min-height: 100vh; margin: 0; padding: 16px; }
    .card { background: #1e293b; border-radius: 16px; padding: 32px; max-width: 440px; width: 100%; text-align: center; box-shadow: 0 20px 25px -5px rgba(0,0,0,0.4); border: 1px solid #334155; }
    h1 { font-size: 1.35rem; margin: 0 0 8px; color: #38bdf8; }
    p { color: #94a3b8; font-size: 0.95rem; line-height: 1.5; margin: 8px 0 20px; }
    .badge { display: inline-block; padding: 6px 14px; border-radius: 999px; font-weight: 600; font-size: 0.85rem; margin-bottom: 16px; }
    .badge.conectado { background: #065f46; color: #6ee7b7; }
    .badge.aguardando { background: #78350f; color: #fcd34d; }
    .badge.iniciando { background: #1e3a8a; color: #93c5fd; }
    .qr-box { background: #ffffff; padding: 16px; border-radius: 12px; display: inline-block; margin: 12px 0; }
    .qr-box img { display: block; width: 260px; height: 260px; }
    button { background: #334155; color: #f8fafc; border: 1px solid #475569; padding: 10px 18px; border-radius: 8px; cursor: pointer; font-weight: 600; margin-top: 16px; }
    button:hover { background: #475569; }
    .dica { font-size: 0.82rem; color: #cbd5e1; background: #0f172a; padding: 12px; border-radius: 8px; margin-top: 16px; text-align: left; }
  </style>
</head>
<body>
  <div class="card">
    <h1>🏛️ Chatbot PROCON Jacareí</h1>
    <div id="status-container">Carregando status...</div>
    <button onclick="resetar()">Gerar novo QR Code / Trocar aparelho</button>
    <div class="dica">
      <strong>Como conectar e testar com segurança:</strong><br/>
      1. No WhatsApp do celular, vá em <b>Aparelhos conectados &gt; Conectar aparelho</b> e leia o QR Code.<br/>
      2. <b>Trava de segurança ativa:</b> O robô <u>nunca</u> responde grupos nem conversas pessoais normais!<br/>
      3. Para usar o bot, mande <b>"oi"</b> na conversa com <b>você mesma</b>, ou peça para alguém te mandar <b>"oi procon"</b>!
    </div>
  </div>
  <script>
    async function atualizar() {
      try {
        const r = await fetch('/api/whatsapp/qr/status');
        const d = await r.json();
        const el = document.getElementById('status-container');
        if (d.status === 'conectado') {
          el.innerHTML = '<span class="badge conectado">✅ WhatsApp Conectado!</span><p>Aparelho ativo: <b>+' + (d.numeroConectado || '') + '</b><br/>O chatbot do PROCON já está respondendo mensagens em tempo real.</p>';
        } else if (d.status === 'aguardando_qr' && d.qrCodeDataUrl) {
          el.innerHTML = '<span class="badge aguardando">📲 Aguardando leitura do QR Code</span><br/><div class="qr-box"><img src="' + d.qrCodeDataUrl + '" alt="QR Code WhatsApp" /></div>';
        } else {
          el.innerHTML = '<span class="badge iniciando">⏳ Preparando conexão com o WhatsApp...</span><p>Aguarde alguns segundos, o QR Code aparecerá automaticamente.</p>';
        }
      } catch (e) {}
    }
    async function resetar() {
      document.getElementById('status-container').innerHTML = '<span class="badge iniciando">🔄 Reiniciando sessão e gerando novo QR Code...</span>';
      await fetch('/api/whatsapp/qr/reset', { method: 'POST' });
      setTimeout(atualizar, 1500);
    }
    atualizar();
    setInterval(atualizar, 2500);
  </script>
</body>
</html>`;
    return res.status(200).type('text/html').send(html);
  });

  return rotas;
}


