import { Organization } from 'src/organizations/entities/organization.entity'
import { User } from 'src/users/entities/user.entity'
import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  OneToMany,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm'
import { DealStatus } from '../enums/deal-status.enum'
import { Activity } from 'src/deals/entities/activity.entity'
import { Proposal } from 'src/deals/entities/proposal.entity'

@Entity('deals')
@Index(['organization', 'status'])
@Index(['deadline'])
export class Deal {
  @PrimaryGeneratedColumn('uuid')
  id: string

  @ManyToOne(() => Activity, (activity) => activity.deals, {
    nullable: false,
    onDelete: 'RESTRICT',
  })
  @JoinColumn({ name: 'activityId' })
  activity: Activity

  @ManyToOne(() => Organization, {
    nullable: false,
    onDelete: 'CASCADE',
  })
  @JoinColumn({ name: 'organizationId' })
  organization: Organization

  @ManyToOne(() => User, {
    nullable: false,
    onDelete: 'RESTRICT',
  })
  @JoinColumn({ name: 'createdBy' })
  creator: User

  @Column({ type: 'integer' })
  studentsCount: number

  @Column({
    type: 'enum',
    enum: DealStatus,
    default: DealStatus.OPEN,
  })
  status: DealStatus

  @Column({ type: 'timestamptz' })
  deadline: Date

  @OneToMany(() => Proposal, (proposal) => proposal.deal)
  proposals: Proposal[]

  @CreateDateColumn()
  createdAt: Date

  @UpdateDateColumn()
  updatedAt: Date
}
