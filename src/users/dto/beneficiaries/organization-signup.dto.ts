import { IsEnum, IsString, Length } from 'class-validator'
import { Transform } from 'class-transformer'
import { BaseSignupDto } from '../base-signup.dto'
import { OrganizationType } from 'src/common/enums/organization-type.enum'
import { AccountType } from 'src/common/enums/account-type.enum'
import { ApiProperty } from '@nestjs/swagger'

export class OrganizationSignupDto extends BaseSignupDto {
  @ApiProperty({
    example: AccountType.ORGANIZATION,
  })
  @IsEnum(AccountType)
  accountType: AccountType.ORGANIZATION

  @ApiProperty({
    example: 'organization-name',
  })
  @IsString()
  @Length(2, 120)
  @Transform(({ value }: { value?: string }) => value?.trim())
  organizationName: string

  @ApiProperty({
    example: OrganizationType.SCHOOL,
  })
  @IsEnum(OrganizationType)
  organizationType: OrganizationType

  // @ApiProperty({
  //   example: ApprovalStatus.APPROVED,
  // })
  // @IsEnum(ApprovalStatus)
  // approvalStatus: ApprovalStatus;
}
