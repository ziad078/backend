import { Injectable, Logger } from '@nestjs/common'
import { Resend } from 'resend'
import { render } from '@react-email/render'

// استيراد الـ Templates
import { VerifyEmailTemplate } from '../templates/VerifyEmailTemplate'
import { WelcomeEmailTemplate } from '../templates/WelcomeEmailTemplate'
import { GeneralEmailTemplate } from '../templates/GeneralEmailTemplate'
import { CredentialsEmailTemplate } from '../templates/CredentialsEmailTemplate'

@Injectable()
export class EmailProvider {
  private readonly logger = new Logger(EmailProvider.name)
  private readonly resend = new Resend(process.env.RESEND_API_KEY)

  async mail(to: string, subject: string, html: string) {
    try {
      const response = await this.resend.emails.send({
        from: process.env.MAIL_FROM ?? 'onboarding@resend.dev',
        to,
        subject,
        html,
      })
      return response
    } catch (error) {
      this.logger.error(
        `Resend Core Error: ${error instanceof Error ? error.message : String(error)}`,
      )
      throw error
    }
  }

  // 1. الدالة العامة
  async sendEmail(to: string, subject: string, message: string): Promise<void> {
    try {
      // نمرر الـ Component كـ JSX مباشرة دون الحاجة لـ React.createElement 🚀
      const emailHtml = await render(<GeneralEmailTemplate subject={subject} message={message} />)

      await this.mail(to, subject, emailHtml)
      this.logger.log(`General email successfully dispatched to ${to}`)
    } catch (err) {
      this.logger.error(
        `Failed to send general email to ${to}: ${err instanceof Error ? err.message : String(err)}`,
      )
      throw err
    }
  }

  // 2. دالة التفعيل
  async sendVerificationEmail(email: string, token: string): Promise<void> {
    try {
      const frontendUrl = process.env.FRONTEND_URL ?? 'http://localhost:3000'
      const verificationLink = `${frontendUrl}/verify-email?token=${token}`

      const emailHtml = await render(<VerifyEmailTemplate link={verificationLink} />)

      await this.mail(email, 'تأكيد حسابك الرقمي - منصة إثراء الذكاء', emailHtml)
    } catch (err) {
      this.logger.error(
        `Failed to send verification email to ${email}: ${err instanceof Error ? err.message : String(err)}`,
      )
      throw err
    }
  }

  // 3. دالة الترحيب
  async sendWelcomeEmail(email: string, userName: string): Promise<void> {
    try {
      const emailHtml = await render(<WelcomeEmailTemplate name={userName} />)

      await this.mail(email, 'مرحباً بك في منصة إثراء الذكاء ✨', emailHtml)
    } catch (err) {
      this.logger.error(
        `Failed to send welcome email to ${email}: ${err instanceof Error ? err.message : String(err)}`,
      )
      throw err
    }
  }

  async sendCredentialsEmail(
    email: string,
    phone: string,
    payload: {
      name: string
      temporaryPassword: string
      roleLabel: string
    },
  ): Promise<void> {
    try {
      const loginUrl = `${process.env.FRONTEND_URL ?? 'http://localhost:3000'}/auth/login`
      const emailHtml = await render(
        <CredentialsEmailTemplate
          name={payload.name}
          email={email}
          phone={phone}
          temporaryPassword={payload.temporaryPassword}
          loginUrl={loginUrl}
          roleLabel={payload.roleLabel}
        />,
      )

      await this.mail(email, 'بيانات الدخول — منصة إثراء الذكاء', emailHtml)
      this.logger.log(`Credentials email successfully dispatched to ${email}`)
    } catch (err) {
      this.logger.error(
        `Failed to send credentials email to ${email}: ${err instanceof Error ? err.message : String(err)}`,
      )
      throw err
    }
  }
}
