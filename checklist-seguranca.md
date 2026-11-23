# Controles de Segurança e Proteção de Dados

**Relacionado a:** Issue #11 · RNF03 · RNF06 (Docker) · RNF08 (testes e CI/CD)
**Versão:** 1.0 · **Data:** 22/11/2026

Controles de segurança adotados como requisito do projeto. Servem de referência para implementação,
revisão de código e testes.

## 1. Segredos e configuração

- Tokens da WhatsApp Business Platform, chaves de criptografia e senhas do banco ficam **somente** em variáveis de ambiente ou Docker secrets.
- `.env` está no `.gitignore`; o repositório mantém um `.env.example` sem valores reais.
- O histórico do Git é verificado por segredos commitados (o repositório é público). Se houver, a credencial é **revogada e trocada** (apagar o commit não basta).
- Segredos diferentes para desenvolvimento e produção.
- Secret scanning e push protection do GitHub habilitados, quando disponíveis.

## 2. Transporte

- HTTPS obrigatório no painel e no webhook, com redirecionamento de HTTP.
- Certificado válido com renovação automática.
- Conexão com o banco restrita à rede interna.

## 3. Webhook do WhatsApp

- Validar a assinatura `X-Hub-Signature-256` de **toda** requisição recebida, antes de processar.
- Comparar em tempo constante (evita ataque de temporização).
- Validar o token de verificação do webhook (`hub.verify_token`).
- Limitar o tamanho do corpo e aplicar rate limit.

Exemplo (Node.js):

```js
const crypto = require('crypto');

function assinaturaValida(rawBody, headerSignature, appSecret) {
  if (!headerSignature) return false;
  const esperado = 'sha256=' +
    crypto.createHmac('sha256', appSecret).update(rawBody).digest('hex');
  const a = Buffer.from(esperado);
  const b = Buffer.from(headerSignature);
  return a.length === b.length && crypto.timingSafeEqual(a, b);
}
// Usar o corpo BRUTO (raw body), não o JSON já parseado.
```

Exemplo (Python):

```python
import hmac, hashlib

def assinatura_valida(raw_body: bytes, header_signature: str, app_secret: str) -> bool:
    if not header_signature:
        return False
    esperado = "sha256=" + hmac.new(app_secret.encode(), raw_body, hashlib.sha256).hexdigest()
    return hmac.compare_digest(esperado, header_signature)
```

## 4. Dados em repouso

- Campos sensíveis (CPF, nome, relato) criptografados com **AES-256-GCM**, com IV/nonce único por registro.
- Chave de criptografia **fora** do banco e do código, com rotação periódica.
- Telefone guardado como **HMAC** (chave secreta) quando só for necessário identificar a sessão.
- Backups criptografados e com retenção definida.
- **Anonimização e exclusão automáticas** conforme os prazos do inventário de dados (job agendado).

Exemplo de criptografia de campo (Node.js):

```js
const crypto = require('crypto');
const KEY = Buffer.from(process.env.FIELD_ENCRYPTION_KEY, 'hex'); // 32 bytes

function cifrar(texto) {
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv('aes-256-gcm', KEY, iv);
  const enc = Buffer.concat([cipher.update(texto, 'utf8'), cipher.final()]);
  const tag = cipher.getAuthTag();
  return Buffer.concat([iv, tag, enc]).toString('base64');
}

function decifrar(b64) {
  const buf = Buffer.from(b64, 'base64');
  const iv = buf.subarray(0, 12);
  const tag = buf.subarray(12, 28);
  const enc = buf.subarray(28);
  const decipher = crypto.createDecipheriv('aes-256-gcm', KEY, iv);
  decipher.setAuthTag(tag);
  return Buffer.concat([decipher.update(enc), decipher.final()]).toString('utf8');
}
```

Exemplo (Python, biblioteca `cryptography`):

```python
import os, base64
from cryptography.hazmat.primitives.ciphers.aead import AESGCM

KEY = bytes.fromhex(os.environ["FIELD_ENCRYPTION_KEY"])  # 32 bytes

def cifrar(texto: str) -> str:
    nonce = os.urandom(12)
    return base64.b64encode(nonce + AESGCM(KEY).encrypt(nonce, texto.encode(), None)).decode()

def decifrar(b64: str) -> str:
    raw = base64.b64decode(b64)
    return AESGCM(KEY).decrypt(raw[:12], raw[12:], None).decode()
```

## 5. Autenticação do painel

- Senhas com bcrypt ou argon2 (nunca MD5, SHA1 ou texto puro).
- Sessão ou token com expiração e cookies `HttpOnly`, `Secure` e `SameSite`.
- Proteção contra força bruta (rate limit e bloqueio temporário).
- Proteção CSRF nas ações do painel.
- Permissões conforme a [matriz de acesso](matriz-de-acesso.md).

## 6. Aplicação

- Consultas ao banco parametrizadas (sem concatenar strings), contra SQL injection.
- Validação e sanitização de entrada (telefone, datas, texto).
- Mensagens de erro sem detalhes internos (sem stack trace para o usuário).
- Dependências atualizadas e verificadas (`npm audit` ou `pip-audit`, Dependabot).
- Cabeçalhos de segurança no painel (CSP, X-Content-Type-Options etc.).

## 7. Logs

- **Nunca** registrar CPF, tokens, senhas ou o conteúdo completo das mensagens.
- Telefone mascarado ou em hash nos logs (ex.: `+55 12 9****-1234`).
- Logs de auditoria separados dos logs técnicos, com retenção de 6 meses.
- Acesso aos logs restrito ao perfil Admin.

## 8. LLM local

- O modelo roda em infraestrutura própria e **não** chama APIs externas com dados dos cidadãos.
- O prompt contém apenas o necessário (sem CPF e sem identificadores).
- Prompts e respostas não são registrados com dados identificáveis (ou são registrados anonimizados).
- Toda resposta vem acompanhada do aviso de caráter orientativo e de uso de IA (RNF04, RNF05).

## 9. Docker (RNF06)

- Contêineres sem usuário root.
- Segredos via `secrets` ou variáveis de ambiente, nunca copiados para a imagem.
- Porta do banco **não** publicada no host (somente rede interna do Compose).
- Imagens base atualizadas e com versão fixada (sem `latest`).
- `.dockerignore` excluindo `.env`, `.git` e arquivos locais.

## 10. CI/CD (RNF08)

- O pipeline roda os testes, incluindo os de autorização.
- Segredos do pipeline ficam no GitHub Secrets.
- Análise de dependências e de segredos no pipeline.

## 11. Direitos do titular (art. 18)

- Rotina para localizar todos os dados de um telefone.
- Rotina para eliminar ou anonimizar esses dados mediante solicitação.
- Rotina para exportar os dados em formato legível.
- Registro de cada pedido atendido (data, tipo e responsável), com resposta em até 15 dias.

## 12. Incidentes de segurança

- Quem decide e quem comunica: controlador (PROCON/Prefeitura) e encarregado, com apoio da equipe técnica.
- Procedimento: conter o incidente, avaliar o risco, registrar e comunicar à ANPD e aos titulares quando houver risco ou dano relevante (LGPD, art. 48).
- O contato do encarregado deve ser conhecido por toda a equipe.
