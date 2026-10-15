/**
 * Converte as mensagens produzidas pelo motor em texto de WhatsApp.
 *
 * No simulador web as opcoes viram botoes; no WhatsApp elas viram uma lista
 * numerada, e o cidadao responde digitando o numero. O conteudo continua sendo
 * exatamente o dos JSON do PROCON - aqui so muda a apresentacao.
 */
import type { Mensagem, OpcaoApresentada } from '../chatbot/sessao.js';

/** Limite de caracteres de uma mensagem de texto na Cloud API. */
export const LIMITE_CARACTERES = 4096;

const DICA_MENU = '_Responda com o número do assunto._';
const DICA_PERGUNTA =
  '_Responda com o número da opção. Digite *voltar* para a pergunta anterior ou *menu* para recomeçar._';

function listarOpcoes(opcoes: OpcaoApresentada[] = []): string {
  return opcoes
    .map((opcao, indice) => {
      const descricao = opcao.descricao ? ` - ${opcao.descricao}` : '';
      return `*${indice + 1}.* ${opcao.rotulo}${descricao}`;
    })
    .join('\n');
}

function listarItens(titulo: string, itens: string[] = []): string | undefined {
  if (itens.length === 0) return undefined;
  return `*${titulo}*\n${itens.map((item) => `• ${item}`).join('\n')}`;
}

export function formatarMensagem(mensagem: Mensagem): string {
  switch (mensagem.tipo) {
    case 'menu':
      return [mensagem.texto, listarOpcoes(mensagem.opcoes), DICA_MENU].join('\n\n');

    case 'pergunta':
      return [mensagem.texto, listarOpcoes(mensagem.opcoes), DICA_PERGUNTA].join('\n\n');

    case 'orientacao':
      return [
        mensagem.texto,
        listarItens('Documentos que podem ajudar:', mensagem.documentos),
        listarItens('Atenção:', mensagem.ressalvas),
      ]
        .filter((parte): parte is string => Boolean(parte))
        .join('\n\n');

    case 'aviso':
      // RNF04 e RNF05: avisos destacados; o de LLM ganha marcador proprio.
      return `${mensagem.geradoPorLlm ? '🤖' : 'ℹ️'} ${mensagem.texto}`;

    case 'encaminhamento':
      return mensagem.opcoes?.length
        ? [mensagem.texto, listarOpcoes(mensagem.opcoes)].join('\n\n')
        : mensagem.texto;

    default:
      return mensagem.texto;
  }
}

/** Quebra um texto grande em pedacos que caibam no limite, preferindo quebras de linha. */
function quebrar(texto: string, limite: number): string[] {
  const partes: string[] = [];
  let restante = texto;
  while (restante.length > limite) {
    let corte = restante.lastIndexOf('\n', limite);
    if (corte <= 0) corte = limite;
    partes.push(restante.slice(0, corte).trimEnd());
    restante = restante.slice(corte).trimStart();
  }
  if (restante) partes.push(restante);
  return partes;
}

/**
 * Formata um turno inteiro. As mensagens do bot sao agrupadas no menor numero
 * possivel de mensagens de WhatsApp (menos notificacoes e ordem garantida).
 * O eco do proprio cidadao, que o simulador exibe, e descartado.
 */
export function formatarTurno(mensagens: Mensagem[], limite = LIMITE_CARACTERES): string[] {
  const blocos = mensagens
    .filter((mensagem) => mensagem.autor === 'bot')
    .map(formatarMensagem)
    .filter((bloco) => bloco.trim().length > 0)
    .flatMap((bloco) => quebrar(bloco, limite));

  const saida: string[] = [];
  let atual = '';
  for (const bloco of blocos) {
    const candidato = atual ? `${atual}\n\n${bloco}` : bloco;
    if (candidato.length > limite && atual) {
      saida.push(atual);
      atual = bloco;
    } else {
      atual = candidato;
    }
  }
  if (atual) saida.push(atual);
  return saida;
}
