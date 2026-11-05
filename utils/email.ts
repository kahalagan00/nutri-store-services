import nodemailer from 'nodemailer';

const RESET_TOKEN_TIME_LIMIT = 15;

export default class Email {
  to: string;
  firstName: string;
  url: string;
  from: string;
  constructor(user: { email: string; name: string }, url: string) {
    this.to = user.email;
    this.firstName = user.name.split(' ')[0];
    this.url = url;
    this.from = `Jhuv Nutri Support <${process.env.EMAIL_FROM}>`;
  }

  newTransport() {
    if (process.env.NODE_ENV === 'production') {
      // Brevo Code
      return nodemailer.createTransport({
        // service: 'Brevo',
        host: process.env.BREVO_HOST,
        port: Number(process.env.BREVO_PORT),
        auth: {
          user: process.env.BREVO_LOGIN,
          pass: process.env.BREVO_SMTPKEY,
        },
      });
    }

    return nodemailer.createTransport({
      host: process.env.EMAIL_HOST,
      port: Number(process.env.EMAIL_PORT),
      auth: {
        user: process.env.EMAIL_USERNAME,
        pass: process.env.EMAIL_PASSWORD,
      },
    });
  }

  // Send the actual email
  async send(subject: string) {
    // 1) Generate email content which is an HTML page in this case
    const token = this.url.split('/').at(-1);
    const htmlContent = `
      <!DOCTYPE html>
      <html lang="en">
      <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Forgot Password</title>
        <style>
          body {
            font-family: Arial, sans-serif;
            margin: 0;
            padding: 0;
            background-color: #f9fafb;
            color: #333;
          }
          .container {
            max-width: 600px;
            margin: 20px auto;
            padding: 20px;
            background-color: #ffffff;
            border-radius: 8px;
            box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);
          }
          .header {
            text-align: center;
            color: #3b82f6;
          }
          .header h1 {
            margin: 0;
            font-size: 24px;
          }
          .content {
            text-align: center;
            margin-top: 20px;
            line-height: 1.6;
          }
          .content p {
            margin-bottom: 20px;
          }
          .token_container {
            display: block;
            width: auto;
            padding: 10px 20px;
            background-color: #e11d48;
            color: #ffffff;
            text-decoration: none;
            font-size: 16px;
            border-radius: 4px;
            margin-left: auto;
            margin-right: auto;
            overflow-wrap: break-word;
          }
          .footer {
            margin-top: 30px;
            text-align: center;
            font-size: 12px;
            color: #888;
          }
          .footer a {
            color: #3b82f6;
            text-decoration: none;
          }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h1>Reset Token</h1>
          </div>
          <div class="content">
            <p>Hello User,</p>
            <p>We received a request to reset your password. Copy the token below:</p>
            <div  class="token_container">${token}</div>
            <p>If you did not request a password reset, please ignore this email or contact support if you have questions.</p>
          </div>
          <div class="footer">
            <p>Please feel free to contact us on our company email below:</p>
            <a href="#">jhuv-nutri-support@jhuv.com</a>
          </div>
        </div>
      </body>
      </html>
    `;

    // 2) Define email options
    const mailOptions = {
      from: this.from,
      to: this.to,
      subject,
      html: htmlContent,
    };

    // 3) Create a transport and send email
    await this.newTransport().sendMail(mailOptions);
  }

  async sendWelcome() {
    await this.send('Welcome to the Jhuv Nutri Store Family!');
  }

  async sendPasswordReset() {
    await this.send(
      `Your password reset token (valid for only ${RESET_TOKEN_TIME_LIMIT} minutes)`
    );
  }
}
