import { ApiProperty } from '@nestjs/swagger'
import { IsUUID } from 'class-validator'

export class AttemptAnswerDto {
  @ApiProperty({ description: 'Evaluation question ID', format: 'uuid' })
  @IsUUID()
  questionId: string

  @ApiProperty({ description: 'Selected answer option ID', format: 'uuid' })
  @IsUUID()
  selectedAnswerId: string
}
