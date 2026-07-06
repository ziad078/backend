import { Type } from 'class-transformer'
import {
  ArrayMinSize,
  IsArray,
  IsEnum,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsString,
  IsUUID,
  Min,
  MinLength,
  ValidateNested,
} from 'class-validator'
import { ApiProperty } from '@nestjs/swagger'
import { EvaluationType } from '../enums/evaluation-type.enum'

export class CreateEvaluationDimensionDto {
  @ApiProperty({ example: 'الذكاء اللغوي' })
  @IsString()
  @IsNotEmpty()
  name: string

  @ApiProperty({ example: 'linguistic' })
  @IsString()
  @IsNotEmpty()
  code: string

  @ApiProperty({ example: 3 })
  @IsNumber()
  minScore: number

  @ApiProperty({ example: 12 })
  @IsNumber()
  maxScore: number

  @ApiProperty({ required: false })
  @IsOptional()
  interpretationRules?: Record<string, any>
}

export class CreateEvaluationQuestionAnswerDto {
  @ApiProperty({ example: 'تنطبق بدرجة عالية' })
  @IsString()
  @IsNotEmpty()
  text: string

  @ApiProperty({ example: 4 })
  @IsNumber()
  scoreValue: number

  @ApiProperty({ example: 'A', required: false })
  @IsOptional()
  @IsString()
  code?: string
}

export class CreateEvaluationQuestionDto {
  @ApiProperty({ example: 'لدى طفلي فضول يدفعه لفتح الكتب أو طلب القراءة له' })
  @IsString()
  @IsNotEmpty()
  content: string

  @ApiProperty({ example: 'linguistic' })
  @IsString()
  @IsNotEmpty()
  dimensionCode: string

  @ApiProperty({ example: 1, required: false, default: 1 })
  @IsOptional()
  @IsNumber()
  @Min(1)
  order?: number

  @ApiProperty({ type: [CreateEvaluationQuestionAnswerDto] })
  @IsArray()
  @ArrayMinSize(2)
  @ValidateNested({ each: true })
  @Type(() => CreateEvaluationQuestionAnswerDto)
  answers: CreateEvaluationQuestionAnswerDto[]
}

export class CreateEvaluationDto {
  @ApiProperty({ example: 'مؤشر الذكاءات الثمانية' })
  @IsString()
  @MinLength(2)
  title: string

  @ApiProperty({ enum: EvaluationType })
  @IsEnum(EvaluationType)
  type: EvaluationType

  @ApiProperty({ format: 'uuid', required: false })
  @IsOptional()
  @IsUUID()
  institutionId?: string | null

  @ApiProperty({ example: 3, required: false })
  @IsOptional()
  @IsNumber()
  @Min(0)
  ageFrom?: number

  @ApiProperty({ example: 15, required: false })
  @IsOptional()
  @IsNumber()
  @Min(0)
  ageTo?: number

  @ApiProperty({ example: ['parent', 'teacher'], required: false })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  evaluatorTypes?: string[]

  @ApiProperty({ type: [CreateEvaluationDimensionDto] })
  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => CreateEvaluationDimensionDto)
  dimensions: CreateEvaluationDimensionDto[]

  @ApiProperty({ type: [CreateEvaluationQuestionDto] })
  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => CreateEvaluationQuestionDto)
  questions: CreateEvaluationQuestionDto[]
}
