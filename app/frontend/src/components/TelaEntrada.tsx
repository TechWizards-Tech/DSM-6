import { useState, type FormEvent } from 'react';

interface Props {
  carregando: boolean;
  erro: string | null;
  aoIniciar: (usuario: string) => void;
}

/**
 * Porta de entrada do simulador.
 *
 * O numero digitado aqui faz o papel do remetente na Cloud API do WhatsApp. E o
 * que o RP01 chama de "identificacao do usuario": e por ele que a sessao e
 * criada e as conversas de pessoas diferentes ficam separadas.
 */
export function TelaEntrada({ carregando, erro, aoIniciar }: Props) {
  const [telefone, setTelefone] = useState('+55 12 99999-0000');

  function enviar(evento: FormEvent) {
    evento.preventDefault();
    const valor = telefone.trim();
    if (valor.length > 0 && !carregando) aoIniciar(valor);
  }

  return (
    <main className="entrada">
      <section className="entrada__cartao">
        <p className="entrada__selo">PROCON Jacareí-SP</p>
        <h1 className="entrada__titulo">Assistente de orientação ao consumidor</h1>
        <p className="entrada__descricao">
          Ambiente de simulação do canal de atendimento. Informe um número para identificar a
          conversa — é o mesmo papel que o telefone do WhatsApp cumpre no atendimento real.
        </p>

        <form className="entrada__form" onSubmit={enviar}>
          <label className="campo">
            <span className="campo__rotulo">Número do consumidor</span>
            <input
              className="campo__input"
              value={telefone}
              onChange={(evento) => setTelefone(evento.target.value)}
              placeholder="+55 12 99999-0000"
              autoComplete="off"
              disabled={carregando}
            />
          </label>

          <button className="botao botao--primario" type="submit" disabled={carregando}>
            {carregando ? 'Abrindo conversa…' : 'Iniciar conversa'}
          </button>
        </form>

        {erro && (
          <p className="entrada__erro" role="alert">
            {erro}
          </p>
        )}

        <p className="entrada__rodape">
          Sprint 1 · ABP 2026-2 · FATEC Jacareí — as orientações vêm dos fluxos decisórios
          fornecidos pelo PROCON e têm caráter orientativo.
        </p>
      </section>
    </main>
  );
}
