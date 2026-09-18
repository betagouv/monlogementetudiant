'use client'

import { fr } from '@codegouvfr/react-dsfr/fr'
import type { RegisteredLinkProps } from '@codegouvfr/react-dsfr/link'
import { cx } from '@codegouvfr/react-dsfr/tools/cx'
import { generateValidHtmlId } from '@codegouvfr/react-dsfr/tools/generateValidHtmlId'
import Link from 'next/link'
import type { CSSProperties, ReactNode } from 'react'

/**
 * Reprise du MegaMenu du DSFR, avec un seul écart : la balise des intitulés de catégorie est
 * paramétrable. L'original les rend en `<h5>` en dur, ce qui fait sauter le plan de titres de h1
 * à h5 depuis l'en-tête ; des `<h2>` précéderaient le `<h1>` de la page (RGAA 9.1). Le reste est
 * identique à l'original, pour que la mise à jour du DSFR reste comparable ligne à ligne.
 */
/**
 * Balise portant l'intitulé d'une catégorie.
 *
 * `p` sort l'intitulé du plan de titres : c'est le choix par défaut ici, parce qu'une colonne de
 * méga-menu n'est pas une section de contenu mais un groupe de liens dans un `<nav>`. Les niveaux
 * de titre restent disponibles pour un usage où la catégorie structure réellement la page.
 */
export type TMegaMenuCategoryTag = 'p' | 'h2' | 'h3' | 'h4' | 'h5' | 'h6'

export type TMegaMenuCategory = {
  links: {
    text: ReactNode
    linkProps: RegisteredLinkProps
    isActive?: boolean
  }[]
} & (
  | { categoryMainLink: { text: ReactNode; linkProps: RegisteredLinkProps }; categoryMainText?: never }
  | { categoryMainText: ReactNode; categoryMainLink?: never }
)

export type TMegaMenuLeader = {
  title: ReactNode
  paragraph: ReactNode
  link?: { linkProps: RegisteredLinkProps; text: ReactNode }
}

export type TMegaMenuProps = {
  id: string
  classes?: Partial<Record<'root' | 'leader' | 'category' | 'list', string>>
  style?: CSSProperties
  leader?: TMegaMenuLeader
  categories: TMegaMenuCategory[]
  /** Balise des intitulés de catégorie. Un niveau de titre doit s'insérer sans saut dans le plan. */
  as?: TMegaMenuCategoryTag
  /** Intitulé du bouton de fermeture, à fournir traduit. */
  closeLabel: string
}

export const MegaMenu = ({ id, classes = {}, style, leader, categories, as = 'p', closeLabel }: TMegaMenuProps) => {
  const Category = as

  return (
    <div className={cx(fr.cx('fr-mega-menu'), classes.root)} style={style} tabIndex={-1} id={id}>
      <div className={fr.cx('fr-container', 'fr-container--fluid', 'fr-container-lg')}>
        <button type="button" className={fr.cx('fr-link--close', 'fr-link')} aria-controls={id}>
          {closeLabel}
        </button>
        <div className={fr.cx('fr-grid-row', 'fr-grid-row-lg--gutters')}>
          {leader !== undefined && (
            <div className={fr.cx('fr-col-12', 'fr-col-lg-8', 'fr-col-offset-lg-4--right', 'fr-mb-4v')}>
              <div className={cx(fr.cx('fr-mega-menu__leader'), classes.leader)}>
                <h4 className={fr.cx('fr-h4', 'fr-mb-2v')}>{leader.title}</h4>
                <p className={fr.cx('fr-hidden', 'fr-displayed-lg')}>{leader.paragraph}</p>
                {leader.link !== undefined && (
                  <Link
                    {...leader.link.linkProps}
                    id={leader.link.linkProps.id ?? `${id}-leader-link${generateValidHtmlId({ text: leader.link.text })}`}
                    className={cx(
                      fr.cx('fr-link', 'fr-icon-arrow-right-line', 'fr-link--icon-right'),
                      'fr-link--align-on-content',
                      leader.link.linkProps.className,
                    )}
                  >
                    {leader.link.text}
                  </Link>
                )}
              </div>
            </div>
          )}
          {categories.map(({ categoryMainLink, categoryMainText, links }, categoryIndex) => (
            <div className={fr.cx('fr-col-12', 'fr-col-lg-3')} key={categoryIndex}>
              {categoryMainLink !== undefined && (
                <Category className={cx(fr.cx('fr-mega-menu__category'), classes.category)}>
                  <Link
                    {...categoryMainLink.linkProps}
                    id={
                      categoryMainLink.linkProps.id ??
                      `${id}-category-link${generateValidHtmlId({ text: categoryMainLink.text })}-${categoryIndex}`
                    }
                    className={cx(fr.cx('fr-nav__link'), categoryMainLink.linkProps.className)}
                  >
                    {categoryMainLink.text}
                  </Link>
                </Category>
              )}
              {categoryMainText !== undefined && (
                <Category className={cx(fr.cx('fr-mega-menu__category', 'fr-nav__link'), classes.category)}>{categoryMainText}</Category>
              )}
              <ul className={cx(fr.cx('fr-mega-menu__list'), classes.list)}>
                {links.map(({ linkProps, text, isActive }, linkIndex) => (
                  <li key={linkIndex}>
                    <Link
                      {...linkProps}
                      id={linkProps.id ?? `${id}-link${generateValidHtmlId({ text })}-${categoryIndex}-${linkIndex}`}
                      className={cx(fr.cx('fr-nav__link'), linkProps.className)}
                      {...(isActive ? { 'aria-current': 'page' as const } : {})}
                    >
                      {text}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
