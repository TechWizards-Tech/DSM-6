import { existsSync } from 'node:fs';
import { resolve } from 'node:path';

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
  arquivoRegistro:
    process.env.REGISTRO_JSONL ?? resolve(process.cwd(), 'dados/interacoes.jsonl'),
  origensPermitidas: (process.env.CORS_ORIGINS ?? 'http://localhost:5173').split(','),
  databaseUrl: process.env.DATABASE_URL,
  segredoToken: process.env.JWT_SEGREDO ?? 'dev-segredo-painel-procon-trocar',
  adminEmail: process.env.ADMIN_EMAIL ?? 'admin@procon.local',
  adminSenha: process.env.ADMIN_SENHA ?? 'procon123',
  adminNome: process.env.ADMIN_NOME ?? 'Atendente PROCON',
};
