import cors from 'cors';
import express, { type Express, type NextFunction, type Request, type Response } from 'express';

import { MotorConversa } from './modules/chatbot/motor.js';
import {
  RepositorioSessoesMemoria,
  type RepositorioSessoes,
} from './modules/chatbot/sessao.js';
import { carregarCatalogo, RepositorioFluxos } from './modules/fluxos/repositorio.js';
import { ProvedorLlmDesativado, type ProvedorLlm } from './modules/llm/index.js';
import {
  RepositorioInteracoesMemoria,
  type RepositorioInteracoes,
} from './modules/registro/index.js';
import { RepositorioInteracoesPostgres } from './modules/registro/postgres.js';
import { criarRotas } from './http/rotas.js';
import {
  RepositorioAgendamentosMemoria,
  type RepositorioAgendamentos,
} from './modules/agendamento/index.js';
import { RepositorioAgendamentosPostgres } from './modules/agendamento/postgres.js';
import { criarPool } from './db/pool.js';
import {
  RepositorioUsuariosAdminMemoria,
  ServicoAutenticacao,
  type RepositorioUsuariosAdmin,
} from './modules/auth/index.js';
import { RepositorioUsuariosAdminPostgres } from './modules/auth/postgres.js';
import { criarRotasPainel } from './http/rotasPainel.js';
import { randomBytes } from 'node:crypto';

export interface OpcoesAplicacao {
  diretorioFluxos: string;
  origensPermitidas?: string[];
  arquivoRegistro?: string;
  databaseUrl?: string;
  sessoes?: RepositorioSessoes;
  interacoes?: RepositorioInteracoes;
  agendamentos?: RepositorioAgendamentos;
  usuariosAdmin?: RepositorioUsuariosAdmin;
  /** Sem segredo fixo, os tokens do painel deixam de valer quando o servidor reinicia. */
  segredoToken?: string;
  llm?: ProvedorLlm;
}

export interface Aplicacao {
  app: Express;
  motor: MotorConversa;
  fluxos: RepositorioFluxos;
  sessoes: RepositorioSessoes;
  interacoes: RepositorioInteracoes;
  agendamentos: RepositorioAgendamentos;
  autenticacao: ServicoAutenticacao;
}

export function criarAplicacao(opcoes: OpcoesAplicacao): Aplicacao {
  const fluxos = new RepositorioFluxos(carregarCatalogo(opcoes.diretorioFluxos));
  const sessoes = opcoes.sessoes ?? new RepositorioSessoesMemoria();
  const pool = opcoes.databaseUrl ? criarPool(opcoes.databaseUrl) : undefined;
  const interacoes =
    opcoes.interacoes ??
    (pool
      ? new RepositorioInteracoesPostgres(pool)
      : new RepositorioInteracoesMemoria(opcoes.arquivoRegistro || undefined));
  const llm = opcoes.llm ?? new ProvedorLlmDesativado();
  const agendamentos =
    opcoes.agendamentos ??
    (pool ? new RepositorioAgendamentosPostgres(pool) : new RepositorioAgendamentosMemoria());
  const usuariosAdmin =
    opcoes.usuariosAdmin ??
    (pool ? new RepositorioUsuariosAdminPostgres(pool) : new RepositorioUsuariosAdminMemoria());
  const autenticacao = new ServicoAutenticacao(
    usuariosAdmin,
    opcoes.segredoToken || randomBytes(32).toString('hex'),
  );

  const motor = new MotorConversa(fluxos, sessoes, interacoes, llm);

  const app = express();
  app.use(cors({ origin: opcoes.origensPermitidas ?? true }));
  app.use(express.json());
  app.use('/api', criarRotas({ motor, fluxos, sessoes, interacoes, agendamentos }));
  app.use('/api', criarRotasPainel({ autenticacao, agendamentos }));

  app.use((_req, res) => res.status(404).json({ erro: 'Rota nao encontrada.' }));

  app.use((erro: unknown, _req: Request, res: Response, _next: NextFunction) => {
    console.error('[erro]', erro);
    res.status(500).json({ erro: 'Erro interno no servidor.' });
  });

  return { app, motor, fluxos, sessoes, interacoes, agendamentos, autenticacao };
}
