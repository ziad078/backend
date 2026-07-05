import * as React from 'react';
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
} from '@react-email/components';

interface GeneralEmailProps {
  subject: string;
  message: string; // ستكون الرسالة النصية العادية المرسلة من أي مكان بالنظام
}

export const GeneralEmailTemplate = ({
  subject,
  message,
}: GeneralEmailProps): React.JSX.Element => {
  // تحويل السطور الجديدة \n إلى وسم <br /> لكي يظهر التنسيق بشكل صحيح في الـ HTML
  const formattedMessage: React.JSX.Element[] = message.split('\n').map(
    (line, index): React.JSX.Element => (
      <React.Fragment key={index}>
        {line}
        <br />
      </React.Fragment>
    ),
  );

  return (
    <Html lang="ar" dir="rtl">
      <Head />
      <Preview>{subject}</Preview>
      <Body style={main}>
        <Container style={container}>
          {/* الهيدر الموحد */}
          <Section style={logoContainer}>
            <Text style={logoText}>إثراء الذكاء</Text>
          </Section>

          {/* محتوى الرسالة المتغير */}
          <Section style={contentSection}>
            <Heading style={heading}>{subject}</Heading>

            <Text style={text}>{formattedMessage}</Text>
          </Section>

          {/* الفوتر الموحد */}
          <Section style={footerSection}>
            <Text style={footerText}>
              منصة إثراء الذكاء · المملكة العربية السعودية
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

// إعدادات الستايلس الآمنة للـ ESLint
const main = {
  backgroundColor: '#f8fafc',
  fontFamily: 'Cairo, system-ui, sans-serif',
  padding: '40px 10px',
};

const container = {
  backgroundColor: '#ffffff',
  border: '1px solid #e2e8f0',
  borderRadius: '16px',
  maxWidth: '560px',
  margin: '0 auto',
  overflow: 'hidden',
};

const logoContainer = {
  background: 'linear-gradient(135deg, #2b4683 0%, #7222e3 100%)', // مزيج الهوية الأساسي
  padding: '25px 30px',
  textAlign: 'center',
};

const logoText = {
  color: '#ffffff',
  fontSize: '24px',
  fontWeight: '900',
  margin: '0',
};

const contentSection = {
  padding: '40px 30px',
  textAlign: 'right',
};

const heading = {
  color: '#1e293b',
  fontSize: '20px',
  fontWeight: '800',
  marginBottom: '20px',
};

const text = {
  color: '#475569',
  fontSize: '15px',
  lineHeight: '1.7',
  marginBottom: '16px',
};

const footerSection = {
  backgroundColor: '#f1f5f9',
  padding: '24px 30px',
  textAlign: 'center',
};

const footerText = {
  color: '#64748b',
  fontSize: '11.5px',
  margin: '0 0 6px 0',
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
