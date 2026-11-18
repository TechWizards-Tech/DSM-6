# 🚀 Manual de Instalação e Execução do Sistema — PROCON Jacareí
**Projeto**: Chatbot de Orientação ao Consumidor + Painel Administrativo (6º DSM — FATEC Jacareí)  
**Equipe**: TechWizards  

Este documento explica passo a passo como qualquer integrante da equipe (ou avaliador) pode rodar e testar o sistema completo em **outros computadores**, tanto **Localmente (Node.js)** quanto **via Docker**, na **Web** e no **WhatsApp**.

---

## 💻 1. Requisitos de Hardware e Software (RNF07)

### Software Necessário
| Software | Versão Mínima | Obrigatório? | Observação |
|---|---|---|---|
| **Node.js** | `20.x` (inclui `npm 10+`) | Sim (para rodar local) | [Baixar em nodejs.org](https://nodejs.org/) |
| **Git** | `2.x` | Sim | Para clonar e atualizar o repositório |
| **Docker Desktop** | `24.x` (com Compose v2) | Opcional | Necessário apenas se quiser subir com PostgreSQL/Nginx via containers |
| **Ollama** | Última versão | Opcional | O sistema já possui motor linguístico local embarcado; o Ollama ativa o modelo neural *Llama 3.2* |

### Hardware Recomendado
* **Execução Padrão (Simulador Web + Back-end + Painel + Motor IA Embarcado)**: Qualquer computador com **4 GB de RAM** e processador Dual-Core ou superior.
* **Execução com Modelo Neural Ollama (`llama3.2:3b`)**: Recomendado **8 GB de RAM** e **2,5 GB de espaço livre em disco** para o arquivo do modelo.

---

## ⚡ 2. MODO A: Como Rodar Localmente (Mais Rápido para a Equipe)

Neste modo você **não precisa instalar PostgreSQL nem configurar Docker**. O back-end funciona automaticamente salvando os dados localmente e com o motor de IA local já ativo.

### Passo 1 — Clonar o repositório e entrar na branch
Abra o terminal (PowerShell, CMD ou Git Bash) e rode:

```bash
git clone https://github.com/TechWizards-Tech/DSM-6.git
cd DSM-6
git checkout Dev
git pull origin Dev
```

### Passo 2 — Criar o arquivo `.env` e Iniciar o Back-end (Terminal 1)
Dentro da pasta `app/backend`, crie um arquivo chamado **`.env`** com as variáveis abaixo (incluindo as novas variáveis da **LLM**):

```env
# Configuracao da Integracao com o WhatsApp (Meta Cloud API)
PORT=3333
# Credenciais: peça para a Duda (nunca suba valores reais para o GitHub)
WHATSAPP_ACCESS_TOKEN=<token-da-meta>
WHATSAPP_PHONE_NUMBER_ID=<id-do-numero>
WHATSAPP_VERIFY_TOKEN=<token-de-verificacao>

# Twilio Sandbox para WhatsApp
TWILIO_ACCOUNT_SID=<account-sid-da-twilio>
TWILIO_AUTH_TOKEN=<auth-token-da-twilio>
TWILIO_WHATSAPP_NUMBER=whatsapp:+14155238886

# Painel Administrativo (RF08)
ADMIN_EMAIL=admin@procon.local
ADMIN_SENHA=procon123
ADMIN_NOME=Atendente PROCON
JWT_SEGREDO=dev-segredo-painel-procon-trocar

# LLM Local (RF05 / RNF05)
OLLAMA_URL=http://localhost:11434
OLLAMA_MODEL=llama3.2:3b

# Banco de dados PostgreSQL (Descomente se estiver com o container postgres do Docker rodando)
# DATABASE_URL=postgresql://procon:procon@localhost:5433/procon_chatbot
```

Agora instale os pacotes e inicie o servidor:

```bash
cd app/backend
npm install
npm run dev
```
> O servidor subirá em **`http://localhost:3333`**. Você pode conferir se está online abrindo `http://localhost:3333/api/saude` no navegador.

### Passo 3 — Iniciar o Front-end (Terminal 2)
Abra um **segundo terminal**, entre na pasta do front-end, instale os pacotes e inicie a interface:

```bash
cd app/frontend
npm install
npm run dev
```

### Passo 4 — Acessar o Sistema no Navegador
* 💬 **Chatbot de Atendimento (Visão do Cidadão)**:  
  👉 **`http://localhost:5173`**
* 🔐 **Painel Web Administrativo (Visão do Funcionário do PROCON)**:  
  👉 **`http://localhost:5173/painel`**
  * **E-mail de acesso**: `admin@procon.local`
  * **Senha**: `procon123`

---

## 🐳 3. MODO B: Como Rodar Tudo no Docker (`PostgreSQL` + `Backend` + `Frontend Nginx`)

Se você tiver o **Docker Desktop** aberto no computador, pode subir toda a infraestrutura de produção com um único comando:

1. *(Se o `npm run dev` estiver aberto em algum terminal, aperte `Ctrl + C` para liberar a porta `3333`).*
2. Na pasta raiz do projeto (`DSM-6`), execute:

```bash
docker compose up --build
```

3. Quando os containers estiverem prontos, acesse no navegador:
   * 💬 **Chatbot de Atendimento (Cidadão)**: **`http://localhost:8080`**
   * 🔐 **Painel Web Administrativo (Funcionário PROCON)**: **`http://localhost:8080/painel`**
     * **E-mail**: `admin@procon.local`
     * **Senha**: `procon123`
   * 🩺 **Healthcheck da API**: **`http://localhost:3333/api/saude`**

*(Nota: O container do PostgreSQL foi configurado na porta `5433` do host para nunca dar conflito caso você já tenha outro PostgreSQL instalado no seu Windows na porta `5432`).*

---

## 🧠 4. Como Testar a Inteligência Artificial Local (RF05 / RNF05)

O sistema funciona em **duplo estágio** para garantir que ninguém da equipe tenha erro ao rodar:
1. **Sem precisar instalar nada extra**: O `ProvedorLlmOllama` já conta com um **Motor Linguístico Local Embarcado** que identifica frases livres digitadas no menu, estrutura as orientações finais em tópicos explicativos e exibe a etiqueta roxa **`Texto apoiado por IA`** + o aviso de transparência do **RNF05**.
2. **(Opcional) Ativando o modelo neural `llama3.2:3b` via Ollama no Docker**:
   Caso queira rodar também o servidor neural do Ollama:
   ```bash
   docker run -d -v ollama:/root/.ollama -p 11434:11434 --name ollama ollama/ollama
   docker exec -it ollama ollama pull llama3.2:3b
   ```

### O que digitar no Chat para testar a IA:
1. Clique em **Iniciar conversa**.
2. Quando o menu aparecer, **não clique nos botões** — digite uma frase livre na barra de mensagens, por exemplo:
   * *"comprei uma televisão na internet ontem e quero cancelar minha compra"* -> Entra direto em **Direito de Arrependimento**.
   * *"minha geladeira veio com defeito e a loja não quer trocar"* -> Entra direto em **Garantia do Produto**.
   * *"estão descontando um empréstimo no meu INSS que não fiz"* -> Entra direto em **Desconto na Folha/INSS**.
3. Durante as perguntas do fluxo, você pode tanto clicar nos botões quanto digitar (ex.: `"já pedi"`, `"loja física"`, `"sim"`).
4. Ao chegar no cartão de **ORIENTAÇÃO**, verifique o selo roxo **`TEXTO APOIADO POR IA`** no topo do cartão e o aviso amarelo logo abaixo.

---

## 📱 5. Como Testar pelo Celular (Wi-Fi Local ou WhatsApp Real)

### Opção 1 — Pelo navegador do celular na mesma rede Wi-Fi (Sem precisar de Twilio)
1. No terminal do `app/frontend`, inicie o Vite expondo para a rede local:
   ```bash
   cd app/frontend
   npm run dev -- --host
   ```
2. O terminal mostrará um endereço **`Network: http://192.168.X.X:5173/`**.
3. Abra esse endereço no navegador do celular conectado no mesmo Wi-Fi.

---

### Opção 2 — Conectar o WhatsApp Real via QR Code (100% Gratuito — Sem Twilio e Sem Ngrok!)

Qualquer integrante da equipe pode conectar seu próprio WhatsApp (ou um número de testes) em poucos segundos usando o conector **Baileys (QR Code)** já integrado ao back-end:

#### Passo 1 — Configurar o `.env` (`app/backend/.env`)
Certifique-se de que o arquivo `app/backend/.env` possui a variável `WHATSAPP_MODO=baileys`:

```env
PORT=3333
WHATSAPP_MODO=baileys

# Painel Administrativo (RF08)
ADMIN_EMAIL=admin@procon.local
ADMIN_SENHA=procon123
ADMIN_NOME=Atendente PROCON
JWT_SEGREDO=dev-segredo-painel-procon-trocar

# LLM Local via Ollama (RF05, RNF05, RP05)
OLLAMA_URL=http://localhost:11434
OLLAMA_MODEL=llama3.2:3b
```

#### Passo 2 — Rodar o Back-end e o Front-end
No **Terminal 1 (Back-end)**:
```bash
cd app/backend
npm install
npm run dev
```

No **Terminal 2 (Front-end)**:
```bash
cd app/frontend
npm install
npm run dev
```

#### Passo 3 — Escanear o QR Code no Navegador
1. Abra no navegador: 👉 **`http://localhost:3333/api/whatsapp/qr`**
2. No seu celular, abra o **WhatsApp** -> **Aparelhos conectados** -> **Conectar um aparelho**.
3. Aponte a câmera do celular para o **QR Code** na tela até aparecer **`✅ WhatsApp Conectado!`**.
   *(Se outra pessoa do grupo for conectar o celular dela, basta clicar no botão **"Gerar novo QR Code / Trocar aparelho"** na tela).*

#### Passo 4 — Como Conversar com o Chatbot (Com Trava de Segurança!)
Para evitar que o robô responda conversas pessoais ou grupos por engano, existem duas formas de testar:
1. **Testando sozinho (no mesmo celular conectado):**
   * Abra a conversa com **você mesmo** no WhatsApp (*"Você — Mensagem para você mesmo"*).
   * Envie **`oi`** (ou uma frase livre como *"comprei na internet e me arrependi"*).
2. **Outra pessoa mandando mensagem para o número conectado:**
   * A primeira mensagem da pessoa deve conter a palavra **`procon`** (ex.: **`oi procon`**).
   * A partir daí, o chatbot atende essa pessoa normalmente (fluxos, IA e agendamento presencial) até ela digitar **`sair`**!

---

## 🗄️ 6. Como Ver se Está Salvando no Banco de Dados (PostgreSQL)

Com o Docker rodando (`docker compose up`), você pode conferir os dados salvos no banco de **3 formas**:

### Forma 1 — Pelo Painel Web (Visual)
1. Abra **`http://localhost:8080/painel`** no navegador.
2. Entre com **`admin@procon.local`** e senha **`procon123`**.
3. Clique em **"Todas as datas"**: todos os agendamentos feitos pelo WhatsApp ou pela Web aparecerão na lista lidos direto do PostgreSQL!

### Forma 2 — Pelas Rotas de Registro no Navegador (RF06)
Abra estas URLs no navegador para ver os dados vindos da tabela `interacoes`:
* **Ranking de fluxos mais usados**: `http://localhost:3333/api/registros/estatisticas`
* **Histórico completo de eventos**: `http://localhost:3333/api/registros`

### Forma 3 — Consultando as Tabelas SQL Direto no Container (Ótimo para Prints de Entrega!)
Abra um novo terminal no VS Code e rode estes comandos:

```powershell
# 1. Ver as últimas interações gravadas no banco:
docker compose exec postgres psql -U procon -d procon_chatbot -c "SELECT usuario, evento, fluxo_id, no_id, em FROM interacoes ORDER BY em DESC LIMIT 10;"

# 2. Ver todos os agendamentos presenciais salvos no banco:
docker compose exec postgres psql -U procon -d procon_chatbot -c "SELECT protocolo, nome, cpf, data, horario, status FROM agendamentos;"
```

---

## 🧪 7. Como Rodar os Testes Automatizados

Para executar a suíte de testes automatizados do back-end (Vitest) e o validador de integridade dos fluxos JSON:

```bash
# Rodar os testes do Back-end:
cd app/backend
npm test

# Validar os arquivos JSON dos fluxos do PROCON (requer Python 3):
cd ../../fluxos
python validar_fluxos.py
```

