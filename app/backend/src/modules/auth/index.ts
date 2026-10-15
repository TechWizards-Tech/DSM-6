/**
 * Autenticacao do Painel Web Administrativo (RF08, US05).
 *
 * Sem dependencias externas: senha com scrypt e token JWT HS256 assinado com
 * node:crypto. Somente funcionarios do PROCON (usuarios_admin) acessam o painel.
 */
import { createHmac, randomBytes, randomUUID, scrypt, timingSafeEqual } from 'node:crypto';
import { promisify } from 'node:util';

const scryptAsync = promisify(scrypt) as (
  senha: string,
  sal: Buffer,
  tamanho: number,
) => Promise<Buffer>;

export interface UsuarioAdmin {
  id: string;
  email: string;
  nome: string;
  senhaHash: string;
  criadoEm: string;
}

export interface CriarUsuarioAdminInput {
  email: string;
  nome: string;
  senhaHash: string;
}

export interface RepositorioUsuariosAdmin {
  buscarPorEmail(email: string): Promise<UsuarioAdmin | undefined>;
  criar(input: CriarUsuarioAdminInput): Promise<UsuarioAdmin>;
}

export class RepositorioUsuariosAdminMemoria implements RepositorioUsuariosAdmin {
  private usuarios = new Map<string, UsuarioAdmin>();

  async buscarPorEmail(email: string): Promise<UsuarioAdmin | undefined> {
    return this.usuarios.get(normalizarEmail(email));
  }

  async criar(input: CriarUsuarioAdminInput): Promise<UsuarioAdmin> {
    const email = normalizarEmail(input.email);
    if (this.usuarios.has(email)) throw new Error(`Ja existe um usuario com o e-mail ${email}.`);
    const usuario: UsuarioAdmin = {
      id: randomUUID(),
      email,
      nome: input.nome,
      senhaHash: input.senhaHash,
      criadoEm: new Date().toISOString(),
    };
    this.usuarios.set(email, usuario);
    return usuario;
  }
}

export function normalizarEmail(email: string): string {
  return email.trim().toLowerCase();
}

const TAMANHO_HASH = 64;

/** Formato armazenado: `scrypt$<sal hex>$<hash hex>`. */
export async function gerarHashSenha(senha: string): Promise<string> {
  const sal = randomBytes(16);
  const hash = await scryptAsync(senha, sal, TAMANHO_HASH);
  return `scrypt$${sal.toString('hex')}$${hash.toString('hex')}`;
}

export async function verificarSenha(senha: string, armazenado: string): Promise<boolean> {
  const [algoritmo, salHex, hashHex] = armazenado.split('$');
  if (algoritmo !== 'scrypt' || !salHex || !hashHex) return false;
  const esperado = Buffer.from(hashHex, 'hex');
  const calculado = await scryptAsync(senha, Buffer.from(salHex, 'hex'), esperado.length);
  return calculado.length === esperado.length && timingSafeEqual(calculado, esperado);
}

export interface UsuarioAutenticado {
  id: string;
  email: string;
  nome: string;
}

interface PayloadToken {
  sub: string;
  email: string;
  nome: string;
  iat: number;
  exp: number;
}

function base64url(dados: Buffer | string): string {
  return Buffer.from(dados).toString('base64url');
}

export class ServicoAutenticacao {
  constructor(
    private readonly usuarios: RepositorioUsuariosAdmin,
    private readonly segredo: string,
    private readonly validadeSegundos = 8 * 60 * 60,
  ) {
    if (segredo.length < 16) throw new Error('O segredo do token deve ter ao menos 16 caracteres.');
  }

  async autenticar(
    email: string,
    senha: string,
  ): Promise<{ token: string; usuario: UsuarioAutenticado } | undefined> {
    const usuario = await this.usuarios.buscarPorEmail(normalizarEmail(email));
    if (!usuario || !(await verificarSenha(senha, usuario.senhaHash))) return undefined;
    const publico = { id: usuario.id, email: usuario.email, nome: usuario.nome };
    return { token: this.emitirToken(publico), usuario: publico };
  }

  emitirToken(usuario: UsuarioAutenticado): string {
    const agora = Math.floor(Date.now() / 1000);
    const payload: PayloadToken = {
      sub: usuario.id,
      email: usuario.email,
      nome: usuario.nome,
      iat: agora,
      exp: agora + this.validadeSegundos,
    };
    const cabecalho = base64url(JSON.stringify({ alg: 'HS256', typ: 'JWT' }));
    const corpo = base64url(JSON.stringify(payload));
    return `${cabecalho}.${corpo}.${this.assinar(`${cabecalho}.${corpo}`)}`;
  }

  validarToken(token: string): UsuarioAutenticado | undefined {
    const [cabecalho, corpo, assinatura] = token.split('.');
    if (!cabecalho || !corpo || !assinatura) return undefined;

    const esperada = Buffer.from(this.assinar(`${cabecalho}.${corpo}`));
    const recebida = Buffer.from(assinatura);
    if (esperada.length !== recebida.length || !timingSafeEqual(esperada, recebida)) {
      return undefined;
    }

    try {
      const payload = JSON.parse(Buffer.from(corpo, 'base64url').toString('utf8')) as PayloadToken;
      if (typeof payload.exp !== 'number' || payload.exp <= Math.floor(Date.now() / 1000)) {
        return undefined;
      }
      return { id: payload.sub, email: payload.email, nome: payload.nome };
    } catch {
      return undefined;
    }
  }

  /** Cria o primeiro funcionario a partir das variaveis de ambiente, se ainda nao existir. */
  async garantirAdminInicial(email: string, senha: string, nome = 'Administrador'): Promise<void> {
    if (await this.usuarios.buscarPorEmail(email)) return;
    await this.usuarios.criar({ email, nome, senhaHash: await gerarHashSenha(senha) });
  }

  private assinar(conteudo: string): string {
    return createHmac('sha256', this.segredo).update(conteudo).digest('base64url');
  }
}
