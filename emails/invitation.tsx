import {
  Body,
  Button,
  Container,
  Head,
  Html,
  Preview,
  Section,
  Text,
} from '@react-email/components'

type Props = {
  name?: string
  loginUrl?: string
}

const baseUrl = process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3000'

export function InvitationEmail({ name, loginUrl }: Props) {
  const url = loginUrl ?? `${baseUrl}/login`

  return (
    <Html>
      <Head />
      <Preview>You've been invited to join Alsia</Preview>
      <Body style={main}>
        <Container style={container}>
          <Text style={heading}>You're invited!</Text>
          <Text style={paragraph}>
            Hi{name ? ` ${name}` : ''}, you've been invited to join Alsia.
            Click the button below to sign in.
          </Text>
          <Section style={buttonContainer}>
            <Button href={url} style={button}>
              Sign in
            </Button>
          </Section>
          <Text style={paragraph}>
            If you didn't expect this invitation, you can ignore this email.
          </Text>
        </Container>
      </Body>
    </Html>
  )
}

const main = {
  backgroundColor: '#f6f9fc',
  fontFamily:
    '-apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,"Helvetica Neue",Ubuntu,sans-serif',
  padding: '40px 0',
}

const container = {
  backgroundColor: '#ffffff',
  border: '1px solid #e6ebf1',
  borderRadius: '8px',
  margin: '0 auto',
  maxWidth: '480px',
  padding: '40px',
}

const heading = {
  fontSize: '24px',
  fontWeight: '600',
  lineHeight: '1.3',
  margin: '0 0 16px',
}

const paragraph = {
  color: '#525f7f',
  fontSize: '16px',
  lineHeight: '1.5',
  margin: '0 0 24px',
}

const buttonContainer = {
  textAlign: 'center' as const,
  margin: '24px 0',
}

const button = {
  backgroundColor: '#000000',
  borderRadius: '6px',
  color: '#ffffff',
  fontSize: '16px',
  fontWeight: '600',
  padding: '12px 24px',
  textDecoration: 'none',
}
