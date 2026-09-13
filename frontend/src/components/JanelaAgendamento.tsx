import React, { useState, useEffect } from 'react';
import { buscarHorarios, criarAgendamento, HorarioSlot, AgendamentoRealizado } from '../services/agendamentoService';

interface Props {
  usuario: string;
  aoFechar: () => void;
}

export const JanelaAgendamento: React.FC<Props> = ({ usuario, aoFechar }) => {
  const hoje = new Date().toISOString().slice(0, 10);
  const [data, setData] = useState(hoje);
  const [horarios, setHorarios] = useState<HorarioSlot[]>([]);
  const [horarioSelecionado, setHorarioSelecionado] = useState('');
  const [nome, setNome] = useState('');
  const [cpf, setCpf] = useState('');
  const [assunto, setAssunto] = useState('Orientação do Consumidor');
  const [carregando, setCarregando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const [agendamentoConfirmado, setAgendamentoConfirmado] = useState<AgendamentoRealizado | null>(null);

  useEffect(() => {
    let cancelado = false;
    async function carregar() {
      setCarregando(true);
      setErro(null);
      try {
        const slots = await buscarHorarios(data);
        if (!cancelado) setHorarios(slots);
      } catch (err: any) {
        if (!cancelado) setErro(err.message || 'Erro ao carregar horários.');
      } finally {
        if (!cancelado) setCarregando(false);
      }
    }
    carregar();
    return () => { cancelado = true; };
  }, [data]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!horarioSelecionado) {
      setErro('Por favor, escolha um horário disponível.');
      return;
    }

    setCarregando(true);
    setErro(null);

    try {
      const resultado = await criarAgendamento({
        usuario,
        nome,
        cpf,
        data,
        horario: horarioSelecionado,
        assunto,
      });
      setAgendamentoConfirmado(resultado);
    } catch (err: any) {
      setErro(err.message || 'Ocorreu um erro ao agendar.');
    } finally {
      setCarregando(false);
    }
  };

  if (agendamentoConfirmado) {
    return (
      <div className="entrada__cartao" style={{ textAlign: 'center', maxWidth: '520px' }}>
        <div className="entrada__selo" style={{ background: '#e0f2fe', color: '#0369a1' }}>
          ✅ Agendamento Confirmado
        </div>
        <h2 className="entrada__titulo" style={{ marginTop: '12px' }}>
          Protocolo: {agendamentoConfirmado.protocolo}
        </h2>
        <p className="entrada__descricao" style={{ marginTop: '16px', fontSize: '0.95rem' }}>
          <strong>Cidadão:</strong> {agendamentoConfirmado.nome}<br />
          <strong>Data:</strong> {agendamentoConfirmado.data} às {agendamentoConfirmado.horario}<br />
          <strong>Local:</strong> Sede do PROCON Jacareí-SP
        </p>

        <div style={{ marginTop: '20px', padding: '14px', background: '#f8fafc', borderRadius: '12px', fontSize: '0.85rem', color: '#475569', textAlign: 'left' }}>
          📌 <strong>Importante:</strong> Compareça com 10 minutos de antecedência munido de documento com foto, comprovante de residência e documentos do caso (notas fiscais, contratos, comprovantes de pagamento).
        </div>

        <button className="botao botao--primario" style={{ marginTop: '24px', width: '100%' }} onClick={aoFechar}>
          Voltar ao Chat
        </button>
      </div>
    );
  }

  return (
    <div className="entrada__cartao" style={{ maxWidth: '540px' }}>
      <div className="entrada__selo">PROCON Jacareí</div>
      <h2 className="entrada__titulo">Agendamento Presencial</h2>
      <p className="entrada__descricao">Escolha a data e o horário para atendimento na sede do PROCON.</p>

      {erro && <div className="entrada__erro">{erro}</div>}

      <form onSubmit={handleSubmit} className="entrada__form" style={{ marginTop: '20px' }}>
        <div className="campo">
          <label className="campo__rotulo">Nome Completo</label>
          <input className="campo__input" type="text" value={nome} onChange={(e) => setNome(e.target.value)} required placeholder="Ex.: Maria Oliveira" />
        </div>

        <div className="campo">
          <label className="campo__rotulo">CPF</label>
          <input className="campo__input" type="text" value={cpf} onChange={(e) => setCpf(e.target.value)} required placeholder="000.000.000-00" />
        </div>

        <div className="campo">
          <label className="campo__rotulo">Data do Atendimento</label>
          <input className="campo__input" type="date" min={hoje} value={data} onChange={(e) => { setData(e.target.value); setHorarioSelecionado(''); }} required />
        </div>

        <div className="campo">
          <label className="campo__rotulo">Horários Disponíveis</label>
          {carregando ? (
            <p style={{ fontSize: '0.85rem', color: '#64748b' }}>Carregando horários...</p>
          ) : (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '8px' }}>
              {horarios.map((slot) => (
                <button
                  key={slot.horario}
                  type="button"
                  disabled={!slot.disponivel}
                  onClick={() => setHorarioSelecionado(slot.horario)}
                  style={{
                    padding: '8px',
                    borderRadius: '8px',
                    border: horarioSelecionado === slot.horario ? '2px solid #0284c7' : '1px solid #cbd5e1',
                    background: horarioSelecionado === slot.horario ? '#e0f2fe' : slot.disponivel ? '#ffffff' : '#f1f5f9',
                    color: slot.disponivel ? '#0f172a' : '#94a3b8',
                    cursor: slot.disponivel ? 'pointer' : 'not-allowed',
                    fontWeight: horarioSelecionado === slot.horario ? 'bold' : 'normal',
                  }}
                >
                  {slot.horario}
                </button>
              ))}
            </div>
          )}
        </div>

        <div className="campo">
          <label className="campo__rotulo">Assunto / Motivo</label>
          <input className="campo__input" type="text" value={assunto} onChange={(e) => setAssunto(e.target.value)} required />
        </div>

        <div style={{ display: 'flex', gap: '12px', marginTop: '12px' }}>
          <button type="button" className="botao botao--fantasma" style={{ flex: 1 }} onClick={aoFechar}>
            Cancelar
          </button>
          <button type="submit" className="botao botao--primario" style={{ flex: 1 }} disabled={carregando || !horarioSelecionado}>
            Confirmar Agendamento
          </button>
        </div>
      </form>
    </div>
  );
};
