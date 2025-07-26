import nodemailer from 'nodemailer';
import { config } from '../config';
import { logger } from '../utils/logger';

interface EmailOptions {
  to: string;
  subject: string;
  html: string;
  text?: string;
}

class EmailService {
  private transporter: nodemailer.Transporter | null = null;

  constructor() {
    this.initializeTransporter();
  }

  private initializeTransporter() {
    if (config.nodeEnv === 'development') {
      // Use Ethereal Email for development
      nodemailer.createTestAccount((err, account) => {
        if (err) {
          logger.error('Failed to create test email account:', err);
          return;
        }

        this.transporter = nodemailer.createTransport({
          host: account.smtp.host,
          port: account.smtp.port,
          secure: account.smtp.secure,
          auth: {
            user: account.user,
            pass: account.pass,
          },
        });

        logger.info('Test email account created:', account.user);
      });
    } else {
      // Use real email service in production
      // Configure based on your email provider (SendGrid, AWS SES, etc.)
      this.transporter = nodemailer.createTransport({
        host: process.env.SMTP_HOST,
        port: parseInt(process.env.SMTP_PORT || '587'),
        secure: process.env.SMTP_SECURE === 'true',
        auth: {
          user: process.env.SMTP_USER,
          pass: process.env.SMTP_PASS,
        },
      });
    }
  }

  async sendEmail(options: EmailOptions): Promise<void> {
    if (!this.transporter) {
      logger.error('Email transporter not initialized');
      return;
    }

    const mailOptions = {
      from: `"CareCompanion" <${process.env.EMAIL_FROM || 'noreply@carecompanion.com'}>`,
      to: options.to,
      subject: options.subject,
      html: options.html,
      text: options.text || this.htmlToText(options.html),
    };

    try {
      const info = await this.transporter.sendMail(mailOptions);
      
      if (config.nodeEnv === 'development') {
        logger.info('Preview URL: %s', nodemailer.getTestMessageUrl(info));
      }
      
      logger.info('Email sent successfully:', info.messageId);
    } catch (error) {
      logger.error('Failed to send email:', error);
      throw error;
    }
  }

  private htmlToText(html: string): string {
    // Simple HTML to text conversion
    return html
      .replace(/<[^>]*>/g, '')
      .replace(/&nbsp;/g, ' ')
      .replace(/&amp;/g, '&')
      .replace(/&lt;/g, '<')
      .replace(/&gt;/g, '>')
      .replace(/&quot;/g, '"')
      .replace(/&#39;/g, "'")
      .trim();
  }
}

export const emailService = new EmailService();

export function sendEmail(options: EmailOptions): Promise<void> {
  return emailService.sendEmail(options);
}