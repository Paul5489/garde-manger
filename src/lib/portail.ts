/** Déplace un élément à la racine de la page (au-dessus de la barre d'onglets). */
export function portail(noeud: HTMLElement) {
  document.body.appendChild(noeud);
  return {
    destroy() {
      noeud.remove();
    },
  };
}
