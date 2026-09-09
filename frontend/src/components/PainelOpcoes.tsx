import type { Opcao } from '../lib/tipos';

interface Props {
  opcoes: Opcao[];
  /** `lista` para o menu de assuntos; `rapida` para as respostas de uma pergunta. */
  variante: 'lista' | 'rapida';
  desabilitado: boolean;
  aoEscolher: (opcaoId: string) => void;
}

/**
 * Opcoes de resposta, ancoradas na mensagem que as gerou.
 *
 * So a ultima mensagem mostra opcoes - e o comportamento dos reply buttons do
 * WhatsApp e evita que o cidadao role a conversa e responda uma pergunta antiga,
 * o que deixaria a sessao fora de sincronia com o servidor.
 */
export function PainelOpcoes({ opcoes, variante, desabilitado, aoEscolher }: Props) {
  return (
    <div className={`opcoes opcoes--${variante}`} role="group" aria-label="Opções de resposta">
      {opcoes.map((opcao) => (
        <button
          key={opcao.id}
          type="button"
          className="opcao"
          disabled={desabilitado}
          onClick={() => aoEscolher(opcao.id)}
        >
          <span className="opcao__rotulo">{opcao.rotulo}</span>
          {opcao.descricao && <span className="opcao__descricao">{opcao.descricao}</span>}
        </button>
      ))}
    </div>
  );
}
