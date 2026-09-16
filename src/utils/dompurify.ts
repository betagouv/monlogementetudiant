import DOMPurify from 'isomorphic-dompurify'

/**
 * Instance DOMPurify partagée par les sanitiseurs de l'application : tout lien avec un `target` reçoit
 * `rel="noopener noreferrer"`, quelle que soit la liste d'attributs autorisés.
 */
DOMPurify.addHook('afterSanitizeAttributes', (node) => {
  if (node.hasAttribute('target')) {
    node.setAttribute('rel', 'noopener noreferrer')
  }
})

export default DOMPurify
