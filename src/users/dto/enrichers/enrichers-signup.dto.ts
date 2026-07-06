import { IsEnum, IsString } from 'class-validator'
import { BaseSignupDto } from '../base-signup.dto'
import { AccountType } from 'src/common/enums/account-type.enum'
import { ApiProperty } from '@nestjs/swagger'

export class EnrichersSignupDto extends BaseSignupDto {
  @ApiProperty({
    example: 'enricher institution',
  })
  @IsString()
  organizationName: string

  @ApiProperty({
    example: AccountType.ENRICHER,
  })
  @IsEnum(AccountType)
  accountType: AccountType.ENRICHER
}
