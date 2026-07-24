import { Injectable } from '@nestjs/common'
import { Evaluation } from './entities/evaluation.entity'
import { EvaluationAnswer } from './entities/evaluation-answer.entity'
import { EvaluationType } from './enums/evaluation-type.enum'
type ScoringResult = {
  type: string
  totalScore?: number
  minScore?: number
  maxScore?: number
  percentage?: number | null
  level?: string
  interpretation?: string
  dimensions: unknown[]
  dominantDimensions?: unknown[]
  note?: string
  hollandCode?: string
  totalLevel?: string
  average?: number
}
type DimensionResult = {
  dimensionId: string
  code: string
  name: string
  score: number
  minScore: number
  maxScore: number
  percentage: number | null
  level: string | null
}
type LevelRule = {
  min: number
  max: number
  label: string
}

type InterpretationRules = {
  levels?: LevelRule[]
  positivePole?: string
  negativePole?: string
}

@Injectable()
export class EvaluationScoringService {
  calculate(evaluation: Evaluation, answers: EvaluationAnswer[]): ScoringResult {
    switch (evaluation.type) {
      case EvaluationType.MULTIPLE_INTELLIGENCES:
        return this.scoreByDimensions(evaluation, answers)

      case EvaluationType.PRIDE:
        return this.scorePride(evaluation, answers)

      case EvaluationType.RENZULLI:
        return this.scoreRenzulli(evaluation, answers)

      case EvaluationType.HOLLAND:
        return this.scoreHolland(evaluation, answers)

      case EvaluationType.LEARNING_STYLES:
        return this.scoreLearningStyles(evaluation, answers)

      case EvaluationType.TORRANCE:
        return this.scoreByDimensions(evaluation, answers)

      default:
        return this.scoreByDimensions(evaluation, answers)
    }
  }

  private scoreByDimensions(evaluation: Evaluation, answers: EvaluationAnswer[]) {
    const dimensions = evaluation.dimensions ?? []

    const grouped = new Map<string, EvaluationAnswer[]>()

    for (const answer of answers) {
      const arr = grouped.get(answer.evaluationDimensionId) ?? []
      arr.push(answer)
      grouped.set(answer.evaluationDimensionId, arr)
    }

    const dimensionResults: DimensionResult[] = dimensions.map((dimension) => {
      const dimensionAnswers = grouped.get(dimension.id) ?? []
      const score = dimensionAnswers.reduce(
        (sum, answer) => sum + Number(answer.scoreValue || 0),
        0,
      )

      const minScore = Number(dimension.minScore ?? 0)
      const maxScore = Number(dimension.maxScore ?? 0)
      const percentage =
        maxScore > minScore
          ? Number((((score - minScore) / (maxScore - minScore)) * 100).toFixed(2))
          : null

      return {
        dimensionId: dimension.id,
        code: dimension.code,
        name: dimension.name,
        score,
        minScore,
        maxScore,
        percentage,
        level: this.resolveLevel(score, dimension.interpretationRules),
      }
    })

    const totalScore = dimensionResults.reduce((sum, d) => sum + d.score, 0)
    const maxScore = dimensionResults.reduce((sum, d) => sum + d.maxScore, 0)
    const minScore = dimensionResults.reduce((sum, d) => sum + d.minScore, 0)

    const sorted = [...dimensionResults].sort((a, b) => {
      const aPct = a.percentage ?? a.score
      const bPct = b.percentage ?? b.score
      return bPct - aPct
    })
    const dominantDimensions = sorted.slice(0, 3)
    const overallPercentage =
      maxScore > minScore
        ? Number((((totalScore - minScore) / (maxScore - minScore)) * 100).toFixed(2))
        : null

    return {
      type: evaluation.type,
      totalScore,
      minScore,
      maxScore,
      percentage: overallPercentage,
      overallPercentage,
      dimensions: dimensionResults,
      dominantDimensions,
      top3: dominantDimensions,
    }
  }

  private scorePride(evaluation: Evaluation, answers: EvaluationAnswer[]) {
    const base = this.scoreByDimensions(evaluation, answers)

    let level = 'غير محدد'

    if (base.totalScore >= 50 && base.totalScore <= 116.7) {
      level = 'منخفض'
    } else if (base.totalScore > 116.7 && base.totalScore <= 183.27) {
      level = 'متوسط'
    } else if (base.totalScore > 183.27) {
      level = 'مرتفع'
    }

    return {
      ...base,
      level,
      interpretation:
        level === 'مرتفع'
          ? 'تشير الدرجة إلى مؤشرات موهبة مرتفعة.'
          : level === 'متوسط'
            ? 'تشير الدرجة إلى مستوى متوسط من مؤشرات الموهبة.'
            : 'تشير الدرجة إلى مستوى منخفض من مؤشرات الموهبة.',
    }
  }

