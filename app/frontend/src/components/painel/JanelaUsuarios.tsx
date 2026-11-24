import { useCallback, useEffect, useRef, useState, type FormEvent } from 'react';

import { ErroApi } from '../../lib/api';
import {
  atualizarUsuario,
  criarUsuario,
  excluirUsuario,
  listarUsuarios,
  type Papel,
  type UsuarioListado,
  type UsuarioPainel,
} from '../../lib/painelApi';

interface Props {
  token: string;
  usuarioLogado: UsuarioPainel;
  aoExpirar: (motivo: string) => void;
}

const SENHA_MIN = 8;

const ROTULO_PAPEL: Record<Papel, string> = {
  admin: 'Administrador',
  atendente: 'Atendente',
};

const DESCRICAO_PAPEL: Record<Papel, string> = {
  admin: 'Gerencia agendamentos e cria usuários.',
  atendente: 'Gerencia apenas os agendamentos.',
};

function formatarCriacao(iso: string): string {
  const data = new Date(iso);
  return Number.isNaN(data.getTime()) ? '' : data.toLocaleDateString('pt-BR');
}

export function JanelaUsuarios({ token, usuarioLogado, aoExpirar }: Props) {
  const ehAdmin = usuarioLogado.papel === 'admin';
  const [usuarios, setUsuarios] = useState<UsuarioListado[]>([]);
  const [carregando, setCarregando] = useState(ehAdmin);
  const [editando, setEditando] = useState<UsuarioListado | null>(
    ehAdmin
      ? null
      : {
          ...usuarioLogado,
          criadoEm: '',
        },
  );
  const [nome, setNome] = useState(ehAdmin ? '' : usuarioLogado.nome);
  const [email, setEmail] = useState(ehAdmin ? '' : usuarioLogado.email);
  const [senha, setSenha] = useState('');
  const [papel, setPapel] = useState<Papel>('atendente');
  const [mostrarSenha, setMostrarSenha] = useState(false);
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const [sucesso, setSucesso] = useState<string | null>(null);
  const campoNome = useRef<HTMLInputElement>(null);

  const tratarFalha = useCallback(
    (falha: unknown) => {
      if (falha instanceof ErroApi && falha.status === 401) {
        aoExpirar(falha.message);
        return;
      }
      setErro(falha instanceof ErroApi ? falha.message : 'Algo deu errado. Tente novamente.');
    },
    [aoExpirar],
  );

  const carregar = useCallback(async () => {
    if (!ehAdmin) return;
    setCarregando(true);
    try {
      setUsuarios(await listarUsuarios(token));
    } catch (falha) {
      tratarFalha(falha);
    } finally {
      setCarregando(false);
    }
  }, [ehAdmin, token, tratarFalha]);

  useEffect(() => {
    void carregar();
  }, [carregar]);

  function iniciarEdicao(alvo: UsuarioListado) {
    setEditando(alvo);
    setNome(alvo.nome);
    setEmail(alvo.email);
    setSenha('');
    setPapel(alvo.papel);
    setMostrarSenha(false);
    setErro(null);
    setSucesso(null);
    campoNome.current?.focus();
  }

  function cancelarEdicao() {
    setEditando(null);
    setNome('');
    setEmail('');
    setSenha('');
    setPapel('atendente');
    setMostrarSenha(false);
    setErro(null);
  }

  async function remover(alvo: UsuarioListado) {
    if (!window.confirm(`Deseja realmente excluir o usuário "${alvo.nome}" (${alvo.email})?`)) {
      return;
    }
    setErro(null);
    setSucesso(null);
    try {
      await excluirUsuario(token, alvo.id);
      if (editando?.id === alvo.id) cancelarEdicao();
      setSucesso(`Usuário ${alvo.nome} foi removido.`);
      await carregar();
    } catch (falha) {
      tratarFalha(falha);
    }
  }

  const senhaCurta = senha.length > 0 && senha.length < SENHA_MIN;
  const formularioValido = editando
    ? nome.trim().length >= 2 && (senha.length === 0 || senha.length >= SENHA_MIN)
    : nome.trim().length >= 2 && email.includes('@') && senha.length >= SENHA_MIN;

  async function enviar(evento: FormEvent) {
    evento.preventDefault();
    if (!formularioValido || salvando) return;
    setSalvando(true);
    setErro(null);
    setSucesso(null);
    try {
      if (editando) {
        const atualizado = await atualizarUsuario(token, editando.id, {
          nome: nome.trim(),
          senha: senha.length > 0 ? senha : undefined,
          papel: ehAdmin ? papel : undefined,
        });
        setSucesso(`Dados de ${atualizado.nome} atualizados com sucesso.`);
        setSenha('');
        setMostrarSenha(false);
        if (ehAdmin) {
          cancelarEdicao();
          await carregar();
        }
      } else {
        const criado = await criarUsuario(token, {
          nome: nome.trim(),
          email: email.trim(),
          senha,
          papel,
        });
        setSucesso(`${criado.nome} foi cadastrado(a) como ${ROTULO_PAPEL[criado.papel].toLowerCase()}.`);
        setNome('');
        setEmail('');
        setSenha('');
        setPapel('atendente');
        setMostrarSenha(false);
        campoNome.current?.focus();
        await carregar();
      }
    } catch (falha) {
      tratarFalha(falha);
    } finally {
      setSalvando(false);
    }
  }

  return (
    <main className="painel">
      <div className="painel__cabecalho">
        <div>
          <h1 className="painel__titulo">
            {ehAdmin ? 'Configurar usuários' : 'Configurações da minha conta'}
          </h1>
          <p className="painel__subtitulo">
            {ehAdmin
              ? 'Gerenciamento de acessos, criação, edição e exclusão de perfis do Painel'
              : 'Atualize o seu nome de exibição ou altere a sua senha de acesso'}
          </p>
        </div>
        {ehAdmin && (
          <dl className="painel__resumo" aria-label="Resumo de usuários">
            <div className="resumo resumo--agendado">
              <dt>Cadastrados</dt>
              <dd>{carregando ? '–' : usuarios.length}</dd>
            </div>
          </dl>
        )}
      </div>

      <section
        className="painel__filtros"
        style={{ display: 'block', marginTop: '24px' }}
        aria-label="Formulário de usuário"
      >
        <div
          className="janela__corpo"
          style={{
            padding: 0,
            gridTemplateColumns: ehAdmin ? undefined : 'minmax(0, 480px)',
          }}
        >
          <form className="janela__form" onSubmit={enviar} noValidate>
            <h3>
              {editando
                ? ehAdmin
                  ? `Editar usuário (${editando.email})`
                  : 'Meus dados'
                : 'Novo usuário'}
            </h3>

            <label className="campo">
              <span className="campo__rotulo">Nome</span>
              <input
                ref={campoNome}
                className="campo__input"
                type="text"
                autoComplete="off"
                maxLength={100}
                value={nome}
                onChange={(e) => setNome(e.target.value)}
              />
            </label>

            <label className="campo">
              <span className="campo__rotulo">E-mail</span>
              <input
                className="campo__input"
                type="email"
                autoComplete="off"
                maxLength={254}
                value={email}
                disabled={Boolean(editando)}
                onChange={(e) => setEmail(e.target.value)}
              />
            </label>

            <label className="campo">
              <span className="campo__rotulo">
                {editando ? 'Nova senha (deixe em branco para manter a atual)' : 'Senha inicial'}
              </span>
              <span className="janela__senha">
                <input
                  className="campo__input"
                  type={mostrarSenha ? 'text' : 'password'}
                  autoComplete="new-password"
                  maxLength={128}
                  value={senha}
                  onChange={(e) => setSenha(e.target.value)}
                  aria-describedby="janela-senha-dica"
                />
                <button
                  className="botao botao--fantasma"
                  type="button"
                  onClick={() => setMostrarSenha((v) => !v)}
                >
                  {mostrarSenha ? 'Ocultar' : 'Mostrar'}
                </button>
              </span>
              <span
                id="janela-senha-dica"
                className={`janela__dica${senhaCurta ? ' janela__dica--erro' : ''}`}
              >
                Mínimo de {SENHA_MIN} caracteres.
              </span>
            </label>

            {ehAdmin && (
              <fieldset className="janela__papeis">
                <legend className="campo__rotulo">Papel</legend>
                {(Object.keys(ROTULO_PAPEL) as Papel[]).map((opcao) => (
                  <label
                    key={opcao}
                    className={`janela__papel${papel === opcao ? ' janela__papel--ativo' : ''}`}
                  >
                    <input
                      type="radio"
                      name="papel"
                      value={opcao}
                      checked={papel === opcao}
                      onChange={() => setPapel(opcao)}
                    />
                    <span>
                      <strong>{ROTULO_PAPEL[opcao]}</strong>
                      <small>{DESCRICAO_PAPEL[opcao]}</small>
                    </span>
                  </label>
                ))}
              </fieldset>
            )}

            {erro && (
              <p className="janela__aviso janela__aviso--erro" role="alert">
                {erro}
              </p>
            )}
            {sucesso && (
              <p className="janela__aviso janela__aviso--sucesso" role="status">
                {sucesso}
              </p>
            )}

            <div className="janela__acoes">
              {ehAdmin && editando && (
                <button
                  className="botao botao--fantasma"
                  type="button"
                  onClick={cancelarEdicao}
                  disabled={salvando}
                >
                  Cancelar edição
                </button>
              )}
              <button
                className="botao botao--primario"
                type="submit"
                disabled={!formularioValido || salvando}
              >
                {salvando
                  ? 'Salvando...'
                  : editando
                    ? 'Salvar alterações'
                    : 'Criar usuário'}
              </button>
            </div>
          </form>

          {ehAdmin && (
            <section className="janela__lista" aria-label="Usuários cadastrados" aria-busy={carregando}>
              <h3>Cadastrados{!carregando && ` (${usuarios.length})`}</h3>
              {carregando && usuarios.length === 0 && <p className="janela__dica">Carregando...</p>}
              <ul>
                {usuarios.map((u) => {
                  const ehProprio = u.id === usuarioLogado.id;
                  return (
                    <li key={u.id}>
                      <div>
                        <strong>
                          {u.nome} {ehProprio ? '(você)' : ''}
                        </strong>
                        <span>{u.email}</span>
                        <div style={{ display: 'flex', gap: '8px', marginTop: '6px' }}>
                          <button
                            type="button"
                            className="botao botao--fantasma"
                            style={{ padding: '4px 10px', fontSize: '0.78rem' }}
                            onClick={() => iniciarEdicao(u)}
                          >
                            Editar
                          </button>
                          {!ehProprio && (
                            <button
                              type="button"
                              className="botao botao--perigo"
                              style={{ padding: '4px 10px', fontSize: '0.78rem' }}
                              onClick={() => remover(u)}
                            >
                              Excluir
                            </button>
                          )}
                        </div>
                      </div>
                      <div className="janela__lateral">
                        <span className={`janela__selo janela__selo--${u.papel}`}>
                          {ROTULO_PAPEL[u.papel]}
                        </span>
                        <small>{formatarCriacao(u.criadoEm)}</small>
                      </div>
                    </li>
                  );
                })}
              </ul>
            </section>
          )}
        </div>
      </section>
    </main>
  );
}
