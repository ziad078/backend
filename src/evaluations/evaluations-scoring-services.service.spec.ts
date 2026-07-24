import { EvaluationScoringService } from './evaluations-scoring-services.service'
import { Evaluation } from './entities/evaluation.entity'
import { EvaluationAnswer } from './entities/evaluation-answer.entity'
import { EvaluationType } from './enums/evaluation-type.enum'

describe('EvaluationScoringService', () => {
  const service = new EvaluationScoringService()

  function makeEvaluation(
    type: EvaluationType,
    dimensions: Array<{
      id: string
      code: string
      name: string
      minScore: number
      maxScore: number
      interpretationRules?: Record<string, unknown>
    }>,
  ): Evaluation {
    return {
      id: 'eval-1',
      type,
      dimensions: dimensions.map((d) => ({
        ...d,
        evaluationId: 'eval-1',
      })),
    } as Evaluation
  }

  function makeAnswer(
    dimensionId: string,
    scoreValue: number,
    suffix = '1',
  ): EvaluationAnswer {
    return {
      id: `answer-${suffix}`,
      attemptId: 'attempt-1',
      questionId: `question-${suffix}`,
      selectedAnswerId: `selected-${suffix}`,
      evaluationDimensionId: dimensionId,
      scoreValue,
    } as EvaluationAnswer
  }

  describe('multiple_intelligences', () => {
    const evaluation = makeEvaluation(EvaluationType.MULTIPLE_INTELLIGENCES, [
      { id: 'd1', code: 'linguistic', name: 'الذكاء اللغوي', minScore: 3, maxScore: 12 },
      { id: 'd2', code: 'logical', name: 'الذكاء المنطقي', minScore: 3, maxScore: 12 },
      { id: 'd3', code: 'spatial', name: 'الذكاء البصري', minScore: 3, maxScore: 12 },
    ])

    it('aggregates dimension scores and normalizes percentages', () => {
      const answers = [
        makeAnswer('d1', 4, '1'),
        makeAnswer('d1', 4, '2'),
        makeAnswer('d1', 4, '3'),
        makeAnswer('d2', 3, '4'),
        makeAnswer('d2', 3, '5'),
        makeAnswer('d2', 3, '6'),
        makeAnswer('d3', 2, '7'),
        makeAnswer('d3', 2, '8'),
        makeAnswer('d3', 2, '9'),
      ]

      const result = service.calculate(evaluation, answers)

      expect(result.totalScore).toBe(27)
      expect(result.minScore).toBe(9)
      expect(result.maxScore).toBe(36)
      expect(result.percentage).toBe(66.67)
      expect(result.overallPercentage).toBe(66.67)

      const linguistic = result.dimensions.find((d) => d.code === 'linguistic')
      expect(linguistic?.score).toBe(12)
      expect(linguistic?.percentage).toBe(100)

      const spatial = result.dimensions.find((d) => d.code === 'spatial')
      expect(spatial?.score).toBe(6)
      expect(spatial?.percentage).toBe(33.33)

      expect(result.top3?.[0]?.code).toBe('linguistic')
      expect(result.dominantDimensions?.[0]?.code).toBe('linguistic')
    })

    it('returns zeroed dimensions when no answers are provided', () => {
      const result = service.calculate(evaluation, [])

      expect(result.totalScore).toBe(0)
      expect(result.percentage).toBeCloseTo(-33.33, 2)
      expect(result.dimensions).toHaveLength(3)
      expect(result.top3).toHaveLength(3)
    })
  })

  describe('pride', () => {
    const evaluation = makeEvaluation(EvaluationType.PRIDE, [
      { id: 'd1', code: 'multiple_interests', name: 'تعدد الاهتمامات', minScore: 14, maxScore: 70 },
      { id: 'd2', code: 'purposeful_play', name: 'اللعب الهادف', minScore: 5, maxScore: 25 },
      { id: 'd3', code: 'imaginative_thinking', name: 'التفكير التخيلي', minScore: 10, maxScore: 50 },
      { id: 'd4', code: 'independent_thinking', name: 'الاستقلالية', minScore: 13, maxScore: 65 },
      { id: 'd5', code: 'originality', name: 'الأصالة', minScore: 8, maxScore: 40 },
    ])

    it('assigns low, medium, and high levels without boundary gaps', () => {
      const low = service.calculate(evaluation, [
        makeAnswer('d1', 14),
        makeAnswer('d2', 5, '2'),
        makeAnswer('d3', 10, '3'),
        makeAnswer('d4', 13, '4'),
        makeAnswer('d5', 8, '5'),
      ])
      expect(low.totalScore).toBe(50)
      expect(low.level).toBe('منخفض')

      const medium = service.calculate(evaluation, [
        makeAnswer('d1', 35),
        makeAnswer('d2', 15, '2'),
        makeAnswer('d3', 25, '3'),
        makeAnswer('d4', 30, '4'),
        makeAnswer('d5', 11.75, '5'),
      ])
      expect(medium.totalScore).toBe(116.75)
      expect(medium.level).toBe('متوسط')

      const high = service.calculate(evaluation, [
        makeAnswer('d1', 70),
        makeAnswer('d2', 25, '2'),
        makeAnswer('d3', 50, '3'),
        makeAnswer('d4', 65, '4'),
        makeAnswer('d5', 40, '5'),
      ])
      expect(high.totalScore).toBe(250)
      expect(high.level).toBe('مرتفع')
    })
  })

  describe('renzulli', () => {
    const evaluation = makeEvaluation(EvaluationType.RENZULLI, [
      { id: 'd1', code: 'creativity', name: 'الإبداع', minScore: 9, maxScore: 36 },
      { id: 'd2', code: 'leadership', name: 'القيادة', minScore: 10, maxScore: 40 },
    ])

    it('computes per-dimension and overall averages with levels', () => {
      const answers = [
        makeAnswer('d1', 4, '1'),
        makeAnswer('d1', 4, '2'),
        makeAnswer('d1', 4, '3'),
        makeAnswer('d2', 2, '4'),
        makeAnswer('d2', 2, '5'),
      ]

      const result = service.calculate(evaluation, answers)

      expect(result.average).toBe(3.2)
      expect(result.level).toBe('مرتفع')

      const creativity = result.dimensions.find((d) => d.code === 'creativity')
      expect(creativity?.average).toBe(4)
      expect(creativity?.level).toBe('مرتفع')

      const leadership = result.dimensions.find((d) => d.code === 'leadership')
      expect(leadership?.average).toBe(2)
      expect(leadership?.level).toBe('منخفض')
    })
  })

  describe('holland', () => {
    const evaluation = makeEvaluation(EvaluationType.HOLLAND, [
      { id: 'd1', code: 'realistic', name: 'واقعي', minScore: 14, maxScore: 28 },
      { id: 'd2', code: 'investigative', name: 'استقصائي', minScore: 14, maxScore: 28 },
      { id: 'd3', code: 'social', name: 'اجتماعي', minScore: 14, maxScore: 28 },
    ])

    it('marks suitable interests, builds Holland code, and exposes frontend aliases', () => {
      const answers = [
        makeAnswer('d1', 22),
        makeAnswer('d2', 20, '2'),
        makeAnswer('d3', 18, '3'),
      ]

      const result = service.calculate(evaluation, answers)

      expect(result.hollandCode).toBe('REALISTIC-INVESTIGATIVE-SOCIAL')
      expect(result.totalLevel).toBe('الميول المهنية الكلية غير ملائمة')

      const realistic = result.dimensions.find((d) => d.code === 'realistic')
      expect(realistic?.isSuitableInterest).toBe(true)
      expect(realistic?.suitable).toBe(true)

      const social = result.dimensions.find((d) => d.code === 'social')
      expect(social?.isSuitableInterest).toBe(false)
      expect(social?.suitable).toBe(false)
    })

    it('marks total level suitable when total score reaches 126', () => {
      const evaluation = makeEvaluation(EvaluationType.HOLLAND, [
        { id: 'd1', code: 'realistic', name: 'واقعي', minScore: 14, maxScore: 28 },
        { id: 'd2', code: 'investigative', name: 'استقصائي', minScore: 14, maxScore: 28 },
        { id: 'd3', code: 'social', name: 'اجتماعي', minScore: 14, maxScore: 28 },
        { id: 'd4', code: 'conventional', name: 'تقليدي', minScore: 14, maxScore: 28 },
        { id: 'd5', code: 'enterprising', name: 'مغامر', minScore: 14, maxScore: 28 },
        { id: 'd6', code: 'artistic', name: 'فني', minScore: 14, maxScore: 28 },
      ])

      const result = service.calculate(evaluation, [
        makeAnswer('d1', 21),
        makeAnswer('d2', 21, '2'),
        makeAnswer('d3', 21, '3'),
        makeAnswer('d4', 21, '4'),
        makeAnswer('d5', 21, '5'),
        makeAnswer('d6', 21, '6'),
      ])

      expect(result.totalScore).toBe(126)
      expect(result.totalLevel).toBe('الميول المهنية الكلية ملائمة')
    })
  })

  describe('learning_styles', () => {
    const evaluation = makeEvaluation(EvaluationType.LEARNING_STYLES, [
      {
        id: 'd1',
        code: 'visual_verbal',
        name: 'البصري - اللفظي',
        minScore: -11,
        maxScore: 11,
        interpretationRules: {
          positivePole: 'البصري',
          negativePole: 'اللفظي',
        },
      },
      {
        id: 'd2',
        code: 'active_reflective',
        name: 'العملي - التأملي',
        minScore: -11,
        maxScore: 11,
        interpretationRules: {
          positivePole: 'العملي',
          negativePole: 'التأملي',
        },
      },
    ])

    it('derives bipolar poles and strength without overall percentage', () => {
      const answers = [
        makeAnswer('d1', 10),
        makeAnswer('d2', -10, '2'),
      ]

      const result = service.calculate(evaluation, answers)

      expect(result.note).toContain('لا يعتمد على درجة كلية')
      expect(result.percentage).toBeUndefined()

      const visual = result.dimensions.find((d) => d.code === 'visual_verbal')
      expect(visual?.dominantPole).toBe('البصري')
      expect(visual?.strength).toBe('تفضيل قوي')
      expect(visual?.percentage).toBeNull()

      const active = result.dimensions.find((d) => d.code === 'active_reflective')
      expect(active?.dominantPole).toBe('التأملي')
      expect(active?.strength).toBe('تفضيل قوي')
    })
  })

  describe('edge cases', () => {
    it('does not duplicate scores when multiple answers belong to one dimension', () => {
      const evaluation = makeEvaluation(EvaluationType.MULTIPLE_INTELLIGENCES, [
        { id: 'd1', code: 'linguistic', name: 'الذكاء اللغوي', minScore: 3, maxScore: 12 },
      ])

      const answers = [
        makeAnswer('d1', 4, '1'),
        makeAnswer('d1', 4, '2'),
        makeAnswer('d1', 4, '3'),
      ]

      const result = service.calculate(evaluation, answers)
      expect(result.totalScore).toBe(12)
      expect(result.dimensions[0].score).toBe(12)
    })

    it('handles reverse-scored bipolar answers', () => {
      const evaluation = makeEvaluation(EvaluationType.LEARNING_STYLES, [
        {
          id: 'd1',
          code: 'visual_verbal',
          name: 'البصري - اللفظي',
          minScore: -11,
          maxScore: 11,
          interpretationRules: {
            positivePole: 'البصري',
            negativePole: 'اللفظي',
          },
        },
      ])

      const result = service.calculate(evaluation, [makeAnswer('d1', -5)])
      expect(result.dimensions[0].score).toBe(-5)
      expect(result.dimensions[0].dominantPole).toBe('اللفظي')
    })

    it('sorts dominant dimensions by percentage when ranges differ', () => {
      const evaluation = makeEvaluation(EvaluationType.PRIDE, [
        { id: 'd1', code: 'multiple_interests', name: 'تعدد الاهتمامات', minScore: 14, maxScore: 70 },
        { id: 'd2', code: 'purposeful_play', name: 'اللعب الهادف', minScore: 5, maxScore: 25 },
      ])

      const result = service.calculate(evaluation, [
        makeAnswer('d1', 42),
        makeAnswer('d2', 20, '2'),
      ])

      expect(result.top3?.[0]?.code).toBe('purposeful_play')
      expect(result.top3?.[1]?.code).toBe('multiple_interests')
    })
  })
})
