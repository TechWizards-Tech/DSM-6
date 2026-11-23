/**
 * Conector gratuito do WhatsApp via QR Code / WhatsApp Web (Baileys) — RF01 / RP01.
 *
 * Implementa a mesma interface `ClienteWhatsApp` usada pela Cloud API e Twilio,
 * repassando as mensagens recebidas diretamente para o `AdaptadorWhatsApp` sem
 * alterar nenhuma regra de negocio dos fluxos, motor, LLM ou agendamento.
 */
import makeWASocket, {
  DisconnectReason,
  fetchLatestBaileysVersion,
  useMultiFileAuthState,
  type WASocket,
} from '@whiskeysockets/baileys';
import { existsSync, mkdirSync, rmSync } from 'node:fs';
import { resolve } from 'node:path';
import QRCode from 'qrcode';
import qrcodeTerminal from 'qrcode-terminal';
import { mascararTelefone, type AdaptadorWhatsApp } from './adaptador.js';
import type { ClienteWhatsApp } from './cliente.js';

export type StatusBaileys = 'iniciando' | 'aguardando_qr' | 'conectado' | 'desconectado';

export interface EstadoQrWhatsApp {
  status: StatusBaileys;
  qrCodeDataUrl?: string;
  numeroConectado?: string;
  atualizadoEm: string;
}

export class ConectorBaileys implements ClienteWhatsApp {
  private sock?: WASocket;
  private adaptador?: AdaptadorWhatsApp;
  private status: StatusBaileys = 'iniciando';
  private qrCodeDataUrl?: string;
  private numeroConectado?: string;
  private atualizadoEm: string = new Date().toISOString();
  private readonly dirAuth: string;
  private readonly idsEnviadosPeloBot = new Set<string>();
  private readonly jidPorTelefone = new Map<string, string>();
  /** Contatos que ativaram explicitamente o atendimento do PROCON (evita responder conversas pessoais). */
  private readonly contatosAutorizados = new Set<string>();
  private reconectando = false;

  constructor(dirAuth?: string) {
    this.dirAuth = dirAuth ?? resolve(process.cwd(), 'dados/whatsapp_auth');
  }

  vincularAdaptador(adaptador: AdaptadorWhatsApp): void {
    this.adaptador = adaptador;
  }

  obterEstado(): EstadoQrWhatsApp {
    return {
      status: this.status,
      qrCodeDataUrl: this.qrCodeDataUrl,
      numeroConectado: this.numeroConectado,
      atualizadoEm: this.atualizadoEm,
    };
  }

