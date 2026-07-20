/**
 * Centralized translation key registry.
 *
 * Every key maps an ApiErrorCodes value to its i18n translation key.
 * The frontend receives the translation key and resolves it via next-intl.
 *
 * Naming convention:
 *   errors.<domain>.<specific>
 *   validation.<constraint>
 */

// ─── Auth ────────────────────────────────────────────────
export const AUTH_TRANSLATIONS = {
  'AUTH.UNAUTHORIZED': 'errors.auth.unauthorized',
  'AUTH.INVALID_CREDENTIALS': 'errors.auth.invalidCredentials',
  'AUTH.FORBIDDEN': 'errors.auth.forbidden',
  'AUTH.REFRESH_TOKEN_MISSING': 'errors.auth.refreshTokenMissing',
  'AUTH.SESSION_COMPROMISED': 'errors.auth.sessionCompromised',
  'AUTH.TOKEN_INVALID': 'errors.auth.tokenInvalid',
  'AUTH.TOKEN_EXPIRED': 'errors.auth.tokenExpired',
  'AUTH.LOGOUT_FAILED': 'errors.auth.logoutFailed',
} as const

// ─── Users ───────────────────────────────────────────────
export const USER_TRANSLATIONS = {
  'USER.NOT_FOUND': 'errors.user.notFound',
  'USER.EMAIL_IN_USE': 'errors.user.emailInUse',
  'USER.PHONE_IN_USE': 'errors.user.phoneInUse',
  'USER.ALREADY_EXISTS': 'errors.user.alreadyExists',
} as const

// ─── Parents ─────────────────────────────────────────────
export const PARENT_TRANSLATIONS = {
  'PARENT.PROFILE_NOT_FOUND': 'errors.parent.profileNotFound',
  'PARENT.ROLE_CONFIRMATION_REQUIRED': 'errors.parent.roleConfirmationRequired',
} as const

// ─── Organizations ───────────────────────────────────────
export const ORGANIZATION_TRANSLATIONS = {
  'ORGANIZATION.NOT_FOUND': 'errors.organization.notFound',
  'ORGANIZATION.ALREADY_EXISTS': 'errors.organization.alreadyExists',
  'ORGANIZATION.NOT_APPROVED': 'errors.organization.notApproved',
  'ORGANIZATION.ALREADY_APPROVED': 'errors.organization.alreadyApproved',
  'ORGANIZATION.ALREADY_REJECTED': 'errors.organization.alreadyRejected',
} as const

// ─── Children ────────────────────────────────────────────
export const CHILD_TRANSLATIONS = {
  'CHILD.NOT_FOUND': 'errors.child.notFound',
  'CHILD.LIMIT_REACHED': 'errors.child.limitReached',
  'CHILD.ACCESS_DENIED': 'errors.child.accessDenied',
  'CHILD.ALREADY_ASSIGNED': 'errors.child.alreadyAssigned',
  'CHILD.INVALID_TYPE': 'errors.child.invalidType',
  'CHILD.DUPLICATE': 'errors.child.duplicate',
} as const

// ─── Grades ──────────────────────────────────────────────
export const GRADE_TRANSLATIONS = {
  'GRADE.NOT_FOUND': 'errors.grade.notFound',
  'GRADE.ALREADY_EXISTS': 'errors.grade.alreadyExists',
} as const

// ─── Classes ─────────────────────────────────────────────
export const CLASS_TRANSLATIONS = {
  'CLASS.NOT_FOUND': 'errors.class.notFound',
  'CLASS.ALREADY_EXISTS': 'errors.class.alreadyExists',
  'CLASS.FULL': 'errors.class.full',
} as const

// ─── Teachers ────────────────────────────────────────────
export const TEACHER_TRANSLATIONS = {
  'TEACHER.NOT_FOUND': 'errors.teacher.notFound',
  'TEACHER.ALREADY_EXISTS': 'errors.teacher.alreadyExists',
  'TEACHER.EMAIL_IMMUTABLE': 'errors.teacher.emailImmutable',
  'TEACHER.PHONE_IMMUTABLE': 'errors.teacher.phoneImmutable',
} as const

