/**
 * Módulo de Agendamento Presencial (RF07, US04).
 * Gerencia horários vagos e emissão de protocolos de agendamento no PROCON Jacareí.
 */

export type StatusAgendamento = 'agendado' | 'atendido' | 'cancelado';

export const STATUS_AGENDAMENTO: readonly StatusAgendamento[] = ['agendado', 'atendido', 'cancelado'];

export interface Agendamento {
  id: string;
  protocolo: string; // Exemplo: PROCON-20260920-8492
  usuario: string;   // Número de telefone do WhatsApp
  nome: string;
  cpf: string;
  data: string;      // YYYY-MM-DD
  horario: string;   // HH:mm
  assunto: string;
  status: StatusAgendamento;
  criadoEm: string;
}

export interface FiltroAgendamentos {
  data?: string;
  status?: StatusAgendamento;
}

export interface AlteracaoAgendamento {
  status?: StatusAgendamento;
  data?: string;
  horario?: string;
}

export interface CriarAgendamentoInput {
  usuario: string;
  nome: string;
  cpf: string;
  data: string;
  horario: string;
  assunto: string;
}

export interface HorarioSlot {
  horario: string;
  disponivel: boolean;
}

export interface RepositorioAgendamentos {
  listarHorarios(data: string): Promise<HorarioSlot[]>;
  criar(input: CriarAgendamentoInput): Promise<Agendamento>;
  buscarPorId(id: string): Promise<Agendamento | undefined>;
  buscarPorProtocolo(protocolo: string): Promise<Agendamento | undefined>;
  listar(filtro?: FiltroAgendamentos): Promise<Agendamento[]>;
  /** Lanca erro "já está ocupado" se o novo dia/horario conflitar com outro agendamento ativo. */
  atualizar(id: string, alteracao: AlteracaoAgendamento): Promise<Agendamento | undefined>;
}

export function mensagemHorarioOcupado(data: string, horario: string): string {
  return `O horário ${horario} no dia ${data} já está ocupado.`;
}

import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname } from 'node:path';

// Horários de atendimento do PROCON Jacareí (08h às 16h)
export const HORARIOS_PADRAO = [
  '08:00', '09:00', '10:00', '11:00',
  '13:00', '14:00', '15:00', '16:00',
];

export class RepositorioAgendamentosMemoria implements RepositorioAgendamentos {
  private agendamentos: Map<string, Agendamento> = new Map();

  constructor(private readonly caminhoArquivo?: string) {
    if (this.caminhoArquivo && existsSync(this.caminhoArquivo)) {
      try {
        const conteudo = readFileSync(this.caminhoArquivo, 'utf-8');
        const lista = JSON.parse(conteudo);
        if (Array.isArray(lista)) {
          for (const item of lista) {
            this.agendamentos.set(item.id, item);
          }
        }
      } catch (e) {
        console.warn(`[agendamentos] Falha ao carregar ${this.caminhoArquivo}:`, e);
      }
    }
  }

  private salvar() {
    if (this.caminhoArquivo) {
      try {
        mkdirSync(dirname(this.caminhoArquivo), { recursive: true });
        writeFileSync(
          this.caminhoArquivo,
          JSON.stringify(Array.from(this.agendamentos.values()), null, 2),
          'utf-8',
        );
      } catch (e) {
        console.warn(`[agendamentos] Falha ao salvar ${this.caminhoArquivo}:`, e);
      }
    }
  }

  async listarHorarios(data: string): Promise<HorarioSlot[]> {
    const [anoStr = '0', mesStr = '1', diaStr = '1'] = data.split('-');
    const dataObj = new Date(Number(anoStr), Number(mesStr) - 1, Number(diaStr));
    const diaDaSemana = dataObj.getDay();

    if (diaDaSemana === 0 || diaDaSemana === 6) {
      return HORARIOS_PADRAO.map((horario) => ({
        horario,
        disponivel: false,
      }));
    }

    const agendamentosNoDia = Array.from(this.agendamentos.values()).filter(
      (a) => a.data === data && a.status === 'agendado'
    );

    const horariosOcupados = new Set(agendamentosNoDia.map((a) => a.horario));

    return HORARIOS_PADRAO.map((horario) => ({
      horario,
      disponivel: !horariosOcupados.has(horario),
    }));
  }

  async criar(input: CriarAgendamentoInput): Promise<Agendamento> {
    const [anoStr = '0', mesStr = '1', diaStr = '1'] = input.data.split('-');
    const dataObj = new Date(Number(anoStr), Number(mesStr) - 1, Number(diaStr));
    const diaDaSemana = dataObj.getDay();

    if (diaDaSemana === 0 || diaDaSemana === 6) {
      throw new Error('O PROCON de Jacareí não realiza atendimentos aos sábados e domingos.');
    }

    const agendamentosNoDia = Array.from(this.agendamentos.values()).filter(
      (a) => a.data === input.data && a.horario === input.horario && a.status === 'agendado'
    );

    if (agendamentosNoDia.length > 0) {
      throw new Error(`O horário ${input.horario} no dia ${input.data} já está ocupado.`);
    }

    const id = `agd_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
    const dataFormatada = input.data.replace(/-/g, '');
    const sufixo = Math.floor(1000 + Math.random() * 9000);
    const protocolo = `PROCON-${dataFormatada}-${sufixo}`;

    const novoAgendamento: Agendamento = {
      id,
      protocolo,
      usuario: input.usuario,
      nome: input.nome,
      cpf: input.cpf,
      data: input.data,
      horario: input.horario,
      assunto: input.assunto,
      status: 'agendado',
      criadoEm: new Date().toISOString(),
    };

    this.agendamentos.set(id, novoAgendamento);
    this.salvar();
    return novoAgendamento;
  }

  async buscarPorId(id: string): Promise<Agendamento | undefined> {
    return this.agendamentos.get(id);
  }

  async buscarPorProtocolo(protocolo: string): Promise<Agendamento | undefined> {
    return Array.from(this.agendamentos.values()).find((a) => a.protocolo === protocolo);
  }

  async listar(filtro: FiltroAgendamentos = {}): Promise<Agendamento[]> {
    return Array.from(this.agendamentos.values())
      .filter(
        (a) =>
          (!filtro.data || a.data === filtro.data) && (!filtro.status || a.status === filtro.status),
      )
      .sort((a, b) => `${a.data} ${a.horario}`.localeCompare(`${b.data} ${b.horario}`));
  }

  async atualizar(id: string, alteracao: AlteracaoAgendamento): Promise<Agendamento | undefined> {
    const atual = this.agendamentos.get(id);
    if (!atual) return undefined;

    const novo: Agendamento = { ...atual, ...alteracao };
    if (novo.status === 'agendado') {
      const conflito = Array.from(this.agendamentos.values()).some(
        (a) =>
          a.id !== id && a.status === 'agendado' && a.data === novo.data && a.horario === novo.horario,
      );
      if (conflito) throw new Error(mensagemHorarioOcupado(novo.data, novo.horario));
    }

    this.agendamentos.set(id, novo);
    this.salvar();
    return novo;
  }
}
