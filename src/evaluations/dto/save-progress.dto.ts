import { Type } from 'class-transformer'
import { ArrayMaxSize, ArrayMinSize, IsArray, IsOptional, ValidateNested } from 'class-validator'
import { ApiProperty } from '@nestjs/swagger'
import { AttemptAnswerDto } from './attempt-answer.dto'

export class SaveProgressDto {
  @ApiProperty({ required: false, type: [AttemptAnswerDto] })
  @IsOptional()
  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(500)
  @ValidateNested({ each: true })
  @Type(() => AttemptAnswerDto)
  answers?: AttemptAnswerDto[]
}
