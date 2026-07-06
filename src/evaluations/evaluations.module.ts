import { forwardRef, Module } from '@nestjs/common'
import { TypeOrmModule } from '@nestjs/typeorm'
import { EvaluationsService } from './evaluations.service'
import { EvaluationsController } from './evaluations.controller'
import { AttemptsController } from './attempts.controller'
import { Evaluation } from './entities/evaluation.entity'
import { EvaluationAttempt } from './entities/evaluation-attempt.entity'
import { EvaluationAnswer } from './entities/evaluation-answer.entity'
import { EvaluationApproval } from './entities/evaluation-approval.entity'
import { EvaluationQuestion } from './entities/evaluation-question.entity'
import { EvaluationQuestionAnswer } from './entities/evaluation-question-answer.entity'
import { OrganizationChild } from 'src/children/entities/organization-child.entity'
import { PrivateChild } from 'src/children/entities/private-child.entity'
import { EvaluationDimension } from './entities/evaluation-dimension.entity'
import { EvaluationScoringService } from './evaluations-scoring-services.service'
import { OwnerEvaluationResultsController } from './owner-evaluation-results.controller'
import { OwnerEvaluationResultsService } from './owner-evaluation-results.service'
import { Class } from 'src/classes/entities/class.entity'
import { Organization } from 'src/organizations/entities/organization.entity'
import { NotificationsModule } from 'src/notifications/notifications.module'
import { AttemptUsageService } from './attempt-usage.service'
import { EvaluationSlot } from './entities/evaluation-slot.entity'
import { PaymentsModule } from 'src/payments/payments.module'
import { EvaluationAccessPolicy } from './services/evaluation-access-policy.service'
import { EvaluationAnswerBuilderService } from './services/evaluation-answer-builder.service'
import { EvaluationAttemptLifecycleService } from './services/evaluation-attempt-lifecycle.service'
import { EvaluationProgressService } from './services/evaluation-progress.service'
import { EvaluationSubmissionService } from './services/evaluation-submission.service'
import { EvaluationApprovalService } from './services/evaluation-approval.service'
import { EvaluationSlotService } from './services/evaluation-slot.service'
import { AdminPrivateAttemptsController } from './admin-private-attempts.controller'
import { UsersModule } from 'src/users/users.module'
import { ScoringStrategyFactory } from './strategies/scoring-strategy.factory'
import { MultipleIntelligencesStrategy } from './strategies/multiple-intelligences.strategy'
import { HollandStrategy } from './strategies/holland.strategy'
import { RenzulliStrategy } from './strategies/renzulli.strategy'
import { PrideStrategy } from './strategies/pride.strategy'
import { LearningStylesStrategy } from './strategies/learning-styles.strategy'
import { TorranceStrategy } from './strategies/torrance.strategy'
import { PreschoolGiftednessStrategy } from './strategies/preschool-giftedness.strategy'
import { EvaluationSeedingService } from './evaluation-seeding.service'

@Module({
  imports: [
    TypeOrmModule.forFeature([
      Evaluation,
      EvaluationAttempt,
      EvaluationAnswer,
      EvaluationApproval,
      EvaluationQuestion,
      EvaluationQuestionAnswer,
      OrganizationChild,
      PrivateChild,
      Class,
      Organization,
      EvaluationDimension,
      EvaluationSlot,
    ]),
    forwardRef(() => PaymentsModule),
    NotificationsModule,
    UsersModule,
  ],
  controllers: [
    EvaluationsController,
    AttemptsController,
    OwnerEvaluationResultsController,
    AdminPrivateAttemptsController,
  ],
  providers: [
    EvaluationsService,
    EvaluationScoringService,
    OwnerEvaluationResultsService,
    AttemptUsageService,
    EvaluationAccessPolicy,
    EvaluationAnswerBuilderService,
    EvaluationAttemptLifecycleService,
    EvaluationProgressService,
    EvaluationSubmissionService,
    EvaluationApprovalService,
    EvaluationSlotService,
    ScoringStrategyFactory,
    MultipleIntelligencesStrategy,
    HollandStrategy,
    RenzulliStrategy,
    PrideStrategy,
    LearningStylesStrategy,
    TorranceStrategy,
    PreschoolGiftednessStrategy,
    EvaluationSeedingService,
  ],
  exports: [AttemptUsageService, EvaluationSlotService],
})
export class EvaluationsModule {}
