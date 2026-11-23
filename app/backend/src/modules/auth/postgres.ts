import type { Pool } from 'pg';

import {
  ErroUsuarioDuplicado,
  ehPapel,
  normalizarEmail,
  type CriarUsuarioAdminInput,
  type Papel,
  type RepositorioUsuariosAdmin,
  type UsuarioAdmin,
} from './index.js';

interface LinhaUsuarioAdmin {
  id: string;
  email: string;
  nome: string;
  papel: string;
  senha_hash: string;
  criado_em: Date;
}

const COLUNAS = 'id, email, nome, papel, senha_hash, criado_em';

function paraUsuario(linha: LinhaUsuarioAdmin): UsuarioAdmin {
  return {
    id: linha.id,
    email: linha.email,
    nome: linha.nome,
    papel: ehPapel(linha.papel) ? linha.papel : 'atendente',
    senhaHash: linha.senha_hash,
    criadoEm: linha.criado_em.toISOString(),
  };
}

/**
 * Migracao para bancos criados antes dos papeis existirem (o schema.sql so roda
 * quando o volume do Postgres e criado). Quem ja tinha acesso ao painel continua
 * como `admin`; usuarios novos nascem `atendente` por padrao.
 */
const MIGRACAO_PAPEL = `
  DO $$
  BEGIN
    IF NOT EXISTS (
      SELECT 1 FROM information_schema.columns
      WHERE table_name = 'usuarios_admin' AND column_name = 'papel'
    ) THEN
      ALTER TABLE usuarios_admin
        ADD COLUMN papel TEXT NOT NULL DEFAULT 'admin'
        CHECK (papel IN ('admin', 'atendente'));
      ALTER TABLE usuarios_admin ALTER COLUMN papel SET DEFAULT 'atendente';
    END IF;
  END
  $$;
`;

export class RepositorioUsuariosAdminPostgres implements RepositorioUsuariosAdmin {
  private esquemaPronto?: Promise<void>;

  constructor(private readonly pool: Pool) {}

  /** Roda a migracao uma unica vez, antes da primeira consulta. */
  private garantirEsquema(): Promise<void> {
    this.esquemaPronto ??= this.pool.query(MIGRACAO_PAPEL).then(() => undefined);
    return this.esquemaPronto;
  }

  async buscarPorEmail(email: string): Promise<UsuarioAdmin | undefined> {
    await this.garantirEsquema();
    const resultado = await this.pool.query<LinhaUsuarioAdmin>(
      `SELECT ${COLUNAS} FROM usuarios_admin WHERE email = $1`,
      [normalizarEmail(email)],
    );
    return resultado.rows[0] ? paraUsuario(resultado.rows[0]) : undefined;
  }

  async listar(): Promise<UsuarioAdmin[]> {
    await this.garantirEsquema();
    const resultado = await this.pool.query<LinhaUsuarioAdmin>(
      `SELECT ${COLUNAS} FROM usuarios_admin ORDER BY criado_em, email`,
    );
    return resultado.rows.map(paraUsuario);
  }

  async criar(input: CriarUsuarioAdminInput): Promise<UsuarioAdmin> {
    await this.garantirEsquema();
    const email = normalizarEmail(input.email);
    try {
      const resultado = await this.pool.query<LinhaUsuarioAdmin>(
        `INSERT INTO usuarios_admin (email, nome, papel, senha_hash) VALUES ($1, $2, $3, $4)
         RETURNING ${COLUNAS}`,
        [email, input.nome, input.papel, input.senhaHash],
      );
      const linha = resultado.rows[0];
      if (!linha) throw new Error('Insercao de usuario admin nao retornou a linha criada.');
      return paraUsuario(linha);
    } catch (erro) {
      // 23505 = unique_violation (e-mail ja cadastrado)
      if ((erro as { code?: string }).code === '23505') throw new ErroUsuarioDuplicado(email);
      throw erro;
    }
  }

  async atualizarPapel(email: string, papel: Papel): Promise<void> {
    await this.garantirEsquema();
    await this.pool.query('UPDATE usuarios_admin SET papel = $2 WHERE email = $1', [
      normalizarEmail(email),
      papel,
    ]);
  }
}
