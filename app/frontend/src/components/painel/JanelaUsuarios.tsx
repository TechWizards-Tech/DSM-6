import { useCallback, useEffect, useRef, useState, type FormEvent } from 'react';

import { ErroApi } from '../../lib/api';
import {
  criarUsuario,
  listarUsuarios,
  type Papel,
  type UsuarioListado,
} from '../../lib/painelApi';

interface Props {
  token: string;
  aoFechar: () => void;
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

export function JanelaUsuarios({ token, aoFechar, aoExpirar }: Props) {
  const [usuarios, setUsuarios] = useState<UsuarioListado[]>([]);
  const [carregando, setCarregando] = useState(true);
  const [nome, setNome] = useState('');
  const [email, setEmail] = useState('');
  const [senha, setSenha] = useState('');
  const [papel, setPapel] = useState<Papel>('atendente');
  const [mostrarSenha, setMostrarSenha] = useState(false);
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const [sucesso, setSucesso] = useState<string | null>(null);
  const campoNome = useRef<HTMLInputElement>(null);
  // Ref para o efeito abaixo nao reexecutar (e roubar o foco) quando o pai renderiza de novo.
  const fecharRef = useRef(aoFechar);
  fecharRef.current = aoFechar;

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
    setCarregando(true);
    try {
      setUsuarios(await listarUsuarios(token));
    } catch (falha) {
      tratarFalha(falha);
    } finally {
      setCarregando(false);
    }
  }, [token, tratarFalha]);

  useEffect(() => {
    void carregar();
  }, [carregar]);

  useEffect(() => {
    campoNome.current?.focus();
    // Trava a rolagem da pagina enquanto a janela esta aberta.
    const overflowAnterior = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    function aoTeclar(evento: KeyboardEvent) {
      if (evento.key === 'Escape') fecharRef.current();
    }
    window.addEventListener('keydown', aoTeclar);
    return () => {
      document.body.style.overflow = overflowAnterior;
      window.removeEventListener('keydown', aoTeclar);
    };
  }, []);

  const senhaCurta = senha.length > 0 && senha.length < SENHA_MIN;
  const formularioValido =
    nome.trim().length >= 2 && email.includes('@') && senha.length >= SENHA_MIN;

  async function enviar(evento: FormEvent) {
    evento.preventDefault();
    if (!formularioValido || salvando) return;
    setSalvando(true);
    setErro(null);
    setSucesso(null);
    try {
      const criado = await criarUsuario(token, { nome: nome.trim(), email: email.trim(), senha, papel });
      setSucesso(`${criado.nome} foi cadastrado(a) como ${ROTULO_PAPEL[criado.papel].toLowerCase()}.`);
      setNome('');
      setEmail('');
      setSenha('');
      setPapel('atendente');
      setMostrarSenha(false);
      campoNome.current?.focus();
      await carregar();
    } catch (falha) {
      tratarFalha(falha);
    } finally {
      setSalvando(false);
    }
  }

  return (
    <div
      className="janela-fundo"
      onMouseDown={(evento) => {
        if (evento.target === evento.currentTarget) aoFechar();
      }}
    >
      <div className="janela" role="dialog" aria-modal="true" aria-labelledby="janela-usuarios-titulo">
        <header className="janela__cabecalho">
          <h2 id="janela-usuarios-titulo">Usuários do painel</h2>
          <button className="janela__fechar" type="button" aria-label="Fechar janela" onClick={aoFechar}>
            ×
          </button>
        </header>

        <div className="janela__corpo">
          <form className="janela__form" onSubmit={enviar} noValidate>
            <h3>Novo usuário</h3>

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
                onChange={(e) => setEmail(e.target.value)}
              />
            </label>

            <label className="campo">
              <span className="campo__rotulo">Senha inicial</span>
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
              <button className="botao botao--fantasma" type="button" onClick={aoFechar}>
                Fechar
              </button>
              <button
                className="botao botao--primario"
                type="submit"
                disabled={!formularioValido || salvando}
              >
                {salvando ? 'Salvando...' : 'Criar usuário'}
              </button>
            </div>
          </form>

          <section className="janela__lista" aria-label="Usuários cadastrados" aria-busy={carregando}>
            <h3>Cadastrados{!carregando && ` (${usuarios.length})`}</h3>
            {carregando && usuarios.length === 0 && <p className="janela__dica">Carregando...</p>}
            <ul>
              {usuarios.map((u) => (
                <li key={u.id}>
                  <div>
                    <strong>{u.nome}</strong>
                    <span>{u.email}</span>
                  </div>
                  <div className="janela__lateral">
                    <span className={`janela__selo janela__selo--${u.papel}`}>{ROTULO_PAPEL[u.papel]}</span>
                    <small>{formatarCriacao(u.criadoEm)}</small>
                  </div>
                </li>
              ))}
            </ul>
          </section>
        </div>
      </div>
    </div>
  );
}
