import { ApiPropertyOptional } from '@nestjs/swagger'
import { IsEnum, IsOptional, IsString, Length } from 'class-validator'
import { Transform } from 'class-transformer'
import { OrganizationType } from 'src/common/enums/organization-type.enum'

export class UpdateOrganizationDto {
  @ApiPropertyOptional({ example: 'Al Noor School' })
  @IsOptional()
  @IsString()
  @Length(2, 120)
  @Transform(({ value }: { value?: string }) => value?.trim())
  organizationName?: string

  @ApiPropertyOptional({ enum: OrganizationType })
  @IsOptional()
  @IsEnum(OrganizationType)
  organizationType?: OrganizationType
}
