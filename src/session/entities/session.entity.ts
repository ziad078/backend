import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn } from 'typeorm'

// sessions/session.entity.ts
@Entity('sessions')
export class Session {
  @PrimaryGeneratedColumn('uuid')
  id: string

  @Column()
  userId: string

  @Column()
  refreshTokenHash: string

  @Column({ nullable: true })
  device: string

  @Column({ nullable: true })
  ip: string

  @Column()
  expiresAt: Date

  @CreateDateColumn()
  createdAt: Date
}
