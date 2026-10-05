import pg from 'pg';

const { Pool, types } = pg;

// O dominio trata "data" e "horario" (agendamento) como texto simples
// (YYYY-MM-DD / HH:mm). Sem isto, node-postgres devolve objetos Date para
// as colunas DATE/TIME, sujeitos a fuso horario.
types.setTypeParser(1082, (valor) => valor); // DATE
types.setTypeParser(1083, (valor) => valor); // TIME

/** Cria o pool de conexoes com o Postgres a partir de uma connection string. */
export function criarPool(databaseUrl: string): pg.Pool {
  return new Pool({ connectionString: databaseUrl });
}
