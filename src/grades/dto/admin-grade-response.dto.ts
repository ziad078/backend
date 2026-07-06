import { BaseGradeResponseDto } from './base-grade-response.dto'

export interface AdminGradeResponseDto extends BaseGradeResponseDto {
  organizationName: string
}
