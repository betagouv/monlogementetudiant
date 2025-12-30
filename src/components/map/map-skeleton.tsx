'use client'

import { FC } from 'react'
import { tss } from 'tss-react'

interface MapSkeletonProps {
  height: number
}

export const MapSkeleton: FC<MapSkeletonProps> = ({ height }) => {
  const { classes } = useStyles({ height })

  return <div className={classes.mapSkeleton} />
}

const useStyles = tss.withParams<{ height: number }>().create(({ height }) => ({
  mapSkeleton: {
    animation: 'pulse 2s cubic-bezier(0.4, 0, 0.6, 1) infinite',
    backgroundColor: '#e5e7eb',
    height: `${height}px`,
    width: '100%',
  },
}))
