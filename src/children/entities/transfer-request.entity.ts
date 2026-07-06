import { OrganizationChild } from './organization-child.entity'
import { PrivateChild } from './private-child.entity'
import { TransferRequestStatus } from 'src/children/enums/transfer-request-status.enum'
import { Organization } from 'src/organizations/entities/organization.entity'
import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
  BeforeInsert,
  BeforeUpdate,
} from 'typeorm'
import { ensureSingleChildType } from 'src/common/helpers/child-resolver.helper'

@Entity('transfer_requests')
export class TransferRequest {
  @PrimaryGeneratedColumn('uuid')
  id: string

  @Index()
  @Column({ type: 'uuid', nullable: true })
  organizationChildId: string | null

  @ManyToOne(() => OrganizationChild, { onDelete: 'CASCADE', nullable: true })
  @JoinColumn({ name: 'organizationChildId' })
  organizationChild: OrganizationChild | null

  @Index()
  @Column({ type: 'uuid', nullable: true })
  privateChildId: string | null

  @ManyToOne(() => PrivateChild, { onDelete: 'CASCADE', nullable: true })
  @JoinColumn({ name: 'privateChildId' })
  privateChild: PrivateChild | null

  @Index()
  @Column({ type: 'uuid' })
  fromOrganizationId: string

  @ManyToOne(() => Organization, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'fromOrganizationId' })
  fromOrganization: Organization

  @Index()
  @Column({ type: 'uuid' })
  toOrganizationId: string

  @ManyToOne(() => Organization, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'toOrganizationId' })
  toOrganization: Organization

  @Column({
    type: 'enum',
    enum: TransferRequestStatus,
    default: TransferRequestStatus.PENDING,
  })
  status: TransferRequestStatus

  @CreateDateColumn()
  createdAt: Date

  @BeforeInsert()
  @BeforeUpdate()
  validateChildType() {
    ensureSingleChildType(this.organizationChildId, this.privateChildId)
  }
}
