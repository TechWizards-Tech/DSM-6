import { useCallback, useEffect, useState } from 'react';

import { ErroApi } from '../../lib/api';
import {
  cancelarAgendamento,
  confirmarAtendimento,
  listarAgendamentos,
  remarcarAgendamento,
  type AgendamentoPainel,
  type StatusAgendamento,
  type UsuarioPainel,
} from '../../lib/painelApi';
import { buscarHorarios, type HorarioSlot } from '../../services/agendamentoService';

interface Props {
  token: string;
  usuario: UsuarioPainel;
  aoSair: () => void;
  aoExpirar: (motivo: string) => void;
}

const ROTULO_STATUS: Record<StatusAgendamento, string> = {
  agendado: 'Agendado',
  atendido: 'Atendido',
  cancelado: 'Cancelado',
};

function hojeLocal(): string {
  const agora = new Date();
  const mes = String(agora.getMonth() + 1).padStart(2, '0');
  const dia = String(agora.getDate()).padStart(2, '0');
  return `${agora.getFullYear()}-${mes}-${dia}`;
}

function formatarData(data: string): string {
  const [ano, mes, dia] = data.split('-');
  return `${dia}/${mes}/${ano}`;
}

function formatarCpf(cpf: string): string {
  const digitos = cpf.replace(/\D/g, '');
  return digitos.length === 11
    ? digitos.replace(/(\d{3})(\d{3})(\d{3})(\d{2})/, '$1.$2.$3-$4')
    : cpf;
}

function ehFimDeSemana(data: string): boolean {
  const [ano = 0, mes = 1, dia = 1] = data.split('-').map(Number);
  const diaDaSemana = new Date(ano, mes - 1, dia).getDay();
  return diaDaSemana === 0 || diaDaSemana === 6;
}