  async iniciar(): Promise<void> {
    if (!existsSync(this.dirAuth)) {
      mkdirSync(this.dirAuth, { recursive: true });
    }

    const { state, saveCreds } = await useMultiFileAuthState(this.dirAuth);
    let version: [number, number, number] | undefined;
    try {
      const v = await fetchLatestBaileysVersion();
      version = v.version;
    } catch {
      // Usa a versao padrao embutida caso nao consiga consultar a ultima
    }

    // Logger silencioso compativel com pino usado internamente pelo Baileys
    const loggerSilencioso: any = {
      level: 'silent',
      trace: () => {},
      debug: () => {},
      info: () => {},
      warn: () => {},
      error: () => {},
      fatal: () => {},
      child: () => loggerSilencioso,
    };

    const sock = makeWASocket({
      ...(version ? { version } : {}),
      auth: state,
      printQRInTerminal: false,
      logger: loggerSilencioso,
      browser: ['PROCON Jacarei Chatbot', 'Chrome', '1.0.0'],
      syncFullHistory: false,
      shouldSyncHistoryMessage: () => false,
      markOnlineOnConnect: false,
    });

    this.sock = sock;
    this.reconectando = false;

    sock.ev.on('creds.update', saveCreds);

    sock.ev.on('connection.update', async (update) => {
      const { connection, lastDisconnect, qr } = update;

      if (qr) {
        this.status = 'aguardando_qr';
        this.atualizadoEm = new Date().toISOString();
        try {
          this.qrCodeDataUrl = await QRCode.toDataURL(qr, { margin: 2, width: 320 });
        } catch {
          this.qrCodeDataUrl = undefined;
        }
        console.log('\n============================================================');
        console.log('📲 ESCANEIE O QR CODE ABAIXO NO SEU WHATSAPP:');
        console.log('   Ou abra no navegador: http://localhost:3333/api/whatsapp/qr');
        console.log('============================================================\n');
        try {
          qrcodeTerminal.generate(qr, { small: true });
        } catch {}
      }

      if (connection === 'open') {
        this.status = 'conectado';
        this.qrCodeDataUrl = undefined;
        this.atualizadoEm = new Date().toISOString();
        const rawUser = sock.user?.id ?? '';
        this.numeroConectado = rawUser.split(':')[0]?.split('@')[0] || 'Conectado';
        console.log(`\n✅ [WhatsApp QR] Conectado com sucesso! Numero: +${this.numeroConectado}\n`);
      }

      if (connection === 'close') {
        const codigo = (lastDisconnect?.error as any)?.output?.statusCode;
        const msgErro = (lastDisconnect?.error as any)?.message || String(lastDisconnect?.error || '');
        const foiLogout = codigo === DisconnectReason.loggedOut;

        if (foiLogout) {
          console.warn('[WhatsApp QR] Sessao desconectada pelo celular (logout). Limpando credenciais...');
          this.status = 'desconectado';
          this.qrCodeDataUrl = undefined;
          this.numeroConectado = undefined;
          this.atualizadoEm = new Date().toISOString();
          this.limparCredenciais();
          setTimeout(() => void this.iniciar(), 1500);
        } else if (!this.reconectando) {
          this.reconectando = true;
          this.status = 'iniciando';
          this.atualizadoEm = new Date().toISOString();
          console.log(`[WhatsApp QR] Conexao oscilou (codigo=${codigo}, motivo=${msgErro}), reconectando...`);
          setTimeout(() => void this.iniciar(), 2500);
        }
      }
    });

    sock.ev.on('messages.upsert', async (evento) => {
      if (evento.type !== 'notify') return;
      if (!this.adaptador) return;

      for (const msg of evento.messages) {
        const msgId = msg.key?.id;
        const remoteJid = msg.key?.remoteJid;
        if (!msgId || !remoteJid) continue;

        // Ignora grupos, status e canais
        if (
          remoteJid.endsWith('@g.us') ||
          remoteJid === 'status@broadcast' ||
          remoteJid.endsWith('@newsletter')
        ) {
          continue;
        }

        // Ignora mensagens que o proprio bot acabou de enviar (evita loop infinito)
        if (this.idsEnviadosPeloBot.has(msgId)) {
          continue;
        }

        const meuNumero = (sock.user?.id ?? '').split(':')[0]?.split('@')[0];
        const meuLid = ((sock.user as any)?.lid ?? '').split(':')[0]?.split('@')[0];
        const destinoNumero = remoteJid.split(':')[0]?.split('@')[0];
        const ehChatConsigoMesmo =
          Boolean(destinoNumero) &&
          (destinoNumero === meuNumero || (Boolean(meuLid) && destinoNumero === meuLid));

        // Se a mensagem foi enviada pelo proprio aparelho conectado (fromMe):
        // So processa se for no chat consigo mesmo ("Voce" / Note to self)!
        if (msg.key.fromMe && !ehChatConsigoMesmo) {
          continue;
        }

        const texto =
          msg.message?.conversation ||
          msg.message?.extendedTextMessage?.text ||
          msg.message?.buttonsResponseMessage?.selectedDisplayText ||
          msg.message?.listResponseMessage?.title ||
          '';

        const textoLimpo = texto.trim();
        if (!textoLimpo) continue;

        // Extrai identificacao numerica limpa do remetente
        const telefone = remoteJid.split(':')[0]?.split('@')[0]?.replace(/\D/g, '') || remoteJid;
        this.jidPorTelefone.set(telefone, remoteJid);

        // TRAVA DE SEGURANCA PESSOAL:
        // Para outra pessoa nao receber resposta automatica do bot quando te mandar mensagem pessoal,
        // outros contatos so ativam o bot se enviarem uma mensagem contendo "procon" (ex: "oi procon", "#procon", "procon").
        // Já no chat com voce mesma ("Voce"), qualquer mensagem (ex: "oi") funciona direto!
        const mencionouProcon = /\bprocon\b/i.test(textoLimpo);
        if (!ehChatConsigoMesmo && !this.contatosAutorizados.has(telefone)) {
          if (!mencionouProcon) {
            console.log(
              `[WhatsApp QR] Mensagem pessoal ignorada de ${mascararTelefone(telefone)} (nao contem a palavra 'procon').`,
            );
            continue;
          }
          this.contatosAutorizados.add(telefone);
        }

        // Se o contato digitar "sair", remove da lista de ativos ate ele chamar "procon" novamente
        if (textoLimpo.toLowerCase() === 'sair') {
          this.contatosAutorizados.delete(telefone);
        }

        // Se iniciou com "procon" / "oi procon", envia como "oi" para abrir o menu inicial
        const textoParaMotor =
          mencionouProcon && /^(#?procon|oi\s+procon|ola\s+procon|olá\s+procon|iniciar\s+procon)$/i.test(textoLimpo)
            ? 'oi'
            : textoLimpo;

        console.log(
          `[WhatsApp QR] Mensagem recebida de ${mascararTelefone(telefone)}: "${textoParaMotor}"`,
        );

        await this.adaptador.receber({
          id: msgId,
          telefone,
          tipo: 'text',
          texto: textoParaMotor,
        });
      }
    });
  }

  async enviarTexto(para: string, texto: string): Promise<void> {
    if (!this.sock) {
      throw new Error('WhatsApp QR ainda nao esta conectado.');
    }

    const limpo = para.replace(/^whatsapp:/i, '').replace(/\D/g, '');
    const jid = this.jidPorTelefone.get(para) || this.jidPorTelefone.get(limpo) || `${limpo}@s.whatsapp.net`;

    const enviada = await this.sock.sendMessage(jid, { text: texto });
    if (enviada?.key?.id) {
      this.idsEnviadosPeloBot.add(enviada.key.id);
      if (this.idsEnviadosPeloBot.size > 1000) {
        const primeiro = this.idsEnviadosPeloBot.values().next().value;
        if (primeiro) this.idsEnviadosPeloBot.delete(primeiro);
      }
    }
  }

  async resetarSessao(): Promise<void> {
    this.reconectando = true;
    try {
      await this.sock?.logout();
    } catch {}
    try {
      this.sock?.end(undefined);
    } catch {}
    this.status = 'iniciando';
    this.qrCodeDataUrl = undefined;
    this.numeroConectado = undefined;
    this.atualizadoEm = new Date().toISOString();
    this.limparCredenciais();
    await this.iniciar();
  }

  private limparCredenciais(): void {
    try {
      if (existsSync(this.dirAuth)) {
        rmSync(this.dirAuth, { recursive: true, force: true });
      }
    } catch {}
  }
}
