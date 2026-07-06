import type { Class } from 'src/classes/entities/class.entity'
import { Organization } from 'src/organizations/entities/organization.entity'
import { User } from 'src/users/entities/user.entity'
import {
  PrimaryGeneratedColumn,
  OneToOne,
  JoinColumn,
  ManyToOne,
  OneToMany,
  Column,
  Entity,
} from 'typeorm'

@Entity('teachers')
export class Teacher {
  @PrimaryGeneratedColumn('uuid')
  id: string

  @Column()
  userId: string

  @Column()
  orgId: string

  @OneToOne(() => User, (user) => user.teacher, {
    onDelete: 'CASCADE',
  })
  @JoinColumn({ name: 'userId' })
  user: User

  @ManyToOne(() => Organization, (org) => org.teachers, {
    onDelete: 'CASCADE',
  })
  @JoinColumn({ name: 'orgId' })
  organization: Organization

  @OneToMany('Class', 'teacher')
  classes: Class[]

  @Column()
  jobTitle: string
}
