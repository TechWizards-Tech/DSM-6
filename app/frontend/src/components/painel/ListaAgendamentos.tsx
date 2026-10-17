import { useCallback, useEffect, useState, type ReactNode } from 'react';

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

function paraDate(data: string): Date {
  const [ano = 0, mes = 1, dia = 1] = data.split('-').map(Number);
  return new Date(ano, mes - 1, dia);
}

/** Ex.: "sexta-feira, 16 de outubro de 2026" */
function formatarDataExtenso(data: string): string {
  const texto = paraDate(data).toLocaleDateString('pt-BR', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  });
  return texto.charAt(0).toUpperCase() + texto.slice(1);
}

/** Ex.: "16 out" */
function formatarDataCurta(data: string): string {
  return paraDate(data)
    .toLocaleDateString('pt-BR', { day: '2-digit', month: 'short' })
    .replace('.', '')
    .replace(' de ', ' ');
}

function iniciais(nome: string): string {
  const partes = nome.trim().split(/\s+/);
  const primeira = partes[0]?.[0] ?? '';
  const ultima = partes.length > 1 ? (partes[partes.length - 1]?.[0] ?? '') : '';
  return (primeira + ultima).toUpperCase() || '?';
}

const OPCOES_STATUS: { valor: StatusAgendamento | ''; rotulo: string }[] = [
  { valor: '', rotulo: 'Todas' },
  { valor: 'agendado', rotulo: 'Agendados' },
  { valor: 'atendido', rotulo: 'Atendidos' },
  { valor: 'cancelado', rotulo: 'Cancelados' },
];

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
  // Busca todos os status da data e filtra aqui: o resumo mostra o dia inteiro
  // e trocar a situacao nao precisa de nova requisicao.
  const [todos, setTodos] = useState<AgendamentoPainel[]>([]);
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
      setTodos(await listarAgendamentos(token, { data: filtroData || undefined }));
    } catch (falha) {
      tratarFalha(falha);
    } finally {
      setCarregando(false);
    }
  }, [token, filtroData, tratarFalha]);

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

  const agendamentos = filtroStatus ? todos.filter((a) => a.status === filtroStatus) : todos;

  const contagem = {
    agendado: todos.filter((a) => a.status === 'agendado').length,
    atendido: todos.filter((a) => a.status === 'atendido').length,
    cancelado: todos.filter((a) => a.status === 'cancelado').length,
  };

  // Sem filtro de data, a lista vem de varios dias: agrupa para facilitar a leitura.
  const grupos = agendamentos.reduce<{ data: string; itens: AgendamentoPainel[] }[]>(
    (acc, agendamento) => {
      const ultimo = acc[acc.length - 1];
      if (ultimo && ultimo.data === agendamento.data) ultimo.itens.push(agendamento);
      else acc.push({ data: agendamento.data, itens: [agendamento] });
      return acc;
    },
    [],
  );

  return (
    <div className="painel-pagina">
      <header className="painel-barra">
        <div className="painel-barra__conteudo">
          <div className="painel-barra__marca">
            <span className="painel-barra__logo" aria-hidden="true">
              P
            </span>
            <div>
              <strong>PROCON Jacareí</strong>
              <span>Painel interno</span>
            </div>
          </div>
          <div className="painel__usuario">
            <span className="painel__avatar" aria-hidden="true">
              {iniciais(usuario.nome)}
            </span>
            <span className="painel__usuario-nome">{usuario.nome}</span>
            <button className="botao botao--fantasma" type="button" onClick={aoSair}>
              <IconeSair />
              Sair
            </button>
          </div>
        </div>
      </header>

      <main className="painel">
        <div className="painel__cabecalho">
          <div>
            <h1 className="painel__titulo">Agendamentos presenciais</h1>
            <p className="painel__subtitulo">
              {filtroData ? formatarDataExtenso(filtroData) : 'Todas as datas'}
            </p>
          </div>
          <dl className="painel__resumo" aria-label="Resumo da lista">
            <div className="resumo resumo--agendado">
              <dt>Agendados</dt>
              <dd>{carregando ? '–' : contagem.agendado}</dd>
            </div>
            <div className="resumo resumo--atendido">
              <dt>Atendidos</dt>
              <dd>{carregando ? '–' : contagem.atendido}</dd>
            </div>
            <div className="resumo resumo--cancelado">
              <dt>Cancelados</dt>
              <dd>{carregando ? '–' : contagem.cancelado}</dd>
            </div>
          </dl>
        </div>

        <section className="painel__filtros" aria-label="Filtros">
          <label className="campo painel__campo-data">
            <span className="campo__rotulo">Data</span>
            <input
              className="campo__input"
              type="date"
              value={filtroData}
              onChange={(e) => setFiltroData(e.target.value)}
            />
          </label>
          <div className="campo">
            <span className="campo__rotulo" id="rotulo-situacao">
              Situação
            </span>
            <div className="segmentos" role="radiogroup" aria-labelledby="rotulo-situacao">
              {OPCOES_STATUS.map((opcao) => (
                <button
                  key={opcao.valor || 'todas'}
                  type="button"
                  role="radio"
                  aria-checked={filtroStatus === opcao.valor}
                  className={`segmento${filtroStatus === opcao.valor ? ' segmento--ativo' : ''}`}
                  onClick={() => setFiltroStatus(opcao.valor)}
                >
                  {opcao.rotulo}
                </button>
              ))}
            </div>
          </div>
          <div className="painel__atalhos">
            <button
              className={`botao botao--fantasma${filtroData === hojeLocal() ? ' botao--ativo' : ''}`}
              type="button"
              onClick={() => setFiltroData(hojeLocal())}
            >
              Hoje
            </button>
            <button
              className={`botao botao--fantasma${filtroData === '' ? ' botao--ativo' : ''}`}
              type="button"
              onClick={() => setFiltroData('')}
            >
              Todas as datas
            </button>
            <button
              className="botao botao--fantasma"
              type="button"
              onClick={() => void carregar()}
              disabled={carregando}
              aria-label="Atualizar lista"
            >
              <IconeAtualizar girando={carregando} />
              Atualizar
            </button>
          </div>
        </section>

        {erro && (
          <div className="painel__mensagem painel__mensagem--erro" role="alert">
            <IconeAlerta />
            <p>{erro}</p>
            <button type="button" aria-label="Fechar aviso" onClick={() => setErro(null)}>
              ×
            </button>
          </div>
        )}
        {sucesso && (
          <div className="painel__mensagem painel__mensagem--sucesso" role="status">
            <IconeCheck />
            <p>{sucesso}</p>
            <button type="button" aria-label="Fechar aviso" onClick={() => setSucesso(null)}>
              ×
            </button>
          </div>
        )}

        <section className="painel__lista" aria-busy={carregando}>
          <p className="painel__contagem">
            {carregando
              ? 'Carregando agendamentos...'
              : `${agendamentos.length} agendamento${agendamentos.length === 1 ? '' : 's'}`}
          </p>

          {carregando && agendamentos.length === 0 && (
            <div className="painel__esqueletos" aria-hidden="true">
              {[0, 1, 2].map((i) => (
                <div key={i} className="esqueleto" />
              ))}
            </div>
          )}

          {!carregando && agendamentos.length === 0 && (
            <div className="painel__vazio">
              <IconeCalendario />
              <strong>Nenhum agendamento encontrado</strong>
              <span>Tente outra data ou mude o filtro de situação.</span>
            </div>
          )}

          {grupos.map((grupo) => (
            <div key={grupo.data} className="painel__grupo">
              {!filtroData && (
                <h2 className="painel__dia">
                  {formatarDataExtenso(grupo.data)}
                  <span>{grupo.itens.length}</span>
                </h2>
              )}

              {grupo.itens.map((agendamento) => (
                <article
                  key={agendamento.id}
                  className={`agendamento agendamento--${agendamento.status}${
                    emAcao === agendamento.id ? ' agendamento--ocupado' : ''
                  }`}
                >
                  <div className="agendamento__quando">
                    <strong>{agendamento.horario}</strong>
                    <span>{formatarDataCurta(agendamento.data)}</span>
                  </div>

                  <div className="agendamento__dados">
                    <div className="agendamento__linha">
                      <h3 className="agendamento__nome">{agendamento.nome}</h3>
                      <span className={`status status--${agendamento.status}`}>
                        {ROTULO_STATUS[agendamento.status]}
                      </span>
                    </div>
                    <p className="agendamento__assunto">{agendamento.assunto}</p>
                    <dl className="agendamento__meta">
                      <div>
                        <dt>CPF</dt>
                        <dd>{formatarCpf(agendamento.cpf)}</dd>
                      </div>
                      <div>
                        <dt>Contato</dt>
                        <dd>{agendamento.usuario}</dd>
                      </div>
                      <div>
                        <dt>Protocolo</dt>
                        <dd className="agendamento__protocolo">{agendamento.protocolo}</dd>
                      </div>
                    </dl>

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
                        className="botao botao--sucesso"
                        type="button"
                        disabled={emAcao !== null}
                        onClick={() => confirmar(agendamento)}
                      >
                        <IconeCheck />
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
                        <IconeCalendario />
                        Remarcar
                      </button>
                      <button
                        className="botao botao--perigo"
                        type="button"
                        disabled={emAcao !== null}
                        onClick={() => cancelar(agendamento)}
                      >
                        <IconeX />
                        Cancelar
                      </button>
                    </div>
                  )}
                </article>
              ))}
            </div>
          ))}
        </section>
      </main>
    </div>
  );
}

