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
  opcoes?: { maxmem?: number; cost?: number; blockSize?: number; parallelization?: number },
) => Promise<Buffer>;

/** `admin` gerencia usuarios do painel; `atendente` so cuida dos agendamentos. */
export const PAPEIS = ['admin', 'atendente'] as const;
export type Papel = (typeof PAPEIS)[number];

export function ehPapel(valor: unknown): valor is Papel {
  return typeof valor === 'string' && (PAPEIS as readonly string[]).includes(valor);
}

export interface UsuarioAdmin {
  id: string;
  email: string;
  nome: string;
  papel: Papel;
  senhaHash: string;
  criadoEm: string;
}

/** Usuario sem o hash da senha: o unico formato que sai pela API. */
export type UsuarioPublico = Omit<UsuarioAdmin, 'senhaHash'>;

export interface CriarUsuarioAdminInput {
  email: string;
  nome: string;
  senhaHash: string;
  papel: Papel;
}

export interface AtualizarUsuarioAdminInput {
  nome?: string;
  senhaHash?: string;
  papel?: Papel;
}

export interface RepositorioUsuariosAdmin {
  buscarPorEmail(email: string): Promise<UsuarioAdmin | undefined>;
  buscarPorId?(id: string): Promise<UsuarioAdmin | undefined>;
  listar(): Promise<UsuarioAdmin[]>;
  criar(input: CriarUsuarioAdminInput): Promise<UsuarioAdmin>;
  atualizarPapel(email: string, papel: Papel): Promise<void>;
  atualizar?(id: string, input: AtualizarUsuarioAdminInput): Promise<UsuarioAdmin | undefined>;
  remover?(id: string): Promise<boolean>;
}

export class ErroUsuarioDuplicado extends Error {
  constructor(email: string) {
    super(`Ja existe um usuario com o e-mail ${email}.`);
    this.name = 'ErroUsuarioDuplicado';
  }
}

/** Dados invalidos ao cadastrar um usuario (vira HTTP 400). */
export class ErroCadastroUsuario extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'ErroCadastroUsuario';
  }
}

export class RepositorioUsuariosAdminMemoria implements RepositorioUsuariosAdmin {
  private usuarios = new Map<string, UsuarioAdmin>();

  async buscarPorEmail(email: string): Promise<UsuarioAdmin | undefined> {
    return this.usuarios.get(normalizarEmail(email));
  }

  async criar(input: CriarUsuarioAdminInput): Promise<UsuarioAdmin> {
    const email = normalizarEmail(input.email);
    if (this.usuarios.has(email)) throw new ErroUsuarioDuplicado(email);
    const usuario: UsuarioAdmin = {
      id: randomUUID(),
      email,
      nome: input.nome,
      papel: input.papel,
      senhaHash: input.senhaHash,
      criadoEm: new Date().toISOString(),
    };
    this.usuarios.set(email, usuario);
    return usuario;
  }

  async listar(): Promise<UsuarioAdmin[]> {
    return [...this.usuarios.values()].sort((a, b) => a.criadoEm.localeCompare(b.criadoEm));
  }

  async atualizarPapel(email: string, papel: Papel): Promise<void> {
    const usuario = this.usuarios.get(normalizarEmail(email));
    if (usuario) usuario.papel = papel;
  }

  async buscarPorId(id: string): Promise<UsuarioAdmin | undefined> {
    for (const usuario of this.usuarios.values()) {
      if (usuario.id === id) return usuario;
    }
    return undefined;
  }

  async atualizar(id: string, input: AtualizarUsuarioAdminInput): Promise<UsuarioAdmin | undefined> {
    const usuario = await this.buscarPorId(id);
    if (!usuario) return undefined;
    if (input.nome !== undefined) usuario.nome = input.nome;
    if (input.senhaHash !== undefined) usuario.senhaHash = input.senhaHash;
    if (input.papel !== undefined) usuario.papel = input.papel;
    return usuario;
  }

  async remover(id: string): Promise<boolean> {
    const usuario = await this.buscarPorId(id);
    if (!usuario) return false;
    return this.usuarios.delete(usuario.email);
  }
}

export function normalizarEmail(email: string): string {
  return email.trim().toLowerCase();
}

const TAMANHO_HASH = 64;
const OPCOES_SCRYPT = { maxmem: 64 * 1024 * 1024 };

/** Formato armazenado: `scrypt$<sal hex>$<hash hex>`. */
export async function gerarHashSenha(senha: string): Promise<string> {
  const sal = randomBytes(16);
  const hash = await scryptAsync(senha, sal, TAMANHO_HASH, OPCOES_SCRYPT);
  return `scrypt$${sal.toString('hex')}$${hash.toString('hex')}`;
}

export async function verificarSenha(senha: string, armazenado: string): Promise<boolean> {
  const [algoritmo, salHex, hashHex] = armazenado.split('$');
  if (algoritmo !== 'scrypt' || !salHex || !hashHex) return false;
  const esperado = Buffer.from(hashHex, 'hex');
  const calculado = await scryptAsync(senha, Buffer.from(salHex, 'hex'), esperado.length, OPCOES_SCRYPT);
  return calculado.length === esperado.length && timingSafeEqual(calculado, esperado);
}

