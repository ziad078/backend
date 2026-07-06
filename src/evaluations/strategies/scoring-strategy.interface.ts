import { EvaluationAttempt } from '../entities/evaluation-attempt.entity'

export interface DimensionScore {
  code: string
  name: string
  score: number
  maxScore: number
  percentage: number
  interpretation: string
}

export interface PreschoolDimensionResult {
  code: string
  name: string
  questionCount: number
  totalScore: number
  averageScore: number
}

export interface StandardEvaluationResult {
  totalScore: number
  maxTotalScore: number
  overallPercentage: number
  dimensions: DimensionScore[]
  topDimensions: DimensionScore[]
  interpretation: string
  recommendations: string[]
}

export interface PreschoolEvaluationResult {
  totalScore: number
  averageScore: number
  giftedIndicator: boolean
  level: 'LOW' | 'MEDIUM' | 'HIGH'
  dimensions: PreschoolDimensionResult[]
}

export type EvaluationResult = StandardEvaluationResult | PreschoolEvaluationResult

export interface ScoringStrategy {
  calculate(attempt: EvaluationAttempt): Promise<EvaluationResult>
  getType(): string
}
