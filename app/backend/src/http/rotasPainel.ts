/**
 * Rotas do Painel Web Administrativo (RF08, US05).
 *
 * `/auth/*` e publico (login); `/admin/*` exige `Authorization: Bearer <token>`.
 */
import { Router, type NextFunction, type Request, type Response } from 'express';

import {
  STATUS_AGENDAMENTO,
  type RepositorioAgendamentos,
  type StatusAgendamento,
} from '../modules/agendamento/index.js';
import {
  AgendamentoNaoEncontrado,
  cancelarAgendamento,
  confirmarAtendimento,
  ErroRegraAgendamento,
  remarcarAgendamento,
} from '../modules/agendamento/gerenciamento.js';
import type { ServicoAutenticacao, UsuarioAutenticado } from '../modules/auth/index.js';

interface Dependencias {
  autenticacao: ServicoAutenticacao;
  agendamentos: RepositorioAgendamentos;
}

type RequisicaoAutenticada = Request & { usuarioAdmin?: UsuarioAutenticado };

export function exigirAutenticacao(autenticacao: ServicoAutenticacao) {
  return (req: RequisicaoAutenticada, res: Response, next: NextFunction) => {
    const [esquema, token] = (req.headers.authorization ?? '').split(' ');
    const usuario = esquema === 'Bearer' && token ? autenticacao.validarToken(token) : undefined;
    if (!usuario) {
      return res.status(401).json({ erro: 'Sessao invalida ou expirada. Faca login novamente.' });
    }
    req.usuarioAdmin = usuario;
    next();
  };
}

function tratarErroAgendamento(erro: unknown, res: Response, next: NextFunction) {
  if (erro instanceof AgendamentoNaoEncontrado) {
    return res.status(404).json({ erro: 'Agendamento nao encontrado.' });
  }
  if (erro instanceof ErroRegraAgendamento) {
    const conflito = erro.message.includes('já está ocupado') || erro.message.includes('ja esta');
    return res.status(conflito ? 409 : 400).json({ erro: erro.message });
  }
  next(erro);
}

export function criarRotasPainel({ autenticacao, agendamentos }: Dependencias): Router {
  const rotas = Router();

  rotas.post('/auth/login', async (req, res, next) => {
    try {
      const { email, senha } = req.body ?? {};
      if (typeof email !== 'string' || typeof senha !== 'string' || !email.trim() || !senha) {
        return res.status(400).json({ erro: 'Informe e-mail e senha.' });
      }
      const sessao = await autenticacao.autenticar(email, senha);
      if (!sessao) return res.status(401).json({ erro: 'E-mail ou senha incorretos.' });
      res.json(sessao);
    } catch (erro) {
      next(erro);
    }
  });

  const admin = Router();
  admin.use(exigirAutenticacao(autenticacao));

  admin.get('/eu', (req: RequisicaoAutenticada, res) => {
    res.json({ usuario: req.usuarioAdmin });
  });

  admin.get('/agendamentos', async (req, res, next) => {
    try {
      const data = typeof req.query.data === 'string' ? req.query.data.trim() : '';
      const status = typeof req.query.status === 'string' ? req.query.status.trim() : '';
      if (status && !STATUS_AGENDAMENTO.includes(status as StatusAgendamento)) {
        return res
          .status(400)
          .json({ erro: `Status invalido. Use: ${STATUS_AGENDAMENTO.join(', ')}.` });
      }
      const lista = await agendamentos.listar({
        data: data || undefined,
        status: (status || undefined) as StatusAgendamento | undefined,
      });
      res.json({ agendamentos: lista });
    } catch (erro) {
      next(erro);
    }
  });

  admin.post('/agendamentos/:id/confirmar', async (req, res, next) => {
    try {
      res.json(await confirmarAtendimento(agendamentos, req.params.id));
    } catch (erro) {
      tratarErroAgendamento(erro, res, next);
    }
  });

  admin.post('/agendamentos/:id/cancelar', async (req, res, next) => {
    try {
      res.json(await cancelarAgendamento(agendamentos, req.params.id));
    } catch (erro) {
      tratarErroAgendamento(erro, res, next);
    }
  });

  admin.post('/agendamentos/:id/remarcar', async (req, res, next) => {
    try {
      const { data, horario } = req.body ?? {};
      res.json(
        await remarcarAgendamento(
          agendamentos,
          req.params.id,
          String(data ?? '').trim(),
          String(horario ?? '').trim(),
        ),
      );
    } catch (erro) {
      tratarErroAgendamento(erro, res, next);
    }
  });

  rotas.use('/admin', admin);
  return rotas;
}
