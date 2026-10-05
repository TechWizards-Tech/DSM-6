-- Schema do chatbot PROCON Jacarei (DSM-6)
-- Espelha as interfaces `Interacao` (RF06) e `Agendamento` (RF07/US04)
-- que hoje vivem em memoria em src/modules/registro e src/modules/agendamento.
--
-- Uso:
--   createdb procon_chatbot
--   psql -d procon_chatbot -f backend/db/schema.sql

CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- RF06: registro das interacoes do chatbot
CREATE TABLE IF NOT EXISTS interacoes (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    sessao_id       TEXT NOT NULL,
    usuario         TEXT NOT NULL,
    evento          TEXT NOT NULL CHECK (evento IN (
        'conversa_iniciada',
        'fluxo_escolhido',
        'opcao_escolhida',
        'orientacao_entregue',
        'entrada_invalida',
        'comando_global',
        'conversa_encerrada'
    )),
    fluxo_id        TEXT,
    no_id           TEXT,
    opcao_id        TEXT,
    encaminhamento  TEXT,
    detalhe         TEXT,
    em              TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_interacoes_sessao_id ON interacoes (sessao_id);
CREATE INDEX IF NOT EXISTS idx_interacoes_fluxo_id  ON interacoes (fluxo_id) WHERE fluxo_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_interacoes_evento     ON interacoes (evento);

-- RF07/US04: agendamento presencial no PROCON Jacarei
CREATE TABLE IF NOT EXISTS agendamentos (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    protocolo       TEXT NOT NULL UNIQUE,
    usuario         TEXT NOT NULL,
    nome            TEXT NOT NULL,
    cpf             VARCHAR(11) NOT NULL,
    data            DATE NOT NULL,
    horario         TIME NOT NULL,
    assunto         TEXT NOT NULL,
    status          TEXT NOT NULL DEFAULT 'agendado' CHECK (status IN ('agendado', 'atendido', 'cancelado')),
    criado_em       TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Garante a regra de negocio ja existente no repositorio em memoria:
-- nao pode haver dois agendamentos ativos no mesmo dia/horario.
CREATE UNIQUE INDEX IF NOT EXISTS idx_agendamentos_slot_ativo
    ON agendamentos (data, horario)
    WHERE status = 'agendado';

CREATE INDEX IF NOT EXISTS idx_agendamentos_data ON agendamentos (data);
