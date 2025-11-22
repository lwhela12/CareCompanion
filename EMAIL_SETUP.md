# Email Service Setup Guide

CareCompanion requires a production email service for:
- Family member invitations
- Medication reminders
- System notifications

## Recommended Email Providers

### 1. Resend (⭐ Recommended for Beta)

**Best for**: Startups, modern API, excellent developer experience

**Pricing**:
- Free: 3,000 emails/month
- Pro: $20/month for unlimited emails

**Pros**:
- Modern, simple API
- Excellent deliverability
- Great documentation
- Fast setup (5 minutes)

**Setup**:
1. Sign up at https://resend.com
2. Verify your sending domain
3. Get your API key

**Environment Variables**:
```env
# Resend (via SMTP)
SMTP_HOST=smtp.resend.com
SMTP_PORT=465
SMTP_SECURE=true
SMTP_USER=resend
SMTP_PASS=your_api_key_here
EMAIL_FROM=noreply@yourdomain.com
```

---

### 2. SendGrid

**Best for**: Established service, good free tier

**Pricing**:
- Free: 100 emails/day forever
- Essentials: $19.95/month for 50,000 emails

**Pros**:
- Very established
- Good free tier for testing
- Extensive features

**Cons**:
- UI can be complex
- More features than needed for simple use case

**Setup**:
1. Sign up at https://sendgrid.com
2. Create an API key
3. Verify your sender identity (single email or domain)

**Environment Variables**:
```env
# SendGrid (via SMTP)
SMTP_HOST=smtp.sendgrid.net
SMTP_PORT=587
SMTP_SECURE=false
SMTP_USER=apikey
SMTP_PASS=your_sendgrid_api_key_here
EMAIL_FROM=noreply@yourdomain.com
```

---

### 3. AWS SES

**Best for**: High volume, cost optimization, existing AWS users

**Pricing**:
- $0.10 per 1,000 emails (extremely cheap)
- Free tier: 3,000 emails/month if using from EC2

**Pros**:
- Very cheap at scale
- Integrates with AWS ecosystem
- High reliability

**Cons**:
- More complex setup
- Requires domain verification
- Starts in sandbox mode (limited recipients)

**Setup**:
1. Go to AWS SES console
2. Verify your domain (requires DNS records)
3. Request production access (moves out of sandbox)
4. Create SMTP credentials

**Environment Variables**:
```env
# AWS SES (via SMTP)
SMTP_HOST=email-smtp.us-east-1.amazonaws.com
SMTP_PORT=587
SMTP_SECURE=false
SMTP_USER=your_ses_smtp_username
SMTP_PASS=your_ses_smtp_password
EMAIL_FROM=noreply@yourdomain.com
```

---

### 4. Mailgun

**Best for**: Alternative to SendGrid

**Pricing**:
- Free: 5,000 emails/month for 3 months
- Foundation: $35/month for 50,000 emails

**Pros**:
- Reliable
- Good API and SMTP support
- Flexible

**Setup**:
1. Sign up at https://www.mailgun.com
2. Add and verify your domain
3. Get SMTP credentials from domain settings

**Environment Variables**:
```env
# Mailgun (via SMTP)
SMTP_HOST=smtp.mailgun.org
SMTP_PORT=587
SMTP_SECURE=false
SMTP_USER=postmaster@yourdomain.com
SMTP_PASS=your_mailgun_smtp_password
EMAIL_FROM=noreply@yourdomain.com
```

---

## Quick Start: Production Setup

### Step 1: Choose Your Provider

For beta launch, we recommend **Resend** for simplicity and generous free tier.

### Step 2: Sign Up and Get Credentials

Follow the setup instructions for your chosen provider above.

### Step 3: Add Environment Variables

Add these to your Railway environment (or `.env.production`):

```env
# Email Configuration
SMTP_HOST=smtp.resend.com
SMTP_PORT=465
SMTP_SECURE=true
SMTP_USER=resend
SMTP_PASS=re_your_actual_api_key_here
EMAIL_FROM=noreply@yourdomain.com
```

### Step 4: Verify Domain (Important!)

All email providers require domain verification to prevent spam:

1. Add DNS records (SPF, DKIM, DMARC) provided by your email service
2. Wait for verification (usually 5-60 minutes)
3. Test email sending

**Without domain verification**, your emails will likely go to spam!

### Step 5: Test Email Sending

Use the test endpoint to verify emails are working:

```bash
curl -X POST https://your-api.railway.app/api/v1/test/email \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -d '{"to": "your@email.com"}'
```

---

## Email Templates

CareCompanion sends these types of emails:

1. **Family Invitations** - When inviting new caregivers
2. **Medication Reminders** - 30 minutes before scheduled doses
3. **Password Reset** (future)
4. **Activity Summaries** (future)

All templates are customizable in the codebase.

---

## Monitoring Email Delivery

### SendGrid Dashboard
- View delivery rates, bounces, spam reports
- Track individual email status

### AWS SES Dashboard
- Monitor sending quotas
- View bounce and complaint rates
- Track reputation

### Resend Dashboard
- Real-time delivery tracking
- Simple, clean interface
- View email logs

---

## Troubleshooting

### Emails Going to Spam

**Solutions**:
1. ✅ Verify your sending domain (SPF, DKIM, DMARC)
2. ✅ Use a real domain (not gmail.com, yahoo.com)
3. ✅ Warm up your sending (start with low volume)
4. ✅ Ensure "from" email matches your verified domain
5. ✅ Add unsubscribe link (for marketing emails)

### Emails Not Sending

**Check**:
1. Environment variables are set correctly
2. SMTP credentials are valid
3. Check Railway logs for errors: `npm run logs`
4. Verify your account is not in sandbox mode (AWS SES)
5. Check your sending limits haven't been exceeded

### Testing in Development

Development mode uses Ethereal Email (no configuration needed):
- Emails don't actually send
- Preview URLs are logged to console
- Perfect for testing without sending real emails

---

## Security Best Practices

1. **Never commit SMTP credentials** to git
2. **Use environment variables** for all secrets
3. **Rotate API keys** periodically
4. **Monitor for suspicious activity** in email provider dashboard
5. **Set up rate limiting** to prevent abuse (already implemented in codebase)

---

## Migration Path

**Beta Launch** (Now):
- Use Resend or SendGrid free tier
- Low volume, easy setup

**Growth Phase** (100+ users):
- Continue with current provider
- Monitor costs

**Scale Phase** (1000+ users):
- Consider migrating to AWS SES for cost savings
- Only if email volume justifies the complexity

---

## Cost Comparison

| Provider | Free Tier | Paid Tier | Cost at 10k emails/month |
|----------|-----------|-----------|--------------------------|
| Resend | 3k/month | $20/month unlimited | $20/month |
| SendGrid | 100/day | $19.95/month for 50k | $19.95/month |
| AWS SES | 3k/month (EC2) | $0.10/1k emails | $1/month |
| Mailgun | 5k/3 months | $35/month for 50k | $35/month |

**Recommendation**: Start with Resend ($20/month) for simplicity. Migrate to AWS SES later if costs become significant (would need 200,000 emails/month to justify the migration effort).

---

## Next Steps

1. Choose your email provider (recommend Resend)
2. Sign up and get SMTP credentials
3. Add environment variables to Railway
4. Verify your sending domain
5. Test with a real invitation
6. Monitor delivery in provider dashboard

---

## Support

- **Resend**: https://resend.com/docs
- **SendGrid**: https://docs.sendgrid.com
- **AWS SES**: https://docs.aws.amazon.com/ses
- **Mailgun**: https://documentation.mailgun.com
