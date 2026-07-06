import { Injectable } from '@nestjs/common'
import { InjectRepository } from '@nestjs/typeorm'
import { Repository } from 'typeorm'
import { EvaluationAttempt } from '../entities/evaluation-attempt.entity'
import { EvaluationAnswer } from '../entities/evaluation-answer.entity'
import { EvaluationQuestion } from '../entities/evaluation-question.entity'
import { EvaluationDimension } from '../entities/evaluation-dimension.entity'
import { ScoringStrategy, EvaluationResult, DimensionScore } from './scoring-strategy.interface'

@Injectable()
export class LearningStylesStrategy implements ScoringStrategy {
  constructor(
    @InjectRepository(EvaluationAnswer)
    private answerRepo: Repository<EvaluationAnswer>,
    @InjectRepository(EvaluationQuestion)
    private questionRepo: Repository<EvaluationQuestion>,
    @InjectRepository(EvaluationDimension)
    private dimensionRepo: Repository<EvaluationDimension>,
  ) {}

  getType(): string {
    return 'learning_styles'
  }

  async calculate(attempt: EvaluationAttempt): Promise<EvaluationResult> {
    const answers = await this.answerRepo.find({
      where: { attempt: { id: attempt.id } },
      relations: ['question', 'question.evaluationDimension', 'selectedAnswer'],
    })

    const dimensions = await this.dimensionRepo.find({
      where: { evaluation: { id: attempt.evaluationId } },
    })

    const dimensionScores = new Map<string, DimensionScore>()

    for (const dimension of dimensions) {
      dimensionScores.set(dimension.code, {
        code: dimension.code,
        name: dimension.name,
        score: 0,
        maxScore: dimension.maxScore,
        percentage: 0,
        interpretation: '',
      })
    }

    for (const answer of answers) {
      const dimensionCode = answer.question.evaluationDimension.code
      const scoreValue = answer.selectedAnswer.scoreValue || 0
      const current = dimensionScores.get(dimensionCode)
      if (current) {
        current.score += scoreValue
      }
    }

    const calculatedDimensions: DimensionScore[] = []
    let totalScore = 0
    let maxTotalScore = 0

    for (const [code, score] of dimensionScores) {
      score.percentage = (score.score / score.maxScore) * 100
      score.interpretation = this.interpretDimension(score)
      calculatedDimensions.push(score)
      totalScore += score.score
      maxTotalScore += score.maxScore
    }

    const overallPercentage = (totalScore / maxTotalScore) * 100
    const topDimensions = [...calculatedDimensions]
      .sort((a, b) => b.percentage - a.percentage)
      .slice(0, 3)

    return {
      totalScore,
      maxTotalScore,
      overallPercentage,
      dimensions: calculatedDimensions,
      topDimensions,
      interpretation: this.interpretOverall(topDimensions),
      recommendations: this.generateRecommendations(topDimensions),
    }
  }

  private interpretDimension(score: DimensionScore): string {
    if (score.percentage >= 70) return 'أسلوب تعليمي مفضل'
    if (score.percentage >= 50) return 'أسلوب تعليمي جيد'
    if (score.percentage >= 30) return 'أسلوب تعليمي متوسط'
    return 'أسلوب تعليمي أقل تفضيلاً'
  }

  private interpretOverall(topDimensions: DimensionScore[]): string {
    const styles = topDimensions.map((d) => d.name).join(' و ')
    return `أساليب التعلم المفضلة لدى الطفل: ${styles}`
  }

  private generateRecommendations(topDimensions: DimensionScore[]): string[] {
    const recommendations: string[] = []
    for (const dim of topDimensions) {
      switch (dim.code) {
        case 'visual':
          recommendations.push('استخدم الصور والرسوم البيانية والخرائط الذهنية')
          break
        case 'auditory':
          recommendations.push('استخدم التسجيلات الصوتية والمناقشات والقراءة بصوت عالٍ')
          break
        case 'kinesthetic':
          recommendations.push('استخدم الأنشطة الحركية والتجارب العملية')
          break
        case 'reading_writing':
          recommendations.push('استخدم القراءة والكتابة والملاحظات المكتوبة')
          break
      }
    }
    return recommendations
  }
}
