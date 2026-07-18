export enum UserEvents {
  PARENT_CREATED = 'user.parent.created',
  TEACHER_CREATED = 'user.teacher.created',
}

export type ParentCreatedEventPayload = {
  userId: string
  name: string
  email: string
  phone: string
  temporaryPassword: string
  organizationId: string
  organizationName: string
}

export type TeacherCreatedEventPayload = {
  userId: string
  teacherId: string
  name: string
  email: string
  phone: string
  temporaryPassword: string
  organizationId: string
  organizationName: string
  jobTitle: string
}
