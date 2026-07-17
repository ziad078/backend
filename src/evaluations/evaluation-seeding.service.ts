import { Injectable, Logger, OnModuleInit } from '@nestjs/common'
import { ApiException } from 'src/common/exceptions/api.exception'
import { ApiErrorCodes } from 'src/common/enums/api-error.enum'
import { InjectRepository } from '@nestjs/typeorm'
import { Repository } from 'typeorm'
import { Evaluation } from './entities/evaluation.entity'
import { EvaluationAttempt } from './entities/evaluation-attempt.entity'
import { EvaluationDimension } from './entities/evaluation-dimension.entity'
import { EvaluationQuestion } from './entities/evaluation-question.entity'
import { EvaluationQuestionAnswer } from './entities/evaluation-question-answer.entity'
import { EvaluationType } from './enums/evaluation-type.enum'

type AnswerSeed = {
  text: string
  scoreValue: number
  code?: string
}

type QuestionSeed = {
  content: string
  dimensionCode: string
  answers?: AnswerSeed[]
}

type DimensionSeed = {
  name: string
  code: string
  minScore: number
  maxScore: number
  interpretationRules?: Record<string, unknown>
}

type EvaluationSeed = {
  type: EvaluationType
  title: string
  ageFrom: number | null
  ageTo: number | null
  evaluatorTypes: string[]
  dimensions: DimensionSeed[]
  questions: QuestionSeed[]
}

@Injectable()
export class EvaluationSeedingService implements OnModuleInit {
  private readonly logger = new Logger(EvaluationSeedingService.name)

  constructor(
    @InjectRepository(Evaluation)
    private readonly evaluationRepo: Repository<Evaluation>,
    @InjectRepository(EvaluationAttempt)
    private readonly attemptRepo: Repository<EvaluationAttempt>,
    @InjectRepository(EvaluationDimension)
    private readonly dimensionRepo: Repository<EvaluationDimension>,
    @InjectRepository(EvaluationQuestion)
    private readonly questionRepo: Repository<EvaluationQuestion>,
    @InjectRepository(EvaluationQuestionAnswer)
    private readonly answerRepo: Repository<EvaluationQuestionAnswer>,
  ) {}

  async onModuleInit() {
    await this.seedEvaluations()
  }

  /**
   * Destructive seeding (deleting & re-creating question banks, overwriting
   * evaluation metadata) is restricted to development. In production/staging
   * seeding is strictly additive: it only inserts missing system evaluations
   * and their initial question banks, and never overwrites admin-modified data.
   */
  private isDestructiveSeedingEnabled(): boolean {
    return (
      process.env.NODE_ENV === 'development' || process.env.RUN_DESTRUCTIVE_SEEDING === 'true'
    )
  }

  private async seedEvaluations() {
    const mode = this.isDestructiveSeedingEnabled() ? 'destructive (dev)' : 'non-destructive'
    this.logger.log(`Starting evaluation seeding (${mode})...`)
    await this.seedEvaluation(this.multipleIntelligencesSeed())
    await this.seedEvaluation(this.prideSeed())
    await this.seedEvaluation(this.renzulliSeed())
    await this.seedEvaluation(this.hollandSeed())
    await this.seedEvaluation(this.learningStylesSeed())
    await this.seedEvaluation(this.torranceSeed())
    await this.removeDeprecatedPreschoolGiftednessSeed()
    this.logger.log('Evaluation seeding complete!')
  }

