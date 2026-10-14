import type { Turno } from './tipos';

const BASE = '/api';

export class ErroApi extends Error {
  constructor(
    message: string,
    public readonly status: number,
  ) {
    super(message);
    this.name = 'ErroApi';
  }
}

async function requisitar<T>(caminho: string, init?: RequestInit): Promise<T> {
  let resposta: Response;
  try {
    resposta = await fetch(`${BASE}${caminho}`, {
      ...init,
      headers: { 'Content-Type': 'application/json', ...init?.headers },
    });
  } catch {
    // Backend fora do ar e o erro mais comum na demo: vale uma mensagem util.
    throw new ErroApi('Nao consegui falar com o servidor. Ele esta rodando na porta 3333?', 0);
  }

  if (!resposta.ok) {
    const corpo = (await resposta.json().catch(() => null)) as { erro?: string } | null;
    throw new ErroApi(corpo?.erro ?? `Erro ${resposta.status} na requisicao.`, resposta.status);
  }

  return (await resposta.json()) as T;
}

/**
 * Abre a conversa. O identificador cumpre o papel do numero de telefone na
 * integracao real com o WhatsApp (RP01).
 */
export function iniciarConversa(usuario: string): Promise<Turno> {
  return requisitar<Turno>('/conversas', {
    method: 'POST',
    body: JSON.stringify({ usuario }),
  });
}

export function enviarOpcao(sessaoId: string, opcaoId: string): Promise<Turno> {
  return requisitar<Turno>(`/conversas/${sessaoId}/mensagens`, {
    method: 'POST',
    body: JSON.stringify({ opcaoId }),
  });
}

export function enviarTexto(sessaoId: string, texto: string): Promise<Turno> {
  return requisitar<Turno>(`/conversas/${sessaoId}/mensagens`, {
    method: 'POST',
    body: JSON.stringify({ texto }),
  });
}

export function recuperarConversa(sessaoId: string): Promise<Turno> {
  return requisitar<Turno>(`/conversas/${sessaoId}`);
}
