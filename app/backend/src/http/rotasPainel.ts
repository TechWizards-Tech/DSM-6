/**
 * Rotas do Painel Web Administrativo (RF08, US05).
 *
 * `/auth/*` e publico (login); `/admin/*` exige `Authorization: Bearer <token>`.
 */
import { Router, type NextFunction, type Request, type Response } from 'express';

import {
  STATUS_AGENDAMENTO,
  type Agendamento,
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
import type { ClienteWhatsApp } from '../modules/whatsapp/cliente.js';
import { mascararTelefone } from '../modules/whatsapp/adaptador.js';

interface Dependencias {
  autenticacao: ServicoAutenticacao;
  agendamentos: RepositorioAgendamentos;
  clienteWhatsApp?: ClienteWhatsApp;
}

export function formatarDataBr(dataIso: string): string {
  const [ano, mes, dia] = dataIso.split('-');
  return dia && mes && ano ? `${dia}/${mes}/${ano}` : dataIso;
}

export function gerarTextoNotificacao(
  agendamento: Agendamento,
  acao: 'confirmado' | 'cancelado' | 'remarcado',
): string {
  const dataBr = formatarDataBr(agendamento.data);

  if (acao === 'confirmado') {
    return (
      `✅ *PROCON Jacareí — Atendimento Confirmado!*\n\n` +
      `Olá, *${agendamento.nome}*!\n` +
      `Seu atendimento presencial foi *confirmado* pela nossa equipe do PROCON.\n\n` +
      `📋 *Protocolo:* ${agendamento.protocolo}\n` +
      `🗓️ *Data:* ${dataBr} às ${agendamento.horario}\n` +
      `📍 *Local:* PROCON de Jacareí\n\n` +
      `📌 *Importante:* Compareça com 15 minutos de antecedência munido de documento oficial com foto, comprovante de residência e os documentos pertinentes ao seu caso.`
    );
  }

  if (acao === 'cancelado') {
    return (
      `⚠️ *PROCON Jacareí — Agendamento Cancelado*\n\n` +
      `Olá, *${agendamento.nome}*.\n` +
      `Informamos que o seu atendimento presencial (Protocolo: *${agendamento.protocolo}*) agendado para ${dataBr} às ${agendamento.horario} foi *cancelado*.\n\n` +
      `Caso precise de um novo agendamento ou orientação, basta responder a esta mensagem digitando *menu*.`
    );
  }

  return (
    `🔄 *PROCON Jacareí — Atendimento Remarcado*\n\n` +
    `Olá, *${agendamento.nome}*!\n` +
    `Seu atendimento presencial foi *remarcado* para um novo horário:\n\n` +
    `📋 *Protocolo:* ${agendamento.protocolo}\n` +
    `🗓️ *Nova Data:* *${dataBr} às ${agendamento.horario}*\n` +
    `📍 *Local:* PROCON de Jacareí\n\n` +
    `📌 *Importante:* Compareça com 15 minutos de antecedência munido de documento oficial com foto, comprovante de residência e os documentos pertinentes ao seu caso.`
  );
}

export async function notificarCidadaoWhatsApp(
  cliente: ClienteWhatsApp | undefined,
  agendamento: Agendamento,
  acao: 'confirmado' | 'cancelado' | 'remarcado',
): Promise<void> {
  if (!cliente || !agendamento.usuario) return;

  const digitos = agendamento.usuario.replace(/\D/g, '');
  if (digitos.length < 8) return;

  try {
    const texto = gerarTextoNotificacao(agendamento, acao);
    await cliente.enviarTexto(agendamento.usuario, texto);
    console.log(
      `[whatsapp notificação] Notificação de "${acao}" enviada com sucesso para ${mascararTelefone(agendamento.usuario)}`,
    );
  } catch (erro) {
    console.warn(
      `[whatsapp notificação] Falha ao enviar notificação de "${acao}" para ${mascararTelefone(agendamento.usuario)}:`,
      erro,
    );
  }
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

export function criarRotasPainel({
  autenticacao,
  agendamentos,
  clienteWhatsApp,
}: Dependencias): Router {
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
      const atualizado = await confirmarAtendimento(agendamentos, req.params.id);
      void notificarCidadaoWhatsApp(clienteWhatsApp, atualizado, 'confirmado');
      res.json(atualizado);
    } catch (erro) {
      tratarErroAgendamento(erro, res, next);
    }
  });

  admin.post('/agendamentos/:id/cancelar', async (req, res, next) => {
    try {
      const atualizado = await cancelarAgendamento(agendamentos, req.params.id);
      void notificarCidadaoWhatsApp(clienteWhatsApp, atualizado, 'cancelado');
      res.json(atualizado);
    } catch (erro) {
      tratarErroAgendamento(erro, res, next);
    }
  });

  admin.post('/agendamentos/:id/remarcar', async (req, res, next) => {
    try {
      const { data, horario } = req.body ?? {};
      const atualizado = await remarcarAgendamento(
        agendamentos,
        req.params.id,
        String(data ?? '').trim(),
        String(horario ?? '').trim(),
      );
      void notificarCidadaoWhatsApp(clienteWhatsApp, atualizado, 'remarcado');
      res.json(atualizado);
    } catch (erro) {
      tratarErroAgendamento(erro, res, next);
    }
  });

  rotas.use('/admin', admin);
  return rotas;
}