  private async seedEvaluation(seed: EvaluationSeed) {
    let evaluation = await this.evaluationRepo.findOne({
      where: { type: seed.type },
    })

    const destructiveSeeding = this.isDestructiveSeedingEnabled()

    if (!evaluation) {
      evaluation = await this.evaluationRepo.save(
        this.evaluationRepo.create({
          type: seed.type,
          title: seed.title,
          institutionId: null,
          ageFrom: seed.ageFrom,
          ageTo: seed.ageTo,
          evaluatorTypes: seed.evaluatorTypes,
        }),
      )
    } else if (destructiveSeeding) {
      // Dev only: refresh metadata from seed. Never overwrite admin edits in prod.
      evaluation.title = seed.title
      evaluation.ageFrom = seed.ageFrom
      evaluation.ageTo = seed.ageTo
      evaluation.evaluatorTypes = seed.evaluatorTypes
      await this.evaluationRepo.save(evaluation)
    }

    const attemptsCount = await this.attemptRepo.count({
      where: { evaluationId: evaluation.id },
    })

    if (attemptsCount > 0) {
      this.logger.log(`${seed.title} has ${attemptsCount} attempts; question bank left unchanged`)
      return
    }

    const [existingDimensions, existingQuestions] = await Promise.all([
      this.dimensionRepo.count({ where: { evaluationId: evaluation.id } }),
      this.questionRepo.count({ where: { evaluationId: evaluation.id } }),
    ])
    const hasQuestionBank = existingDimensions > 0 || existingQuestions > 0

    if (hasQuestionBank && !destructiveSeeding) {
      // Production/staging: an existing question bank is never deleted or overwritten.
      this.logger.log(
        `${seed.title} already has a question bank; skipping (non-destructive mode)`,
      )
      return
    }

    if (hasQuestionBank) {
      // Destructive dev re-seed: safe to wipe and rebuild.
      await this.questionRepo.delete({ evaluationId: evaluation.id })
      await this.dimensionRepo.delete({ evaluationId: evaluation.id })
    }

    const dimensions = new Map<string, EvaluationDimension>()

    for (const dimensionSeed of seed.dimensions) {
      const dimension = await this.dimensionRepo.save(
        this.dimensionRepo.create({
          evaluationId: evaluation.id,
          name: dimensionSeed.name,
          code: dimensionSeed.code,
          minScore: dimensionSeed.minScore,
          maxScore: dimensionSeed.maxScore,
          interpretationRules: dimensionSeed.interpretationRules ?? null,
        }),
      )
      dimensions.set(dimension.code, dimension)
    }

    for (const [index, questionSeed] of seed.questions.entries()) {
      const dimension = dimensions.get(questionSeed.dimensionCode)
      if (!dimension) {
        throw ApiException.internal(
          { dimensionCode: questionSeed.dimensionCode, evaluationTitle: seed.title },
        )
      }

      const question = await this.questionRepo.save(
        this.questionRepo.create({
          evaluationId: evaluation.id,
          evaluationDimensionId: dimension.id,
          content: questionSeed.content,
          order: index + 1,
        }),
      )

      await this.answerRepo.save(
        (questionSeed.answers ?? this.likert5Answers()).map((answerSeed, answerIndex) =>
          this.answerRepo.create({
            questionId: question.id,
            text: answerSeed.text,
            scoreValue: answerSeed.scoreValue,
            code: answerSeed.code ?? null,
            order: answerIndex + 1,
          }),
        ),
      )
    }

    this.logger.log(
      `Seeded ${seed.title}: ${seed.dimensions.length} dimensions, ${seed.questions.length} questions`,
    )
  }

  private async removeDeprecatedPreschoolGiftednessSeed() {
    const existing = await this.evaluationRepo.findOne({
      where: { type: EvaluationType.PRESCHOOL_GIFTEDNESS },
    })

    if (!existing) return

    const attemptsCount = await this.attemptRepo.count({
      where: { evaluationId: existing.id },
    })

    if (attemptsCount > 0) {
      this.logger.warn('Deprecated preschool giftedness seed has attempts; leaving it in place')
      return
    }

    await this.evaluationRepo.delete(existing.id)
    this.logger.log(
      'Removed deprecated preschool giftedness seed; Pride is the preschool giftedness scale',
    )
  }

  private likert4Answers(): AnswerSeed[] {
    return [
      { text: 'لا تنطبق', scoreValue: 1, code: 'never' },
      { text: 'نادرا', scoreValue: 2, code: 'rarely' },
      { text: 'غالبا', scoreValue: 3, code: 'often' },
      { text: 'دائما', scoreValue: 4, code: 'always' },
    ]
  }

  private likert5Answers(): AnswerSeed[] {
    return [
      { text: 'أدنى أداء', scoreValue: 1, code: 'one' },
      { text: 'منخفض', scoreValue: 2, code: 'two' },
      { text: 'متوسط', scoreValue: 3, code: 'three' },
      { text: 'مرتفع', scoreValue: 4, code: 'four' },
      { text: 'أعلى أداء', scoreValue: 5, code: 'five' },
    ]
  }

  private yesNoAnswers(): AnswerSeed[] {
    return [
      { text: 'نعم', scoreValue: 2, code: 'yes' },
      { text: 'لا', scoreValue: 1, code: 'no' },
    ]
  }

  private bipolarAnswers(positive: string, negative: string): AnswerSeed[] {
    return [
      { text: positive, scoreValue: 1, code: 'positive' },
      { text: negative, scoreValue: -1, code: 'negative' },
    ]
  }

