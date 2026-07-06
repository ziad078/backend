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
import { EvaluationSlot } from 'src/evaluations/entities/evaluation-slot.entity'

@Entity('private_children')
export class PrivateChild {
  @PrimaryGeneratedColumn('uuid')
  id: string

  @Column()
  name: string

  @Column({ type: 'date' })
  birthDate: Date

  @Column({ type: 'enum', enum: Gender })
  gender: Gender

  @Index()
  @Column({ type: 'uuid' })
  createdById: string

  @ManyToOne(() => User, (user) => user.privateChildren, {
    onDelete: 'CASCADE',
  })
  @JoinColumn({ name: 'createdById' })
  createdBy: User

  @Index()
  @Column({ type: 'uuid' })
  parentId: string

  @ManyToOne(() => ParentProfile, (profile) => profile.privateChildren, {
    onDelete: 'CASCADE',
  })
  @JoinColumn({ name: 'parentId' })
  parent: ParentProfile

  @OneToOne(() => ChildProfile, (profile) => profile.privateChild)
  profile: ChildProfile

  @OneToMany(() => EvaluationSlot, (a) => a.privateChild)
  slots: EvaluationSlot[]

  @CreateDateColumn()
  createdAt: Date

  @UpdateDateColumn()
  updatedAt: Date
}
