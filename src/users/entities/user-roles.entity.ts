// src/modules/roles/role.entity.ts

import { Entity, PrimaryGeneratedColumn, Column, ManyToMany } from 'typeorm'
import { User } from './user.entity'
import { UserRole } from 'src/common/enums/role.enum'

@Entity('roles')
export class Role {
  @PrimaryGeneratedColumn('uuid')
  id: string

  @Column({ unique: true })
  name: UserRole

  @ManyToMany(() => User, (user) => user.roles)
  users: User[]
}
