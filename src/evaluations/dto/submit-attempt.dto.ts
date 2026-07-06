import { Type } from 'class-transformer'
import { ArrayMaxSize, ArrayMinSize, IsArray, ValidateNested } from 'class-validator'
import { ApiProperty } from '@nestjs/swagger'
import { AttemptAnswerDto } from './attempt-answer.dto'

export class SubmitAttemptDto {
  @ApiProperty({ type: [AttemptAnswerDto] })
  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(500)
  @ValidateNested({ each: true })
  @Type(() => AttemptAnswerDto)
  answers: AttemptAnswerDto[]
}
