import { IsDateString, IsEnum, IsInt, IsOptional, IsUUID, Min } from 'class-validator'
import { ApiProperty } from '@nestjs/swagger'

export class StartEvaluationDto {
  @ApiProperty({
    description: 'Child ID (must belong to the authenticated parent)',
    format: 'uuid',
  })
  @IsUUID()
  childId: string

  @ApiProperty({
    description: 'Child type (organization or private)',
    enum: ['organization', 'private'],
  })
  @IsEnum(['organization', 'private'])
  childType: 'organization' | 'private'

  /**
   * Provide ONE of:
   * - expiresAt (absolute timestamp)
   * - expiresInSeconds (relative duration)
   */
  @ApiProperty({
    required: false,
    example: '2027-12-30T10:00:00.000Z',
    description: 'Absolute expiry timestamp (ISO string)',
  })
  @IsOptional()
  @IsDateString()
  expiresAt?: string

  @ApiProperty({
    required: false,
    example: 1800,
    description: 'Relative expiry duration in seconds',
  })
  @IsOptional()
  @IsInt()
  @Min(1)
  expiresInSeconds?: number
}
