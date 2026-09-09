/**
 * Composicao da aplicacao.
 *
 * Este e o unico lugar onde as implementacoes concretas sao escolhidas. Trocar a
 * sessao em memoria por um banco, ou ligar uma LLM local na Sprint 2, e mudar uma
 * linha aqui - nenhum modulo precisa saber.
 */
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
import { criarRotas } from './http/rotas.js';

export interface OpcoesAplicacao {
  diretorioFluxos: string;
  origensPermitidas?: string[];
  arquivoRegistro?: string;
  sessoes?: RepositorioSessoes;
  interacoes?: RepositorioInteracoes;
  llm?: ProvedorLlm;
}

export interface Aplicacao {
  app: Express;
  motor: MotorConversa;
  fluxos: RepositorioFluxos;
  sessoes: RepositorioSessoes;
  interacoes: RepositorioInteracoes;
}

export function criarAplicacao(opcoes: OpcoesAplicacao): Aplicacao {
  const fluxos = new RepositorioFluxos(carregarCatalogo(opcoes.diretorioFluxos));
  const sessoes = opcoes.sessoes ?? new RepositorioSessoesMemoria();
  const interacoes =
    opcoes.interacoes ?? new RepositorioInteracoesMemoria(opcoes.arquivoRegistro || undefined);
  // RP05: nenhuma API externa de LLM. Ver `modules/llm`.
  const llm = opcoes.llm ?? new ProvedorLlmDesativado();

  const motor = new MotorConversa(fluxos, sessoes, interacoes, llm);

  const app = express();
  app.use(cors({ origin: opcoes.origensPermitidas ?? true }));
  app.use(express.json());
  app.use('/api', criarRotas({ motor, fluxos, sessoes, interacoes }));

  app.use((_req, res) => res.status(404).json({ erro: 'Rota nao encontrada.' }));

  app.use((erro: unknown, _req: Request, res: Response, _next: NextFunction) => {
    console.error('[erro]', erro);
    res.status(500).json({ erro: 'Erro interno no servidor.' });
  });

  return { app, motor, fluxos, sessoes, interacoes };
}
