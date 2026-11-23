import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';

function carregarEnvLocal(): void {
  const caminhos = ['.env', '../.env', 'app/backend/.env'];
  for (const c of caminhos) {
    const caminho = resolve(process.cwd(), c);
    if (existsSync(caminho)) {
      try {
        const conteudo = readFileSync(caminho, 'utf-8');
        for (const linha of conteudo.split('\n')) {
          const limpa = linha.trim();
          if (!limpa || limpa.startsWith('#')) continue;
          const pos = limpa.indexOf('=');
          if (pos > 0) {
            const chave = limpa.slice(0, pos).trim();
            const valor = limpa.slice(pos + 1).trim();
            if (!process.env[chave]) {
              process.env[chave] = valor;
            }
          }
        }
      } catch {}
      break;
    }
  }
}
carregarEnvLocal();

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
  arquivoAgendamentos:
    process.env.AGENDAMENTOS_JSON ?? resolve(process.cwd(), 'dados/agendamentos.json'),
  origensPermitidas: (process.env.CORS_ORIGINS ?? 'http://localhost:5173').split(','),
  databaseUrl: process.env.DATABASE_URL,
  segredoToken: process.env.JWT_SEGREDO ?? 'dev-segredo-painel-procon-trocar',
  adminEmail: process.env.ADMIN_EMAIL ?? 'admin@procon.local',
  adminSenha: process.env.ADMIN_SENHA ?? 'procon123',
  adminNome: process.env.ADMIN_NOME ?? 'Atendente PROCON',
  ollamaUrl: process.env.OLLAMA_URL ?? 'http://localhost:11434',
  ollamaModelo: process.env.OLLAMA_MODEL ?? 'llama3.2:3b',
  /** Tempo maximo das classificacoes (menu e opcoes). */
  ollamaTimeoutMs: Number(process.env.OLLAMA_TIMEOUT_MS ?? 12000),
  /** Tempo maximo da reescrita da orientacao, que gera um texto mais longo. */
  ollamaTimeoutExplicacaoMs: Number(process.env.OLLAMA_TIMEOUT_EXPLICACAO_MS ?? 30000),
  /** Quanto o Ollama mantem o modelo na memoria ("60m", "-1" = sempre). */
  ollamaKeepAlive: process.env.OLLAMA_KEEP_ALIVE ?? '60m',
};
