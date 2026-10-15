import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';

import App from './App';
import { PainelAdmin } from './components/painel/PainelAdmin';
import './estilos.css';

const raiz = document.getElementById('root');
if (!raiz) throw new Error('Elemento #root nao encontrado em index.html');

// Duas telas independentes nao justificam um roteador: /painel e a area interna do PROCON.
const ehPainel = window.location.pathname.replace(/\/+$/, '') === '/painel';

createRoot(raiz).render(<StrictMode>{ehPainel ? <PainelAdmin /> : <App />}</StrictMode>);
