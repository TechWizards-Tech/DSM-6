import { existsSync } from 'node:fs';
import { resolve } from 'node:path';

/**
 * Descobre onde esta o diretorio `fluxos/` do repositorio.
 *
 * Os fluxos sao a entrega da Pessoa 3 e ficam na raiz do repo, fora do backend,
 * de proposito: o PROCON pode revisar os textos sem abrir a pasta de codigo.
 * Em producao/Docker basta apontar FLUXOS_DIR.
 */
function descobrirDiretorioFluxos(): string {
  const doAmbiente = process.env.FLUXOS_DIR;
  if (doAmbiente) return resolve(doAmbiente);

  const candidatos = ['../fluxos', './fluxos', '../../fluxos'];
  for (const candidato of candidatos) {
    const caminho = resolve(process.cwd(), candidato);
    if (existsSync(resolve(caminho, 'menu.json'))) return caminho;
  }

  throw new Error(
    'Nao encontrei o diretorio "fluxos/". Rode o backend a partir de backend/ ou defina FLUXOS_DIR.',
  );
}

export const config = {
  porta: Number(process.env.PORT ?? 3333),
  diretorioFluxos: descobrirDiretorioFluxos(),
  /**
   * Espelho dos eventos de RF06 em disco. Serve de evidencia para a Review
   * enquanto o banco de dados nao entra. Defina como vazio para desligar.
   */
  arquivoRegistro:
    process.env.REGISTRO_JSONL ?? resolve(process.cwd(), 'dados/interacoes.jsonl'),
  origensPermitidas: (process.env.CORS_ORIGINS ?? 'http://localhost:5173').split(','),
  /**
   * Connection string do Postgres (ex.: postgresql://user:senha@host:5432/db).
   * Se nao definida, os repositorios de interacoes e agendamentos caem para
   * as implementacoes em memoria (uteis em testes e na Sprint 1).
   */
  databaseUrl: process.env.DATABASE_URL,
};
