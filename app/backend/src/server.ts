import { criarAplicacao } from './app.js';
import { config } from './config.js';
import { ErroCarregamentoFluxos } from './modules/fluxos/repositorio.js';
import { ClienteCloudApi } from './modules/whatsapp/cliente.js';
import { lerConfigWhatsApp } from './modules/whatsapp/config.js';

try {
  const configWhatsApp = lerConfigWhatsApp();

  const { app, fluxos } = criarAplicacao({
    diretorioFluxos: config.diretorioFluxos,
    origensPermitidas: config.origensPermitidas,
    arquivoRegistro: config.arquivoRegistro,
    databaseUrl: config.databaseUrl,
    whatsapp: configWhatsApp
      ? {
          cliente: new ClienteCloudApi(configWhatsApp),
          tokenVerificacao: configWhatsApp.tokenVerificacao,
          segredoApp: configWhatsApp.segredoApp,
        }
      : undefined,
  });

  app.listen(config.porta, () => {
    console.log(`Chatbot PROCON  |  http://localhost:${config.porta}/api/saude`);
    console.log(`Fluxos: ${fluxos.listarFluxos().length} carregados de ${config.diretorioFluxos}`);
    console.log(
      configWhatsApp
        ? `WhatsApp: webhook ativo em /api/whatsapp/webhook${configWhatsApp.segredoApp ? '' : ' (sem validacao de assinatura)'}`
        : 'WhatsApp: desligado (defina WHATSAPP_ACCESS_TOKEN, WHATSAPP_PHONE_NUMBER_ID e WHATSAPP_VERIFY_TOKEN)',
    );
  });
} catch (erro) {
  if (erro instanceof ErroCarregamentoFluxos) {
    console.error('Os fluxos do PROCON nao passaram na validacao:\n');
    for (const problema of erro.problemas) console.error(`  - ${problema}`);
    process.exit(1);
  }
  throw erro;
}
