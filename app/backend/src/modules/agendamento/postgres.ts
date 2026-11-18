import type { Pool } from '../../../node_modules/@types/pg/index.js';

import {
  mensagemHorarioOcupado,
  type AlteracaoAgendamento,
  type Agendamento,
  type CriarAgendamentoInput,
  type FiltroAgendamentos,
  type HorarioSlot,
  type RepositorioAgendamentos,
} from './index.js';

// Horarios de atendimento do PROCON Jacarei (08h as 16h)
const HORARIOS_PADRAO = ['08:00', '09:00', '10:00', '11:00', '13:00', '14:00', '15:00', '16:00'];

const COLUNAS = 'id, protocolo, usuario, nome, cpf, data, horario, assunto, status, criado_em';

interface LinhaAgendamento {
  id: string;
  protocolo: string;
  usuario: string;
  nome: string;
  cpf: string;
  data: string;
  horario: string;
  assunto: string;
  status: Agendamento['status'];
  criado_em: Date;
}

function paraAgendamento(linha: LinhaAgendamento): Agendamento {
  return {
    id: linha.id,
    protocolo: linha.protocolo,
    usuario: linha.usuario,
    nome: linha.nome,
    cpf: linha.cpf,
    data: linha.data,
    horario: linha.horario.slice(0, 5),
    assunto: linha.assunto,
    status: linha.status,
    criadoEm: linha.criado_em.toISOString(),
  };
}

export class RepositorioAgendamentosPostgres implements RepositorioAgendamentos {
  constructor(private readonly pool: Pool) { }

  async listarHorarios(data: string): Promise<HorarioSlot[]> {
    const resultado = await this.pool.query<{ horario: string }>(
      `SELECT horario FROM agendamentos WHERE data = $1 AND status = 'agendado'`,
      [data],
    );
    const ocupados = new Set(resultado.rows.map((linha) => linha.horario.slice(0, 5)));
    return HORARIOS_PADRAO.map((horario) => ({ horario, disponivel: !ocupados.has(horario) }));
  }

  async criar(input: CriarAgendamentoInput): Promise<Agendamento> {
    const dataFormatada = input.data.replace(/-/g, '');
    const sufixo = Math.floor(1000 + Math.random() * 9000);
    const protocolo = `PROCON-${dataFormatada}-${sufixo}`;

    const cpfParaSalvar = input.cpf.slice(0, 20);

    try {
      const resultado = await this.pool.query<LinhaAgendamento>(
        `INSERT INTO agendamentos (protocolo, usuario, nome, cpf, data, horario, assunto)
         VALUES ($1, $2, $3, $4, $5, $6, $7)
         RETURNING ${COLUNAS}`,
        [protocolo, input.usuario, input.nome, cpfParaSalvar, input.data, input.horario, input.assunto],
      );
      const linha = resultado.rows[0];
      if (!linha) throw new Error('Insercao de agendamento nao retornou a linha criada.');
      return paraAgendamento(linha);
    } catch (erro) {
      // idx_agendamentos_slot_ativo (schema.sql) garante a exclusividade do
      // slot no banco; traduzimos a violacao para o mesmo erro de negocio
      // que a implementacao em memoria ja lancava.
      if (erro && typeof erro === 'object' && 'code' in erro && erro.code === '23505') {
        throw new Error(`O horário ${input.horario} no dia ${input.data} já está ocupado.`);
      }
      throw erro;
    }
  }

  async buscarPorId(id: string): Promise<Agendamento | undefined> {
    const resultado = await this.pool.query<LinhaAgendamento>(
      `SELECT ${COLUNAS} FROM agendamentos WHERE id = $1`,
      [id],
    );
    return resultado.rows[0] ? paraAgendamento(resultado.rows[0]) : undefined;
  }

  async buscarPorProtocolo(protocolo: string): Promise<Agendamento | undefined> {
    const resultado = await this.pool.query<LinhaAgendamento>(
      `SELECT ${COLUNAS} FROM agendamentos WHERE protocolo = $1`,
      [protocolo],
    );
    return resultado.rows[0] ? paraAgendamento(resultado.rows[0]) : undefined;
  }

  async listar(filtro: FiltroAgendamentos = {}): Promise<Agendamento[]> {
    const condicoes: string[] = [];
    const valores: string[] = [];
    if (filtro.data) {
      valores.push(filtro.data);
      condicoes.push(`data = $${valores.length}`);
    }
    if (filtro.status) {
      valores.push(filtro.status);
      condicoes.push(`status = $${valores.length}`);
    }
    const where = condicoes.length > 0 ? `WHERE ${condicoes.join(' AND ')}` : '';
    const resultado = await this.pool.query<LinhaAgendamento>(
      `SELECT ${COLUNAS} FROM agendamentos ${where} ORDER BY data ASC, horario ASC`,
      valores,
    );
    return resultado.rows.map(paraAgendamento);
  }

  async atualizar(id: string, alteracao: AlteracaoAgendamento): Promise<Agendamento | undefined> {
    try {
      const resultado = await this.pool.query<LinhaAgendamento>(
        `UPDATE agendamentos
            SET status  = COALESCE($2, status),
                data    = COALESCE($3::date, data),
                horario = COALESCE($4::time, horario)
          WHERE id = $1
         RETURNING ${COLUNAS}`,
        [id, alteracao.status ?? null, alteracao.data ?? null, alteracao.horario ?? null],
      );
      return resultado.rows[0] ? paraAgendamento(resultado.rows[0]) : undefined;
    } catch (erro) {
      if (erro && typeof erro === 'object' && 'code' in erro && erro.code === '23505') {
        throw new Error(mensagemHorarioOcupado(alteracao.data ?? '', alteracao.horario ?? ''));
      }
      throw erro;
    }
  }
}
