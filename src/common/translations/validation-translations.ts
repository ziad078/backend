/**
 * Maps class-validator constraint names to i18n translation keys.
 *
 * Each key is the constraint method name from class-validator.
 * The frontend uses the translation key + context to render localized messages.
 */
export const VALIDATION_CONSTRAINT_TRANSLATIONS: Record<string, string> = {
  isEmail: 'validation.isEmail',
  isNotEmpty: 'validation.required',
  isEmpty: 'validation.mustBeEmpty',
  isString: 'validation.isString',
  isNumber: 'validation.isNumber',
  isBoolean: 'validation.isBoolean',
  isDate: 'validation.isDate',
  isEnum: 'validation.invalidEnum',
  isUuid: 'validation.invalidUuid',
  isArray: 'validation.isArray',
  isObject: 'validation.isObject',
  isPositive: 'validation.isPositive',
  isNegative: 'validation.isNegative',
  isInt: 'validation.isInteger',
  isFloat: 'validation.isDecimal',
  minLength: 'validation.minLength',
  maxLength: 'validation.maxLength',
  min: 'validation.min',
  max: 'validation.max',
  matches: 'validation.pattern',
  isPhoneNumber: 'validation.invalidPhone',
  arrayMinSize: 'validation.arrayMinSize',
  arrayMaxSize: 'validation.arrayMaxSize',
  arrayNotEmpty: 'validation.arrayNotEmpty',
  isStrongPassword: 'validation.weakPassword',
  isAfter: 'validation.dateAfter',
  isBefore: 'validation.dateBefore',
  isIPAddress: 'validation.invalidIp',
  isJSON: 'validation.invalidJson',
  isUrl: 'validation.invalidUrl',
  isCreditCard: 'validation.invalidCreditCard',
  isMimeType: 'validation.invalidMimeType',
  contains: 'validation.contains',
  notContains: 'validation.notContains',
  isAlpha: 'validation.isAlpha',
  isAlphanumeric: 'validation.isAlphanumeric',
  isNumeric: 'validation.isNumeric',
  isLowercase: 'validation.isLowercase',
  isUppercase: 'validation.isUppercase',
  isFQDN: 'validation.invalidDomain',
  isHexColor: 'validation.invalidHexColor',
  isPostalCode: 'validation.invalidPostalCode',
  isValidBirthDate: 'validation.invalidBirthDate',
}

/**
 * Extract context values from class-validator constraints.
 * Returns interpolation parameters for the frontend i18n library.
 */
export function extractValidationContext(
  constraintName: string,
  constraints: unknown[],
  validationValue?: unknown,
): Record<string, unknown> | undefined {
  switch (constraintName) {
    case 'minLength':
      return { min: constraints[0] as number }
    case 'maxLength':
      return { max: constraints[0] as number }
    case 'min':
      return { min: constraints[0] as number }
    case 'max':
      return { max: constraints[0] as number }
    case 'arrayMinSize':
      return { min: constraints[0] as number }
    case 'arrayMaxSize':
      return { max: constraints[0] as number }
    case 'isEnum':
      return { values: constraints[0] as string[] }
    case 'matches':
      return { pattern: String(constraints[0]) }
    case 'minLength':
      return { min: constraints[0] as number }
    default:
      return undefined
  }
}

/**
 * Resolve a class-validator constraint name to its translation key.
 * Falls back to a generic key if not found.
 */
export function resolveValidationTranslation(constraintName: string): string {
  return VALIDATION_CONSTRAINT_TRANSLATIONS[constraintName] ?? 'validation.invalid'
}
