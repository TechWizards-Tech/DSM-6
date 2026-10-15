import type { Pool } from 'pg';

import {
  normalizarEmail,
  type CriarUsuarioAdminInput,
  type RepositorioUsuariosAdmin,
  type UsuarioAdmin,
} from './index.js';

interface LinhaUsuarioAdmin {
  id: string;
  email: string;
  nome: string;
  senha_hash: string;
  criado_em: Date;
}

const COLUNAS = 'id, email, nome, senha_hash, criado_em';

function paraUsuario(linha: LinhaUsuarioAdmin): UsuarioAdmin {
  return {
    id: linha.id,
    email: linha.email,
    nome: linha.nome,
    senhaHash: linha.senha_hash,
    criadoEm: linha.criado_em.toISOString(),
  };
}

export class RepositorioUsuariosAdminPostgres implements RepositorioUsuariosAdmin {
  constructor(private readonly pool: Pool) {}

  async buscarPorEmail(email: string): Promise<UsuarioAdmin | undefined> {
    const resultado = await this.pool.query<LinhaUsuarioAdmin>(
      `SELECT ${COLUNAS} FROM usuarios_admin WHERE email = $1`,
      [normalizarEmail(email)],
    );
    return resultado.rows[0] ? paraUsuario(resultado.rows[0]) : undefined;
  }

  async criar(input: CriarUsuarioAdminInput): Promise<UsuarioAdmin> {
    const resultado = await this.pool.query<LinhaUsuarioAdmin>(
      `INSERT INTO usuarios_admin (email, nome, senha_hash) VALUES ($1, $2, $3)
       RETURNING ${COLUNAS}`,
      [normalizarEmail(input.email), input.nome, input.senhaHash],
    );
    const linha = resultado.rows[0];
    if (!linha) throw new Error('Insercao de usuario admin nao retornou a linha criada.');
    return paraUsuario(linha);
  }
}
