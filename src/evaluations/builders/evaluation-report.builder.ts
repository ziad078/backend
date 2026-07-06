import { Injectable } from '@nestjs/common'
import { ReportBuilder, Report } from './report-builder.interface'
import {
  EvaluationResult,
  StandardEvaluationResult,
  PreschoolEvaluationResult,
} from '../strategies/scoring-strategy.interface'

function isStandardEvaluationResult(result: EvaluationResult): result is StandardEvaluationResult {
  return 'maxTotalScore' in result
}

@Injectable()
export class EvaluationReportBuilder implements ReportBuilder {
  build(result: EvaluationResult, childName: string, evaluationType: string): Report {
    if (isStandardEvaluationResult(result)) {
      return {
        title: `تقرير تقييم ${evaluationType}`,
        childName,
        evaluationType,
        date: new Date(),
        summary: this.generateStandardSummary(result),
        scores: {
          total: result.totalScore,
          maxTotal: result.maxTotalScore,
          percentage: result.overallPercentage,
        },
        dimensions: result.dimensions.map((d) => ({
          name: d.name,
          score: d.score,
          maxScore: d.maxScore,
          percentage: `${d.percentage.toFixed(1)}%`,
          interpretation: d.interpretation,
        })),
        topDimensions: result.topDimensions.map((d) => ({
          name: d.name,
          percentage: `${d.percentage.toFixed(1)}%`,
        })),
        interpretation: result.interpretation,
        recommendations: result.recommendations,
      }
    } else {
      return this.buildPreschoolReport(result, childName, evaluationType)
    }
  }

  private buildPreschoolReport(
    result: PreschoolEvaluationResult,
    childName: string,
    evaluationType: string,
  ): Report {
    return {
      title: `تقرير تقييم ${evaluationType}`,
      childName,
      evaluationType,
      date: new Date(),
      summary: this.generatePreschoolSummary(result),
      scores: {
        total: result.totalScore,
        maxTotal: 250, // 50 questions * 5 points each
        percentage: result.averageScore,
      },
      dimensions: result.dimensions.map((d) => ({
        name: d.name,
        score: d.totalScore,
        maxScore: d.questionCount * 5,
        percentage: `${d.averageScore.toFixed(1)}`,
        interpretation: '',
      })),
      topDimensions: [],
      interpretation: `مستوى الطفل: ${result.level}${
        result.giftedIndicator ? ' - يظهر مؤشرات الموهبة' : ''
      }`,
      recommendations: [],
    }
  }

  private generateStandardSummary(result: StandardEvaluationResult): string {
    if (result.overallPercentage >= 80) {
      return 'أداء ممتاز - الطفل يظهر قدرات عالية في المجالات المقاسة'
    } else if (result.overallPercentage >= 60) {
      return 'أداء جيد جداً - الطفل يظهر قدرات قوية في معظم المجالات'
    } else if (result.overallPercentage >= 40) {
      return 'أداء متوسط - الطفل يظهر قدرات متوسطة في المجالات المقاسة'
    } else {
      return 'أداء يحتاج دعم - يوصى بتقديم دعم إضافي للطفل'
    }
  }

  private generatePreschoolSummary(result: PreschoolEvaluationResult): string {
    const levelText =
      result.level === 'HIGH'
        ? 'مستوى عالي'
        : result.level === 'MEDIUM'
          ? 'مستوى متوسط'
          : 'مستوى منخفض'
    const giftedText = result.giftedIndicator
      ? 'الطفل يظهر مؤشرات الموهبة'
      : 'الطفل لا يظهر مؤشرات الموهبة كافية'
    return `${levelText} - ${giftedText}`
  }
}
