/**
 * Acoes do Painel Web Administrativo sobre agendamentos (RF08, US05).
 * Somente agendamentos com status "agendado" podem ser confirmados, cancelados
 * ou remarcados; "atendido" e "cancelado" sao estados finais.
 */
import { HORARIOS_PADRAO, type Agendamento, type RepositorioAgendamentos } from './index.js';

export class AgendamentoNaoEncontrado extends Error {
  constructor(id: string) {
    super(`Agendamento ${id} nao encontrado.`);
    this.name = 'AgendamentoNaoEncontrado';
  }
}

/** Violacao de regra de negocio: vira HTTP 400/409 na camada HTTP. */
export class ErroRegraAgendamento extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'ErroRegraAgendamento';
  }
}

const FORMATO_DATA = /^\d{4}-\d{2}-\d{2}$/;

function hojeLocal(): string {
  const agora = new Date();
  const mes = String(agora.getMonth() + 1).padStart(2, '0');
  const dia = String(agora.getDate()).padStart(2, '0');
  return `${agora.getFullYear()}-${mes}-${dia}`;
}

async function buscarAtivo(repo: RepositorioAgendamentos, id: string): Promise<Agendamento> {
  const agendamento = await repo.buscarPorId(id);
  if (!agendamento) throw new AgendamentoNaoEncontrado(id);
  if (agendamento.status !== 'agendado') {
    throw new ErroRegraAgendamento(
      `Este agendamento ja esta "${agendamento.status}" e nao pode mais ser alterado.`,
    );
  }
  return agendamento;
}

async function aplicar(
  repo: RepositorioAgendamentos,
  id: string,
  alteracao: Parameters<RepositorioAgendamentos['atualizar']>[1],
): Promise<Agendamento> {
  try {
    const atualizado = await repo.atualizar(id, alteracao);
    if (!atualizado) throw new AgendamentoNaoEncontrado(id);
    return atualizado;
  } catch (erro) {
    if (erro instanceof Error && erro.message.includes('já está ocupado')) {
      throw new ErroRegraAgendamento(erro.message);
    }
    throw erro;
  }
}

/** Confirma que o cidadao foi atendido presencialmente. */
export async function confirmarAtendimento(
  repo: RepositorioAgendamentos,
  id: string,
): Promise<Agendamento> {
  await buscarAtivo(repo, id);
  return aplicar(repo, id, { status: 'atendido' });
}

export async function cancelarAgendamento(
  repo: RepositorioAgendamentos,
  id: string,
): Promise<Agendamento> {
  await buscarAtivo(repo, id);
  return aplicar(repo, id, { status: 'cancelado' });
}

export async function remarcarAgendamento(
  repo: RepositorioAgendamentos,
  id: string,
  data: string,
  horario: string,
  hoje = hojeLocal(),
): Promise<Agendamento> {
  if (!FORMATO_DATA.test(data)) {
    throw new ErroRegraAgendamento('Informe a nova data no formato YYYY-MM-DD.');
  }
  if (!HORARIOS_PADRAO.includes(horario)) {
    throw new ErroRegraAgendamento(
      `Horario invalido. Horarios de atendimento: ${HORARIOS_PADRAO.join(', ')}.`,
    );
  }
  if (data < hoje) {
    throw new ErroRegraAgendamento('Nao e possivel remarcar para uma data que ja passou.');
  }
  const [ano = 0, mes = 1, dia = 1] = data.split('-').map(Number);
  const diaDaSemana = new Date(ano, mes - 1, dia).getDay();
  if (diaDaSemana === 0 || diaDaSemana === 6) {
    throw new ErroRegraAgendamento(
      'O PROCON de Jacareí não realiza atendimentos aos sábados e domingos.',
    );
  }

  const atual = await buscarAtivo(repo, id);
  if (atual.data === data && atual.horario === horario) {
    throw new ErroRegraAgendamento('Escolha uma data ou horario diferente do atual.');
  }
  return aplicar(repo, id, { data, horario });
}
