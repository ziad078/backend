import { ApprovalStatus } from 'src/common/enums/approval-status.enum'
import { User } from 'src/users/entities/user.entity'
import { Entity, PrimaryGeneratedColumn, Column, OneToOne, JoinColumn } from 'typeorm'

@Entity('enrichers')
export class Enricher {
  @PrimaryGeneratedColumn('uuid')
  id: string

  @OneToOne(() => User, (user) => user.enricher, { onDelete: 'CASCADE' })
  @JoinColumn()
  user: User

  @Column()
  organizationName: string

  @Column({
    type: 'enum',
    enum: ApprovalStatus,
    default: ApprovalStatus.PENDING,
  })
  approvalStatus: ApprovalStatus
}
