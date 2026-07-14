import {
  Body,
  Controller,
  Headers,
  Param,
  ParseUUIDPipe,
  Post,
  Req,
  type RawBodyRequest,
} from '@nestjs/common'
import { ApiBearerAuth, ApiOperation, ApiTags, ApiHeader } from '@nestjs/swagger'
import { ApiException } from 'src/common/exceptions/api.exception'
import { ApiErrorCodes } from 'src/common/enums/api-error.enum'
import type { Request } from 'express'
import { Roles } from 'src/users/decorators/role.decorator'
import { UserRole } from 'src/common/enums/role.enum'
import { Public } from 'src/users/decorators/public.decorator'
import { type AuthRequest } from 'src/common/interfaces/auth-request.interface'
import { PaymentsService } from './payments.service'
import { CreatePaymentDto } from './dto/create-payment.dto'
import { RetryPaymentDto } from './dto/retry-payment.dto'
import { EvaluationSlotService } from 'src/evaluations/services/evaluation-slot.service'

@ApiTags('payments')
@Controller('payments')
export class PaymentsController {
  constructor(
    private readonly payments: PaymentsService,
    private readonly slots: EvaluationSlotService,
  ) {}

  @Post()
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Create a SAR checkout session (Moyasar)' })
  @Roles(UserRole.PARENT)
  create(@Body() dto: CreatePaymentDto, @Req() req: AuthRequest) {
    return this.payments.createPayment(req.user.userId, dto)
  }

  @Post('webhook')
  @Public()
  @ApiOperation({
    summary: 'Provider webhook (signature-validated, idempotent, queued)',
  })
  @ApiHeader({
    name: 'x-moyasar-signature',
    required: true,
    description: 'HMAC-SHA256 hex digest of the raw body',
  })
  webhook(@Req() req: RawBodyRequest<Request>, @Headers('x-moyasar-signature') signature?: string) {
    const raw = req.rawBody
    if (!raw?.length) {
      throw ApiException.badRequest(ApiErrorCodes.PAYMENT_WEBHOOK_MISSING)
    }
    return this.payments.handleWebhook(raw, signature)
  }

  @Post(':attemptId/initiate')
  @ApiBearerAuth()
  @ApiOperation({
    summary: 'Refresh or retry checkout for a private extra attempt (after admin approval)',
  })
  @Roles(UserRole.PARENT)
  initiatePrivateExtra(
    @Param('attemptId', new ParseUUIDPipe()) attemptId: string,
    @Req() req: AuthRequest,
  ) {
    return this.slots.initiateOrRefreshExtraPayment(attemptId, req.user.userId)
  }

  @Post(':id/retry')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Retry a failed or expired payment' })
  @Roles(UserRole.PARENT)
  retry(
    @Param('id', new ParseUUIDPipe()) id: string,
    @Body() _dto: RetryPaymentDto,
    @Req() req: AuthRequest,
  ) {
    void _dto
    return this.payments.retryPayment(id, req.user.userId)
  }
}
