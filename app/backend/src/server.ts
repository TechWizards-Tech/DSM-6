import { criarAplicacao } from './app.js';
import { config } from './config.js';
import { ErroCarregamentoFluxos } from './modules/fluxos/repositorio.js';
import { ClienteCloudApi, ClienteTwilio, type ClienteWhatsApp } from './modules/whatsapp/cliente.js';
import { lerConfigWhatsApp } from './modules/whatsapp/config.js';

try {
  const configWhatsApp = lerConfigWhatsApp();

  let clienteWhatsApp: ClienteWhatsApp | undefined;
  if (configWhatsApp) {
    if (configWhatsApp.twilioAccountSid && configWhatsApp.twilioAuthToken) {
      clienteWhatsApp = new ClienteTwilio({
        accountSid: configWhatsApp.twilioAccountSid,
        authToken: configWhatsApp.twilioAuthToken,
        numeroTwilio: configWhatsApp.twilioNumero ?? 'whatsapp:+14155238886',
      });
    } else if (configWhatsApp.tokenAcesso && configWhatsApp.idNumeroTelefone) {
      clienteWhatsApp = new ClienteCloudApi({
        tokenAcesso: configWhatsApp.tokenAcesso,
        idNumeroTelefone: configWhatsApp.idNumeroTelefone,
        versaoApi: configWhatsApp.versaoApi ?? 'v21.0',
      });
    }
  }

  const { app, fluxos, autenticacao } = criarAplicacao({
    diretorioFluxos: config.diretorioFluxos,
    origensPermitidas: config.origensPermitidas,
    arquivoRegistro: config.arquivoRegistro,
    arquivoAgendamentos: config.arquivoAgendamentos,
    databaseUrl: config.databaseUrl,
    segredoToken: config.segredoToken,
    whatsapp: configWhatsApp
      ? {
          cliente: clienteWhatsApp,
          tokenVerificacao: configWhatsApp.tokenVerificacao ?? '',
          segredoApp: configWhatsApp.segredoApp,
        }
      : undefined,
  });


  if (config.adminEmail && config.adminSenha) {
    await autenticacao.garantirAdminInicial(config.adminEmail, config.adminSenha, config.adminNome);
  } else {
    console.warn('ADMIN_EMAIL/ADMIN_SENHA nao definidos: nenhum acesso inicial ao painel foi criado.');
  }

  app.listen(config.porta, () => {
    console.log(`Chatbot PROCON  |  http://localhost:${config.porta}/api/saude`);
    if (config.databaseUrl) {
      console.log('Banco de dados: PostgreSQL ativo!');
    } else {
      console.log('Banco de dados: memoria local');
    }
    if (configWhatsApp) {
      console.log('WhatsApp: ativo!');
      if (configWhatsApp.twilioAccountSid) {
        console.log('  -> Twilio Sandbox webhook: /api/whatsapp/twilio');
      }
      if (configWhatsApp.tokenAcesso) {
        console.log('  -> Meta Cloud API webhook: /api/whatsapp/webhook');
      }
    } else {
      console.log('WhatsApp: desligado (sem credenciais)');
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
