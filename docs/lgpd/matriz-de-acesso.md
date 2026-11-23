# Matriz de Acesso e Controle de Permissões

**Relacionado a:** Issue #11 · RNF03 · RF08 (painel web)
**Versão:** 1.0 · **Data:** 22/11/2026
**Princípio:** menor privilégio — cada perfil acessa só o necessário para sua função (LGPD, art. 6º, VII).

## 1. Perfis

| Perfil | Descrição |
|---|---|
| **Cidadão** | Usa o chatbot pelo WhatsApp. Não acessa o painel. |
| **Funcionário PROCON** | Usa o painel para gerenciar agendamentos. |
| **Admin** | Gerencia usuários, configurações e auditoria. |
| **Sistema (bot)** | Serviço interno que grava e lê dados da conversa. Credencial própria, sem acesso ao painel. |

## 2. Matriz de permissões do painel

Legenda: ✅ permitido · ❌ negado · 🔒 permitido com restrição e registro em auditoria

| Ação | Funcionário | Admin |
|---|---|---|
| Fazer login | ✅ | ✅ |
| Listar agendamentos | ✅ | ✅ |
| Ver detalhes do agendamento (nome, data, motivo) | ✅ | ✅ |
| Ver resumo do caso vinculado ao agendamento | ✅ | ✅ |
| Ver CPF completo | 🔒 (mascarado por padrão; revelar registra log) | 🔒 |
| Criar, alterar ou cancelar agendamento | ✅ | ✅ |
| Ver histórico completo de conversas | ❌ | 🔒 (com motivo e log) |
| Ver estatísticas de fluxos (sem identificação) | ✅ | ✅ |
| Exportar dados | ❌ | 🔒 (log) |
| Atender pedido de titular (acessar, corrigir, eliminar) | ❌ | 🔒 (log) |
| Criar, desativar e alterar perfil de usuários | ❌ | ✅ |
| Ver logs de auditoria | ❌ | ✅ |

## 3. Regras de implementação

- Autorização no **backend**, em toda rota e endpoint. Esconder botão no front não basta.
- Negar por padrão: rota sem regra explícita de permissão é bloqueada.
- Sessão ou token com **expiração de 30 minutos de inatividade** e logout funcional.
- Senhas com **bcrypt ou argon2**, política mínima de senha e bloqueio temporário após tentativas falhas.
- CPF mascarado na listagem (ex.: `***.456.789-**`).
- **Trilha de auditoria** com quem, o quê, quando, qual registro e IP, para:
  - login, logout e tentativas falhas;
  - visualização de CPF completo;
  - acesso ao histórico de conversas;
  - exportação, alteração e exclusão de dados pessoais.
- Conta própria para cada funcionário (sem contas compartilhadas).
- Desativação imediata do acesso quando o funcionário deixar a função.
- Revisão dos acessos a cada 6 meses.
- O bot usa credencial separada, com acesso apenas às tabelas de que precisa.

## 4. Testes de autorização (incluir nos testes automatizados — RNF08)

| Teste | Resultado esperado |
|---|---|
| Acessar rota do painel sem login | 401 |
| Funcionário acessa rota de admin (ex.: gerenciar usuários) | 403 |
| Funcionário tenta ver histórico completo de conversas | 403 |
| Usuário altera o ID na URL para ver registro sem permissão | 403 ou 404 |
| Token expirado | 401 |
| Listagem de agendamentos retorna CPF mascarado | Sim |
| Revelar CPF gera registro de auditoria | Sim |
| Muitas tentativas de login falhas | Bloqueio ou atraso |
