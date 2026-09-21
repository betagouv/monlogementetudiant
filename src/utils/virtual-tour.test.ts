import { describe, expect, it } from 'vitest'
import { isValidVirtualTourInput, parseVirtualTour } from './virtual-tour'

describe('parseVirtualTour', () => {
  it('accepte les liens des plateformes autorisées', () => {
    expect(parseVirtualTour('https://tour.klapty.com/5m20OJ5Iae/ ')).toEqual({ type: 'embed', src: 'https://tour.klapty.com/5m20OJ5Iae/' })
    expect(parseVirtualTour('https://my.matterport.com/show/?m=bwtYCMgopaH')).toEqual({
      type: 'embed',
      src: 'https://my.matterport.com/show/?m=bwtYCMgopaH',
    })
    expect(parseVirtualTour('https://view.ricoh360.com/143183be-a323-42ac-88e1-4de6979540bd')?.type).toBe('embed')
  })

  it("extrait le src d'un code d'intégration, même sans guillemets", () => {
    const code =
      '<iframe width="853" height="480" src=https://my.matterport.com/show/?m=LtxBdTM25YX frameborder="0" allowfullscreen allow="autoplay; fullscreen"></iframe>'
    expect(parseVirtualTour(code)).toEqual({ type: 'embed', src: 'https://my.matterport.com/show/?m=LtxBdTM25YX' })
    expect(parseVirtualTour('<iframe src="https://player.vimeo.com/video/1"></iframe>')?.src).toBe('https://player.vimeo.com/video/1')
  })

  it('convertit les pages de partage YouTube et Drive en adresse intégrable', () => {
    expect(parseVirtualTour('https://www.youtube.com/watch?v=4qXBYDIDV1A&t')?.src).toBe('https://www.youtube.com/embed/4qXBYDIDV1A')
    expect(parseVirtualTour('https://youtu.be/4qXBYDIDV1A')?.src).toBe('https://www.youtube.com/embed/4qXBYDIDV1A')
    expect(parseVirtualTour('https://drive.google.com/file/d/1OU5Vh/view?usp=sharing')?.src).toBe(
      'https://drive.google.com/file/d/1OU5Vh/preview',
    )
  })

  it('garde le premier lien quand plusieurs sont collés', () => {
    expect(parseVirtualTour('https://tour.klapty.com/uk20OJ5Iae/ https://tour.klapty.com/uk40uciGEm/')?.src).toBe(
      'https://tour.klapty.com/uk20OJ5Iae/',
    )
  })

  it('refuse les plateformes hors liste, y compris par un sous-domaine piège', () => {
    expect(parseVirtualTour('https://evil.example/login')).toBeNull()
    expect(parseVirtualTour('https://matterport.com.evil.fr/show')).toBeNull()
    expect(parseVirtualTour('https://evilmatterport.com/show')).toBeNull()
    expect(parseVirtualTour('https://sites.google.com/view/faux-dossierfacile')).toBeNull()
    expect(parseVirtualTour('<iframe src="https://evil.example/login"></iframe>')).toBeNull()
  })

  it('refuse ce qui n’est pas du https', () => {
    expect(parseVirtualTour('http://my.matterport.com/show/?m=x')).toBeNull()
    expect(parseVirtualTour('javascript:alert(1)')).toBeNull()
    expect(parseVirtualTour('<iframe src="data:text/html,<script>alert(1)</script>"></iframe>')).toBeNull()
    expect(parseVirtualTour('<iframe srcdoc="<script>alert(1)</script>"></iframe>')).toBeNull()
  })

  it('accepte un fichier vidéo en https quel que soit son hôte', () => {
    expect(parseVirtualTour('https://cdn.bailleur.fr/visite.mp4')).toEqual({ type: 'video', src: 'https://cdn.bailleur.fr/visite.mp4' })
  })

  it('ignore le texte libre', () => {
    expect(parseVirtualTour('logement pour une entrée fin mai')).toBeNull()
    expect(parseVirtualTour('   ')).toBeNull()
  })
})

describe('isValidVirtualTourInput', () => {
  it('accepte un champ vide et une saisie affichable, refuse le reste', () => {
    expect(isValidVirtualTourInput('')).toBe(true)
    expect(isValidVirtualTourInput(undefined)).toBe(true)
    expect(isValidVirtualTourInput('https://tour.klapty.com/x/')).toBe(true)
    expect(isValidVirtualTourInput('https://evil.example/login')).toBe(false)
  })
})
