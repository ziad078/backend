import { User } from 'src/users/entities/user.entity'
import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
} from 'typeorm'

@Entity('notifications')
@Index(['user', 'createdAt'])
export class Notification {
  @PrimaryGeneratedColumn('uuid')
  id: string

  @ManyToOne(() => User, {
    onDelete: 'CASCADE',
  })
  @JoinColumn({ name: 'userId' })
  user: User

  @Index()
  @Column({ type: 'uuid' })
  userId: string

  @Column({ type: 'varchar', length: 500 })
  title: string

  @Column({ type: 'text' })
  message: string

  @Column({ type: 'boolean', default: false })
  isRead: boolean

  @CreateDateColumn()
  createdAt: Date

  @Column({ type: 'varchar', length: 50, default: 'general' })
  type: string

  @Column({ type: 'jsonb', nullable: true })
  metadata: Record<string, unknown> | null
}