  private multipleIntelligencesSeed(): EvaluationSeed {
    const dimensions: DimensionSeed[] = [
      { name: 'الذكاء اللغوي', code: 'linguistic', minScore: 3, maxScore: 12 },
      {
        name: 'الذكاء المنطقي الرياضي',
        code: 'logical',
        minScore: 3,
        maxScore: 12,
      },
      { name: 'الذكاء البصري', code: 'spatial', minScore: 3, maxScore: 12 },
      {
        name: 'الذكاء الجسدي الحركي',
        code: 'bodily',
        minScore: 3,
        maxScore: 12,
      },
      { name: 'الذكاء السمعي', code: 'musical', minScore: 3, maxScore: 12 },
      {
        name: 'الذكاء الاجتماعي',
        code: 'interpersonal',
        minScore: 3,
        maxScore: 12,
      },
      {
        name: 'الذكاء الذاتي',
        code: 'intrapersonal',
        minScore: 3,
        maxScore: 12,
      },
      {
        name: 'الذكاء الطبيعي',
        code: 'naturalist',
        minScore: 3,
        maxScore: 12,
      },
    ]

    const byDimension: Record<string, string[]> = {
      linguistic: [
        'لدى طفلي فضول يدفعه لفتح الكتب أو طلب القراءة له',
        'يحب طفلي أن يؤلف القصص أو يتحدث عن يومياته',
        'طفلي يتذكر الكلمات الجديدة التي سمعها ويحاول استخدامها',
      ],
      logical: [
        'يستمتع طفلي بحل الألعاب المعقدة أو التي بها أرقام أو إجراء التجارب',
        'طفلي يطرح الكثير من الأسئلة حول الأشياء ويحاول فهم كل شيء',
        'يستمتع طفلي بالأنشطة التي تتضمن تصنيف الأنماط أو التسلسل أو تتطلب تفكيرا منطقيا',
      ],
      spatial: [
        'يحب طفلي الرسم أو التلوين أو إنشاء أعمال فنية بالمواد المختلفة',
        'تشد انتباه طفلي الخرائط والصور والرسوم البيانية الملونة',
        'يستمتع طفلي ببناء الأشياء وتصميمها ولديه رؤية للشكل النهائي للأشياء',
      ],
      bodily: [
        'طفلي نشيط جدا ويحب الحركة أو الرقص أو الأنشطة التي تتطلب جهدا بدنيا وحركيا',
        'يتعلم طفلي بشكل أفضل حين يمارس الأشياء بجسده مثل بناء الأشياء أو لمسها أو تمثيلها',
        'غالبا يعبر طفلي عن نفسه بالإيماءات بالوجه والجسد',
      ],
      musical: [
        'يستمتع طفلي بالاستماع إلى الأناشيد أو الغناء',
        'يحفظ طفلي غالبا الكلمات والجمل الملحنة ويتذكرها',
        'يحب طفلي أن يدندن ويؤلف الكلمات ويلحنها من نفسه',
      ],
      interpersonal: [
        'طفلي قادر على تكوين العلاقات والصداقات بسهولة',
        'لدى طفلي فهم لما يشعر به الآخرون وغالبا ما يساعدهم',
        'يحب طفلي الأنشطة والألعاب الجماعية وغالبا ما يكون قائدا على أقرانه',
      ],
      intrapersonal: [
        'يفهم ويدرك طفلي المشاعر ويستطيع التعبير عنها بشكل جيد',
        'يستمتع طفلي بقضاء الوقت بمفرده إما بالتفكير والتأمل أو اللعب',
        'يستطيع طفلي تمييز نقاط قوته وضعفه',
      ],
      naturalist: [
        'يستمتع طفلي بأوقات الخروج ويظهر اهتماما بالنباتات والحيوانات والحياة الطبيعية',
        'يفضل طفلي أنشطة مثل الزراعة أو المشي لمسافات طويلة أو استكشاف الطبيعة ورعاية الحيوانات',
        'يسأل طفلي عن البيئة ويستمتع بالتعلم عن الطبيعة',
      ],
    }

    return {
      type: EvaluationType.MULTIPLE_INTELLIGENCES,
      title: 'مؤشر الذكاءات الثمانية',
      ageFrom: 3,
      ageTo: 15,
      evaluatorTypes: ['parent', 'teacher'],
      dimensions,
      questions: Object.entries(byDimension).flatMap(([dimensionCode, items]) =>
        items.map((content) => ({
          content,
          dimensionCode,
          answers: this.likert4Answers(),
        })),
      ),
    }
  }

