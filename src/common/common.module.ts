import { Module, Global } from '@nestjs/common'
import { TypeOrmModule } from '@nestjs/typeorm'
import { AuditLog } from './entities/audit-log.entity'
import { AuditLoggingService } from './services/audit-logging.service'
import { AuditLogsController } from './controllers/audit-logs.controller'

@Global()
@Module({
  imports: [TypeOrmModule.forFeature([AuditLog])],
  controllers: [AuditLogsController],
  providers: [AuditLoggingService],
  exports: [TypeOrmModule, AuditLoggingService],
})
export class CommonModule {}
