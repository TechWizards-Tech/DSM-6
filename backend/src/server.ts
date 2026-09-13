import { criarAplicacao } from './app.js';
import { config } from './config.js';
import { ErroCarregamentoFluxos } from './modules/fluxos/repositorio.js';

try {
  const { app, fluxos } = criarAplicacao({
    diretorioFluxos: config.diretorioFluxos,
    origensPermitidas: config.origensPermitidas,
    arquivoRegistro: config.arquivoRegistro,
    databaseUrl: config.databaseUrl,
  });

  app.listen(config.porta, () => {
    console.log(`Chatbot PROCON  |  http://localhost:${config.porta}/api/saude`);
    console.log(`Fluxos: ${fluxos.listarFluxos().length} carregados de ${config.diretorioFluxos}`);
  });
} catch (erro) {
  if (erro instanceof ErroCarregamentoFluxos) {
    // Subir com um fluxo quebrado significa travar a conversa de um cidadao no
    // meio do atendimento. Melhor nao subir.
    console.error('Os fluxos do PROCON nao passaram na validacao:\n');
    for (const problema of erro.problemas) console.error(`  - ${problema}`);
    process.exit(1);
  }
  throw erro;
}
