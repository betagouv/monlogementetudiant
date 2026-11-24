'use client'

import Link from 'next/link'
import { FC } from 'react'
import { tss } from 'tss-react'
import { TCity } from '~/schemas/territories'
import { wpCityUrl } from '~/utils/wp-redirect'

interface AutocompleteResultsProps {
  data: TCity[]
}

export const CitiesAutocompleteResults: FC<AutocompleteResultsProps> = ({ data }) => {
  const { classes } = useStyles()

  return (
    <div className={classes.container}>
      <ul className={classes.list}>
        {data.map((item: TCity) => (
          <li className={classes.item} key={item.id}>
            <Link className={classes.itemLink} href={wpCityUrl(item.name)}>
              {item.name}
            </Link>
          </li>
        ))}
      </ul>
    </div>
  )
}

const useStyles = tss.create({
  container: {
    backgroundColor: 'white',
    boxShadow: '0 2px 4px rgba(0, 0, 0, 0.1)',
    left: 0,
    position: 'absolute',
    top: '100%',
    width: '100%',
    zIndex: 10,
  },
  item: {
    '&:hover': {
      backgroundColor: '#f0f0f0',
    },
    borderBottom: '1px solid #e0e0e0',
    borderTop: '1px solid #e0e0e0',
    cursor: 'pointer',
  },
  itemLink: {
    backgroundImage: 'none',
    color: 'inherit',
    display: 'block',
    padding: '8px',
    textDecoration: 'none',
    width: '100%',
  },
  list: {
    backgroundColor: 'white',
    borderBottom: '1px solid #e0e0e0',
    listStyle: 'none',
    margin: 0,
    padding: 0,
  },
})
