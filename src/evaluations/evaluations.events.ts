export const EVALUATION_EVENTS = {
  submitted: 'evaluation.submitted',
  approved: 'evaluation.approved',
  limitReached: 'evaluation.limit_reached',
} as const

export type EvaluationEventName = (typeof EVALUATION_EVENTS)[keyof typeof EVALUATION_EVENTS]
