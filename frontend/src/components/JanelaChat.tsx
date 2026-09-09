import { useEffect, useRef, useState, type FormEvent } from 'react';

import { BolhaMensagem } from './BolhaMensagem';
import type { EstadoSessao, Mensagem } from '../lib/tipos';

interface Props {
  sessao: EstadoSessao;
  mensagens: Mensagem[];
  carregando: boolean;
  erro: string | null;
  aoEscolher: (opcaoId: string) => void;
  aoEnviarTexto: (texto: string) => void;
  aoReiniciar: () => void;
}

const ETAPAS: Record<EstadoSessao['etapa'], string> = {
  menu: 'Escolhendo o assunto',
  em_fluxo: 'Em atendimento',
  finalizada: 'Conversa finalizada',
};

export function JanelaChat({
  sessao,
  mensagens,
  carregando,
  erro,
  aoEscolher,
  aoEnviarTexto,
  aoReiniciar,
}: Props) {
  const [rascunho, setRascunho] = useState('');
  const fimDaLista = useRef<HTMLDivElement>(null);

  useEffect(() => {
    fimDaLista.current?.scrollIntoView({ behavior: 'smooth', block: 'end' });
  }, [mensagens.length, carregando]);

  const ultima = mensagens.at(-1);
  const conversaEncerrada = sessao.etapa === 'finalizada' && !ultima?.opcoes?.length;

  function enviarTexto(evento: FormEvent) {
    evento.preventDefault();
    const texto = rascunho.trim();
    if (texto.length === 0 || carregando) return;
    setRascunho('');
    aoEnviarTexto(texto);
  }

  return (
    <div className="pagina">
      <main className="chat">
        <header className="chat__cabecalho">
          <div className="chat__identidade">
            <div className="chat__avatar" aria-hidden="true">
              PJ
            </div>
            <div className="chat__info">
              <h1 className="chat__titulo">Assistente do PROCON Jacareí</h1>
              <p className="chat__estado">
                <span className={`ponto ponto--${sessao.etapa}`} aria-hidden="true" />
                {sessao.tituloFluxo ?? ETAPAS[sessao.etapa]}
                <span className="chat__separador" aria-hidden="true" />
                {sessao.usuario}
              </p>
            </div>
          </div>

          <button className="botao botao--fantasma" type="button" onClick={aoReiniciar}>
            Nova conversa
          </button>
        </header>

        {sessao.passos.length > 0 && (
          // Trilha do caminho percorrido: ajuda o time a explicar as regras do
          // fluxo na Review e o cidadao a lembrar o que ja respondeu.
          <nav className="trilha" aria-label="Caminho percorrido">
            {sessao.passos.map((passo, indice) => (
              <span className="trilha__passo" key={`${passo}-${indice}`}>
                {passo}
              </span>
            ))}
          </nav>
        )}

        <div className="chat__mensagens">
          {mensagens.map((mensagem) => (
            <BolhaMensagem
              key={mensagem.id}
              mensagem={mensagem}
              ativa={mensagem.id === ultima?.id}
              aguardando={carregando}
              aoEscolher={aoEscolher}
            />
          ))}

          {carregando && (
            <div className="linha linha--bot">
              <div className="bolha bolha--bot digitando" aria-label="Digitando">
                <span />
                <span />
                <span />
              </div>
            </div>
          )}

          <div ref={fimDaLista} />
        </div>

        <footer className="chat__rodape">
          {erro && (
            <p className="chat__erro" role="alert">
              {erro}
            </p>
          )}

          {conversaEncerrada ? (
            <button className="botao botao--primario" type="button" onClick={aoReiniciar}>
              Iniciar nova conversa
            </button>
          ) : (
            <form className="composicao" onSubmit={enviarTexto}>
              <input
                className="composicao__input"
                value={rascunho}
                onChange={(evento) => setRascunho(evento.target.value)}
                placeholder="Escreva sua resposta, o número da opção ou MENU…"
                aria-label="Mensagem"
                autoComplete="off"
                disabled={carregando}
              />
              <button
                className="composicao__enviar"
                type="submit"
                aria-label="Enviar mensagem"
                disabled={carregando || rascunho.trim().length === 0}
              >
                <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">
                  <path
                    d="M4 12h13M12 5l7 7-7 7"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2.2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                </svg>
              </button>
            </form>
          )}

          <p className="chat__dica">
            A qualquer momento digite <strong>menu</strong>, <strong>voltar</strong>,{' '}
            <strong>atendente</strong> ou <strong>sair</strong>.
          </p>
        </footer>
      </main>
    </div>
  );
}
