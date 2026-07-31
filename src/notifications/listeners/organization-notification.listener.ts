import { Injectable } from '@nestjs/common'
import { NotificationsService } from '../notifications.service'
import { OnEvent } from '@nestjs/event-emitter'
import { NotificationDelivery } from '../enums/notification-delivery.enum'
import { OrganizationEvents } from 'src/organizations/enums/organization-events.enum'

@Injectable()
export class OrgNotificationListener {
  constructor(private readonly notifications: NotificationsService) {}

  @OnEvent(OrganizationEvents.REGISTERED)
  async OnOrgRegistered(payload: {
    orgId: string
    orgName: string
    ownerId: string
    ownerName: string
    ownerEmail: string
    ownerPhone: string
  }) {
    await this.notifications.enqueue({
      delivery: NotificationDelivery.BOTH,
      userId: process.env.ADMINID ?? '',
      title: 'تم تسجيل مؤسسة جديدة ',
      message: 'تم تسجيل مؤسسة جديدة',
      metadata: payload,
    })
    await this.notifications.enqueue({
      delivery: NotificationDelivery.BOTH,
      userId: payload.ownerId,
      email: payload.ownerEmail,
      title: 'تم تسجيل مؤسستك بنجاح',
      message: `مرحبا ${payload.ownerName} نشكرك علي التسجيل لدي اثراء`,
      metadata: payload,
    })
    await this.notifications.enqueueVerificationEmail(payload.ownerId, payload.ownerEmail)
  }

  @OnEvent(OrganizationEvents.APPROVED)
  async OnOrgApproved(payload: {
    orgId: string
    ownerName: string
    orgName: string
    ownerId: string
  }) {
    await this.notifications.enqueue({
      delivery: NotificationDelivery.BOTH,
      userId: process.env.ADMINID ?? '',
      title: 'تم اعتماد المؤسسة بنجاح ',
      message: `تم اعتماد المؤسسة ذات المعرف ${payload.orgId} والتي اسمها ${payload.orgName} و مالكها ${payload.ownerName}`,
      metadata: payload,
    })
    await this.notifications.enqueue({
      delivery: NotificationDelivery.BOTH,
      userId: payload.ownerId,
      title: 'تم اعتماد مؤسستك بنجاح',
      message: `مرحبا ${payload.ownerName} نشكرك علي التسجيل لدي اثراء و نحيطك علما انو تم اعتماد مؤسستك بنجاح`,
      metadata: payload,
    })
  }

  @OnEvent(OrganizationEvents.REJECTED)
  async OnOrgRejected(payload: {
    orgId: string
    ownerName: string
    orgName: string
    ownerId: string
    rejectionReason: string
  }) {
    await this.notifications.enqueue({
      delivery: NotificationDelivery.BOTH,
      userId: process.env.ADMINID ?? '',
      title: 'تم رفض المؤسسة بنجاح ',
      message: `تم رفض المؤسسة ذات المعرف ${payload.orgId} والتي اسمها ${payload.orgName} و مالكها ${payload.ownerName}`,
      metadata: payload,
    })
    await this.notifications.enqueue({
      delivery: NotificationDelivery.BOTH,
      userId: payload.ownerId,
      title: 'نعتذر تم رفض مؤسستك',
      message: `نعتذر عن رفض مؤسستك بسبب ${payload.rejectionReason} الرجاء التواصل مع الدعم`,
      metadata: payload,
    })
  }
}
