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
  private initPromise: Promise<void> | null = null;

  constructor() {
    this.initPromise = this.initializeTransporter();
  }

  private async initializeTransporter(): Promise<void> {
    if (config.nodeEnv === 'development') {
      // Use Ethereal Email for development
      try {
        const account = await nodemailer.createTestAccount();

        this.transporter = nodemailer.createTransport({
          host: account.smtp.host,
          port: account.smtp.port,
          secure: account.smtp.secure,
          auth: {
            user: account.user,
            pass: account.pass,
          },
        });

        logger.info('Test email account created', { user: account.user });
      } catch (err) {
        logger.error('Failed to create test email account', { error: err });
        throw err;
      }
    } else {
      // Use real email service in production
      const smtpHost = process.env.SMTP_HOST;
      const smtpUser = process.env.SMTP_USER;
      const smtpPass = process.env.SMTP_PASS;

      if (!smtpHost || !smtpUser || !smtpPass) {
        logger.warn('SMTP credentials not configured. Email sending will fail in production.', {
          hasHost: !!smtpHost,
          hasUser: !!smtpUser,
          hasPass: !!smtpPass,
        });

        // Create a dummy transporter that will fail gracefully
        this.transporter = null;
        return;
      }

      this.transporter = nodemailer.createTransport({
        host: smtpHost,
        port: parseInt(process.env.SMTP_PORT || '587'),
        secure: process.env.SMTP_SECURE === 'true', // true for port 465, false for others
        auth: {
          user: smtpUser,
          pass: smtpPass,
        },
      });

      // Verify SMTP connection
      try {
        await this.transporter.verify();
        logger.info('SMTP connection verified successfully');
      } catch (error) {
        logger.error('SMTP connection verification failed', { error });
        throw error;
      }
    }
  }

  async sendEmail(options: EmailOptions): Promise<void> {
    // Wait for transporter to be initialized
    if (this.initPromise) {
      await this.initPromise;
    }

    if (!this.transporter) {
      const error = 'Email transporter not initialized. Check SMTP configuration.';
      logger.error(error);
      throw new Error(error);
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
        const previewUrl = nodemailer.getTestMessageUrl(info);
        logger.info('Email sent (test mode)', {
          messageId: info.messageId,
          previewUrl,
        });
      } else {
        logger.info('Email sent successfully', {
          messageId: info.messageId,
          to: options.to,
          subject: options.subject,
        });
      }
    } catch (error) {
      logger.error('Failed to send email', {
        error: error instanceof Error ? error.message : 'Unknown error',
        to: options.to,
        subject: options.subject,
      });
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