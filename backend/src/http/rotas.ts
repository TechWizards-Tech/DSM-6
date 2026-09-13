/**
 * Camada HTTP.
 *
 * E a unica parte que conhece Express. O motor de conversa nao sabe que existe
 * uma API: na Sprint 2, o webhook da Cloud API do WhatsApp entra como um segundo
 * adaptador ao lado deste, chamando os mesmos metodos.
 */
import { Router } from 'express';
import type { MotorConversa } from '../modules/chatbot/motor.js';
import { SessaoNaoEncontrada } from '../modules/chatbot/motor.js';
import type { RepositorioSessoes } from '../modules/chatbot/sessao.js';
import type { RepositorioFluxos } from '../modules/fluxos/repositorio.js';
import { calcularEstatisticas, type RepositorioInteracoes } from '../modules/registro/index.js';
import { mensagemParaDTO, sessaoParaDTO, type TurnoDTO } from './dto.js';
import type { RepositorioAgendamentos } from '../modules/agendamento/index.js';

interface Dependencias {
  motor: MotorConversa;
  fluxos: RepositorioFluxos;
  sessoes: RepositorioSessoes;
  interacoes: RepositorioInteracoes;
  agendamentos: RepositorioAgendamentos;
}

export function criarRotas({ motor, fluxos, sessoes, interacoes, agendamentos }: Dependencias): Router {
  const rotas = Router();

  rotas.get('/saude', (_req, res) => {
    res.json({
      status: 'ok',
      fluxosCarregados: fluxos.listarFluxos().length,
      versaoMenu: fluxos.menu.versao,
    });
  });

  /**
   * Abre uma conversa. O `usuario` cumpre o papel do numero de telefone na
   * integracao real: e a identificacao exigida pelo RP01.
   */
  rotas.post('/conversas', async (req, res, next) => {
    try {
      const usuario = String(req.body?.usuario ?? '').trim();
      if (!usuario) {
        return res.status(400).json({ erro: 'Informe o identificador do usuario (ex.: telefone).' });
      }

      const { sessao, novasMensagens } = await motor.iniciar(usuario);
      const corpo: TurnoDTO = {
        sessao: sessaoParaDTO(sessao, fluxos),
        mensagens: novasMensagens.map((mensagem) => mensagemParaDTO(mensagem, fluxos)),
      };
      res.status(201).json(corpo);
    } catch (erro) {
      next(erro);
    }
  });

  /** Recupera a conversa inteira: permite recarregar a pagina sem perder o fio. */
  rotas.get('/conversas/:id', async (req, res, next) => {
    try {
      const sessao = await sessoes.buscar(req.params.id);
      if (!sessao) return res.status(404).json({ erro: 'Conversa nao encontrada.' });

      const corpo: TurnoDTO = {
        sessao: sessaoParaDTO(sessao, fluxos),
        mensagens: sessao.mensagens.map((mensagem) => mensagemParaDTO(mensagem, fluxos)),
      };
      res.json(corpo);
    } catch (erro) {
      next(erro);
    }
  });

  /** Recebe uma escolha (`opcaoId`) ou texto livre (`texto`) e avanca o fluxo. */
  rotas.post('/conversas/:id/mensagens', async (req, res, next) => {
    try {
      const { opcaoId, texto } = req.body ?? {};
      const entrada =
        typeof opcaoId === 'string' && opcaoId.length > 0
          ? ({ tipo: 'opcao', opcaoId } as const)
          : typeof texto === 'string' && texto.trim().length > 0
            ? ({ tipo: 'texto', texto: texto.trim() } as const)
            : undefined;

      if (!entrada) {
        return res.status(400).json({ erro: 'Envie "opcaoId" ou "texto".' });
      }

      const { sessao, novasMensagens } = await motor.responder(req.params.id, entrada);
      const corpo: TurnoDTO = {
        sessao: sessaoParaDTO(sessao, fluxos),
        mensagens: novasMensagens.map((mensagem) => mensagemParaDTO(mensagem, fluxos)),
      };
      res.json(corpo);
    } catch (erro) {
      if (erro instanceof SessaoNaoEncontrada) {
        return res.status(404).json({ erro: 'Conversa nao encontrada.' });
      }
      next(erro);
    }
  });

  /** Catalogo de fluxos. Usado pelo QA e pelo painel administrativo da Sprint 3. */
  rotas.get('/fluxos', (_req, res) => {
    res.json({
      versaoMenu: fluxos.menu.versao,
      fluxos: fluxos.listarFluxos().map((fluxo) => ({
        id: fluxo.id,
        titulo: fluxo.titulo,
        categoria: fluxo.categoria,
        resumo: fluxo.resumo,
        fonte: fluxo.fonte,
        quantidadeNos: Object.keys(fluxo.nos).length,
        quantidadeOrientacoes: Object.values(fluxo.nos).filter((no) => no.tipo === 'orientacao')
          .length,
      })),
    });
  });

  // RF06: registro das interacoes e analise dos fluxos mais utilizados.
  rotas.get('/registros', async (_req, res, next) => {
    try {
      res.json({ interacoes: await interacoes.listar() });
    } catch (erro) {
      next(erro);
    }
  });

  rotas.get('/registros/estatisticas', async (_req, res, next) => {
    try {
      const estatisticas = calcularEstatisticas(await interacoes.listar());
      res.json({
        ...estatisticas,
        fluxosMaisUtilizados: estatisticas.fluxosMaisUtilizados.map((item) => ({
          ...item,
          titulo: fluxos.buscarFluxo(item.fluxoId)?.titulo ?? item.fluxoId,
        })),
      });
    } catch (erro) {
      next(erro);
    }
  });

  // RF07 / US04: Agendamento de atendimento presencial
  rotas.get('/agendamentos/horarios', async (req, res, next) => {
    try {
      const data = String(req.query.data ?? '').trim();
      if (!data) {
        return res.status(400).json({ erro: 'Informe a data no formato YYYY-MM-DD.' });
      }
      const horarios = await agendamentos.listarHorarios(data);
      res.json({ data, horarios })
    } catch (erro) {
      next(erro)
    }
  });

  rotas.post('/agendamentos', async (req, res, next) => {
    try {
      const { usuario, nome, cpf, data, horario, assunto } = req.body ?? {};

      if (!usuario || !nome || !cpf || !data || !horario || !assunto) {
        return res.status(400).json({
          erro: 'Preencha todos os campos: usuario, nome, cpf, data, horario, assunto.',
        });
      }

      const novoAgendamento = await agendamentos.criar({
        usuario: String(usuario).trim(),
        nome: String(nome).trim(),
        cpf: String(cpf).trim(),
        data: String(data).trim(),
        horario: String(horario).trim(),
        assunto: String(assunto).trim(),
      });
      res.status(201).json(novoAgendamento);
    } catch (erro: any) {
      if (erro.message?.includes('já está ocupado')) {
        return res.status(409).json({ erro: erro.message });
      }
      next(erro);
    }
  });

  rotas.get('/agendamentos', async (_req, res, next) => {
    try {
      const lista = await agendamentos.listar();
      res.json({ agendamentos: lista })
    } catch (erro) {
      next(erro)
    }
  })

  return rotas;
}