export function ListaAgendamentos({ token, usuario, aoSair, aoExpirar }: Props) {
  const [filtroData, setFiltroData] = useState(hojeLocal);
  const [filtroStatus, setFiltroStatus] = useState<StatusAgendamento | ''>('agendado');
  const [agendamentos, setAgendamentos] = useState<AgendamentoPainel[]>([]);
  const [carregando, setCarregando] = useState(true);
  const [erro, setErro] = useState<string | null>(null);
  const [sucesso, setSucesso] = useState<string | null>(null);
  const [emAcao, setEmAcao] = useState<string | null>(null);
  const [remarcando, setRemarcando] = useState<AgendamentoPainel | null>(null);

  const tratarFalha = useCallback(
    (falha: unknown) => {
      if (falha instanceof ErroApi && falha.status === 401) {
        aoExpirar(falha.message);
        return;
      }
      setErro(falha instanceof ErroApi ? falha.message : 'Algo deu errado. Tente novamente.');
    },
    [aoExpirar],
  );

  const carregar = useCallback(async () => {
    setCarregando(true);
    setErro(null);
    try {
      setAgendamentos(
        await listarAgendamentos(token, {
          data: filtroData || undefined,
          status: filtroStatus || undefined,
        }),
      );
    } catch (falha) {
      tratarFalha(falha);
    } finally {
      setCarregando(false);
    }
  }, [token, filtroData, filtroStatus, tratarFalha]);

  useEffect(() => {
    void carregar();
  }, [carregar]);

  async function executar(
    agendamento: AgendamentoPainel,
    operacao: () => Promise<AgendamentoPainel>,
    mensagem: string,
  ) {
    setEmAcao(agendamento.id);
    setErro(null);
    setSucesso(null);
    try {
      await operacao();
      setSucesso(mensagem);
      setRemarcando(null);
      await carregar();
    } catch (falha) {
      tratarFalha(falha);
    } finally {
      setEmAcao(null);
    }
  }

  function confirmar(agendamento: AgendamentoPainel) {
    if (!window.confirm(`Confirmar que ${agendamento.nome} foi atendido(a)?`)) return;
    void executar(
      agendamento,
      () => confirmarAtendimento(token, agendamento.id),
      `Atendimento de ${agendamento.nome} confirmado.`,
    );
  }

  function cancelar(agendamento: AgendamentoPainel) {
    const texto = `Cancelar o agendamento ${agendamento.protocolo} de ${agendamento.nome}? O horário ficará livre para outro cidadão.`;
    if (!window.confirm(texto)) return;
    void executar(
      agendamento,
      () => cancelarAgendamento(token, agendamento.id),
      `Agendamento ${agendamento.protocolo} cancelado.`,
    );
  }

  return (
    <main className="painel">
      <header className="painel__cabecalho">
        <div>
          <span className="entrada__selo">PROCON Jacareí · Uso interno</span>
          <h1 className="painel__titulo">Agendamentos presenciais</h1>
        </div>
        <div className="painel__usuario">
          <span>{usuario.nome}</span>
          <button className="botao botao--fantasma" type="button" onClick={aoSair}>
            Sair
          </button>
        </div>
      </header>

      <section className="painel__filtros" aria-label="Filtros">
        <label className="campo">
          <span className="campo__rotulo">Data</span>
          <input
            className="campo__input"
            type="date"
            value={filtroData}
            onChange={(e) => setFiltroData(e.target.value)}
          />
        </label>
        <label className="campo">
          <span className="campo__rotulo">Situação</span>
          <select
            className="campo__input"
            value={filtroStatus}
            onChange={(e) => setFiltroStatus(e.target.value as StatusAgendamento | '')}
          >
            <option value="">Todas</option>
            <option value="agendado">Agendados</option>
            <option value="atendido">Atendidos</option>
            <option value="cancelado">Cancelados</option>
          </select>
        </label>
        <div className="painel__atalhos">
          <button className="botao botao--fantasma" type="button" onClick={() => setFiltroData(hojeLocal())}>
            Hoje
          </button>
          <button className="botao botao--fantasma" type="button" onClick={() => setFiltroData('')}>
            Todas as datas
          </button>
          <button className="botao botao--fantasma" type="button" onClick={() => void carregar()}>
            Atualizar
          </button>
        </div>
      </section>

      {erro && (
        <p className="painel__mensagem painel__mensagem--erro" role="alert">
          {erro}
        </p>
      )}
      {sucesso && (
        <p className="painel__mensagem painel__mensagem--sucesso" role="status">
          {sucesso}
        </p>
      )}

      <section className="painel__lista" aria-busy={carregando}>
        <p className="painel__contagem">
          {carregando
            ? 'Carregando...'
            : `${agendamentos.length} agendamento${agendamentos.length === 1 ? '' : 's'}`}
        </p>

        {!carregando && agendamentos.length === 0 && (
          <p className="painel__vazio">Nenhum agendamento encontrado para estes filtros.</p>
        )}

        {agendamentos.map((agendamento) => (
          <article key={agendamento.id} className="agendamento">
            <div className="agendamento__quando">
              <strong>{agendamento.horario}</strong>
              <span>{formatarData(agendamento.data)}</span>
            </div>

            <div className="agendamento__dados">
              <div className="agendamento__linha">
                <h2 className="agendamento__nome">{agendamento.nome}</h2>
                <span className={`status status--${agendamento.status}`}>
                  {ROTULO_STATUS[agendamento.status]}
                </span>
              </div>
              <p className="agendamento__assunto">{agendamento.assunto}</p>
              <p className="agendamento__meta">
                CPF {formatarCpf(agendamento.cpf)} · Contato {agendamento.usuario} · Protocolo{' '}
                {agendamento.protocolo}
              </p>

              {remarcando?.id === agendamento.id && (
                <FormularioRemarcar
                  agendamento={agendamento}
                  ocupado={emAcao === agendamento.id}
                  aoCancelar={() => setRemarcando(null)}
                  aoConfirmar={(data, horario) =>
                    void executar(
                      agendamento,
                      () => remarcarAgendamento(token, agendamento.id, data, horario),
                      `Agendamento de ${agendamento.nome} remarcado para ${formatarData(data)} às ${horario}.`,
                    )
                  }
                />
              )}
            </div>

            {agendamento.status === 'agendado' && remarcando?.id !== agendamento.id && (
              <div className="agendamento__acoes">
                <button
                  className="botao botao--primario"
                  type="button"
                  disabled={emAcao !== null}
                  onClick={() => confirmar(agendamento)}
                >
                  Confirmar atendimento
                </button>
                <button
                  className="botao botao--fantasma"
                  type="button"
                  disabled={emAcao !== null}
                  onClick={() => {
                    setSucesso(null);
                    setRemarcando(agendamento);
                  }}
                >
                  Remarcar
                </button>
                <button
                  className="botao botao--perigo"
                  type="button"
                  disabled={emAcao !== null}
                  onClick={() => cancelar(agendamento)}
                >
                  Cancelar
                </button>
              </div>
            )}
          </article>
        ))}
      </section>
    </main>
  );
}

