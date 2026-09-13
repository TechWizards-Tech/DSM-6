/**
 * Módulo de Agendamento Presencial (RF07, US04).
 * Gerencia horários vagos e emissão de protocolos de agendamento no PROCON Jacareí.
 */

export interface Agendamento {
  id: string;
  protocolo: string; // Exemplo: PROCON-20260920-8492
  usuario: string;   // Número de telefone do WhatsApp
  nome: string;
  cpf: string;
  data: string;      // YYYY-MM-DD
  horario: string;   // HH:mm
  assunto: string;
  status: 'agendado' | 'atendido' | 'cancelado';
  criadoEm: string;
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
  listar(): Promise<Agendamento[]>;
}

// Horários de atendimento do PROCON Jacareí (08h às 16h)
const HORARIOS_PADRAO = [
  '08:00', '09:00', '10:00', '11:00',
  '13:00', '14:00', '15:00', '16:00',
];

export class RepositorioAgendamentosMemoria implements RepositorioAgendamentos {
  private agendamentos: Map<string, Agendamento> = new Map();

  async listarHorarios(data: string): Promise<HorarioSlot[]> {
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
    return novoAgendamento;
  }

  async buscarPorId(id: string): Promise<Agendamento | undefined> {
    return this.agendamentos.get(id);
  }

  async buscarPorProtocolo(protocolo: string): Promise<Agendamento | undefined> {
    return Array.from(this.agendamentos.values()).find((a) => a.protocolo === protocolo);
  }

  async listar(): Promise<Agendamento[]> {
    return Array.from(this.agendamentos.values());
  }
}