  private prideSeed(): EvaluationSeed {
    const dimensions: DimensionSeed[] = [
      {
        name: 'تعدد الاهتمامات',
        code: 'multiple_interests',
        minScore: 14,
        maxScore: 70,
      },
      {
        name: 'اللعب الهادف والقبول الاجتماعي',
        code: 'purposeful_play',
        minScore: 5,
        maxScore: 25,
      },
      {
        name: 'التفكير التخيلي والتفاعل الاجتماعي',
        code: 'imaginative_thinking',
        minScore: 10,
        maxScore: 50,
      },
      {
        name: 'الاستقلالية في التفكير',
        code: 'independent_thinking',
        minScore: 13,
        maxScore: 65,
      },
      {
        name: 'الأصالة في التفكير',
        code: 'originality',
        minScore: 8,
        maxScore: 40,
      },
    ]

    const dimensionByQuestion = this.mapQuestionNumbers({
      multiple_interests: [1, 3, 6, 11, 16, 18, 20, 24, 27, 28, 39, 43, 45, 49],
      purposeful_play: [2, 7, 21, 23, 34],
      imaginative_thinking: [8, 9, 10, 13, 19, 22, 26, 40, 47, 50],
      independent_thinking: [4, 5, 12, 17, 29, 30, 32, 33, 36, 37, 38, 42, 46],
      originality: [14, 15, 25, 31, 35, 41, 44, 48],
    })

    const questions = [
      'يهتم طفلي بالأشياء من حوله لفترة طويلة.',
      'يحب طفلي أن أروي له القصص.',
      'يسأل طفلي أسئلة كثيرة ومتنوعة.',
      'يندفع طفلي بسرعة نحو الأشياء (الألعاب).',
      'يميل طفلي إلى التفكير في الأشياء المطروحة عليه.',
      'يميل طفلي إلى استطلاع الأشياء من حوله.',
      'يقضي طفلي وقتا طويلا في الألعاب الإيهامية.',
      'نتبادل أنا وطفلي النكات والمداعبات اللفظية.',
      'لدى طفلي أصدقاء وهميون.',
      'يسأل طفلي أسئلة غير عادية أعلى من عمره الزمني.',
      'يرغب طفلي في اللعب معي ولكني لا أجد الوقت الكافي لذلك.',
      'يحب طفلي اللعب منفردا.',
      'يحب طفلي اختراع النكات.',
      'يبدو طفلي مبدعا إلى درجة كبيرة.',
      'يؤلف أغاني جديدة.',
      'يهتم طفلي بالكتب وخاصة كتب من هم أكبر منه.',
      'يبدي طفلي مللا من الأشياء المعروضة عليه.',
      'يحلل طفلي الأشياء من حوله ليرى كيف تعمل.',
      'يستمتع طفلي باللعب الإيهامي التخيلي.',
      'يبدي طفلي كثيرا من الميول والاهتمامات.',
      'يستمتع طفلي بعملية دهن الأشياء (الرسم على الجدران).',
      'يتأمل طفلي في الأشياء أكثر من اندفاعه نحوها.',
      'يبادلني طفلي الضحك كثيرا.',
      'لدى طفلي ميول كثيرة ومتعددة.',
      'يبدي طفلي أفكارا غير عادية.',
      'يعمل طفلي ما يقوم به الآخرون.',
      'يقوم طفلي بعمل شيئين لا يعملا معا عادة (كالرسم والغناء مثلا).',
      'يبدي طفلي اهتماما سريعا بالأشياء من حوله.',
      'يقوم طفلي بعمل أشياء لا يقوم بها الآخرون.',
      'يهتم طفلي بتعلم الأشياء الجديدة.',
      'يعزف طفلي على آلة موسيقية بطريقة جديدة.',
      'يقوم طفلي بعمل الأشياء الصعبة (حل وتركيب الأشياء) وحده.',
      'يعتمد طفلي على نفسه.',
      'يحب طفلي أن يلون الصور التي يرسمها بطريقة مفيدة.',
      'يحب طفلي حل الألغاز بطرق جديدة.',
      'يميل طفلي للذهاب إلى مكان جديد.',
      'يميل طفلي إلى ما هو أكثر صعوبة وحده.',
      'يحب طفلي أن يمشي منفردا.',
      'يجمع طفلي أشياء متنوعة (طوابع وصور...).',
      'يحب طفلي أن يلعب في الخارج مع الآخرين.',
      'يحب طفلي أن يجرب الأشياء الجديدة.',
      'يفضل طفلي أن يلون على كتب التلوين ليكون الصورة الخاصة به.',
      'يهتم طفلي بالفنون (الرسم، التمثيل، الموسيقى، الرياضة).',
      'يصف طفلي الأشياء التي يراها بطريقة غير عادية.',
      'يحب طفلي أن يبني أشياء صعبة (بيت، لعبة، باستعمال أدوات اللعب، ليغو).',
      'يحب طفلي أن يختار ملابسه بنفسه.',
      'يروي طفلي أشياء مضحكة في الغالب (نكتة، طرفة...).',
      'يشير طفلي إلى الأشياء غير العادية من حوله غالبا.',
      'يحب طفلي قصص الحيوانات.',
      'يبدو أن طفلي قادر على فهم الأشياء من وجهة نظر الآخرين.',
    ]

    return {
      type: EvaluationType.PRIDE,
      title: 'مقياس برايد للكشف عن الأطفال الموهوبين لما قبل المدرسة',
      ageFrom: 3,
      ageTo: 6,
      evaluatorTypes: ['parent', 'teacher'],
      dimensions,
      questions: questions.map((content, index) => ({
        content,
        dimensionCode: dimensionByQuestion.get(index + 1)!,
        answers: this.likert5Answers(),
      })),
    }
  }

