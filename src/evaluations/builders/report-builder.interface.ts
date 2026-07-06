import { EvaluationResult } from '../strategies/scoring-strategy.interface'

export interface Report {
  title: string
  childName: string
  evaluationType: string
  date: Date
  summary: string
  scores: {
    total: number
    maxTotal: number
    percentage: number
  }
  dimensions: {
    name: string
    score: number
    maxScore: number
    percentage: string
    interpretation: string
  }[]
  topDimensions: {
    name: string
    percentage: string
  }[]
  interpretation: string
  recommendations: string[]
}

export interface ReportBuilder {
  build(result: EvaluationResult, childName: string, evaluationType: string): Report
}
