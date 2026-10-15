/**
 * Envio de mensagens para o WhatsApp.
 *
 * O adaptador depende so da interface `ClienteWhatsApp`. A implementacao real
 * fala com a WhatsApp Cloud API (RP01); nos testes entra um cliente falso que
 * apenas guarda o que seria enviado.
 */
export interface ClienteWhatsApp {
  enviarTexto(para: string, texto: string): Promise<void>;
}

export interface ConfigCloudApi {
  tokenAcesso: string;
  idNumeroTelefone: string;
  versaoApi: string;
}

export interface ConfigTwilio {
  accountSid: string;
  authToken: string;
  numeroTwilio: string;
}

export class ErroEnvioWhatsApp extends Error {
  constructor(
    readonly status: number,
    readonly corpo: string,
  ) {
    super(`Falha ao enviar mensagem pelo WhatsApp (HTTP ${status})`);
    this.name = 'ErroEnvioWhatsApp';
  }
}

/** Cliente da WhatsApp Cloud API: POST /{versao}/{phone-number-id}/messages. */
export class ClienteCloudApi implements ClienteWhatsApp {
  constructor(
    private readonly config: ConfigCloudApi,
    private readonly fetchFn: typeof fetch = fetch,
  ) {}

  async enviarTexto(para: string, texto: string): Promise<void> {
    const { versaoApi, idNumeroTelefone, tokenAcesso } = this.config;
    const url = `https://graph.facebook.com/${versaoApi}/${idNumeroTelefone}/messages`;

    const resposta = await this.fetchFn(url, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${tokenAcesso}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        messaging_product: 'whatsapp',
        recipient_type: 'individual',
        to: para,
        type: 'text',
        text: { preview_url: false, body: texto },
      }),
    });

    if (!resposta.ok) {
      throw new ErroEnvioWhatsApp(resposta.status, await resposta.text());
    }

    const dados = await resposta.json();
    console.log('[whatsapp] Resposta da Meta Cloud API:', JSON.stringify(dados));
  }
}

/** Cliente do Twilio WhatsApp API: POST /Accounts/{AccountSid}/Messages.json. */
export class ClienteTwilio implements ClienteWhatsApp {
  constructor(
    private readonly config: ConfigTwilio,
    private readonly fetchFn: typeof fetch = fetch,
  ) {}

  async enviarTexto(para: string, texto: string): Promise<void> {
    const { accountSid, authToken, numeroTwilio } = this.config;
    const destino = para.startsWith('whatsapp:') ? para : `whatsapp:+${para.replace(/\D/g, '')}`;
    const origem = numeroTwilio.startsWith('whatsapp:') ? numeroTwilio : `whatsapp:${numeroTwilio}`;
    const url = `https://api.twilio.com/2010-04-01/Accounts/${accountSid}/Messages.json`;
    const auth = Buffer.from(`${accountSid}:${authToken}`).toString('base64');

    const resposta = await this.fetchFn(url, {
      method: 'POST',
      headers: {
        Authorization: `Basic ${auth}`,
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: new URLSearchParams({
        From: origem,
        To: destino,
        Body: texto,
      }),
    });

    if (!resposta.ok) {
      throw new ErroEnvioWhatsApp(resposta.status, await resposta.text());
    }

    const dados = await resposta.json();
    console.log('[whatsapp] Resposta da Twilio API:', JSON.stringify(dados));
  }
}

