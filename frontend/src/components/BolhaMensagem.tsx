import { PainelOpcoes } from './PainelOpcoes';
import type { Mensagem } from '../lib/tipos';

const HORA = new Intl.DateTimeFormat('pt-BR', { hour: '2-digit', minute: '2-digit' });

interface Props {
  mensagem: Mensagem;
  /** Verdadeiro apenas para a ultima mensagem: so ela aceita resposta. */
  ativa: boolean;
  aguardando: boolean;
  aoEscolher: (opcaoId: string) => void;
}

/**
 * Renderiza uma mensagem conforme o tipo devolvido pelo motor.
 *
 * A distincao visual entre orientacao, aviso e encaminhamento nao e enfeite: o
 * RNF04 exige que o carater orientativo fique explicito, e o RNF01 pede leitura
 * facil para o publico em geral. Documentos e ressalvas viram lista porque e
 * assim que o cidadao vai usar - conferindo item a item antes do atendimento.
 */
export function BolhaMensagem({ mensagem, ativa, aguardando, aoEscolher }: Props) {
  const hora = HORA.format(new Date(mensagem.criadaEm));

  // As opcoes ficam ancoradas na mensagem, como os reply buttons do WhatsApp.
  const opcoes =
    ativa && mensagem.opcoes?.length ? (
      <PainelOpcoes
        opcoes={mensagem.opcoes}
        variante={mensagem.tipo === 'menu' ? 'lista' : 'rapida'}
        desabilitado={aguardando}
        aoEscolher={aoEscolher}
      />
    ) : null;

  if (mensagem.autor === 'cidadao') {
    return (
      <div className="linha linha--cidadao">
        <div className="bolha bolha--cidadao">
          <p className="bolha__texto">{mensagem.texto}</p>
          <span className="bolha__hora">{hora}</span>
        </div>
      </div>
    );
  }

  if (mensagem.tipo === 'aviso') {
    return (
      <div className="linha linha--bot">
        <div className="aviso" role="note">
          <p>{mensagem.texto}</p>
        </div>
      </div>
    );
  }

  if (mensagem.tipo === 'orientacao') {
    return (
      <div className="linha linha--bot">
        <div className="grupo">
          <article className="bolha bolha--bot cartao">
            <header className="cartao__cabecalho">
              <span className="etiqueta etiqueta--orientacao">Orientação</span>
              {mensagem.geradoPorLlm && (
                // RNF05: identificar de forma clara o que foi gerado com apoio de LLM.
                <span className="etiqueta etiqueta--llm">Texto apoiado por IA</span>
              )}
            </header>

            <p className="bolha__texto">{mensagem.texto}</p>

            {mensagem.documentos && mensagem.documentos.length > 0 && (
              <section className="cartao__secao">
                <h3>Documentos para levar</h3>
                <ul className="lista lista--documentos">
                  {mensagem.documentos.map((documento) => (
                    <li key={documento}>{documento}</li>
                  ))}
                </ul>
              </section>
            )}

            {mensagem.ressalvas && mensagem.ressalvas.length > 0 && (
              <section className="cartao__secao">
                <h3>Fique atento</h3>
                <ul className="lista lista--ressalvas">
                  {mensagem.ressalvas.map((ressalva) => (
                    <li key={ressalva}>{ressalva}</li>
                  ))}
                </ul>
              </section>
            )}

            <span className="bolha__hora">{hora}</span>
          </article>
          {opcoes}
        </div>
      </div>
    );
  }

  if (mensagem.tipo === 'encaminhamento') {
    return (
      <div className="linha linha--bot">
        <div className="grupo">
          <article className="bolha bolha--bot cartao cartao--encaminhamento">
            <header className="cartao__cabecalho">
              <span className="etiqueta etiqueta--encaminhamento">
                {mensagem.encaminhamento?.rotulo ?? 'Próximo passo'}
              </span>
            </header>
            <p className="bolha__texto">{mensagem.texto}</p>
            <span className="bolha__hora">{hora}</span>
          </article>
          {opcoes}
        </div>
      </div>
    );
  }

  return (
    <div className="linha linha--bot">
      <div className="grupo">
        <div className="bolha bolha--bot">
          <p className="bolha__texto">{mensagem.texto}</p>
          <span className="bolha__hora">{hora}</span>
        </div>
        {opcoes}
      </div>
    </div>
  );
}
