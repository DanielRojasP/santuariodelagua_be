import nodemailer from "nodemailer";

export const sendEmail = async ({ to, subject, html }: any) => {
  const transporter = nodemailer.createTransport({
    // host: process.env.EMAIL_PROVIDER, // El servidor de Hostinger
    host: "smtp.hostinger.com", // El servidor de Hostinger
    port: 465,                  // Puerto seguro para SSL
    secure: true,               // true para puerto 465
    auth: {
      user: process.env.SMTP_USERNAME, // Tu correo: info@tudominio.com
      pass: process.env.SMTP_PASSWORD, // Tu contraseña de Hostinger
    },
  });

  await transporter.sendMail({
    from: `"Santuario del Agua" <${process.env.SMTP_USERNAME}>`,
    to,
    bcc: "rojasporrasdaniel@gmail.com",
    subject,
    html,
  });
};