  private renzulliSeed(): EvaluationSeed {
    const dimensions: DimensionSeed[] = [
      {
        name: 'الصفات الإبداعية',
        code: 'creativity',
        minScore: 9,
        maxScore: 36,
      },
      {
        name: 'الصفات القيادية',
        code: 'leadership',
        minScore: 10,
        maxScore: 40,
      },
      {
        name: 'الدافعية',
        code: 'motivation',
        minScore: 9,
        maxScore: 36,
      },
      {
        name: 'الصفات التعلمية',
        code: 'learning',
        minScore: 8,
        maxScore: 32,
      },
    ]

    const byDimension: Record<string, string[]> = {
      creativity: [
        'أحب الاستطلاع، أسأل عن كل شيء.',
        'أعرض أفكارا وحلولا لمشاكل أو مسائل متعددة.',
        'أعبر عن رأيي بجرأة.',
        'أنا على قدر عال من الشغف لاكتشاف الغامض.',
        'أتميز بسرعة البديهة وسعة الخيال.',
        'أتمتع بروح الدعابة والطرفة والفكاهة.',
        'إني مرهف الحس وسريع التأثر عاطفيا.',
        'لدي إحساس فني (أتذوق الأشياء الجميلة).',
        'أتميز بالنقد البناء.',
      ],
      leadership: [
        'كفء في تحمل المسؤوليات.',
        'قادر على إقناع الآخرين.',
        'محبوب بين زملائي.',
        'يألفني الآخرون.',
        'أعبر عما يدور في خاطري بوضوح.',
        'أتطوع للقيام بأعمال غير مطلوبة مني.',
        'أفضل الحياة الجماعية.',
        'أسيطر على من حولي، وأدير الأنشطة التي أشارك فيها.',
        'أشارك في الأنشطة المدرسية.',
        'أنسجم بسهولة مع الآخرين في العمل الجماعي.',
      ],
      motivation: [
        'أسعى إلى إتقان أي عمل أرغبه أو أكلف به.',
        'أنزعج من الأعمال الروتينية.',
        'أحتاج إلى قليل من الحث لإتمام عملي.',
        'أسعى إلى إتمام عملي بحرص شديد.',
        'أفضل العمل بمفردي.',
        'أهتم بأمور الكبار التي لا يبدي من هو في سني أي اهتمام لها.',
        'أتصف بالحزم.',
        'أحب تنظيم الأشياء والعيش بطريقة منظمة.',
        'أفرق بين الأشياء الحسنة والسيئة.',
      ],
      learning: [
        'أمتلك حصيلة لغوية ومصطلحات تفوق مستوى عمري.',
        'أمتلك حصيلة كبيرة من المعلومات في مواضيع شتى.',
        'أتصف بسرعة وقوة الذاكرة.',
        'أحلل الوقائع وأتوقع النتائج.',
        'ملم ببعض القواعد التي تساعدني على الاستنتاج.',
        'أرى الأشياء من زوايا مختلفة.',
        'أحب القراءة والمطالعة لمواضيع تفوق مستوى سني.',
        'أقيس وأحلل الأمور المعقدة.',
      ],
    }

    return {
      type: EvaluationType.RENZULLI,
      title: 'مقياس رنزولي للسمات السلوكية للطلبة الموهوبين',
      ageFrom: 7,
      ageTo: 18,
      evaluatorTypes: ['student'],
      dimensions,
      questions: Object.entries(byDimension).flatMap(([dimensionCode, items]) =>
        items.map((content) => ({
          content,
          dimensionCode,
          answers: this.likert4Answers(),
        })),
      ),
    }
  }

