import { criarAplicacao } from './app.js';
import { config } from './config.js';
import { ErroCarregamentoFluxos } from './modules/fluxos/repositorio.js';

try {
  const { app, fluxos, autenticacao } = criarAplicacao({
    diretorioFluxos: config.diretorioFluxos,
    origensPermitidas: config.origensPermitidas,
    arquivoRegistro: config.arquivoRegistro,
    databaseUrl: config.databaseUrl,
    segredoToken: config.segredoToken,
  });

  if (config.adminEmail && config.adminSenha) {
    await autenticacao.garantirAdminInicial(config.adminEmail, config.adminSenha, config.adminNome);
  } else {
    console.warn('ADMIN_EMAIL/ADMIN_SENHA nao definidos: nenhum acesso inicial ao painel foi criado.');
  }

  app.listen(config.porta, () => {
    console.log(`Chatbot PROCON  |  http://localhost:${config.porta}/api/saude`);
    console.log(`Fluxos: ${fluxos.listarFluxos().length} carregados de ${config.diretorioFluxos}`);
  });
} catch (erro) {
  if (erro instanceof ErroCarregamentoFluxos) {
    console.error('Os fluxos do PROCON nao passaram na validacao:\n');
    for (const problema of erro.problemas) console.error(`  - ${problema}`);
    process.exit(1);
  }
  throw erro;
}
