import { useCallback, useEffect, useMemo, useState } from 'react';

import { ErroApi } from '../../lib/api';
import {
  listarInteracoes,
  obterEstatisticas,
  type EstatisticasFluxos,
  type InteracaoRegistrada,
} from '../../lib/painelApi';

const ROTULO_EVENTO: Record<string, string> = {
  conversa_iniciada: 'Conversa iniciada',
  fluxo_escolhido: 'Fluxo escolhido',
  opcao_escolhida: 'Opção respondida',
  orientacao_entregue: 'Orientação entregue',
  entrada_invalida: 'Entrada não reconhecida',
  comando_global: 'Comando global',
  conversa_encerrada: 'Conversa encerrada',
};

function formatarDataHora(iso: string): string {
  const data = new Date(iso);
  if (Number.isNaN(data.getTime())) return iso;
  return data.toLocaleString('pt-BR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

interface GrupoUsuario {
  usuario: string;
  ultimoEm: string;
  fluxos: string[];
  orientacoes: number;
  eventos: InteracaoRegistrada[];
}

export function JanelaEstatisticas() {
  const [dados, setDados] = useState<EstatisticasFluxos | null>(null);
  const [interacoes, setInteracoes] = useState<InteracaoRegistrada[]>([]);
  const [visao, setVisao] = useState<'ranking' | 'historico'>('ranking');
  const [usuarioExpandido, setUsuarioExpandido] = useState<string | null>(null);
  const [carregando, setCarregando] = useState(true);
  const [erro, setErro] = useState<string | null>(null);

  const carregar = useCallback(async () => {
    setCarregando(true);
    setErro(null);
    try {
      const [est, reg] = await Promise.all([obterEstatisticas(), listarInteracoes()]);
      setDados(est);
      setInteracoes(reg);
    } catch (falha) {
      setErro(falha instanceof ErroApi ? falha.message : 'Não foi possível carregar as estatísticas.');
    } finally {
      setCarregando(false);
    }
  }, []);

  useEffect(() => {
    void carregar();
  }, [carregar]);

  const gruposPorUsuario = useMemo<GrupoUsuario[]>(() => {
    const mapa = new Map<string, GrupoUsuario>();

    for (const item of interacoes) {
      const chave = item.usuario || 'Anônimo';
      let grupo = mapa.get(chave);
      if (!grupo) {
        grupo = {
          usuario: chave,
          ultimoEm: item.em,
          fluxos: [],
          orientacoes: 0,
          eventos: [],
        };
        mapa.set(chave, grupo);
      }
      grupo.eventos.push(item);
      if (item.em > grupo.ultimoEm) {
        grupo.ultimoEm = item.em;
      }
      if (item.fluxoId && !grupo.fluxos.includes(item.fluxoId)) {
        grupo.fluxos.push(item.fluxoId);
      }
      if (item.evento === 'orientacao_entregue') {
        grupo.orientacoes += 1;
      }
    }

    return Array.from(mapa.values()).sort((a, b) => b.ultimoEm.localeCompare(a.ultimoEm));
  }, [interacoes]);

  return (
    <main className="painel">
      <div className="painel__cabecalho">
        <div>
          <h1 className="painel__titulo">Estatísticas dos fluxos mais utilizados</h1>
          <p className="painel__subtitulo">
            Análise das demandas mais recorrentes e histórico por consumidor (RF06 / US06)
          </p>
        </div>
        <dl className="painel__resumo" aria-label="Resumo de interações">
          <div className="resumo resumo--agendado">
            <dt>Conversas iniciadas</dt>
            <dd>{carregando || !dados ? '–' : dados.conversasIniciadas}</dd>
          </div>
          <div className="resumo resumo--atendido">
            <dt>Orientações entregues</dt>
            <dd>{carregando || !dados ? '–' : dados.orientacoesEntregues}</dd>
          </div>
          <div className="resumo resumo--cancelado">
            <dt>Usuários atendidos</dt>
            <dd>{carregando ? '–' : gruposPorUsuario.length}</dd>
          </div>
        </dl>
      </div>

      <section className="painel__filtros" aria-label="Visualização de estatísticas">
        <div className="campo">
          <span className="campo__rotulo" id="rotulo-visao-estatisticas">
            Visualização
          </span>
          <div className="segmentos" role="radiogroup" aria-labelledby="rotulo-visao-estatisticas">
            <button
              type="button"
              role="radio"
              aria-checked={visao === 'ranking'}
              className={`segmento${visao === 'ranking' ? ' segmento--ativo' : ''}`}
              onClick={() => setVisao('ranking')}
            >
              Ranking de Fluxos ({dados?.fluxosMaisUtilizados.length ?? 0})
            </button>
            <button
              type="button"
              role="radio"
              aria-checked={visao === 'historico'}
              className={`segmento${visao === 'historico' ? ' segmento--ativo' : ''}`}
              onClick={() => setVisao('historico')}
            >
              Por Usuário ({gruposPorUsuario.length})
            </button>
          </div>
        </div>
        <div className="painel__atalhos">
          <button
            className="botao botao--fantasma"
            type="button"
            onClick={carregar}
            disabled={carregando}
          >
            Atualizar
          </button>
        </div>
      </section>

      {erro && (
        <div className="painel__mensagem painel__mensagem--erro" role="alert">
          <p>{erro}</p>
        </div>
      )}

      <section className="painel__lista" aria-live="polite" aria-busy={carregando}>
        {carregando && (
          <div className="painel__vazio">
            <strong>Carregando estatísticas...</strong>
          </div>
        )}

        {!carregando && visao === 'ranking' && dados && (
          <div className="painel__grupo">
            {dados.fluxosMaisUtilizados.map((item, indice) => (
              <article
                key={item.fluxoId}
                className={`agendamento${item.vezesEscolhido > 0 ? '' : ' agendamento--cancelado'}`}
              >
                <div className="agendamento__quando">
                  <strong>{indice + 1}º</strong>
                  <span>Ranking</span>
                </div>

                <div className="agendamento__dados">
                  <div className="agendamento__linha">
                    <h3 className="agendamento__nome">{item.titulo}</h3>
                    <span className="status status--agendado">
                      {item.vezesEscolhido} {item.vezesEscolhido === 1 ? 'acesso' : 'acessos'}
                    </span>
                    <span className="status status--atendido">
                      {item.orientacoesEntregues}{' '}
                      {item.orientacoesEntregues === 1
                        ? 'orientação entregue'
                        : 'orientações entregues'}
                    </span>
                  </div>

                  <dl className="agendamento__meta">
                    <div>
                      <dt>Identificador do fluxo</dt>
                      <dd>{item.fluxoId}</dd>
                    </div>
                    <div>
                      <dt>Taxa de conclusão</dt>
                      <dd>
                        {item.vezesEscolhido > 0
                          ? `${Math.round((item.orientacoesEntregues / item.vezesEscolhido) * 100)}%`
                          : '0%'}
                      </dd>
                    </div>
                  </dl>
                </div>
              </article>
            ))}
          </div>
        )}

        {!carregando && visao === 'historico' && (
          <div className="painel__grupo">
            {gruposPorUsuario.length === 0 ? (
              <div className="painel__vazio">
                <strong>Nenhuma interação registrada</strong>
              </div>
            ) : (
              gruposPorUsuario.map((grupo) => {
                const aberto = usuarioExpandido === grupo.usuario;
                const dataHora = formatarDataHora(grupo.ultimoEm);
                const [dataParte, horaParte] = dataHora.split(',');

                return (
                  <article
                    key={grupo.usuario}
                    className={`agendamento${grupo.orientacoes > 0 ? ' agendamento--atendido' : ''}`}
                  >
                    <div className="agendamento__quando">
                      <strong style={{ fontSize: '0.95rem' }}>{horaParte?.trim() || '–'}</strong>
                      <span>{dataParte}</span>
                    </div>

                    <div className="agendamento__dados">
                      <div className="agendamento__linha">
                        <h3 className="agendamento__nome">{grupo.usuario}</h3>
                        <span className="status status--agendado">
                          {grupo.eventos.length} {grupo.eventos.length === 1 ? 'interação' : 'interações'}
                        </span>
                        {grupo.orientacoes > 0 && (
                          <span className="status status--atendido">
                            {grupo.orientacoes}{' '}
                            {grupo.orientacoes === 1
                              ? 'orientação concluída'
                              : 'orientações concluídas'}
                          </span>
                        )}
                      </div>

                      <dl className="agendamento__meta">
                        <div>
                          <dt>Fluxos consultados</dt>
                          <dd>
                            {grupo.fluxos.length > 0
                              ? grupo.fluxos.join(', ')
                              : 'Apenas menu inicial'}
                          </dd>
                        </div>
                        <div>
                          <dt>Última atividade</dt>
                          <dd>{dataHora}</dd>
                        </div>
                      </dl>

                      {aberto && (
                        <div
                          style={{
                            marginTop: '14px',
                            paddingTop: '12px',
                            borderTop: '1px solid var(--borda)',
                            display: 'flex',
                            flexDirection: 'column',
                            gap: '8px',
                          }}
                        >
                          <strong style={{ fontSize: '0.82rem', color: 'var(--texto-2)' }}>
                            Passo a passo do atendimento ({grupo.eventos.length} eventos):
                          </strong>
                          <ul
                            style={{
                              listStyle: 'none',
                              margin: 0,
                              padding: 0,
                              display: 'flex',
                              flexDirection: 'column',
                              gap: '6px',
                            }}
                          >
                            {grupo.eventos.map((ev) => (
                              <li
                                key={ev.id}
                                style={{
                                  display: 'flex',
                                  flexWrap: 'wrap',
                                  alignItems: 'center',
                                  justifyContent: 'space-between',
                                  gap: '8px',
                                  padding: '8px 12px',
                                  background: 'var(--conversa)',
                                  border: '1px solid var(--borda)',
                                  borderRadius: 'var(--raio-campo)',
                                  fontSize: '0.84rem',
                                }}
                              >
                                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px', alignItems: 'center' }}>
                                  <strong>{ROTULO_EVENTO[ev.evento] ?? ev.evento}</strong>
                                  {ev.fluxoId && (
                                    <span className="status status--agendado">{ev.fluxoId}</span>
                                  )}
                                  {ev.noId && (
                                    <span style={{ color: 'var(--texto-2)' }}>Etapa: {ev.noId}</span>
                                  )}
                                  {ev.opcaoId && (
                                    <span style={{ color: 'var(--marca-forte)', fontWeight: 600 }}>
                                      Resposta: {ev.opcaoId}
                                    </span>
                                  )}
                                  {ev.encaminhamento && (
                                    <span className="status status--atendido">
                                      {ev.encaminhamento}
                                    </span>
                                  )}
                                </div>
                                <small style={{ color: 'var(--texto-3)' }}>
                                  {formatarDataHora(ev.em)}
                                </small>
                              </li>
                            ))}
                          </ul>
                        </div>
                      )}
                    </div>

                    <div className="agendamento__acoes">
                      <button
                        type="button"
                        className="botao botao--fantasma"
                        onClick={() =>
                          setUsuarioExpandido(aberto ? null : grupo.usuario)
                        }
                      >
                        {aberto ? 'Ocultar passos' : 'Ver passos'}
                      </button>
                    </div>
                  </article>
                );
              })
            )}
          </div>
        )}
      </section>
    </main>
  );
}
