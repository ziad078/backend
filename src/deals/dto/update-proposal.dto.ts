import { ApiProperty } from '@nestjs/swagger'
import { IsNumber, IsPositive } from 'class-validator'

export class UpdateProposalDto {
  @ApiProperty({
    description: 'Updated proposed price',
    minimum: 0.01,
    example: 1400,
  })
  @IsNumber({ maxDecimalPlaces: 2 })
  @IsPositive()
  price: number
}