  private hollandSeed(): EvaluationSeed {
    const dimensions: DimensionSeed[] = [
      {
        name: 'المقياس الواقعي',
        code: 'realistic',
        minScore: 14,
        maxScore: 28,
      },
      {
        name: 'المقياس العقلي',
        code: 'investigative',
        minScore: 14,
        maxScore: 28,
      },
      { name: 'المقياس الاجتماعي', code: 'social', minScore: 14, maxScore: 28 },
      {
        name: 'المقياس التقليدي',
        code: 'conventional',
        minScore: 14,
        maxScore: 28,
      },
      {
        name: 'المقياس المغامر',
        code: 'enterprising',
        minScore: 14,
        maxScore: 28,
      },
      { name: 'المقياس الفني', code: 'artistic', minScore: 14, maxScore: 28 },
    ]

    const dimensionByQuestion = this.mapQuestionNumbers({
      realistic: [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 17],
      investigative: [14, 15, 16, 33, 34, 35, 36, 37, 38, 39, 40, 41, 42, 43],
      social: [82, 56, 55, 54, 53, 52, 51, 50, 49, 48, 47, 46, 45, 44],
      conventional: [84, 83, 68, 29, 28, 26, 25, 24, 23, 22, 21, 20, 19, 18],
      enterprising: [67, 66, 65, 64, 63, 62, 61, 60, 58, 57, 32, 31, 30, 27],
      artistic: [81, 80, 79, 78, 77, 76, 75, 74, 73, 72, 71, 70, 69, 59],
    })

    const jobs = [
      'ميكانيكي سيارات',
      'سائق',
      'نجار',
      'طباخ',
      'مقاول بناء',
      'ضابط أمن',
      'مساح أراضي',
      'مهندس إنتاج',
      'حداد',
      'ضابط في الجيش',
      'كهربائي سيارات',
      'عامل بناء',
      'مزارع',
      'خبير أرصاد جوية',
      'صيدلي',
      'عالم في الكيمياء',
      'مشغل محطة كهربائية',
      'مدقق في بنك',
      'مراقب جودة إنتاج في مصنع',
      'أمين مستودع',
      'خبير ضرائب',
      'موظف مصرفي في بنك',
      'كاتب على الحاسب',
      'محاسب',
      'عامل في محطة بنزين',
      'إحصائي',
      'منظم حفلات وفعاليات',
      'كاتب جداول رواتب',
      'مساعد إداري',
      'محامي',
      'قاضي',
      'تاجر',
      'طبيب جراح',
      'كاتب مقالات علمية',
      'محلل نظم',
      'عالم فلك',
      'عالم أحياء',
      'مهندس تصميم',
      'عالم نفس تربوي',
      'دكتور في الجامعة',
      'عالم نبات',
      'عالم فيزياء',
      'متخصص في علم الحيوان',
      'مرشد تربوي',
      'طبيب نفسي',
      'باحث اجتماعي',
      'إمام جامع',
      'مدرس مواد اجتماعية',
      'رئيس لجنة اجتماعية',
      'معالج نطق',
      'معالج مهني',
      'ممرض',
      'مدير مؤسسة خيرية',
      'طبيب',
      'عالم اجتماع',
      'مساعد مدير مدرسة',
      'محقق جنائي',
      'دبلوماسي',
      'مخرج تلفزيوني',
      'مدير مبيعات',
      'بائع عقارات',
      'رئيس غرفة تجارية',
      'مدير مشروع',
      'طيار',
      'مدير دعاية وإعلان',
      'معلق سياسي',
      'صاحب مصنع',
      'باحث علمي',
      'معماري',
      'ممثل',
      'مصمم أزياء',
      'شاعر',
      'رسام إعلانات تجارية',
      'مصور',
      'مدرب مسرح',
      'كاتب روايات مسرحية',
      'مؤلف أدبي',
      'قائد فرقة مسرحية',
      'مصمم داخلي',
      'مغني في فرقة موسيقية',
      'رسام كاريكاتير',
      'واعظ ديني',
      'كاتب ديوان',
      'سكرتير',
    ]

    return {
      type: EvaluationType.HOLLAND,
      title: 'مقياس هولاند للميول المهنية',
      ageFrom: 16,
      ageTo: 18,
      evaluatorTypes: ['student'],
      dimensions,
      questions: jobs.map((job, index) => ({
        content: `هل تفضل مهنة: ${job}؟`,
        dimensionCode: dimensionByQuestion.get(index + 1)!,
        answers: this.yesNoAnswers(),
      })),
    }
  }

