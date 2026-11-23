import { useCallback, useEffect, useState } from 'react';

import { ErroApi } from '../../lib/api';
import { obterEstatisticas, type EstatisticasFluxos } from '../../lib/painelApi';

export function JanelaEstatisticas() {
  const [dados, setDados] = useState<EstatisticasFluxos | null>(null);
  const [carregando, setCarregando] = useState(true);
  const [erro, setErro] = useState<string | null>(null);

  const carregar = useCallback(async () => {
    setCarregando(true);
    setErro(null);
    try {
      setDados(await obterEstatisticas());
    } catch (falha) {
      setErro(falha instanceof ErroApi ? falha.message : 'Não foi possível carregar as estatísticas.');
    } finally {
      setCarregando(false);
    }
  }, []);

  useEffect(() => {
    void carregar();
  }, [carregar]);

  return (
    <main className="painel">
      <div className="painel__cabecalho">
        <div>
          <h1 className="painel__titulo">Estatísticas dos fluxos mais utilizados</h1>
          <p className="painel__subtitulo">
            Análise das demandas mais recorrentes dos consumidores (RF06 / US06)
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
            <dt>Entradas inválidas</dt>
            <dd>{carregando || !dados ? '–' : dados.entradasInvalidas}</dd>
          </div>
        </dl>
      </div>

      <section className="painel__filtros" aria-label="Ações de estatísticas">
        <div style={{ flex: 1 }}>
          <strong style={{ fontSize: '0.95rem', color: 'var(--texto)' }}>
            Ranking de assuntos procurados no Chatbot (Web e WhatsApp)
          </strong>
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
        <div className="painel__alerta painel__alerta--erro" role="alert">
          <span>{erro}</span>
        </div>
      )}

      <section className="painel__conteudo" aria-live="polite" aria-busy={carregando}>
        {carregando && (
          <div className="painel__vazio">
            <p>Carregando estatísticas...</p>
          </div>
        )}

        {!carregando && dados && dados.fluxosMaisUtilizados.length === 0 && (
          <div className="painel__vazio">
            <strong>Nenhum fluxo utilizado até o momento</strong>
            <p>As estatísticas aparecerão aqui conforme os cidadãos utilizarem o chatbot.</p>
          </div>
        )}

        {!carregando && dados && dados.fluxosMaisUtilizados.length > 0 && (
          <div className="agendamentos">
            {dados.fluxosMaisUtilizados.map((item, indice) => (
              <article key={item.fluxoId} className="agendamento agendamento--agendado">
                <div className="agendamento__principal">
                  <div className="agendamento__horario">
                    <span className="agendamento__hora">{indice + 1}º</span>
                    <span className="agendamento__data-curta">Ranking</span>
                  </div>
                  <div className="agendamento__pessoa">
                    <div className="agendamento__topo">
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
                    <p className="agendamento__assunto">Identificador do fluxo: {item.fluxoId}</p>
                  </div>
                </div>
              </article>
            ))}
          </div>
        )}
      </section>
    </main>
  );
}
