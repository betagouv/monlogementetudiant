import { z } from 'zod'

export enum EStudyYear {
  BAC_1 = 'bac_1',
  BAC_2 = 'bac_2',
  BAC_3 = 'bac_3',
  BAC_4 = 'bac_4',
  BAC_5_PLUS = 'bac_5_plus',
}

export const STUDY_YEARS = Object.values(EStudyYear)

export const ZStudyYear = z.enum(EStudyYear)

export const STUDY_YEAR_SHORT_LABELS: Record<EStudyYear, string> = {
  [EStudyYear.BAC_1]: 'Bac+1',
  [EStudyYear.BAC_2]: 'Bac+2',
  [EStudyYear.BAC_3]: 'Bac+3',
  [EStudyYear.BAC_4]: 'Bac+4',
  [EStudyYear.BAC_5_PLUS]: 'Bac+5 et +',
}
