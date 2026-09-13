/**
 * Contrato HTTP entre backend e frontend.
 *
 * Esta camada existe para controlar o que sai do servidor. O caso mais
 * importante e `base_legal`: os artigos do CDC sao metadado de auditoria do
 * PROCON e nao devem chegar ao cidadao (ver `fluxos/README.md`). O motor ja nao
 * copia esse campo para a mensagem, e o DTO garante isso na fronteira.
 */
import type { RepositorioFluxos } from '../modules/fluxos/repositorio.js';
import type { Mensagem, Sessao } from '../modules/chatbot/sessao.js';

export interface OpcaoDTO {
  id: string;
  rotulo: string;
  descricao?: string;
}

export interface MensagemDTO {
  id: string;
  autor: 'bot' | 'cidadao';
  tipo: Mensagem['tipo'];
  texto: string;
  opcoes?: OpcaoDTO[];
  documentos?: string[];
  ressalvas?: string[];
  encaminhamento?: { chave: string; rotulo: string };
  /** RNF05: o frontend marca visualmente o que veio de LLM. */
  geradoPorLlm: boolean;
  criadaEm: string;
}

export interface EstadoSessaoDTO {
  sessaoId: string;
  usuario: string;
  etapa: Sessao['etapa'];
  fluxoId?: string;
  tituloFluxo?: string;
  noAtual?: string;
  podeVoltar: boolean;
  /** Caminho percorrido, exibido como trilha na interface. */
  passos: string[];
}

export interface TurnoDTO {
  sessao: EstadoSessaoDTO;
  mensagens: MensagemDTO[];
}

export function mensagemParaDTO(mensagem: Mensagem, fluxos: RepositorioFluxos): MensagemDTO {
  const dto: MensagemDTO = {
    id: mensagem.id,
    autor: mensagem.autor,
    tipo: mensagem.tipo,
    texto: mensagem.texto,
    geradoPorLlm: mensagem.geradoPorLlm,
    criadaEm: mensagem.criadaEm,
  };

  if (mensagem.opcoes?.length) dto.opcoes = mensagem.opcoes;
  if (mensagem.documentos?.length) dto.documentos = mensagem.documentos;
  if (mensagem.ressalvas?.length) dto.ressalvas = mensagem.ressalvas;
  if (mensagem.encaminhamento) {
    dto.encaminhamento = {
      chave: mensagem.encaminhamento,
      rotulo: fluxos.menu.encaminhamentos[mensagem.encaminhamento].rotulo,
    };
  }

  return dto;
}

export function sessaoParaDTO(sessao: Sessao, fluxos: RepositorioFluxos): EstadoSessaoDTO {
  return {
    sessaoId: sessao.id,
    usuario: sessao.usuario,
    etapa: sessao.etapa,
    fluxoId: sessao.fluxoId,
    tituloFluxo: sessao.fluxoId ? fluxos.buscarFluxo(sessao.fluxoId)?.titulo : undefined,
    noAtual: sessao.noAtual,
    podeVoltar: sessao.historico.length > 0,
    passos: sessao.historico.map((passo) => passo.rotulo),
  };
}
