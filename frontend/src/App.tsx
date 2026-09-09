import { useCallback, useEffect, useState } from 'react';

import { JanelaChat } from './components/JanelaChat';
import { TelaEntrada } from './components/TelaEntrada';
import { enviarOpcao, enviarTexto, iniciarConversa, recuperarConversa, ErroApi } from './lib/api';
import type { EstadoSessao, Mensagem, Turno } from './lib/tipos';

/** Guardar o id no navegador deixa recarregar a pagina sem perder a conversa. */
const CHAVE_SESSAO = 'procon.sessaoId';

export default function App() {
  const [sessao, setSessao] = useState<EstadoSessao | null>(null);
  const [mensagens, setMensagens] = useState<Mensagem[]>([]);
  const [carregando, setCarregando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  const aplicarTurno = useCallback((turno: Turno, substituir = false) => {
    setSessao(turno.sessao);
    setMensagens((anteriores) => (substituir ? turno.mensagens : [...anteriores, ...turno.mensagens]));
  }, []);

  // Retomada da sessao: o backend guarda o historico, entao um F5 nao apaga nada.
  useEffect(() => {
    const salva = localStorage.getItem(CHAVE_SESSAO);
    if (!salva) return;

    let cancelado = false;
    recuperarConversa(salva)
      .then((turno) => {
        if (!cancelado) aplicarTurno(turno, true);
      })
      .catch(() => {
        // Sessao expirada ou backend reiniciado: comeca do zero, sem alarde.
        localStorage.removeItem(CHAVE_SESSAO);
      });

    return () => {
      cancelado = true;
    };
  }, [aplicarTurno]);

  async function executar(acao: () => Promise<Turno>, substituir = false) {
    setCarregando(true);
    setErro(null);
    try {
      const turno = await acao();
      localStorage.setItem(CHAVE_SESSAO, turno.sessao.sessaoId);
      aplicarTurno(turno, substituir);
    } catch (falha) {
      setErro(falha instanceof ErroApi ? falha.message : 'Algo deu errado. Tente novamente.');
    } finally {
      setCarregando(false);
    }
  }

  function iniciar(usuario: string) {
    setMensagens([]);
    void executar(() => iniciarConversa(usuario), true);
  }

  function escolher(opcaoId: string) {
    if (!sessao) return;
    void executar(() => enviarOpcao(sessao.sessaoId, opcaoId));
  }

  function escrever(texto: string) {
    if (!sessao) return;
    void executar(() => enviarTexto(sessao.sessaoId, texto));
  }

  /** Volta a tela de entrada, o que permite ao QA testar com outro numero. */
  function reiniciar() {
    localStorage.removeItem(CHAVE_SESSAO);
    setSessao(null);
    setMensagens([]);
    setErro(null);
  }

  if (!sessao) {
    return <TelaEntrada carregando={carregando} erro={erro} aoIniciar={iniciar} />;
  }

  return (
    <JanelaChat
      sessao={sessao}
      mensagens={mensagens}
      carregando={carregando}
      erro={erro}
      aoEscolher={escolher}
      aoEnviarTexto={escrever}
      aoReiniciar={reiniciar}
    />
  );
}
