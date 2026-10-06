import { mount } from 'svelte';
import './app.css';
import App from './App.svelte';

const app = mount(App, { target: document.getElementById('app')! });

// Option payante retirée (06/10/2026) : on efface une éventuelle clé Claude gardée par une version précédente.
try {
  localStorage.removeItem('garde-manger:cle-claude');
} catch {
  /* stockage indisponible : rien à effacer */
}

export default app;
