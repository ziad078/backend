import { PartialType } from '@nestjs/swagger'
import { CreateTeacherDto } from './teachersDtos/create-teacher.dto'

export class UpdateTeacherDto extends PartialType(CreateTeacherDto) {
  organizationId: string
}
