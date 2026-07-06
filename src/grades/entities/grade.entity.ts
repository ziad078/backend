import { Class } from 'src/classes/entities/class.entity'
import { Organization } from 'src/organizations/entities/organization.entity'
import {
  PrimaryGeneratedColumn,
  Column,
  ManyToOne,
  OneToMany,
  Entity,
  Index,
  JoinColumn,
} from 'typeorm'

@Entity('grades')
export class Grade {
  @PrimaryGeneratedColumn('uuid')
  id: string

  @Column()
  name: string

  @Index()
  @Column({ type: 'uuid' })
  organizationId: string

  @ManyToOne(() => Organization, (org) => org.grades, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'organizationId' })
  organization: Organization

  @OneToMany(() => Class, (cls) => cls.grade)
  classes: Class[]
}
