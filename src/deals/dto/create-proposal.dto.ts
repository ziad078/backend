import { ApiProperty } from '@nestjs/swagger'
import { IsNumber, IsPositive } from 'class-validator'

export class CreateProposalDto {
  @ApiProperty({
    description: 'Proposed price',
    minimum: 0.01,
    example: 1250.5,
  })
  @IsNumber({ maxDecimalPlaces: 2 })
  @IsPositive()
  price: number
}
