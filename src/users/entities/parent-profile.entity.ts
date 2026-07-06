import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  OneToOne,
  OneToMany,
  CreateDateColumn,
  UpdateDateColumn,
  JoinColumn,
  Index,
} from 'typeorm'
import { User } from './user.entity'
import { OrganizationChild } from 'src/children/entities/organization-child.entity'
import { PrivateChild } from 'src/children/entities/private-child.entity'
import { ParentOrganization } from './parent-organization.entity'

@Entity('parents')
@Index('idx_parent_userId', ['userId'], { unique: true })
export class ParentProfile {
  @PrimaryGeneratedColumn('uuid')
  id: string

  @Column({ type: 'uuid', unique: true })
  userId: string

  @OneToOne(() => User, (user) => user.parentProfile, {
    onDelete: 'CASCADE',
    eager: false,
  })
  @JoinColumn({ name: 'userId' })
  user: User

  @Column({ type: 'int', default: 2 })
  maxChildren: number

  @OneToMany(() => OrganizationChild, (child) => child.parent)
  organizationChildren: OrganizationChild[]

  @OneToMany(() => PrivateChild, (child) => child.parent)
  privateChildren: PrivateChild[]

  @OneToMany(() => ParentOrganization, (link) => link.parent)
  organizationLinks: ParentOrganization[]

  @CreateDateColumn()
  createdAt: Date

  @UpdateDateColumn()
  updatedAt: Date
}
