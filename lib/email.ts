import { render } from '@react-email/components'
import nodemailer from 'nodemailer'
import { createElement } from 'react'
import { RedemptionEmail } from '@/emails/redemption'

function createTransport () {
  const secure = process.env.SMTP_SECURE === 'true'
  return nodemailer.createTransport({
    host: process.env.SMTP_HOST,
    port: Number(process.env.SMTP_PORT) || 587,
    secure,
    auth: {
      user: process.env.SMTP_USER,
      pass: process.env.SMTP_PASSWORD
    }
  })
}

export async function sendRedemptionEmail (
  to: string,
  name: string | null,
  code: string,
  url: string
): Promise<void> {
  const html = await render(
    createElement(RedemptionEmail, {
      name: name ?? undefined,
      code,
      redemptionUrl: url
    })
  )

  const transport = createTransport()
  await transport.sendMail({
    from: process.env.EMAIL_FROM,
    to,
    subject: 'Your Cursor Pro Credit - Redeemed',
    html
  })
}
