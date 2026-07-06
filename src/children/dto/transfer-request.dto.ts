import { ApiProperty } from '@nestjs/swagger'
import { IsEnum, IsUUID } from 'class-validator'

export class RequestTransferDto {
  @ApiProperty({ format: 'uuid' })
  @IsUUID()
  childId: string

  @ApiProperty({ enum: ['organization', 'private'] })
  @IsEnum(['organization', 'private'])
  childType: 'organization' | 'private'

  @ApiProperty({ format: 'uuid' })
  @IsUUID()
  toOrganizationId: string
}

export class ApproveTransferDto {
  @ApiProperty({ format: 'uuid' })
  @IsUUID()
  classId: string
}
