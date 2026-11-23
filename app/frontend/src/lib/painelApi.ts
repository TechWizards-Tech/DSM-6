import { requisitar } from './api';

export type StatusAgendamento = 'agendado' | 'atendido' | 'cancelado';

export interface AgendamentoPainel {
  id: string;
  protocolo: string;
  usuario: string;
  nome: string;
  cpf: string;
  data: string;
  horario: string;
  assunto: string;
  status: StatusAgendamento;
  criadoEm: string;
}

export type Papel = 'admin' | 'atendente';

export interface UsuarioPainel {
  id: string;
  email: string;
  nome: string;
  papel: Papel;
}

export interface UsuarioListado extends UsuarioPainel {
  criadoEm: string;
}

export interface NovoUsuario {
  nome: string;
  email: string;
  senha: string;
  papel: Papel;
}

export interface FiltroAgendamentos {
  data?: string;
  status?: StatusAgendamento;
}

function comToken(token: string, init: RequestInit = {}): RequestInit {
  return { ...init, headers: { ...init.headers, Authorization: `Bearer ${token}` } };
}

export function entrar(email: string, senha: string) {
  return requisitar<{ token: string; usuario: UsuarioPainel }>('/auth/login', {
    method: 'POST',
    body: JSON.stringify({ email, senha }),
  });
}

export async function obterUsuario(token: string): Promise<UsuarioPainel> {
  const { usuario } = await requisitar<{ usuario: UsuarioPainel }>('/admin/eu', comToken(token));
  return usuario;
}

export async function listarAgendamentos(
  token: string,
  filtro: FiltroAgendamentos,
): Promise<AgendamentoPainel[]> {
  const parametros = new URLSearchParams();
  if (filtro.data) parametros.set('data', filtro.data);
  if (filtro.status) parametros.set('status', filtro.status);
  const consulta = parametros.toString();
  const { agendamentos } = await requisitar<{ agendamentos: AgendamentoPainel[] }>(
    `/admin/agendamentos${consulta ? `?${consulta}` : ''}`,
    comToken(token),
  );
  return agendamentos;
}

function acao(token: string, id: string, nome: string, corpo?: object) {
  return requisitar<AgendamentoPainel>(
    `/admin/agendamentos/${encodeURIComponent(id)}/${nome}`,
    comToken(token, { method: 'POST', body: corpo ? JSON.stringify(corpo) : undefined }),
  );
}

export const confirmarAtendimento = (token: string, id: string) => acao(token, id, 'confirmar');
export const cancelarAgendamento = (token: string, id: string) => acao(token, id, 'cancelar');
export const remarcarAgendamento = (token: string, id: string, data: string, horario: string) =>
  acao(token, id, 'remarcar', { data, horario });

export async function listarUsuarios(token: string): Promise<UsuarioListado[]> {
  const { usuarios } = await requisitar<{ usuarios: UsuarioListado[] }>(
    '/admin/usuarios',
    comToken(token),
  );
  return usuarios;
}

export function criarUsuario(token: string, dados: NovoUsuario) {
  return requisitar<UsuarioListado>(
    '/admin/usuarios',
    comToken(token, { method: 'POST', body: JSON.stringify(dados) }),
  );
}

export interface AtualizarUsuarioInput {
  nome?: string;
  senha?: string;
  papel?: Papel;
}

export function atualizarUsuario(token: string, id: string, dados: AtualizarUsuarioInput) {
  return requisitar<UsuarioListado>(
    `/admin/usuarios/${encodeURIComponent(id)}`,
    comToken(token, { method: 'PATCH', body: JSON.stringify(dados) }),
  );
}

export function excluirUsuario(token: string, id: string) {
  return requisitar<undefined>(
    `/admin/usuarios/${encodeURIComponent(id)}`,
    comToken(token, { method: 'DELETE' }),
  );
}

export interface EstatisticaFluxoPainel {
  fluxoId: string;
  titulo: string;
  vezesEscolhido: number;
  orientacoesEntregues: number;
}

export interface EstatisticasFluxos {
  conversasIniciadas: number;
  orientacoesEntregues: number;
  entradasInvalidas: number;
  fluxosMaisUtilizados: EstatisticaFluxoPainel[];
}

export function obterEstatisticas(): Promise<EstatisticasFluxos> {
  return requisitar<EstatisticasFluxos>('/registros/estatisticas');
}

