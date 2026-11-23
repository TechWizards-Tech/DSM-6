import path from 'node:path';
import fileUrl from 'node:url';
import request from 'supertest';
import { beforeEach, describe, expect, it } from 'vitest';

import { criarAplicacao } from '../src/app.js';
import {
  RepositorioUsuariosAdminMemoria,
  ServicoAutenticacao,
  gerarHashSenha,
} from '../src/modules/auth/index.js';

const __dirname = path.dirname(fileUrl.fileURLToPath(import.meta.url));
const FLUXOS_DIR = path.resolve(__dirname, '../../../fluxos');

const ADMIN = { email: 'admin@procon.local', senha: 'senha-forte-123' };
const NOVO = {
  nome: 'Joana Atendente',
  email: 'joana@procon.local',
  senha: 'outra-senha-123',
  papel: 'atendente',
};

describe('Usuarios do painel e papeis', () => {
  let instancia: ReturnType<typeof criarAplicacao>;
  let tokenAdmin: string;

  beforeEach(async () => {
    instancia = criarAplicacao({ diretorioFluxos: FLUXOS_DIR, segredoToken: 'segredo-de-teste-123456' });
    await instancia.autenticacao.garantirAdminInicial(ADMIN.email, ADMIN.senha, 'Administrador');
    tokenAdmin = (await request(instancia.app).post('/api/auth/login').send(ADMIN)).body.token;
  });

  const como = (token: string, req: request.Test) => req.set('Authorization', `Bearer ${token}`);

  async function loginComo(email: string, senha: string) {
    return request(instancia.app).post('/api/auth/login').send({ email, senha });
  }

  it('o admin inicial entra com papel admin', async () => {
    const eu = await como(tokenAdmin, request(instancia.app).get('/api/admin/eu'));
    expect(eu.body.usuario.papel).toBe('admin');
  });

  it('admin cria um atendente que consegue entrar, sem expor hash de senha', async () => {
    const criado = await como(tokenAdmin, request(instancia.app).post('/api/admin/usuarios').send(NOVO));
    expect(criado.status).toBe(201);
    expect(criado.body).toMatchObject({ email: NOVO.email, nome: NOVO.nome, papel: 'atendente' });
    expect(criado.body).not.toHaveProperty('senhaHash');

    const login = await loginComo(NOVO.email, NOVO.senha);
    expect(login.status).toBe(200);
    expect(login.body.usuario.papel).toBe('atendente');
  });

  it('o papel padrao e atendente quando nao informado', async () => {
    const { papel: _papel, ...semPapel } = NOVO;
    const criado = await como(tokenAdmin, request(instancia.app).post('/api/admin/usuarios').send(semPapel));
    expect(criado.status).toBe(201);
    expect(criado.body.papel).toBe('atendente');
  });

  it('admin lista os usuarios sem hash de senha', async () => {
    await como(tokenAdmin, request(instancia.app).post('/api/admin/usuarios').send(NOVO));
    const lista = await como(tokenAdmin, request(instancia.app).get('/api/admin/usuarios'));
    expect(lista.status).toBe(200);
    expect(lista.body.usuarios.map((u: { email: string }) => u.email)).toEqual([
      ADMIN.email,
      NOVO.email,
    ]);
    for (const u of lista.body.usuarios) expect(u).not.toHaveProperty('senhaHash');
  });

  it('atendente nao lista nem cria usuarios (403), mas continua vendo agendamentos', async () => {
    await como(tokenAdmin, request(instancia.app).post('/api/admin/usuarios').send(NOVO));
    const tokenAtendente = (await loginComo(NOVO.email, NOVO.senha)).body.token;

    const lista = await como(tokenAtendente, request(instancia.app).get('/api/admin/usuarios'));
    expect(lista.status).toBe(403);

    const tentativa = await como(
      tokenAtendente,
      request(instancia.app)
        .post('/api/admin/usuarios')
        .send({ ...NOVO, email: 'outro@procon.local' }),
    );
    expect(tentativa.status).toBe(403);

    const agendamentos = await como(tokenAtendente, request(instancia.app).get('/api/admin/agendamentos'));
    expect(agendamentos.status).toBe(200);
  });

  it('exige autenticacao nas rotas de usuarios', async () => {
    expect((await request(instancia.app).get('/api/admin/usuarios')).status).toBe(401);
    expect((await request(instancia.app).post('/api/admin/usuarios').send(NOVO)).status).toBe(401);
  });

  it('recusa e-mail repetido (409), ignorando maiusculas e espacos', async () => {
    await como(tokenAdmin, request(instancia.app).post('/api/admin/usuarios').send(NOVO));
    const repetido = await como(
      tokenAdmin,
      request(instancia.app)
        .post('/api/admin/usuarios')
        .send({ ...NOVO, email: '  JOANA@Procon.Local ' }),
    );
    expect(repetido.status).toBe(409);
  });

  it.each([
    ['nome vazio', { nome: ' ' }],
    ['e-mail invalido', { email: 'sem-arroba' }],
    ['senha curta', { senha: '1234567' }],
    ['papel desconhecido', { papel: 'superusuario' }],
  ])('recusa cadastro com %s (400)', async (_descricao, alteracao) => {
    const resposta = await como(
      tokenAdmin,
      request(instancia.app)
        .post('/api/admin/usuarios')
        .send({ ...NOVO, ...alteracao }),
    );
    expect(resposta.status).toBe(400);
    expect(resposta.body.erro).toEqual(expect.any(String));
  });

  it('recusa corpo sem campos obrigatorios (400)', async () => {
    const resposta = await como(tokenAdmin, request(instancia.app).post('/api/admin/usuarios').send({}));
    expect(resposta.status).toBe(400);
  });

  it('admin consegue criar outro admin', async () => {
    const criado = await como(
      tokenAdmin,
      request(instancia.app)
        .post('/api/admin/usuarios')
        .send({ ...NOVO, papel: 'admin' }),
    );
    expect(criado.status).toBe(201);
    const tokenNovo = (await loginComo(NOVO.email, NOVO.senha)).body.token;
    const lista = await como(tokenNovo, request(instancia.app).get('/api/admin/usuarios'));
    expect(lista.status).toBe(200);
  });

  it('token antigo, sem papel, vale como atendente', async () => {
    const [cabecalho, , assinatura] = tokenAdmin.split('.');
    // Reassina um payload sem "papel", como os tokens emitidos antes desta mudanca.
    const servico = new ServicoAutenticacao(
      new RepositorioUsuariosAdminMemoria(),
      'segredo-de-teste-123456',
    );
    const emitido = servico.emitirToken({ id: 'u1', email: 'a@b.c', nome: 'A', papel: 'admin' });
    const [c, corpo, ass] = emitido.split('.');
    const semPapel = JSON.parse(Buffer.from(corpo!, 'base64url').toString('utf8'));
    delete semPapel.papel;
    const { createHmac } = await import('node:crypto');
    const novoCorpo = Buffer.from(JSON.stringify(semPapel)).toString('base64url');
    const novaAssinatura = createHmac('sha256', 'segredo-de-teste-123456')
      .update(`${c}.${novoCorpo}`)
      .digest('base64url');
    expect(servico.validarToken(`${c}.${novoCorpo}.${novaAssinatura}`)?.papel).toBe('atendente');
    expect([cabecalho, assinatura, ass]).toBeDefined();
  });

  describe('garantirAdminInicial', () => {
    it('promove a admin um usuario existente com o e-mail do admin inicial', async () => {
      const repositorio = new RepositorioUsuariosAdminMemoria();
      const servico = new ServicoAutenticacao(repositorio, 'segredo-de-teste-123456');
      await repositorio.criar({
        email: ADMIN.email,
        nome: 'Antigo',
        papel: 'atendente',
        senhaHash: await gerarHashSenha('senha-antiga-123'),
      });

      await servico.garantirAdminInicial(ADMIN.email, 'senha-nova-123', 'Novo Nome');

      const usuario = await repositorio.buscarPorEmail(ADMIN.email);
      expect(usuario?.papel).toBe('admin');
      // Senha e nome do usuario existente nao sao sobrescritos.
      expect(usuario?.nome).toBe('Antigo');
      expect(await servico.autenticar(ADMIN.email, 'senha-antiga-123')).toBeDefined();
      expect(await servico.autenticar(ADMIN.email, 'senha-nova-123')).toBeUndefined();
    });
  });
});
