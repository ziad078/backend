import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger'

/**
 * Documented shape for Moyasar-style webhooks (parsed JSON).
 * The live endpoint validates a signature over the raw body instead of this DTO.
 */
export class MoyasarWebhookDataDto {
  @ApiProperty()
  id: string

  @ApiPropertyOptional()
  status?: string

  @ApiPropertyOptional()
  amount?: number

  @ApiPropertyOptional()
  currency?: string
}

export class WebhookDto {
  @ApiProperty({ example: 'payment_paid' })
  type: string

  @ApiProperty({ type: MoyasarWebhookDataDto })
  data: MoyasarWebhookDataDto
}