  private learningStylesSeed(): EvaluationSeed {
    const dimensions: DimensionSeed[] = [
      {
        name: 'البصري - اللفظي',
        code: 'visual_verbal',
        minScore: -11,
        maxScore: 11,
        interpretationRules: {
          positivePole: 'البصري',
          negativePole: 'اللفظي',
        },
      },
      {
        name: 'العملي - التأملي',
        code: 'active_reflective',
        minScore: -11,
        maxScore: 11,
        interpretationRules: {
          positivePole: 'العملي',
          negativePole: 'التأملي',
        },
      },
      {
        name: 'التتابعي - الكلي',
        code: 'sequential_global',
        minScore: -11,
        maxScore: 11,
        interpretationRules: {
          positivePole: 'التتابعي',
          negativePole: 'الكلي',
        },
      },
      {
        name: 'الحسي - الحدسي',
        code: 'sensing_intuitive',
        minScore: -11,
        maxScore: 11,
        interpretationRules: {
          positivePole: 'الحسي',
          negativePole: 'الحدسي',
        },
      },
    ]

    const groups = [
      {
        dimensionCode: 'visual_verbal',
        pairs: [
          ['عندما أفكر في ما فعلت بالأمس، يكون ذلك من خلال', 'الصور', 'الكلمات'],
          [
            'أفضل الحصول على المعلومات الجديدة من خلال',
            'صور أو مخططات أو رسوم بيانية أو خرائط',
            'إشارات مكتوبة أو معلومات لفظية',
          ],
          [
            'في كتاب يحتوي الكثير من الصور والمخططات أميل إلى',
            'استعراض الصور والمخططات بعناية',
            'التركيز على النص المكتوب',
          ],
          [
            'أحب المعلمين',
            'الذين يضعون العديد من المخططات على السبورة',
            'الذين يقضون وقتا كبيرا في الشرح',
          ],
          ['أتذكر أفضل', 'ما أرى', 'ما أسمع'],
          ['أفضل أن أحصل على وصف مكان ما من خلال', 'خريطة', 'تعليمات مكتوبة'],
          ['عندما أرى مخططا أو رسما بيانيا في المحاضرة، أتذكر', 'الصورة', 'ما قاله المحاضر حوله'],
          [
            'عندما يقوم شخص ما بعرض بيانات علي فإنني أفضل',
            'مخططات أو رسوم بيانية',
            'نصا يلخص النتائج',
          ],
          ['عندما أقابل أشخاصا في حفلة، أتذكرهم', 'بما يناسبهم', 'بما قالوا عن أنفسهم'],
          ['للتسلية أو الترفيه أفضل', 'مشاهدة التلفزيون', 'قراءة كتاب'],
          ['أميل إلى تصوير الأماكن', 'إلى حد ما بسهولة ودقة', 'بصعوبة وبدون تفاصيل كثيرة'],
        ],
      },
      {
        dimensionCode: 'active_reflective',
        pairs: [
          ['أفهم الأشياء أفضل بعد أن', 'أقوم بتنفيذها', 'أفكر فيها'],
          ['عندما أتعلم شيئا جديدا يساعدني ذلك في', 'التحدث عنه', 'التفكير فيه'],
          [
            'في مجموعات العمل الدراسية لمادة صعبة، أهتم أكثر بـ',
            'الأمثلة المساعدة',
            'الجلوس والإصغاء',
          ],
          [
            'في الفصول التي أدرس بها',
            'عادة ما أتعرف على الكثير من الطلاب',
            'نادرا ما أتعرف على الكثير من الطلاب',
          ],
          [
            'عندما أبدأ في حل الواجبات المنزلية فإن أكثر ما يناسبني',
            'بدء العمل في الحل مباشرة',
            'محاولة فهم المشكلة أولا',
          ],
          ['أفضل أن أدرس من خلال', 'مجموعة', 'منفردا'],
          ['أفضل أولا', 'المحاولة في الأشياء', 'التفكير في كيفية عملها'],
          ['أفكر بسهولة في', 'الأشياء التي عملتها', 'الأشياء التي فكرت فيها كثيرا'],
          [
            'عندما أعمل في مشروع جماعي فإنني أريد أن أبدأ',
            'بالعصف الذهني الجماعي حيث يساهم كل فرد بأفكاره',
            'بالعصف الذهني الفردي ثم طرح الأفكار مع الجماعة للمقارنة بينها',
          ],
          ['أنا على الأرجح أعتبر', 'منفتحا', 'محافظا'],
          [
            'فكرة القيام بالواجبات المنزلية في مجموعات مع إعطاء درجة واحدة للمجموعة كلها',
            'تناسبني',
            'لا تناسبني',
          ],
        ],
      },
      {
        dimensionCode: 'sequential_global',
        pairs: [
          [
            'أميل إلى',
            'فهم تفاصيل الموضوع لأن البناء العام ربما يكون غامضا',
            'فهم البناء العام لأن التفاصيل ربما تكون غامضة',
          ],
          ['أبدأ بفهم', 'جميع الأجزاء حتى أفهم الشيء بالكامل', 'الشيء بالكامل حتى أفهم الأجزاء'],
          [
            'عندما أحل المشكلات الرياضية',
            'عادة ما أعمل على الوصول إلى الحل خطوة خطوة في الوقت المحدد',
            'غالبا ما أتوصل إلى الحلول لكن بعد الصراع مع الخطوات المؤدية للحل',
          ],
          [
            'عندما أقوم بتحليل قصة أو رواية',
            'أفكر في الأحداث وأحاول تجميعها لاكتشاف الموضوع',
            'أعرف فقط الموضوعات وبعد أن أنهي قراءتها أعود للأحداث التي تفسرها',
          ],
          [
            'الأكثر أهمية عندي بالنسبة للمحاضر أن',
            'يعرض المادة في خطوات متسلسلة واضحة',
            'يعطيني صورة عامة ويربط بين المادة والموضوعات الأخرى',
          ],
          ['أتعلم', 'بسرعة مناسبة إذا كانت الدراسة صعبة', 'بداية بسرعة ثم أرتبك فجأة ثم أفهم'],
          [
            'لفهم كمية من المعلومات أميل إلى',
            'التركيز على التفاصيل وأهمل الصورة العامة',
            'فهم الصورة العامة قبل الدخول في التفاصيل',
          ],
          [
            'عند كتابة ورقة أميل إلى',
            'العمل على التفكير أو الكتابة في بداية الورقة ثم التقدم إلى الأمام',
            'العمل على التفكير أو الكتابة في أجزاء مختلفة من الورقة ثم أرتبها',
          ],
          [
            'عندما أتعلم موضوعا جديدا أفضل',
            'التركيز على الموضوع والتعلم أكثر حوله قدر الإمكان',
            'محاولة عمل ارتباطات بين الموضوع والموضوعات ذات الصلة',
          ],
          [
            'بعض الأساتذة يقدمون لمحاضراتهم بملخص لما سيعطونه وهذه الملخصات تكون',
            'مفيدة لي إلى حد ما',
            'مفيدة جدا لي',
          ],
          [
            'عندما أحل المشكلات في جماعة، أميل إلى',
            'التفكير في خطوات عملية الحل',
            'التفكير في النتائج المحتملة أو تطبيقات الحل في مدى أوسع',
          ],
        ],
      },
      {
        dimensionCode: 'sensing_intuitive',
        pairs: [
          ['أفضل أن أكون', 'واقعيا', 'إبداعيا'],
          [
            'إذا كنت معلما أفضل تدريس المقرر من خلال',
            'التعامل مع الحقائق والمواقف الحياتية الواقعية',
            'التعامل مع الأفكار والنظريات',
          ],
          ['أجد من السهل', 'تعلم الحقائق', 'تعلم المفاهيم'],
          [
            'عند قراءة القصص أفضل',
            'الشيء الذي يعلمني حقائق جديدة، أو الذي يخبرني كيف أعمل شيئا ما',
            'الشيء الذي يعطيني أفكارا جديدة للتفكير',
          ],
          ['أفضل الأفكار', 'الواقعية', 'النظرية'],
          ['من الأكثر أهمية لي أن', 'أحرص على تفاصيل أعمالي', 'أكون مبدعا في تنفيذ أعمالي'],
          [
            'عندما أقرأ للاستمتاع أميل إلى الكتاب الذين',
            'يقولون بوضوح ما يعنون',
            'يرون الأشياء بطرق إبداعية ومثيرة',
          ],
          [
            'عندما أنفذ مهمة أفضل',
            'إتقان طريقة واحدة للعمل',
            'محاولة معرفة طرق جديدة للقيام بالعمل',
          ],
          ['أعتبر أن الثناء يصف الشخص', 'بالعاقل', 'بالتحليلي'],
          [
            'أفضل المقررات التي تركز على',
            'مواد واقعية (حقائق وبيانات)',
            'مواد مجردة (مفاهيم ونظريات)',
          ],
          [
            'عندما أنجز حسابات طويلة',
            'أميل إلى تكرار خطوات وأراجع عملي بعناية',
            'أجد التدقيق في العمل متعبا وأجد نفسي مجبرا على ذلك',
          ],
        ],
      },
    ]

    return {
      type: EvaluationType.LEARNING_STYLES,
      title: 'مقياس أساليب التعلم لفلدر وسيلفرمان',
      ageFrom: 13,
      ageTo: 18,
      evaluatorTypes: ['parent', 'teacher'],
      dimensions,
      questions: groups.flatMap((group) =>
        group.pairs.map(([content, positive, negative]) => ({
          content,
          dimensionCode: group.dimensionCode,
          answers: this.bipolarAnswers(positive, negative),
        })),
      ),
    }
  }

  private torranceSeed(): EvaluationSeed {
    return {
      type: EvaluationType.TORRANCE,
      title: 'مقياس تورانس للتفكير الإبداعي TTCT',
      ageFrom: 4,
      ageTo: 18,
      evaluatorTypes: ['teacher', 'specialist'],
      dimensions: [],
      questions: [],
    }
  }

  private mapQuestionNumbers(source: Record<string, number[]>): Map<number, string> {
    const map = new Map<number, string>()
    for (const [dimensionCode, numbers] of Object.entries(source)) {
      for (const questionNumber of numbers) {
        map.set(questionNumber, dimensionCode)
      }
    }
    return map
  }
}
