import express from "express";
import axios from "axios";
import cors from "cors";
import nodemailer from "nodemailer";
import dotenv from "dotenv";

// Load environment variables if present
dotenv.config();

const app = express();
const PORT = process.env.PORT || 5001;

// Middlewares
app.use(cors({
  origin: [
    "http://localhost:5173",
    "http://localhost:3000",
    "http://localhost:5174",
    "https://expense-tracker-sepia-phi-13.vercel.app"
  ],
  credentials: true
}));
app.use(express.json());

// Dynamic SMTP Transporter Setup
const getTransporter = (smtpConfig) => {
  // Use user-provided config, environment variable, or hardcoded verified defaults
  const user = smtpConfig?.user || process.env.SMTP_USER || "princeturkar1@gmail.com";
  const pass = smtpConfig?.pass || process.env.SMTP_PASS || "vuab gpzg pheq tstu";

  return nodemailer.createTransport({
    service: "gmail",
    auth: {
      user,
      pass
    }
  });
};

// Route: Send OTP Email
app.post("/api/send-otp", async (req, res) => {
  const { email, otpCode, smtpConfig } = req.body;

  if (!email || !otpCode) {
    return res.status(400).json({ 
      success: false, 
      message: "Recipient email and OTP code are required." 
    });
  }

  const transporter = getTransporter(smtpConfig);

  // Premium, beautiful HTML email template matching the HSL green design
  const htmlContent = `
    <div style="font-family: 'Plus Jakarta Sans', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; background-color: #f8fafc; padding: 40px 20px; text-align: center; color: #0f172a;">
      <div style="max-width: 500px; margin: 0 auto; background-color: #ffffff; border: 1px solid #e2e8f0; border-radius: 20px; padding: 40px; box-shadow: 0 10px 15px -3px rgba(0, 0, 0, 0.05);">
        
        <!-- Logo Icon -->
        <div style="margin-bottom: 24px;">
          <div style="display: inline-block; background: rgba(16, 185, 129, 0.08); padding: 16px; border-radius: 50%;">
            <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="#10b981" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" style="display: block; margin: 0 auto;">
              <rect x="3" y="11" width="18" height="11" rx="2" ry="2"></rect>
              <path d="M7 11V7a5 5 0 0 1 10 0v4"></path>
            </svg>
          </div>
        </div>

        <h2 style="font-size: 24px; font-weight: 800; margin: 0 0 8px 0; color: #0f172a;">Verify Your Account</h2>
        <p style="font-size: 14px; color: #475569; margin: 0 0 32px 0; line-height: 1.5;">To complete your sign-in, use the secure one-time password (OTP) code below. This code is active for 5 minutes.</p>

        <!-- Dynamic Code Display -->
        <div style="background: linear-gradient(135deg, rgba(16, 185, 129, 0.08) 0%, rgba(99, 102, 241, 0.03) 100%); border: 1.5px dashed #10b981; border-radius: 12px; padding: 16px; margin-bottom: 32px; display: inline-block; letter-spacing: 6px; font-size: 28px; font-weight: 800; color: #10b981; min-width: 200px;">
          ${otpCode}
        </div>

        <div style="border-top: 1px solid #e2e8f0; padding-top: 24px;">
          <p style="font-size: 11px; color: #94a3b8; margin: 0; line-height: 1.5;">If you did not make this request, you can safely ignore this email. Someone may have entered your address by mistake.</p>
        </div>

      </div>
      <p style="font-size: 11px; color: #94a3b8; margin-top: 20px;">Expense Splitting Premium App &copy; 2026</p>
    </div>
  `;

  const senderUser = smtpConfig?.user || process.env.SMTP_USER || "princeturkar1@gmail.com";

  const mailOptions = {
    from: `"Secure Verification" <${senderUser}>`,
    to: email,
    subject: `🔐 ${otpCode} is your verification code`,
    text: `Your account verification code is ${otpCode}.`,
    html: htmlContent
  };

  try {
    await transporter.sendMail(mailOptions);
    return res.status(200).json({ 
      success: true, 
      message: "OTP sent successfully." 
    });
  } catch (error) {
    console.error("Nodemailer transport error:", error);
    return res.status(500).json({ 
      success: false, 
      message: "Error dispatching secure email.",
      details: error.message 
    });
  }
});

// Route: Create Razorpay Order
app.post("/api/create-order", async (req, res) => {
  const { amount } = req.body;

  if (!amount || isNaN(parseFloat(amount)) || parseFloat(amount) <= 0) {
    return res.status(400).json({ 
      success: false, 
      message: "A valid transaction amount is required." 
    });
  }

  // Convert amount to Paise (1 INR = 100 Paise)
  const amountInPaise = Math.round(parseFloat(amount) * 100);

  try {
    const keyId = process.env.RAZORPAY_KEY_ID || "rzp_test_Sskutx9tW32pQ1";
    const keySecret = process.env.RAZORPAY_KEY_SECRET || "kVe4n9aeEu6qfM7IZkFcQPd1";

    const authHeader = Buffer.from(`${keyId}:${keySecret}`).toString("base64");

    const response = await axios.post(
      "https://api.razorpay.com/v1/orders",
      {
        amount: amountInPaise,
        currency: "INR",
        receipt: `rcpt_${Date.now()}`
      },
      {
        headers: {
          Authorization: `Basic ${authHeader}`,
          "Content-Type": "application/json"
        }
      }
    );

    return res.status(200).json({
      success: true,
      keyId: keyId,
      orderId: response.data.id,
      amount: amountInPaise
    });
  } catch (error) {
    console.error("Razorpay order creation failed:", error.response?.data || error.message);
    return res.status(500).json({
      success: false,
      message: "Failed to initialize payment gateway order.",
      details: error.response?.data?.error?.description || error.message
    });
  }
});

// App listener
app.listen(PORT, () => {
  console.log(`Backend OTP server running on http://localhost:${PORT}`);
});
