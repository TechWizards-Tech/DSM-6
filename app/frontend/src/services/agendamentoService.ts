export interface HorarioSlot {
  horario: string;
  disponivel: boolean;
}

export interface SolicitacaoAgendamento {
  usuario: string;
  nome: string;
  cpf: string;
  data: string;
  horario: string;
  assunto: string;
}

export interface AgendamentoRealizado {
  id: string;
  protocolo: string;
  usuario: string;
  nome: string;
  cpf: string;
  data: string;
  horario: string;
  assunto: string;
  status: string;
  criadoEm: string;
}

export async function buscarHorarios(data: string): Promise<HorarioSlot[]> {
  const resposta = await fetch(`/api/agendamentos/horarios?data=${encodeURIComponent(data)}`);
  if (!resposta.ok) {
    throw new Error('Falha ao buscar horários disponíveis.');
  }
  const json = await resposta.json();
  return json.horarios;
}

export async function criarAgendamento(dados: SolicitacaoAgendamento): Promise<AgendamentoRealizado> {
  const resposta = await fetch('/api/agendamentos', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(dados),
  });

  if (!resposta.ok) {
    const erro = await resposta.json();
    throw new Error(erro.erro || 'Falha ao realizar agendamento.');
  }

  return resposta.json();
}