export interface UsuarioAutenticado {
  id: string;
  email: string;
  nome: string;
  papel: Papel;
}

interface PayloadToken {
  sub: string;
  email: string;
  nome: string;
  papel?: Papel;
  iat: number;
  exp: number;
}

export const SENHA_MIN = 8;
const REGEX_EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export interface NovoUsuarioInput {
  email: string;
  nome: string;
  senha: string;
  papel: Papel;
}

function publico(usuario: UsuarioAdmin): UsuarioPublico {
  const { senhaHash: _senhaHash, ...resto } = usuario;
  return resto;
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
    const dados: UsuarioAutenticado = {
      id: usuario.id,
      email: usuario.email,
      nome: usuario.nome,
      papel: usuario.papel,
    };
    return { token: this.emitirToken(dados), usuario: dados };
  }

  emitirToken(usuario: UsuarioAutenticado): string {
    const agora = Math.floor(Date.now() / 1000);
    const payload: PayloadToken = {
      sub: usuario.id,
      email: usuario.email,
      nome: usuario.nome,
      papel: usuario.papel,
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
      // Token antigo, emitido antes dos papeis existirem, vale como o menos privilegiado.
      const papel: Papel = ehPapel(payload.papel) ? payload.papel : 'atendente';
      return { id: payload.sub, email: payload.email, nome: payload.nome, papel };
    } catch {
      return undefined;
    }
  }

  /**
   * Cria o primeiro funcionario a partir das variaveis de ambiente, se ainda nao existir.
   * Se ja existir, so garante o papel `admin`: a senha e o nome nunca sao sobrescritos.
   */
  async garantirAdminInicial(email: string, senha: string, nome = 'Administrador'): Promise<void> {
    const existente = await this.usuarios.buscarPorEmail(email);
    if (existente) {
      if (existente.papel !== 'admin') await this.usuarios.atualizarPapel(email, 'admin');
      return;
    }
    await this.usuarios.criar({
      email,
      nome,
      papel: 'admin',
      senhaHash: await gerarHashSenha(senha),
    });
  }

  async listarUsuarios(): Promise<UsuarioPublico[]> {
    return (await this.usuarios.listar()).map(publico);
  }

  /** Cadastra um funcionario novo. Lanca `ErroCadastroUsuario` ou `ErroUsuarioDuplicado`. */
  async criarUsuario(entrada: NovoUsuarioInput): Promise<UsuarioPublico> {
    const nome = entrada.nome.trim();
    const email = normalizarEmail(entrada.email);
    if (nome.length < 2 || nome.length > 100) {
      throw new ErroCadastroUsuario('Informe o nome (de 2 a 100 caracteres).');
    }
    if (email.length > 254 || !REGEX_EMAIL.test(email)) {
      throw new ErroCadastroUsuario('Informe um e-mail valido.');
    }
    if (entrada.senha.length < SENHA_MIN || entrada.senha.length > 128) {
      throw new ErroCadastroUsuario(`A senha deve ter de ${SENHA_MIN} a 128 caracteres.`);
    }
    if (!ehPapel(entrada.papel)) {
      throw new ErroCadastroUsuario(`Papel invalido. Use: ${PAPEIS.join(', ')}.`);
    }
    const criado = await this.usuarios.criar({
      email,
      nome,
      papel: entrada.papel,
      senhaHash: await gerarHashSenha(entrada.senha),
    });
    return publico(criado);
  }

  async atualizarUsuario(
    id: string,
    entrada: { nome?: string; senha?: string; papel?: Papel },
  ): Promise<UsuarioPublico | undefined> {
    const atualizacao: AtualizarUsuarioAdminInput = {};

    if (entrada.nome !== undefined) {
      const nome = entrada.nome.trim();
      if (nome.length < 2 || nome.length > 100) {
        throw new ErroCadastroUsuario('Informe o nome (de 2 a 100 caracteres).');
      }
      atualizacao.nome = nome;
    }

    if (entrada.senha !== undefined && entrada.senha !== '') {
      if (entrada.senha.length < SENHA_MIN || entrada.senha.length > 128) {
        throw new ErroCadastroUsuario(`A senha deve ter de ${SENHA_MIN} a 128 caracteres.`);
      }
      atualizacao.senhaHash = await gerarHashSenha(entrada.senha);
    }

    if (entrada.papel !== undefined) {
      if (!ehPapel(entrada.papel)) {
        throw new ErroCadastroUsuario(`Papel invalido. Use: ${PAPEIS.join(', ')}.`);
      }
      atualizacao.papel = entrada.papel;
    }

    if (!this.usuarios.atualizar) return undefined;
    const atualizado = await this.usuarios.atualizar(id, atualizacao);
    return atualizado ? publico(atualizado) : undefined;
  }

  async removerUsuario(id: string): Promise<boolean> {
    if (!this.usuarios.remover) return false;
    return this.usuarios.remover(id);
  }

  private assinar(conteudo: string): string {
    return createHmac('sha256', this.segredo).update(conteudo).digest('base64url');
  }
}
