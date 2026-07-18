import * as React from 'react'
import {
  Body,
  Container,
  Head,
  Heading,
  Html,
  Link,
  Preview,
  Section,
  Text,
} from '@react-email/components'

type Props = {
  name: string
  email: string
  temporaryPassword: string
  loginUrl: string
  roleLabel: string
}

export function CredentialsEmailTemplate({
  name,
  email,
  temporaryPassword,
  loginUrl,
  roleLabel,
}: Props) {
  return (
    <Html dir="rtl" lang="ar">
      <Head />
      <Preview>بيانات الدخول إلى منصة إثراء الذكاء</Preview>
      <Body style={main}>
        <Container style={container}>
          <Heading style={heading}>مرحباً {name}</Heading>
          <Text style={paragraph}>
            تم إنشاء حساب {roleLabel} لك على منصة إثراء الذكاء. استخدم بيانات الدخول التالية ثم
            قم بتغيير كلمة المرور بعد أول تسجيل دخول.
          </Text>
          <Section style={credentialsBox}>
            <Text style={credentialLine}>
              <strong>البريد الإلكتروني:</strong> {email}
            </Text>
            <Text style={credentialLine}>
              <strong>كلمة المرور المؤقتة:</strong> {temporaryPassword}
            </Text>
          </Section>
          <Link href={loginUrl} style={button}>
            تسجيل الدخول
          </Link>
          <Text style={footer}>
            إذا لم تكن تتوقع هذا البريد، يرجى التواصل مع إدارة مؤسستك.
          </Text>
        </Container>
      </Body>
    </Html>
  )
}

const main = {
  backgroundColor: '#f8f5ff',
  fontFamily: 'Tahoma, Arial, sans-serif',
}

const container = {
  margin: '0 auto',
  padding: '32px 24px',
  maxWidth: '560px',
  backgroundColor: '#ffffff',
  borderRadius: '16px',
}

const heading = {
  color: '#7222e3',
  fontSize: '24px',
  fontWeight: '700',
  margin: '0 0 16px',
}

const paragraph = {
  color: '#334155',
  fontSize: '15px',
  lineHeight: '1.7',
  margin: '0 0 20px',
}

const credentialsBox = {
  backgroundColor: '#f5f3ff',
  borderRadius: '12px',
  padding: '16px',
  marginBottom: '24px',
}

const credentialLine = {
  color: '#1e293b',
  fontSize: '14px',
  lineHeight: '1.8',
  margin: '0 0 8px',
}

const button = {
  backgroundColor: '#7222e3',
  borderRadius: '999px',
  color: '#ffffff',
  display: 'inline-block',
  fontSize: '15px',
  fontWeight: '700',
  padding: '12px 24px',
  textDecoration: 'none',
}

const footer = {
  color: '#64748b',
  fontSize: '12px',
  lineHeight: '1.6',
  marginTop: '24px',
}

export default CredentialsEmailTemplate
