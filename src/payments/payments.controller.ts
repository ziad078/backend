import {
  Body,
  Controller,
  Get,
  Headers,
  Param,
  ParseUUIDPipe,
  Post,
  Query,
  Req,
  type RawBodyRequest,
} from '@nestjs/common'
import { ApiBearerAuth, ApiOperation, ApiTags, ApiQuery } from '@nestjs/swagger'
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
import { ListPaymentsQueryDto } from './dto/list-payments-query.dto'
import { EvaluationSlotService } from 'src/evaluations/services/evaluation-slot.service'

@ApiTags('payments')
@Controller('payments')
export class PaymentsController {
  constructor(
    private readonly payments: PaymentsService,
    private readonly slots: EvaluationSlotService,
  ) {}

  @Get()
  @ApiBearerAuth()
  @ApiOperation({ summary: 'List payments (admin only, paginated)' })
  @Roles(UserRole.ADMIN)
  listForAdmin(@Query() query: ListPaymentsQueryDto) {
    return this.payments.listForAdmin(query)
  }

  @Post()
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Create a SAR Paymob checkout session' })
  @Roles(UserRole.PARENT)
  create(@Body() dto: CreatePaymentDto, @Req() req: AuthRequest) {
    return this.payments.createPayment(req.user.userId, dto)
  }

  @Post('webhook/paymob')
  @Public()
  @ApiOperation({
    summary: 'Paymob transaction webhook (HMAC-validated, idempotent, queued)',
  })
  @ApiQuery({ name: 'hmac', required: true, description: 'Paymob SHA-512 HMAC digest' })
  paymobWebhook(
    @Req() req: RawBodyRequest<Request>,
    @Query() query: Record<string, string>,
  ) {
    const raw = req.rawBody
    if (!raw?.length) {
      throw ApiException.badRequest(ApiErrorCodes.PAYMENT_WEBHOOK_MISSING)
    }
    return this.payments.handleWebhook(raw, { query })
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
