import { useState, type FormEvent } from 'react';

import { ErroApi } from '../../lib/api';
import { entrar, type UsuarioPainel } from '../../lib/painelApi';

interface Props {
  aviso: string | null;
  aoEntrar: (token: string, usuario: UsuarioPainel) => void;
}

export function TelaLoginPainel({ aviso, aoEntrar }: Props) {
  const [email, setEmail] = useState('');
  const [senha, setSenha] = useState('');
  const [carregando, setCarregando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  async function enviar(evento: FormEvent) {
    evento.preventDefault();
    setCarregando(true);
    setErro(null);
    try {
      const { token, usuario } = await entrar(email, senha);
      aoEntrar(token, usuario);
    } catch (falha) {
      setErro(falha instanceof ErroApi ? falha.message : 'Nao foi possivel entrar. Tente novamente.');
    } finally {
      setCarregando(false);
    }
  }

  const mensagem = erro ?? aviso;

  return (
    <main className="entrada">
      <div className="entrada__cartao">
        <span className="entrada__selo">PROCON Jacareí · Uso interno</span>
        <h1 className="entrada__titulo">Painel de Agendamentos</h1>
        <p className="entrada__descricao">
          Acesso restrito aos funcionários do PROCON para gerenciar os atendimentos presenciais.
        </p>

        <form className="entrada__form" onSubmit={enviar}>
          <label className="campo">
            <span className="campo__rotulo">E-mail</span>
            <input
              className="campo__input"
              type="email"
              autoComplete="username"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              autoFocus
            />
          </label>
          <label className="campo">
            <span className="campo__rotulo">Senha</span>
            <input
              className="campo__input"
              type="password"
              autoComplete="current-password"
              value={senha}
              onChange={(e) => setSenha(e.target.value)}
              required
            />
          </label>
          <button className="botao botao--primario" type="submit" disabled={carregando}>
            {carregando ? 'Entrando...' : 'Entrar'}
          </button>
        </form>

        {mensagem && (
          <p className="entrada__erro" role="alert">
            {mensagem}
          </p>
        )}
      </div>
    </main>
  );
}
