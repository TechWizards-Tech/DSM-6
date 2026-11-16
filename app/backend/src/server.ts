import { criarAplicacao } from './app.js';
import { config } from './config.js';
import { ErroCarregamentoFluxos } from './modules/fluxos/repositorio.js';
import { ProvedorLlmDesativado, ProvedorLlmOllama } from './modules/llm/index.js';

try {
  const provedorLlm = config.ollamaUrl
    ? new ProvedorLlmOllama({ urlBase: config.ollamaUrl, modelo: config.ollamaModelo })
    : new ProvedorLlmDesativado();

  const { app, fluxos } = criarAplicacao({
    diretorioFluxos: config.diretorioFluxos,
    origensPermitidas: config.origensPermitidas,
    arquivoRegistro: config.arquivoRegistro,
    databaseUrl: config.databaseUrl,
    llm: provedorLlm,
  });

  app.listen(config.porta, () => {
    console.log(`Chatbot PROCON  |  http://localhost:${config.porta}/api/saude`);
    console.log(`Fluxos: ${fluxos.listarFluxos().length} carregados de ${config.diretorioFluxos}`);
    if (config.ollamaUrl) {
      console.log(`LLM Local (Ollama): ativo em ${config.ollamaUrl} (modelo: ${config.ollamaModelo})`);
    } else {
      console.log('LLM Local (Ollama): desligado (defina OLLAMA_URL para ativar)');
    }
  });
} catch (erro) {
  if (erro instanceof ErroCarregamentoFluxos) {
    console.error('Os fluxos do PROCON nao passaram na validacao:\n');
    for (const problema of erro.problemas) console.error(`  - ${problema}`);
    process.exit(1);
  }
  throw erro;
}
