import { criarAplicacao } from './app.js';
import { config } from './config.js';
import { ErroCarregamentoFluxos } from './modules/fluxos/repositorio.js';
import { ProvedorLlmDesativado, ProvedorLlmOllama } from './modules/llm/index.js';
import { ConectorBaileys } from './modules/whatsapp/baileys.js';
import { ClienteCloudApi, ClienteTwilio, type ClienteWhatsApp } from './modules/whatsapp/cliente.js';
import { lerConfigWhatsApp } from './modules/whatsapp/config.js';

const PAUSA_ENTRE_TENTATIVAS_MS = 30_000;
const MAX_TENTATIVAS_AQUECIMENTO = 10;

/**
 * Carrega o modelo na memoria em segundo plano. No Windows o Ollama pode subir
 * depois do backend, entao tenta de novo por alguns minutos. O log diz a verdade:
 * a mensagem de "configurado" acima so mostra a variavel, nao que o Ollama responde.
 */
async function aquecerOllama(llm: ProvedorLlmOllama): Promise<void> {
  for (let tentativa = 1; tentativa <= MAX_TENTATIVAS_AQUECIMENTO; tentativa++) {
    if (await llm.aquecer()) {
      console.log(`[llm] Ollama respondeu e o modelo "${llm.modeloEmUso}" esta carregado na memoria.`);
      return;
    }
    await new Promise((resolver) => setTimeout(resolver, PAUSA_ENTRE_TENTATIVAS_MS));
  }
  console.warn(
    '[llm] Ollama nao respondeu. As orientacoes usam o motor linguistico embarcado ate ele ficar disponivel.',
  );
}

try {
  const configWhatsApp = lerConfigWhatsApp();
  const provedorLlm = config.ollamaUrl
    ? new ProvedorLlmOllama({
        urlBase: config.ollamaUrl,
        modelo: config.ollamaModelo,
        timeoutMs: config.ollamaTimeoutMs,
        timeoutExplicacaoMs: config.ollamaTimeoutExplicacaoMs,
        keepAlive: config.ollamaKeepAlive,
      })
    : new ProvedorLlmDesativado();

  let clienteWhatsApp: ClienteWhatsApp | undefined;
  let conectorBaileys: ConectorBaileys | undefined;
  if (configWhatsApp) {
    if (configWhatsApp.usarBaileys) {
      conectorBaileys = new ConectorBaileys();
      clienteWhatsApp = conectorBaileys;
    } else if (configWhatsApp.twilioAccountSid && configWhatsApp.twilioAuthToken) {
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
    llm: provedorLlm,
    whatsapp: configWhatsApp
      ? {
          cliente: clienteWhatsApp,
          conectorBaileys,
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
    console.log(`Fluxos: ${fluxos.listarFluxos().length} carregados de ${config.diretorioFluxos}`);
    if (config.databaseUrl) {
      console.log('Banco de dados: PostgreSQL ativo!');
    } else {
      console.log('Banco de dados: memoria local');
    }
    if (config.ollamaUrl) {
      console.log(`LLM Local (Ollama): configurado em ${config.ollamaUrl} (modelo: ${config.ollamaModelo})`);
      if (provedorLlm instanceof ProvedorLlmOllama) void aquecerOllama(provedorLlm);
    } else {
      console.log('LLM Local (Ollama): desligado (defina OLLAMA_URL para ativar)');
    }
    if (configWhatsApp) {
      console.log('WhatsApp: ativo!');
      if (conectorBaileys) {
        console.log(`  -> QR Code (Baileys): http://localhost:${config.porta}/api/whatsapp/qr`);
        void conectorBaileys.iniciar();
      }
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
