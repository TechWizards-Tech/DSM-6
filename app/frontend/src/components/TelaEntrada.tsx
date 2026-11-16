import { useState, type FormEvent } from 'react';

interface Props {
  carregando: boolean;
  erro: string | null;
  aoIniciar: (usuario: string) => void;
}

function formatarTelefoneComDdi(valor: string): string {
  const digitos = valor.replace(/\D/g, '');
  if (digitos.length === 0) return '+55 ';

  // Se for número do Brasil (começa com 55)
  if (digitos.startsWith('55')) {
    const local = digitos.slice(2, 13); // DDD (2) + Celular (9)
    if (local.length === 0) return '+55 ';
    if (local.length <= 2) return `+55 (${local}`;
    if (local.length <= 6) return `+55 (${local.slice(0, 2)}) ${local.slice(2)}`;
    if (local.length <= 10) {
      return `+55 (${local.slice(0, 2)}) ${local.slice(2, 6)}-${local.slice(6)}`;
    }
    return `+55 (${local.slice(0, 2)}) ${local.slice(2, 7)}-${local.slice(7, 11)}`;
  }

  // Se for outro DDI internacional (ex.: +1, +351):
  // Limite da norma mundial ITU-T E.164: no máximo 15 dígitos
  const internacional = digitos.slice(0, 15);
  return `+${internacional}`;
}

/**
 * Porta de entrada do simulador.
 *
 * O numero digitado aqui faz o papel do remetente na Cloud API do WhatsApp. E o
 * que o RP01 chama de "identificacao do usuario": e por ele que a sessao e
 * criada e as conversas de pessoas diferentes ficam separadas.
 */
export function TelaEntrada({ carregando, erro, aoIniciar }: Props) {
  const [telefone, setTelefone] = useState('+55 (12) 99999-0000');
  const [erroLocal, setErroLocal] = useState<string | null>(null);

  function enviar(evento: FormEvent) {
    evento.preventDefault();
    const digitos = telefone.replace(/\D/g, '');
    if (digitos.length < 10) {
      setErroLocal('Informe um número de telefone com DDD válido (ex.: +55 (12) 99999-0000).');
      return;
    }
    setErroLocal(null);
    const valor = telefone.trim();
    if (valor.length > 0 && !carregando) aoIniciar(valor);
  }

  const mensagemErro = erroLocal ?? erro;

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
            <span className="campo__rotulo">Número do consumidor (Celular / WhatsApp)</span>
            <input
              className="campo__input"
              type="tel"
              inputMode="numeric"
              maxLength={19}
              value={telefone}
              onChange={(evento) => {
                setErroLocal(null);
                setTelefone(formatarTelefoneComDdi(evento.target.value));
              }}
              placeholder="+55 (12) 99999-0000"
              autoComplete="off"
              disabled={carregando}
            />
          </label>

          <button className="botao botao--primario" type="submit" disabled={carregando}>
            {carregando ? 'Abrindo conversa…' : 'Iniciar conversa'}
          </button>
        </form>

        {mensagemErro && (
          <p className="entrada__erro" role="alert">
            {mensagemErro}
          </p>
        )}

        <div style={{ marginTop: '16px', textAlign: 'center' }}>
          <a
            href="/painel"
            style={{
              color: '#0284c7',
              textDecoration: 'none',
              fontSize: '0.88rem',
              display: 'inline-flex',
              alignItems: 'center',
              gap: '6px',
            }}
          >
            Área do Funcionário · Painel de Agendamentos →
          </a>
        </div>

        <p className="entrada__rodape">
          Sprint 1 · ABP 2026-2 · FATEC Jacareí — as orientações vêm dos fluxos decisórios
          fornecidos pelo PROCON e têm caráter orientativo.
        </p>
      </section>
    </main>
  );
}