// ─── Evaluations ─────────────────────────────────────────
export const EVALUATION_TRANSLATIONS = {
  'EVALUATION.NOT_FOUND': 'errors.evaluation.notFound',
  'EVALUATION.ATTEMPT_NOT_FOUND': 'errors.evaluation.attemptNotFound',
  'EVALUATION.ATTEMPT_LOCKED': 'errors.evaluation.attemptLocked',
  'EVALUATION.MAX_ATTEMPTS_REACHED': 'errors.evaluation.maxAttemptsReached',
  'EVALUATION.DIMENSION_MISSING': 'errors.evaluation.dimensionMissing',
  'EVALUATION.DUPLICATE_DIMENSIONS': 'errors.evaluation.duplicateDimensions',
  'EVALUATION.DUPLICATE_ANSWERS': 'errors.evaluation.duplicateAnswers',
  'EVALUATION.INVALID_TRANSITION': 'errors.evaluation.invalidTransition',
  'EVALUATION.SLOT_NOT_FOUND': 'errors.evaluation.slotNotFound',
  'EVALUATION.INVALID_QUESTION': 'errors.evaluation.invalidQuestion',
  'EVALUATION.INVALID_ANSWER': 'errors.evaluation.invalidAnswer',
  'EVALUATION.NOT_SUITABLE_AGE': 'errors.evaluation.notSuitableAge',
  'EVALUATION.NOT_AVAILABLE': 'errors.evaluation.notAvailable',
} as const

// ─── Payments ────────────────────────────────────────────
export const PAYMENT_TRANSLATIONS = {
  'PAYMENT.NOT_FOUND': 'errors.payment.notFound',
  'PAYMENT.FAILED': 'errors.payment.failed',
  'PAYMENT.EXPIRED': 'errors.payment.expired',
  'PAYMENT.MAX_RETRIES': 'errors.payment.maxRetries',
  'PAYMENT.INVALID_PROVIDER': 'errors.payment.invalidProvider',
  'PAYMENT.CURRENCY_NOT_SUPPORTED': 'errors.payment.currencyNotSupported',
  'PAYMENT.WEBHOOK_INVALID': 'errors.payment.webhookInvalid',
  'PAYMENT.WEBHOOK_MISSING': 'errors.payment.webhookMissing',
  'PAYMENT.PROVIDER_UNAVAILABLE': 'errors.payment.providerUnavailable',
  'PAYMENT.INVALID_JSON': 'errors.payment.invalidJson',
} as const

// ─── Deals ───────────────────────────────────────────────
export const DEAL_TRANSLATIONS = {
  'DEAL.NOT_FOUND': 'errors.deal.notFound',
  'DEAL.CLOSED': 'errors.deal.closed',
  'DEAL.DEADLINE_PASSED': 'errors.deal.deadlinePassed',
  'DEAL.DUPLICATE_PROPOSAL': 'errors.deal.duplicateProposal',
  'DEAL.CANNOT_CREATE': 'errors.deal.cannotCreate',
  'DEAL.PROPOSAL_NOT_FOUND': 'errors.deal.proposalNotFound',
  'DEAL.PROPOSAL_INVALID_STATE': 'errors.deal.proposalInvalidState',
} as const

// ─── Activities ──────────────────────────────────────────
export const ACTIVITY_TRANSLATIONS = {
  'ACTIVITY.NOT_FOUND': 'errors.activity.notFound',
  'ACTIVITY.HAS_DEALS': 'errors.activity.hasDeals',
} as const

