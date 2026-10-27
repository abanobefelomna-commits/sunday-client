import nodemailer from 'nodemailer';

export async function sendOtpEmail(toEmail: string, code: string): Promise<boolean> {
  const host = process.env.SMTP_HOST;
  const port = Number(process.env.SMTP_PORT || 465);
  const user = process.env.SMTP_USER;
  const pass = process.env.SMTP_PASS;
  const from = process.env.MAIL_FROM || user;
  const ttlMinutes = Number(process.env.OTP_TTL_MINUTES || 10);

  if (!host || !user || !pass || !from) {
    console.warn(`[EmailService] SMTP not fully configured. Generated OTP for ${toEmail} is: ${code}`);
    return false;
  }

  const heading = 'استعادة كلمة المرور';

  const transporter = nodemailer.createTransport({
    host,
    port,
    secure: port === 465,
    auth: { user, pass },
  });

  const text = [
    `مرحبًا،`,
    ``,
    `كود ${heading} هو: ${code}`,
    `صلاحية الكود ${ttlMinutes} دقائق.`,
    `إذا لم تطلب هذه العملية، يمكنك تجاهل الرسالة.`,
  ].join('\n');

  const html = `
    <div dir="rtl" style="font-family:Arial,sans-serif;max-width:520px;margin:auto;line-height:1.8;padding:20px;border:1px solid #e5e7eb;border-radius:12px;background:#ffffff">
      <h2 style="color:#1e3a8a;text-align:center">${heading} - مدارس الأحد</h2>
      <p style="color:#374151">استخدم الكود التالي لإكمال عملية استعادة كلمة المرور:</p>
      <div style="font-size:32px;font-weight:bold;letter-spacing:8px;padding:16px;background:#f3f4f6;text-align:center;border-radius:8px;color:#111827;margin:20px 0">
        ${code}
      </div>
      <p style="color:#6b7280;font-size:14px">صلاحية الكود ${ttlMinutes} دقائق، ويمكن استخدامه مرة واحدة فقط.</p>
      <p style="color:#9ca3af;font-size:12px">إذا لم تطلب هذه العملية، يمكنك تجاهل هذه الرسالة بأمان.</p>
    </div>
  `;

  try {
    await transporter.sendMail({
      from,
      to: toEmail,
      subject: `${heading} - مدارس الأحد`,
      text,
      html,
    });
    return true;
  } catch (error) {
    console.error('[EmailService] Failed to send email:', error);
    return false;
  }
}
