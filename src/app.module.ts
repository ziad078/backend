import { ClassSerializerInterceptor, Module, MiddlewareConsumer, NestModule } from '@nestjs/common'
import { AppController } from './app.controller'
import { AppService } from './app.service'
import { ChildrenModule } from './children/children.module'
import { TypeOrmModule } from '@nestjs/typeorm'
import { UsersModule } from './users/users.module'
import { OrganizationsModule } from './organizations/organizations.module'
import { ConfigModule, ConfigService } from '@nestjs/config'
import { SessionModule } from './session/session.module'
import { APP_GUARD, APP_INTERCEPTOR } from '@nestjs/core'

import { JwtAuthGuard } from './users/guards/auth.guard'
import { RolesGuard } from './users/guards/roles.guard'
import { ClassesModule } from './classes/classes.module'
import { GradesModule } from './grades/grades.module'
import { BullModule } from '@nestjs/bull'
import { NotificationsModule } from './notifications/notifications.module'
import { EventEmitterModule } from '@nestjs/event-emitter'
import { EvaluationsModule } from 'src/evaluations/evaluations.module'
import { ScheduleModule } from '@nestjs/schedule'
import { PaymentsModule } from 'src/payments/payments.module'
import { DealsModule } from 'src/deals/deals.module'
import { ThrottlerGuard, ThrottlerModule } from '@nestjs/throttler'
import { CommonModule } from './common/common.module'
import { AuditLogInterceptor } from './common/interceptors/audit-log.interceptor'
import { CapacityModule } from './capacity/capacity.module'
import { ApiResponseSuccessIntercepter } from './common/interceptors/api-success-response.interceptor'
import { RequestIdMiddleware } from './common/middleware/request-id.middleware'
import { buildTypeOrmOptions } from './database/typeorm-options'

@Module({
  imports: [
    CommonModule,
    ConfigModule.forRoot({ isGlobal: true }),
    ThrottlerModule.forRoot([
      {
        name: 'default',
        ttl: 60_000,
        limit: 120,
      },
      {
        name: 'auth',
        ttl: 60_000,
        limit: 10,
      },
      {
        name: 'upload',
        ttl: 60_000,
        limit: 20,
      },
      {
        name: 'assessment',
        ttl: 60_000,
        limit: 30,
      },
    ]),
    EventEmitterModule.forRoot({
      wildcard: true,
      delimiter: '.',
      maxListeners: 50,
    }),
    ScheduleModule.forRoot(),
    BullModule.forRootAsync({
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        redis: {
          host: config.get<string>('REDIS_HOST', '127.0.0.1'),
          port: config.get<number>('REDIS_PORT', 6379),
          password: config.get<string>('REDIS_PASSWORD') || undefined,
          tls: config.get<string>('REDIS_TLS') === 'true' ? {} : undefined,
        },
      }),
    }),
    ChildrenModule,
    TypeOrmModule.forRoot(buildTypeOrmOptions()),
    UsersModule,
    OrganizationsModule,
    SessionModule,
    ClassesModule,
    GradesModule,
    NotificationsModule,
    EvaluationsModule,
    PaymentsModule,
    DealsModule,
    CapacityModule,
  ],
  controllers: [AppController],
  providers: [
    AppService,
    {
      provide: APP_GUARD,
      useClass: JwtAuthGuard,
    },
    {
      provide: APP_GUARD,
      useClass: RolesGuard,
    },
    {
      provide: APP_GUARD,
      useClass: ThrottlerGuard,
    },
    {
      provide: APP_INTERCEPTOR,
      useClass: ClassSerializerInterceptor,
    },
    {
      provide: APP_INTERCEPTOR,
      useClass: ApiResponseSuccessIntercepter,
    },
    {
      provide: APP_INTERCEPTOR,
      useClass: AuditLogInterceptor,
    },
  ],
})
export class AppModule implements NestModule {
  configure(consumer: MiddlewareConsumer) {
    consumer.apply(RequestIdMiddleware).forRoutes('*')
  }
}
