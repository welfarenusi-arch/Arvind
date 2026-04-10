import dotenv from 'dotenv';
dotenv.config();

import express from 'express';
import nodemailer from 'nodemailer';
import cors from 'cors';
import twilio from 'twilio';

const app = express();

app.use(cors());
app.use(express.json());

// Email Transporter
const transporter = nodemailer.createTransport({
  host: process.env.SMTP_HOST,
  port: parseInt(process.env.SMTP_PORT || '587'),
  secure: process.env.SMTP_SECURE === 'true',
  auth: {
    user: process.env.SMTP_USER,
    pass: process.env.SMTP_PASS,
  },
});

// Twilio Client (Lazy Initialization)
let twilioClient: any = null;
const getTwilioClient = () => {
  if (!twilioClient && process.env.TWILIO_ACCOUNT_SID && process.env.TWILIO_AUTH_TOKEN) {
    twilioClient = twilio(process.env.TWILIO_ACCOUNT_SID, process.env.TWILIO_AUTH_TOKEN);
  }
  return twilioClient;
};

// API Routes
app.post('/api/notify-lead', async (req, res) => {
  const { email, leadName, service, score, userEmail } = req.body;

  if (!userEmail) {
    return res.status(400).json({ error: 'User email is required' });
  }

  const mailOptions = {
    from: `"LeadFinder AI" <${process.env.SMTP_USER}>`,
    to: userEmail,
    subject: `🚀 New High-Score Lead: ${leadName}`,
    html: `
      <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #e5e7eb; border-radius: 12px;">
        <h2 style="color: #f97316;">New Lead Captured!</h2>
        <p>A new lead has been identified by the AI system.</p>
        <div style="background: #f9fafb; padding: 15px; border-radius: 8px; margin: 20px 0;">
          <p><strong>Name:</strong> ${leadName}</p>
          <p><strong>Service:</strong> ${service}</p>
          <p><strong>AI Score:</strong> ${score}/100</p>
        </div>
        <p>Log in to your dashboard to view full details and contact the lead.</p>
        <hr style="border: 0; border-top: 1px solid #e5e7eb; margin: 20px 0;" />
        <p style="font-size: 12px; color: #6b7280;">You received this because your email notifications are enabled in LeadFinder AI.</p>
      </div>
    `,
  };

  try {
    if (process.env.SMTP_USER && process.env.SMTP_PASS) {
      await transporter.sendMail(mailOptions);
      res.json({ success: true, message: 'Notification sent' });
    } else {
      console.log('SMTP not configured. Skipping email send.');
      res.json({ success: true, message: 'SMTP not configured, logged to console' });
    }
  } catch (error) {
    console.error('Email error:', error);
    res.status(500).json({ error: 'Failed to send email' });
  }
});

app.post('/api/send-lead-email', async (req, res) => {
  const { to, subject, body } = req.body;
  
  const mailOptions = {
    from: `"LeadFinder AI" <${process.env.SMTP_USER}>`,
    to: to,
    subject: subject,
    text: body,
    html: `<div style="font-family: sans-serif; white-space: pre-wrap;">${body}</div>`,
  };

  try {
    if (process.env.SMTP_USER && process.env.SMTP_PASS) {
      await transporter.sendMail(mailOptions);
      res.json({ success: true, message: 'Email sent to lead' });
    } else {
      res.status(400).json({ error: 'SMTP not configured' });
    }
  } catch (error) {
    console.error('Email error:', error);
    res.status(500).json({ error: 'Failed to send email' });
  }
});

app.post('/api/notify-whatsapp', async (req, res) => {
  const { leadName, service, score, userEmail } = req.body;

  if (!userEmail) {
    return res.status(400).json({ error: 'User email is required' });
  }

  const client = getTwilioClient();
  const fromNumber = process.env.TWILIO_WHATSAPP_NUMBER;
  const toNumber = process.env.USER_WHATSAPP_NUMBER;

  if (client && fromNumber && toNumber) {
    try {
      await client.messages.create({
        from: `whatsapp:${fromNumber}`,
        to: `whatsapp:${toNumber}`,
        body: `🚀 *New High-Score Lead!*\n\n*Name:* ${leadName}\n*Service:* ${service}\n*AI Score:* ${score}/100\n\nLog in to your dashboard for details.`,
      });
      res.json({ success: true, message: 'WhatsApp notification sent' });
    } catch (error) {
      console.error('Twilio error:', error);
      res.status(500).json({ error: 'Failed to send WhatsApp notification' });
    }
  } else {
    res.json({ success: true, message: 'Twilio not configured, logged to console' });
  }
});

app.post('/api/send-lead-whatsapp', async (req, res) => {
  const { to, body } = req.body;
  const client = getTwilioClient();
  const fromNumber = process.env.TWILIO_WHATSAPP_NUMBER;

  if (client && fromNumber) {
    try {
      await client.messages.create({
        from: `whatsapp:${fromNumber}`,
        to: `whatsapp:${to}`,
        body: body,
      });
      res.json({ success: true, message: 'WhatsApp message sent' });
    } catch (error) {
      console.error('Twilio error:', error);
      res.status(500).json({ error: 'Failed to send WhatsApp message' });
    }
  } else {
    res.status(400).json({ error: 'Twilio not configured' });
  }
});

export default app;
