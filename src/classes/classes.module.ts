import { forwardRef, Module } from '@nestjs/common'
import { ClassesService } from './classes.service'
import { ClassesController } from './classes.controller'
import { TypeOrmModule } from '@nestjs/typeorm'
import { Class } from './entities/class.entity'
import { Teacher } from 'src/users/entities/teacher.entity'
import { GradesModule } from 'src/grades/grades.module'
import { ChildrenModule } from 'src/children/children.module'
import { OrganizationsModule } from 'src/organizations/organizations.module'

@Module({
  controllers: [ClassesController],
  providers: [ClassesService],
  imports: [
    TypeOrmModule.forFeature([Class, Teacher]),
    GradesModule,
    forwardRef(() => ChildrenModule),
    OrganizationsModule,
  ],
  exports: [TypeOrmModule, ClassesService],
})
export class ClassesModule {}
