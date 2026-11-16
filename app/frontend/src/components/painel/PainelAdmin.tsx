import { useEffect, useState } from 'react';

import { ErroApi } from '../../lib/api';
import { obterUsuario, type UsuarioPainel } from '../../lib/painelApi';
import { ListaAgendamentos } from './ListaAgendamentos';
import { TelaLoginPainel } from './TelaLoginPainel';

/** sessionStorage: o acesso ao painel termina quando a aba e fechada. */
const CHAVE_TOKEN = 'procon.painel.token';

function lerToken(): string | null {
  try {
    return sessionStorage.getItem(CHAVE_TOKEN);
  } catch {
    return null;
  }
}

export function PainelAdmin() {
  const [token, setToken] = useState<string | null>(lerToken);
  const [usuario, setUsuario] = useState<UsuarioPainel | null>(null);
  const [aviso, setAviso] = useState<string | null>(null);

  useEffect(() => {
    if (!token || usuario) return;
    let cancelado = false;
    obterUsuario(token)
      .then((dados) => {
        if (!cancelado) setUsuario(dados);
      })
      .catch((erro) => {
        if (!cancelado) sair(erro instanceof ErroApi && erro.status === 401 ? erro.message : null);
      });
    return () => {
      cancelado = true;
    };
  }, [token, usuario]);

  function entrar(novoToken: string, dados: UsuarioPainel) {
    try {
      sessionStorage.setItem(CHAVE_TOKEN, novoToken);
    } catch {
      // Sem storage o login vale so ate recarregar a pagina.
    }
    setAviso(null);
    setUsuario(dados);
    setToken(novoToken);
  }

  function sair(motivo: string | null = null) {
    try {
      sessionStorage.removeItem(CHAVE_TOKEN);
    } catch {
      // Nada a limpar.
    }
    setAviso(motivo);
    setUsuario(null);
    setToken(null);
  }

  if (!token) return <TelaLoginPainel aviso={aviso} aoEntrar={entrar} />;
  if (!usuario) return <div className="painel-carregando">Carregando painel...</div>;

  return (
    <ListaAgendamentos
      token={token}
      usuario={usuario}
      aoSair={() => sair()}
      aoExpirar={(motivo) => sair(motivo)}
    />
  );
}
