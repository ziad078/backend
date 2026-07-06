export interface ITeacherResponseDto {
  teacherId: string
  userId: string
  name: string
  email: string
  isEmailVerified: boolean
  phone: string
  isPhoneVerified: boolean
  organizationId: string
  organizationName: string
  jobTitle: string
  classes: string[]
}
