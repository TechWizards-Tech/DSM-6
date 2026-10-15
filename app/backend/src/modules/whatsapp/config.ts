/**
 * Configuracao da integracao com o WhatsApp (RF01 / RP01).
 *
 * A integracao e opcional: sem as variaveis obrigatorias o backend sobe
 * exatamente como antes, so com o simulador web. Assim nada muda para quem
 * nao tem credenciais da Meta (ex.: testes, CI, outros membros da equipe).
 */
export interface ConfigWhatsApp {
  /** Token de acesso da WhatsApp Cloud API (painel Meta for Developers). */
  tokenAcesso: string;
  /** "Phone number ID" do numero que envia as mensagens (numero de teste da Meta). */
  idNumeroTelefone: string;
  /** Texto livre escolhido pela equipe, repetido no painel da Meta ao cadastrar o webhook. */
  tokenVerificacao: string;
  /** "App secret" do app na Meta. Quando informado, valida a assinatura de cada webhook. */
  segredoApp?: string;
  /** Versao da Graph API usada nas chamadas de envio. */
  versaoApi: string;
}

export const VERSAO_API_PADRAO = 'v21.0';

import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';

function carregarEnvLocal(): void {
  const caminhos = ['.env', '../.env', 'app/backend/.env'];
  for (const c of caminhos) {
    const caminho = resolve(process.cwd(), c);
    if (existsSync(caminho)) {
      try {
        const conteudo = readFileSync(caminho, 'utf-8');
        for (const linha of conteudo.split('\n')) {
          const limpa = linha.trim();
          if (!limpa || limpa.startsWith('#')) continue;
          const pos = limpa.indexOf('=');
          if (pos > 0) {
            const chave = limpa.slice(0, pos).trim();
            const valor = limpa.slice(pos + 1).trim().replace(/^["']|["']$/g, '');
            if (!process.env[chave]) {
              process.env[chave] = valor;
            }
          }
        }
      } catch {
        // ignora se nao conseguir ler
      }
      break;
    }
  }
}

/** Le a configuracao das variaveis de ambiente. Retorna undefined se a integracao estiver desligada. */
export function lerConfigWhatsApp(env: NodeJS.ProcessEnv = process.env): ConfigWhatsApp | undefined {
  carregarEnvLocal();
  const tokenAcesso = env.WHATSAPP_ACCESS_TOKEN?.trim();
  const idNumeroTelefone = env.WHATSAPP_PHONE_NUMBER_ID?.trim();
  const tokenVerificacao = env.WHATSAPP_VERIFY_TOKEN?.trim();

  if (!tokenAcesso || !idNumeroTelefone || !tokenVerificacao) return undefined;

  return {
    tokenAcesso,
    idNumeroTelefone,
    tokenVerificacao,
    segredoApp: env.WHATSAPP_APP_SECRET?.trim() || undefined,
    versaoApi: env.WHATSAPP_API_VERSION?.trim() || VERSAO_API_PADRAO,
  };
}
