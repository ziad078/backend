import { Module, Global } from '@nestjs/common'
import { TypeOrmModule } from '@nestjs/typeorm'
import { AuditLog } from './entities/audit-log.entity'
import { AuditLoggingService } from './services/audit-logging.service'

@Global()
@Module({
  imports: [TypeOrmModule.forFeature([AuditLog])],
  providers: [AuditLoggingService],
  exports: [TypeOrmModule, AuditLoggingService],
})
export class CommonModule {}
