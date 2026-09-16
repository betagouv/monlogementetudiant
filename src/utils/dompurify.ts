import DOMPurify from 'isomorphic-dompurify'

/**
 * Instance DOMPurify partagée par les sanitiseurs de l'application.
 *
 * Tout lien qui garde un `target` reçoit `rel="noopener noreferrer"` : sans lui, la page ouverte
 * récupère `window.opener` et peut rediriger l'onglet d'origine vers une page de phishing (reverse
 * tabnabbing). On le pose après le filtrage des attributs, pour ne pas dépendre des listes autorisées.
 */
DOMPurify.addHook('afterSanitizeAttributes', (node) => {
  if (node.hasAttribute('target')) {
    node.setAttribute('rel', 'noopener noreferrer')
  }
})

export default DOMPurify
