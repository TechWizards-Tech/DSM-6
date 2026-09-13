import type { Pool } from 'pg';

import type { Interacao, RepositorioInteracoes, TipoEvento } from './index.js';

interface LinhaInteracao {
  id: string;
  sessao_id: string;
  usuario: string;
  evento: TipoEvento;
  fluxo_id: string | null;
  no_id: string | null;
  opcao_id: string | null;
  encaminhamento: string | null;
  detalhe: string | null;
  em: Date;
}

function paraInteracao(linha: LinhaInteracao): Interacao {
  return {
    id: linha.id,
    sessaoId: linha.sessao_id,
    usuario: linha.usuario,
    evento: linha.evento,
    fluxoId: linha.fluxo_id ?? undefined,
    noId: linha.no_id ?? undefined,
    opcaoId: linha.opcao_id ?? undefined,
    encaminhamento: linha.encaminhamento ?? undefined,
    detalhe: linha.detalhe ?? undefined,
    em: linha.em.toISOString(),
  };
}

export class RepositorioInteracoesPostgres implements RepositorioInteracoes {
  constructor(private readonly pool: Pool) {}

  async registrar(dados: Omit<Interacao, 'id' | 'em'>): Promise<void> {
    // Mesma postura da implementacao em memoria: falha ao gravar o registro
    // nao pode derrubar a conversa do cidadao.
    try {
      await this.pool.query(
        `INSERT INTO interacoes (sessao_id, usuario, evento, fluxo_id, no_id, opcao_id, encaminhamento, detalhe)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
        [
          dados.sessaoId,
          dados.usuario,
          dados.evento,
          dados.fluxoId ?? null,
          dados.noId ?? null,
          dados.opcaoId ?? null,
          dados.encaminhamento ?? null,
          dados.detalhe ?? null,
        ],
      );
    } catch (erro) {
      console.error('[registro] nao foi possivel gravar o evento no banco:', erro);
    }
  }

  async listar(): Promise<Interacao[]> {
    const resultado = await this.pool.query<LinhaInteracao>(
      `SELECT id, sessao_id, usuario, evento, fluxo_id, no_id, opcao_id, encaminhamento, detalhe, em
       FROM interacoes ORDER BY em ASC`,
    );
    return resultado.rows.map(paraInteracao);
  }
}
