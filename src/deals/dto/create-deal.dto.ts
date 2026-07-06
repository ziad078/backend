import { ApiProperty } from '@nestjs/swagger'
import {
  IsDateString,
  IsInt,
  IsUUID,
  Min,
  Validate,
  ValidatorConstraint,
  ValidatorConstraintInterface,
} from 'class-validator'

@ValidatorConstraint({ name: 'isFutureDate', async: false })
export class IsFutureDateConstraint implements ValidatorConstraintInterface {
  validate(value: string): boolean {
    const date = new Date(value)
    return !Number.isNaN(date.getTime()) && date.getTime() > Date.now()
  }

  defaultMessage(): string {
    return 'deadline must be in the future'
  }
}

export class CreateDealDto {
  @ApiProperty({
    description: 'Activity ID',
    format: 'uuid',
  })
  @IsUUID()
  activityId: string

  @ApiProperty({
    description: 'Expected number of students',
    minimum: 1,
  })
  @IsInt()
  @Min(1)
  studentsCount: number

  @ApiProperty({
    description: 'Bidding deadline (ISO date)',
    example: '2027-01-10T12:00:00.000Z',
  })
  @IsDateString()
  @Validate(IsFutureDateConstraint)
  deadline: string
}
