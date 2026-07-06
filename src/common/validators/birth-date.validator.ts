import {
  registerDecorator,
  ValidationOptions,
  ValidatorConstraint,
  ValidatorConstraintInterface,
} from 'class-validator'

@ValidatorConstraint({ name: 'isValidBirthDate', async: false })
export class IsValidBirthDateConstraint implements ValidatorConstraintInterface {
  validate(value: string) {
    if (!value) return false
    const date = new Date(value)
    if (Number.isNaN(date.getTime())) return false

    const today = new Date()
    today.setHours(23, 59, 59, 999)
    if (date > today) return false

    const minAgeDate = new Date()
    minAgeDate.setFullYear(minAgeDate.getFullYear() - 25)
    if (date < minAgeDate) return false

    return true
  }

  defaultMessage() {
    return 'birthDate must be a valid date, not in the future, and within a reasonable age range'
  }
}

export function IsValidBirthDate(validationOptions?: ValidationOptions) {
  return function (object: object, propertyName: string) {
    registerDecorator({
      target: object.constructor,
      propertyName,
      options: validationOptions,
      constraints: [],
      validator: IsValidBirthDateConstraint,
    })
  }
}