// ─── Transfers ───────────────────────────────────────────
export const TRANSFER_TRANSLATIONS = {
  'TRANSFER.NOT_FOUND': 'errors.transfer.notFound',
  'TRANSFER.ALREADY_RESOLVED': 'errors.transfer.alreadyResolved',
  'TRANSFER.INVALID_CHILD_TYPE': 'errors.transfer.invalidChildType',
} as const

// ─── Notifications ───────────────────────────────────────
export const NOTIFICATION_TRANSLATIONS = {
  'NOTIFICATION.NOT_FOUND': 'errors.notification.notFound',
  'NOTIFICATION.EMAIL_REQUIRED': 'errors.notification.emailRequired',
} as const

// ─── Sessions ────────────────────────────────────────────
export const SESSION_TRANSLATIONS = {
  'SESSION.EXPIRED': 'errors.session.expired',
  'SESSION.NOT_FOUND': 'errors.session.notFound',
} as const

// ─── Capacity ────────────────────────────────────────────
export const CAPACITY_TRANSLATIONS = {
  'CAPACITY.NOT_FOUND': 'errors.capacity.notFound',
  'CAPACITY.ACCESS_DENIED': 'errors.capacity.accessDenied',
} as const

// ─── Database ────────────────────────────────────────────
export const DATABASE_TRANSLATIONS = {
  'DB.UNIQUE_VIOLATION': 'errors.database.duplicateKey',
  'DB.FOREIGN_KEY_VIOLATION': 'errors.database.foreignKeyViolation',
  'DB.NOT_NULL_VIOLATION': 'errors.database.notNullViolation',
  'DB.CHECK_VIOLATION': 'errors.database.checkViolation',
  'DB.ERROR': 'errors.database.genericError',
} as const

// ─── Validation ──────────────────────────────────────────
export const VALIDATION_TRANSLATIONS = {
  'VALIDATION.FAILED': 'errors.validation.failed',
  'VALIDATION.INVALID_UUID': 'errors.validation.invalidUuid',
  'VALIDATION.INVALID_BIRTH_DATE': 'errors.validation.invalidBirthDate',
  'VALIDATION.IS_EMAIL': 'errors.validation.isEmail',
  'VALIDATION.REQUIRED': 'errors.validation.required',
  'VALIDATION.PARENT_NAME_REQUIRED': 'errors.validation.parentNameRequired',
} as const

// ─── Generic HTTP ────────────────────────────────────────
export const COMMON_TRANSLATIONS = {
  'RATE_LIMIT.EXCEEDED': 'errors.common.tooManyRequests',
  'INTERNAL.UNEXPECTED': 'errors.common.internalServerError',
} as const

// ─── Combined map ────────────────────────────────────────
export const ERROR_CODE_TO_TRANSLATION: Record<string, string> = {
  ...AUTH_TRANSLATIONS,
  ...USER_TRANSLATIONS,
  ...PARENT_TRANSLATIONS,
  ...ORGANIZATION_TRANSLATIONS,
  ...CHILD_TRANSLATIONS,
  ...GRADE_TRANSLATIONS,
  ...CLASS_TRANSLATIONS,
  ...TEACHER_TRANSLATIONS,
  ...EVALUATION_TRANSLATIONS,
  ...PAYMENT_TRANSLATIONS,
  ...DEAL_TRANSLATIONS,
  ...ACTIVITY_TRANSLATIONS,
  ...TRANSFER_TRANSLATIONS,
  ...NOTIFICATION_TRANSLATIONS,
  ...SESSION_TRANSLATIONS,
  ...CAPACITY_TRANSLATIONS,
  ...DATABASE_TRANSLATIONS,
  ...VALIDATION_TRANSLATIONS,
  ...COMMON_TRANSLATIONS,
}

/**
 * Resolve an ApiErrorCodes value to its i18n translation key.
 * Falls back to a generic key if not found.
 */
export function resolveTranslation(code: string): string {
  return ERROR_CODE_TO_TRANSLATION[code] ?? 'errors.common.internalServerError'
}
