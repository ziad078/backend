import { IsInt, IsOptional, IsString, Min } from 'class-validator'

export class CreateCapacityRequestDto {
  @IsInt()
  @Min(1)
  requestedCapacity: number

  @IsString()
  @IsOptional()
  notes?: string
}