  private scoreRenzulli(evaluation: Evaluation, answers: EvaluationAnswer[]) {
    const base = this.scoreByDimensions(evaluation, answers)

    const dimensions = base.dimensions.map((d) => {
      const answerCount = answers.filter((a) => a.evaluationDimensionId === d.dimensionId).length

      const average = answerCount > 0 ? d.score / answerCount : 0

      return {
        ...d,
        average: Number(average.toFixed(2)),
        level: this.levelByAverage4(average),
      }
    })

    const totalAverage = answers.length > 0 ? base.totalScore / answers.length : 0

    return {
      ...base,
      dimensions,
      average: Number(totalAverage.toFixed(2)),
      level: this.levelByAverage4(totalAverage),
    }
  }

  private scoreHolland(evaluation: Evaluation, answers: EvaluationAnswer[]) {
    const base = this.scoreByDimensions(evaluation, answers)

    const dimensions = base.dimensions.map((d) => {
      const suitable = d.score >= 21
      return {
        ...d,
        isSuitableInterest: suitable,
        suitable,
        level: suitable ? 'ميل مهني ملائم' : 'ميل مهني غير ملائم',
      }
    })

    const sorted = [...dimensions].sort((a, b) => b.score - a.score)
    const dominantDimensions = sorted.slice(0, 3)

    return {
      ...base,
      dimensions,
      totalLevel:
        base.totalScore >= 126
          ? 'الميول المهنية الكلية ملائمة'
          : 'الميول المهنية الكلية غير ملائمة',
      hollandCode: dominantDimensions.map((d) => d.code.toUpperCase()).join('-'),
      dominantDimensions,
      top3: dominantDimensions,
    }
  }

  private scoreLearningStyles(evaluation: Evaluation, answers: EvaluationAnswer[]) {
    const base = this.scoreByDimensions(evaluation, answers)

    const dimensions = base.dimensions.map((d) => {
      const abs = Math.abs(d.score)

      let strength = 'متوازن'
      if (abs >= 5 && abs <= 8) strength = 'تفضيل متوسط'
      if (abs >= 9 && abs <= 11) strength = 'تفضيل قوي'

      let dominantPole: string | null = null

      const dimension = evaluation.dimensions?.find((x) => x.id === d.dimensionId)

      const rules = this.parseInterpretationRules(dimension?.interpretationRules)

      if (rules) {
        if (d.score > 0) {
          dominantPole = rules.positivePole ?? null
        }

        if (d.score < 0) {
          dominantPole = rules.negativePole ?? null
        }
      }

      return {
        ...d,
        percentage: null,
        dominantPole,
        strength,
      }
    })

    return {
      type: evaluation.type,
      dimensions,
      note: 'هذا المقياس لا يعتمد على درجة كلية، بل على أربعة أبعاد ثنائية القطب.',
    }
  }

  private resolveLevel(
    score: number,
    rulesInput: Record<string, unknown> | null | undefined,
  ): string | null {
    const rules = this.parseInterpretationRules(rulesInput)

    if (!rules?.levels || rules.levels.length === 0) {
      return null
    }

    const matched = rules.levels.find((rule) => score >= rule.min && score <= rule.max)

    return matched?.label ?? null
  }

  private parseInterpretationRules(
    input: Record<string, unknown> | null | undefined,
  ): InterpretationRules | null {
    if (!input) return null

    const parsed: InterpretationRules = {}

    const positivePole = input.positivePole
    if (typeof positivePole === 'string') {
      parsed.positivePole = positivePole
    }

    const negativePole = input.negativePole
    if (typeof negativePole === 'string') {
      parsed.negativePole = negativePole
    }

    const levels = input.levels
    if (Array.isArray(levels)) {
      const validLevels: LevelRule[] = []

      for (const item of levels) {
        if (!this.isRecord(item)) continue

        const min = item.min
        const max = item.max
        const label = item.label

        if (typeof label !== 'string') continue

        const parsedMin = typeof min === 'number' ? min : Number(min)
        const parsedMax = typeof max === 'number' ? max : Number(max)

        if (!Number.isNaN(parsedMin) && !Number.isNaN(parsedMax)) {
          validLevels.push({
            min: parsedMin,
            max: parsedMax,
            label,
          })
        }
      }

      parsed.levels = validLevels
    }

    return parsed
  }

  private isRecord(value: unknown): value is Record<string, unknown> {
    return typeof value === 'object' && value !== null && !Array.isArray(value)
  }

  private levelByAverage4(avg: number) {
    if (avg >= 1 && avg <= 2) return 'منخفض'
    if (avg > 2 && avg <= 3) return 'متوسط'
    if (avg > 3 && avg <= 4) return 'مرتفع'
    return 'غير محدد'
  }
}