interface PropsRemarcar {
  agendamento: AgendamentoPainel;
  ocupado: boolean;
  aoCancelar: () => void;
  aoConfirmar: (data: string, horario: string) => void;
}

function FormularioRemarcar({ agendamento, ocupado, aoCancelar, aoConfirmar }: PropsRemarcar) {
  const hoje = hojeLocal();
  const [data, setData] = useState(agendamento.data < hoje ? hoje : agendamento.data);
  const [horario, setHorario] = useState('');
  const [horarios, setHorarios] = useState<HorarioSlot[]>([]);
  const [carregando, setCarregando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const fimDeSemana = ehFimDeSemana(data);

  useEffect(() => {
    setHorario('');
    if (!data || fimDeSemana) {
      setHorarios([]);
      return;
    }
    let cancelado = false;
    setCarregando(true);
    setErro(null);
    buscarHorarios(data)
      .then((slots) => {
        if (!cancelado) setHorarios(slots);
      })
      .catch((falha: unknown) => {
        if (!cancelado) setErro(falha instanceof Error ? falha.message : 'Erro ao carregar horários.');
      })
      .finally(() => {
        if (!cancelado) setCarregando(false);
      });
    return () => {
      cancelado = true;
    };
  }, [data, fimDeSemana]);

  return (
    <div className="remarcar">
      <label className="campo">
        <span className="campo__rotulo">Nova data</span>
        <input
          className="campo__input"
          type="date"
          min={hoje}
          value={data}
          onChange={(e) => setData(e.target.value)}
        />
      </label>

      <div className="campo">
        <span className="campo__rotulo">Novo horário</span>
        {fimDeSemana ? (
          <p className="remarcar__aviso">Não há atendimento aos sábados e domingos.</p>
        ) : carregando ? (
          <p className="remarcar__aviso">Carregando horários...</p>
        ) : erro ? (
          <p className="remarcar__aviso">{erro}</p>
        ) : (
          <div className="remarcar__horarios" role="radiogroup" aria-label="Horários">
            {horarios.map((slot) => {
              const atual = data === agendamento.data && slot.horario === agendamento.horario;
              return (
                <button
                  key={slot.horario}
                  type="button"
                  role="radio"
                  aria-checked={horario === slot.horario}
                  className={`horario${horario === slot.horario ? ' horario--selecionado' : ''}`}
                  disabled={!slot.disponivel}
                  title={atual ? 'Horário atual deste agendamento' : undefined}
                  onClick={() => setHorario(slot.horario)}
                >
                  {slot.horario}
                </button>
              );
            })}
          </div>
        )}
      </div>

      <div className="remarcar__acoes">
        <button className="botao botao--fantasma" type="button" onClick={aoCancelar} disabled={ocupado}>
          Voltar
        </button>
        <button
          className="botao botao--primario"
          type="button"
          disabled={ocupado || !horario || fimDeSemana}
          onClick={() => aoConfirmar(data, horario)}
        >
          {ocupado ? 'Salvando...' : 'Salvar nova data'}
        </button>
      </div>
    </div>
  );
}
