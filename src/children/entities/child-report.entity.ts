import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn } from 'typeorm'

@Entity('children-reports')
export class ChildReport {
  @PrimaryGeneratedColumn('uuid')
  id: string

  @Column('text')
  scoreJson: string

  @CreateDateColumn()
  createdAt: Date
}
