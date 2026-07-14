import { Injectable } from '@nestjs/common'
import { ApiException } from 'src/common/exceptions/api.exception'
import { ApiErrorCodes } from 'src/common/enums/api-error.enum'
import { EvaluationType } from '../enums/evaluation-type.enum'
import { ScoringStrategy } from './scoring-strategy.interface'
import { MultipleIntelligencesStrategy } from './multiple-intelligences.strategy'
import { HollandStrategy } from './holland.strategy'
import { RenzulliStrategy } from './renzulli.strategy'
import { PrideStrategy } from './pride.strategy'
import { LearningStylesStrategy } from './learning-styles.strategy'
import { TorranceStrategy } from './torrance.strategy'
import { PreschoolGiftednessStrategy } from './preschool-giftedness.strategy'

@Injectable()
export class ScoringStrategyFactory {
  constructor(
    private multipleIntelligencesStrategy: MultipleIntelligencesStrategy,
    private hollandStrategy: HollandStrategy,
    private renzulliStrategy: RenzulliStrategy,
    private prideStrategy: PrideStrategy,
    private learningStylesStrategy: LearningStylesStrategy,
    private torranceStrategy: TorranceStrategy,
    private preschoolGiftednessStrategy: PreschoolGiftednessStrategy,
  ) {}

  getStrategy(type: EvaluationType): ScoringStrategy {
    const strategyMap = new Map<EvaluationType, ScoringStrategy>([
      [EvaluationType.MULTIPLE_INTELLIGENCES, this.multipleIntelligencesStrategy],
      [EvaluationType.PRIDE, this.prideStrategy],
      [EvaluationType.RENZULLI, this.renzulliStrategy],
      [EvaluationType.HOLLAND, this.hollandStrategy],
      [EvaluationType.LEARNING_STYLES, this.learningStylesStrategy],
      [EvaluationType.TORRANCE, this.torranceStrategy],
      [EvaluationType.PRESCHOOL_GIFTEDNESS, this.preschoolGiftednessStrategy],
    ])

    const strategy = strategyMap.get(type)
    if (!strategy) {
      throw ApiException.badRequest(ApiErrorCodes.VALIDATION_FAILED, { assessmentType: type })
    }
    return strategy
  }
}
