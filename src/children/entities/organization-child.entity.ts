import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  ManyToOne,
  OneToOne,
  OneToMany,
  CreateDateColumn,
  UpdateDateColumn,
  JoinColumn,
  Index,
} from 'typeorm'
import { Gender } from 'src/common/enums/gender.enum'
import { User } from 'src/users/entities/user.entity'
import { ParentProfile } from 'src/users/entities/parent-profile.entity'
import { ChildProfile } from './child-profile.entity'
import { Class } from 'src/classes/entities/class.entity'
import { Organization } from 'src/organizations/entities/organization.entity'
import { EvaluationSlot } from 'src/evaluations/entities/evaluation-slot.entity'
@Index('idx_parent_org', ['organizationId', 'parentId'])
@Entity('organization_children')
export class OrganizationChild {
  @PrimaryGeneratedColumn('uuid')
  id: string

  @Column()
  name: string

  @Column({ type: 'date' })
  birthDate: Date

  @Column({ type: 'enum', enum: Gender })
  gender: Gender

  @Index()
  @Column({ type: 'uuid', nullable: false })
  classId: string

  @ManyToOne(() => Class, (cls) => cls.children, {
    nullable: false,
    onDelete: 'CASCADE',
  })
  @JoinColumn({ name: 'classId' })
  class: Class

  @Index()
  @Column({ type: 'uuid', nullable: false })
  organizationId: string

  @ManyToOne(() => Organization, { nullable: false, onDelete: 'CASCADE' })
  @JoinColumn({ name: 'organizationId' })
  organization: Organization

  @Index()
  @Column({ type: 'uuid' })
  createdById: string

  @ManyToOne(() => User, (user) => user.organizationChildren, {
    onDelete: 'CASCADE',
  })
  @JoinColumn({ name: 'createdById' })
  createdBy: User

  @Index()
  @Column({ type: 'uuid' })
  parentId: string

  @ManyToOne(() => ParentProfile, (profile) => profile.organizationChildren, {
    onDelete: 'CASCADE',
  })
  @JoinColumn({ name: 'parentId' })
  parent: ParentProfile

  @OneToOne(() => ChildProfile, (profile) => profile.organizationChild)
  profile: ChildProfile

  @OneToMany(() => EvaluationSlot, (a) => a.organizationChild)
  slots: EvaluationSlot[]

  @CreateDateColumn()
  createdAt: Date

  @UpdateDateColumn()
  updatedAt: Date
}