/* ------------------------------------------------------------------ icones */

function Icone({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <svg
      className={`icone${className ? ` ${className}` : ''}`}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      {children}
    </svg>
  );
}

const IconeCheck = () => (
  <Icone>
    <path d="M20 6 9 17l-5-5" />
  </Icone>
);

const IconeX = () => (
  <Icone>
    <path d="M18 6 6 18M6 6l12 12" />
  </Icone>
);

const IconeCalendario = () => (
  <Icone>
    <rect x="3" y="4" width="18" height="18" rx="2" />
    <path d="M16 2v4M8 2v4M3 10h18" />
  </Icone>
);

const IconeAlerta = () => (
  <Icone>
    <circle cx="12" cy="12" r="10" />
    <path d="M12 8v4M12 16h.01" />
  </Icone>
);

const IconeSair = () => (
  <Icone>
    <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4M16 17l5-5-5-5M21 12H9" />
  </Icone>
);

const IconeAtualizar = ({ girando }: { girando: boolean }) => (
  <Icone className={girando ? 'icone--girando' : undefined}>
    <path d="M21 12a9 9 0 1 1-2.64-6.36L21 8M21 3v5h-5" />
  </Icone>
);

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
      <p className="remarcar__titulo">
        <IconeCalendario />
        Remarcar · atual: {formatarData(agendamento.data)} às {agendamento.horario}
      </p>
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
