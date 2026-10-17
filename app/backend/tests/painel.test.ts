import path from 'node:path';
import fileUrl from 'node:url';
import request from 'supertest';
import { beforeEach, describe, expect, it } from 'vitest';

import { criarAplicacao } from '../src/app.js';
import { gerarHashSenha, verificarSenha } from '../src/modules/auth/index.js';
import { remarcarAgendamento } from '../src/modules/agendamento/gerenciamento.js';

const __dirname = path.dirname(fileUrl.fileURLToPath(import.meta.url));
const FLUXOS_DIR = path.resolve(__dirname, '../../../fluxos');

const ADMIN = { email: 'admin@procon.local', senha: 'senha-forte-123' };
// 2099 garante datas futuras independentemente de quando o teste rodar.
const SEGUNDA = '2099-09-21';
const TERCA = '2099-09-22';
const SABADO = '2099-09-26';

function corpoAgendamento(horario = '09:00', data = SEGUNDA) {
  return {
    usuario: '+5512999990000',
    nome: 'Maria da Silva',
    cpf: '12345678900',
    data,
    horario,
    assunto: 'Dificuldade de cancelamento de contrato',
  };
}

describe('Painel Web Administrativo (RF08, US05)', () => {
  let instancia: ReturnType<typeof criarAplicacao>;
  let token: string;

  beforeEach(async () => {
    instancia = criarAplicacao({ diretorioFluxos: FLUXOS_DIR, segredoToken: 'segredo-de-teste-123456' });
    await instancia.autenticacao.garantirAdminInicial(ADMIN.email, ADMIN.senha, 'Atendente');
    const login = await request(instancia.app).post('/api/auth/login').send(ADMIN);
    token = login.body.token;
  });

  async function criarAgendamento(horario = '09:00', data = SEGUNDA) {
    const resposta = await request(instancia.app)
      .post('/api/agendamentos')
      .send(corpoAgendamento(horario, data));
    expect(resposta.status).toBe(201);
    return resposta.body as { id: string };
  }

  const autenticado = (req: request.Test) => req.set('Authorization', `Bearer ${token}`);

  describe('autenticacao', () => {
    it('armazena a senha com hash e valida corretamente', async () => {
      const hash = await gerarHashSenha('minha-senha');
      expect(hash).not.toContain('minha-senha');
      expect(await verificarSenha('minha-senha', hash)).toBe(true);
      expect(await verificarSenha('outra-senha', hash)).toBe(false);
    });

    it('faz login e devolve token e dados publicos do usuario', async () => {
      const resposta = await request(instancia.app).post('/api/auth/login').send(ADMIN);
      expect(resposta.status).toBe(200);
      expect(resposta.body.token).toEqual(expect.any(String));
      expect(resposta.body.usuario).toMatchObject({ email: ADMIN.email, nome: 'Atendente' });
      expect(resposta.body.usuario).not.toHaveProperty('senhaHash');
    });

    it('aceita e-mail com maiusculas e espacos', async () => {
      const resposta = await request(instancia.app)
        .post('/api/auth/login')
        .send({ email: '  ADMIN@Procon.Local ', senha: ADMIN.senha });
      expect(resposta.status).toBe(200);
    });

    it('recusa senha incorreta', async () => {
      const resposta = await request(instancia.app)
        .post('/api/auth/login')
        .send({ email: ADMIN.email, senha: 'errada' });
      expect(resposta.status).toBe(401);
    });

    it('recusa login sem campos', async () => {
      const resposta = await request(instancia.app).post('/api/auth/login').send({});
      expect(resposta.status).toBe(400);
    });

    it('bloqueia rotas do painel sem token, com token invalido ou adulterado', async () => {
      const semToken = await request(instancia.app).get('/api/admin/agendamentos');
      expect(semToken.status).toBe(401);

      const invalido = await request(instancia.app)
        .get('/api/admin/agendamentos')
        .set('Authorization', 'Bearer abc.def.ghi');
      expect(invalido.status).toBe(401);

      const [cabecalho, , assinatura] = token.split('.');
      const corpoFalso = Buffer.from(
        JSON.stringify({ sub: 'x', email: 'x', nome: 'x', iat: 0, exp: 9999999999 }),
      ).toString('base64url');
      const adulterado = await request(instancia.app)
        .get('/api/admin/agendamentos')
        .set('Authorization', `Bearer ${cabecalho}.${corpoFalso}.${assinatura}`);
      expect(adulterado.status).toBe(401);
    });

    it('recusa token emitido com outro segredo', async () => {
      const outra = criarAplicacao({ diretorioFluxos: FLUXOS_DIR, segredoToken: 'outro-segredo-qualquer-123' });
      const resposta = await request(outra.app)
        .get('/api/admin/eu')
        .set('Authorization', `Bearer ${token}`);
      expect(resposta.status).toBe(401);
    });

    it('identifica o usuario logado', async () => {
      const resposta = await autenticado(request(instancia.app).get('/api/admin/eu'));
      expect(resposta.status).toBe(200);
      expect(resposta.body.usuario.email).toBe(ADMIN.email);
    });

    it('nao expoe mais a listagem de agendamentos sem autenticacao', async () => {
      const resposta = await request(instancia.app).get('/api/agendamentos');
      expect(resposta.status).toBe(404);
    });
  });

  describe('listagem de agendamentos', () => {
    it('lista ordenado por data e horario, com filtros de data e status', async () => {
      await criarAgendamento('14:00', TERCA);
      const segundaTarde = await criarAgendamento('15:00');
      await criarAgendamento('08:00');
      await autenticado(
        request(instancia.app).post(`/api/admin/agendamentos/${segundaTarde.id}/cancelar`),
      );

      const todos = await autenticado(request(instancia.app).get('/api/admin/agendamentos'));
      expect(todos.status).toBe(200);
      expect(
        todos.body.agendamentos.map((a: { data: string; horario: string }) => `${a.data} ${a.horario}`),
      ).toEqual([`${SEGUNDA} 08:00`, `${SEGUNDA} 15:00`, `${TERCA} 14:00`]);

      const porData = await autenticado(
        request(instancia.app).get(`/api/admin/agendamentos?data=${TERCA}`),
      );
      expect(porData.body.agendamentos).toHaveLength(1);

      const cancelados = await autenticado(
        request(instancia.app).get('/api/admin/agendamentos?status=cancelado'),
      );
      expect(cancelados.body.agendamentos).toHaveLength(1);
      expect(cancelados.body.agendamentos[0].id).toBe(segundaTarde.id);
    });

    it('recusa status desconhecido no filtro', async () => {
      const resposta = await autenticado(
        request(instancia.app).get('/api/admin/agendamentos?status=qualquer'),
      );
      expect(resposta.status).toBe(400);
    });
  });

  describe('acoes de gerenciamento', () => {
    it('confirma o atendimento', async () => {
      const { id } = await criarAgendamento();
      const resposta = await autenticado(
        request(instancia.app).post(`/api/admin/agendamentos/${id}/confirmar`),
      );
      expect(resposta.status).toBe(200);
      expect(resposta.body.status).toBe('atendido');
    });

    it('cancela e libera o horario para outro cidadao', async () => {
      const { id } = await criarAgendamento();
      const resposta = await autenticado(
        request(instancia.app).post(`/api/admin/agendamentos/${id}/cancelar`),
      );
      expect(resposta.status).toBe(200);
      expect(resposta.body.status).toBe('cancelado');

      const horarios = await request(instancia.app).get(`/api/agendamentos/horarios?data=${SEGUNDA}`);
      expect(horarios.body.horarios).toContainEqual({ horario: '09:00', disponivel: true });
    });

    it('nao altera agendamento ja finalizado', async () => {
      const { id } = await criarAgendamento();
      await autenticado(request(instancia.app).post(`/api/admin/agendamentos/${id}/cancelar`));

      for (const acao of ['confirmar', 'cancelar']) {
        const resposta = await autenticado(
          request(instancia.app).post(`/api/admin/agendamentos/${id}/${acao}`),
        );
        expect(resposta.status).toBe(409);
      }
      const remarcar = await autenticado(
        request(instancia.app).post(`/api/admin/agendamentos/${id}/remarcar`),
      ).send({ data: TERCA, horario: '10:00' });
      expect(remarcar.status).toBe(409);
    });

    it('responde 404 para agendamento inexistente', async () => {
      const resposta = await autenticado(
        request(instancia.app).post('/api/admin/agendamentos/nao-existe/confirmar'),
      );
      expect(resposta.status).toBe(404);
    });

    it('remarca para outro dia e horario, liberando o slot antigo', async () => {
      const { id } = await criarAgendamento('09:00');
      const resposta = await autenticado(
        request(instancia.app).post(`/api/admin/agendamentos/${id}/remarcar`),
      ).send({ data: TERCA, horario: '10:00' });

      expect(resposta.status).toBe(200);
      expect(resposta.body).toMatchObject({ id, data: TERCA, horario: '10:00', status: 'agendado' });

      const antigo = await request(instancia.app).get(`/api/agendamentos/horarios?data=${SEGUNDA}`);
      expect(antigo.body.horarios).toContainEqual({ horario: '09:00', disponivel: true });
      const novo = await request(instancia.app).get(`/api/agendamentos/horarios?data=${TERCA}`);
      expect(novo.body.horarios).toContainEqual({ horario: '10:00', disponivel: false });
    });

    it('recusa remarcar para horario ja ocupado', async () => {
      const { id } = await criarAgendamento('09:00');
      await criarAgendamento('10:00');
      const resposta = await autenticado(
        request(instancia.app).post(`/api/admin/agendamentos/${id}/remarcar`),
      ).send({ data: SEGUNDA, horario: '10:00' });
      expect(resposta.status).toBe(409);
      expect(resposta.body.erro).toContain('já está ocupado');
    });

    it.each([
      [{ data: SABADO, horario: '10:00' }, 'sábados e domingos'],
      [{ data: TERCA, horario: '12:00' }, 'Horario invalido'],
      [{ data: '22/09/2099', horario: '10:00' }, 'YYYY-MM-DD'],
      [{ data: SEGUNDA, horario: '09:00' }, 'diferente do atual'],
    ])('recusa remarcacao invalida %j', async (corpo, mensagem) => {
      const { id } = await criarAgendamento('09:00');
      const resposta = await autenticado(
        request(instancia.app).post(`/api/admin/agendamentos/${id}/remarcar`),
      ).send(corpo);
      expect(resposta.status).toBe(400);
      expect(resposta.body.erro).toContain(mensagem);
    });

    it('recusa remarcar para data passada', async () => {
      const { id } = await criarAgendamento('09:00');
      await expect(
        remarcarAgendamento(instancia.agendamentos, id, '2099-09-21', '10:00', '2099-09-22'),
      ).rejects.toThrow('ja passou');
    });
  });
});
