import path from 'node:path';
import fileUrl from 'node:url';
import request from 'supertest';
import { describe, expect, it } from 'vitest';
import { criarAplicacao } from '../src/app.js';

const __filename = fileUrl.fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const FLUXOS_DIR = path.resolve(__dirname, '../../fluxos');

describe('Módulo de Agendamento Presencial (RF07, US04)', () => {
  function instanciar() {
    return criarAplicacao({ diretorioFluxos: FLUXOS_DIR });
  }

  it('deve listar os horários padrão para uma data específica', async () => {
    const { app } = instanciar();
    const resposta = await request(app).get('/api/agendamentos/horarios?data=2026-09-20');

    expect(resposta.status).toBe(200);
    expect(resposta.body.data).toBe('2026-09-20');
    expect(resposta.body.horarios.length).toBeGreaterThan(0);
  });

  it('deve criar um novo agendamento com protocolo único', async () => {
    const { app } = instanciar();

    const corpo = {
      usuario: '+5512999990000',
      nome: 'Maria da Silva',
      cpf: '123.456.789-00',
      data: '2026-09-20',
      horario: '09:00',
      assunto: 'Dificuldade de cancelamento de contrato',
    };

    const resposta = await request(app).post('/api/agendamentos').send(corpo);

    expect(resposta.status).toBe(201);
    expect(resposta.body).toHaveProperty('protocolo');
    expect(resposta.body.status).toBe('agendado');
  });
});
