export interface OwnerClassEvaluationSummary {
  classId: string
  className: string
  highestScore: number | null
  averageScore: number | null
  lowestScore: number | null
  topDimensions: {
    code: string
    name: string
    percentage: number | null
    score: number
  }[]
  children: {
    organizationChildId: string
    childName: string
    className: string
    topResultLabel: string | null
    topDimensionName: string | null
    score: number | null
    status: 'not_started' | 'in_progress' | 'submitted' | 'approved'
  }[]
}
