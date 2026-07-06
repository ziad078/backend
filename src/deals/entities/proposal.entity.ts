import { User } from 'src/users/entities/user.entity'
import {
  Column,
  CreateDateColumn,
  Entity,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
  Unique,
  UpdateDateColumn,
} from 'typeorm'
import { ProposalStatus } from '../enums/proposal-status.enum'
import { Deal } from './deal.entity'

@Entity('proposals')
@Unique(['deal', 'provider'])
export class Proposal {
  @PrimaryGeneratedColumn('uuid')
  id: string

  @ManyToOne(() => Deal, (deal) => deal.proposals, {
    nullable: false,
    onDelete: 'CASCADE',
  })
  @JoinColumn({ name: 'dealId' })
  deal: Deal

  @ManyToOne(() => User, {
    nullable: false,
    onDelete: 'CASCADE',
  })
  @JoinColumn({ name: 'providerId' })
  provider: User

  @Column({ type: 'numeric', precision: 12, scale: 2 })
  price: string

  @Column({
    type: 'enum',
    enum: ProposalStatus,
    default: ProposalStatus.PENDING,
  })
  status: ProposalStatus

  @CreateDateColumn()
  createdAt: Date

  @UpdateDateColumn()
  updatedAt: Date
}
