import * as React from 'react';
import {
  Body,
  Button,
  Container,
  Head,
  Heading,
  Html,
  Link,
  Preview,
  Section,
  Text,
} from '@react-email/components';

interface ResetPasswordEmailProps {
  link: string;
}

export const ResetPasswordEmailTemplate = ({
  link,
}: ResetPasswordEmailProps): React.JSX.Element => {
  return (
    <Html lang="ar" dir="rtl">
      <Head />
      <Preview>إعادة تعيين كلمة المرور — منصة إثراء الذكاء</Preview>
      <Body style={main}>
        <Container style={container}>
          <Section style={logoContainer}>
            <Text style={logoText}>
              ITHRA <span style={logoSpan}>ITHRA</span>
            </Text>
          </Section>

          <Section style={contentSection}>
            <Heading style={heading}>إعادة تعيين كلمة المرور</Heading>

            <Text style={text}>
              تلقينا طلباً لإعادة تعيين كلمة المرور لحسابك في{' '}
              <strong>منصة إثراء الذكاء</strong>. اضغط على الزر أدناه لاختيار كلمة
              مرور جديدة.
            </Text>

            <Text style={text}>
              هذا الرابط صالح لمدة ساعة واحدة فقط. إذا لم تطلب إعادة التعيين،
              يمكنك تجاهل هذا البريد بأمان.
            </Text>

            <Section style={btnContainer}>
              <Button style={button} href={link}>
                إعادة تعيين كلمة المرور
              </Button>
            </Section>
          </Section>

          <Section style={footerSection}>
            <Text style={footerText}>
              تنمية وإثراء الذكاء للمؤسسات والأفراد · المملكة العربية السعودية
            </Text>
            <Text style={footerLinks}>
              <Link href="https://ithrathaka.com" style={linkStyle}>
                الموقع الرسمي
              </Link>{' '}
              |{' '}
              <Link href="mailto:support@ithrathaka.com" style={linkStyle}>
                الدعم الفني
              </Link>
            </Text>
          </Section>
        </Container>
      </Body>
    </Html>
  );
};

const main = {
  backgroundColor: '#f8fafc',
  fontFamily: 'Cairo, system-ui, -apple-system, sans-serif',
  padding: '40px 10px',
};

const container = {
  backgroundColor: '#ffffff',
  border: '1px solid #e2e8f0',
  borderRadius: '16px',
  maxWidth: '560px',
  margin: '0 auto',
  overflow: 'hidden',
  boxShadow: '0 4px 12px rgba(114, 34, 227, 0.03)',
};

const logoContainer = {
  background: 'linear-gradient(135deg, #7222e3 0%, #2b4683 100%)',
  padding: '30px',
  textAlign: 'center' as const,
};

const logoText = {
  color: '#ffffff',
  fontSize: '24px',
  fontWeight: 'bold',
  margin: '0',
  letterSpacing: '1px',
};

const logoSpan = {
  color: '#ff9ad7',
};

const contentSection = {
  padding: '40px 30px',
  textAlign: 'right' as const,
};

const heading = {
  color: '#1e293b',
  fontSize: '22px',
  fontWeight: '800',
  marginBottom: '20px',
};

const text = {
  color: '#475569',
  fontSize: '15px',
  lineHeight: '1.6',
  marginBottom: '16px',
};

const btnContainer = {
  textAlign: 'center' as const,
  margin: '30px 0',
};

const button = {
  backgroundColor: '#7222e3',
  borderRadius: '12px',
  color: '#ffffff',
  fontSize: '15px',
  fontWeight: 'bold',
  textDecoration: 'none',
  textAlign: 'center' as const,
  display: 'inline-block',
  padding: '14px 30px',
  boxShadow: '0 4px 10px rgba(114, 34, 227, 0.2)',
};

const footerSection = {
  backgroundColor: '#f1f5f9',
  padding: '24px 30px',
  textAlign: 'center' as const,
};

const footerText = {
  color: '#64748b',
  fontSize: '12px',
  margin: '0 0 8px 0',
};

const footerLinks = {
  color: '#64748b',
  fontSize: '12px',
  margin: '0',
};

const linkStyle = {
  color: '#7222e3',
  textDecoration: 'none',
  fontWeight: '600',
};
