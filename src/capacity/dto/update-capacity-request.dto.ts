import { IsEnum, IsOptional, IsString, IsUUID } from 'class-validator'
import { CapacityRequestStatus } from 'src/common/enums/capacity-request-status.enum'

export class UpdateCapacityRequestDto {
  @IsEnum(CapacityRequestStatus)
  @IsOptional()
  status?: CapacityRequestStatus

  @IsString()
  @IsOptional()
  notes?: string

  @IsUUID()
  @IsOptional()
  paymentId?: string
}
