import { ApiPropertyOptional } from '@nestjs/swagger'
import { IsEnum, IsOptional, IsUUID } from 'class-validator'
import { Transform } from 'class-transformer'
import { TransferRequestStatus } from 'src/children/enums/transfer-request-status.enum'

export class ListTransferRequestsDto {
  @ApiPropertyOptional({ format: 'uuid' })
  @IsOptional()
  @IsUUID()
  toOrganizationId?: string

  @ApiPropertyOptional({ format: 'uuid' })
  @IsOptional()
  @IsUUID()
  fromOrganizationId?: string

  @ApiPropertyOptional({
    enum: TransferRequestStatus,
  })
  @IsOptional()
  @Transform(({ value }: { value: string }) => value?.toUpperCase())
  @IsEnum(TransferRequestStatus)
  status?: TransferRequestStatus
}
