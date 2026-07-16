import { Module, forwardRef } from '@nestjs/common'
import { UsersController } from './controllers/users.controller'
import { TypeOrmModule } from '@nestjs/typeorm'
import { User } from './entities/user.entity'
import { Role } from './entities/user-roles.entity'
import { TeachersProvider } from './services/teachers.provider'
import { Teacher } from './entities/teacher.entity'
import { AuthProvider } from './services/auth.provider'
import { SignupStrategyFactory } from './factories/signup.factory'
import { JwtStrategy } from './strategies/jwt.strategy'
import { AuthController } from './controllers/auth.controller'
import { ConfigService } from '@nestjs/config'
import { JwtModule } from '@nestjs/jwt'
import { PassportModule } from '@nestjs/passport'
import { SessionModule } from 'src/session/session.module'
import { UsersService } from './services/users.service'
import { TeachersController } from './controllers/teachers.controller'
import { ParentsController } from './controllers/parent.controller'
import { ParentsServices } from './services/parents.service'
import { EnrichersService } from './services/enrichers.service'
import { Enricher } from './entities/enricher.entity'
import { EnrichersController } from './controllers/enrichers.controller'
import { NotificationsModule } from 'src/notifications/notifications.module'
import { OrganizationsModule } from 'src/organizations/organizations.module'
import { DealsModule } from 'src/deals/deals.module'
import { ParentProfile } from './entities/parent-profile.entity'
import { ParentOrganization } from './entities/parent-organization.entity'
import { ParentProfilesService } from './services/parent-profiles.service'

@Module({
  controllers: [
    UsersController,
    AuthController,
    TeachersController,
    ParentsController,
    EnrichersController,
  ],
  providers: [
    UsersService,
    TeachersProvider,
    AuthProvider,
    JwtStrategy,
    SignupStrategyFactory,
    ParentsServices,
    EnrichersService,
    ParentProfilesService,
  ],
  imports: [
    TypeOrmModule.forFeature([User, Role, Teacher, Enricher, ParentProfile, ParentOrganization]),
    forwardRef(() => DealsModule),
    forwardRef(() => OrganizationsModule),
    SessionModule,
    PassportModule,
    forwardRef(() => NotificationsModule),
    JwtModule.registerAsync({
      inject: [ConfigService],
      useFactory: (config: ConfigService) => {
        return {
          secret: config.get<string>('JWT_SECRET'),
          signOptions: {
            expiresIn: config.get('JWT_EXPIRESIN'),
          },
        }
      },
    }),
  ],
  exports: [TypeOrmModule, UsersService, AuthProvider, EnrichersService, ParentProfilesService],
})
export class UsersModule {}
