import { Class } from 'src/classes/entities/class.entity'
import { ApprovalStatus } from 'src/common/enums/approval-status.enum'
import { OrganizationType } from 'src/common/enums/organization-type.enum'
import { Grade } from 'src/grades/entities/grade.entity'
import { Teacher } from 'src/users/entities/teacher.entity'
import { User } from 'src/users/entities/user.entity'
import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  OneToMany,
  OneToOne,
  JoinColumn,
  ManyToOne,
} from 'typeorm'

@Entity('organizations')
export class Organization {
  @PrimaryGeneratedColumn('uuid')
  id: string

  @Column()
  organizationName: string

  @Column({
    type: 'enum',
    enum: OrganizationType,
  })
  organizationType: OrganizationType

  @Column({
    type: 'enum',
    enum: ApprovalStatus,
    default: ApprovalStatus.PENDING,
  })
  approvalStatus: ApprovalStatus

  @Column({ unique: true })
  ownerId: string

  @Column({ type: 'uuid', nullable: true })
  approvedById: string | null

  @ManyToOne(() => User, { nullable: true, onDelete: 'SET NULL' })
  @JoinColumn({ name: 'approvedById' })
  approvedBy: User | null

  @Column({ type: 'timestamptz', nullable: true })
  approvedAt: Date | null

  @Column({ type: 'uuid', nullable: true })
  rejectedById: string | null

  @ManyToOne(() => User, { nullable: true, onDelete: 'SET NULL' })
  @JoinColumn({ name: 'rejectedById' })
  rejectedBy: User | null

  @Column({ type: 'timestamptz', nullable: true })
  rejectedAt: Date | null

  @Column({ type: 'varchar', length: 500, nullable: true })
  rejectionReason: string | null

  /**
   * Organization owner
   */
  @OneToOne(() => User, (user) => user.ownedOrganization, {
    onDelete: 'CASCADE',
  })
  @JoinColumn({ name: 'ownerId' })
  owner: User

  /**
   * Users inside organization
   */
  @OneToMany(() => Teacher, (teacher) => teacher.organization)
  teachers: Teacher[]

  @OneToMany(() => Grade, (grade) => grade.organization)
  grades: Grade[]

  @OneToMany(() => Class, (cls) => cls.organization)
  classes: Class[]
}
