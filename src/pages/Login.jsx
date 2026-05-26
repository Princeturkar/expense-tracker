import { useState, useEffect } from "react";
import { useNavigate, Link } from "react-router-dom";
import API from "../services/api";
import axios from "axios";

function Login() {
  const navigate = useNavigate();
  
  // Credentials Step form state
  const [form, setForm] = useState({
    email: "",
    password: ""
  });
  
  const [message, setMessage] = useState("");
  const [messageType, setMessageType] = useState("");
  const [loading, setLoading] = useState(false);

  // OTP Step-specific states
  const [step, setStep] = useState("credentials"); // "credentials" | "otp"
  const [otpDigits, setOtpDigits] = useState(["", "", "", "", "", ""]);
  const [generatedOtp, setGeneratedOtp] = useState("");
  const [timer, setTimer] = useState(30);
  const [tempUserData, setTempUserData] = useState(null);

  // SMTP configuration (optional overrides, stored in localStorage)
  const [smtpConfig, setSmtpConfig] = useState({
    email: localStorage.getItem("smtp_email") || "",
    password: localStorage.getItem("smtp_password") || ""
  });
  const [showConfigPanel, setShowConfigPanel] = useState(false);
  const [emailStatus, setEmailStatus] = useState(""); // "sending" | "sent" | "failed" | ""
  const [emailError, setEmailError] = useState("");
  const [showSimulatedBanner, setShowSimulatedBanner] = useState(false);

  // Handle countdown timer for Resend OTP
  useEffect(() => {
    let interval = null;
    if (step === "otp" && timer > 0) {
      interval = setInterval(() => {
        setTimer((prev) => prev - 1);
      }, 1000);
    } else if (timer === 0) {
      clearInterval(interval);
    }
    return () => clearInterval(interval);
  }, [step, timer]);

  // Generate OTP and dispatch via Node Server (Nodemailer)
  const generateAndSendOtp = async (targetEmail) => {
    const code = Math.floor(100000 + Math.random() * 900000).toString();
    setGeneratedOtp(code);
    setOtpDigits(["", "", "", "", "", ""]); // Reset input digits
    setTimer(30); // Reset cooldown
    setShowSimulatedBanner(false);
    setEmailStatus("sending");
    setEmailError("");

    try {
      const payload = {
        email: targetEmail,
        otpCode: code,
        smtpConfig: smtpConfig.email && smtpConfig.password ? {
          user: smtpConfig.email,
          pass: smtpConfig.password
        } : null
      };
      
      // Attempt to call the local SMTP Node server
      const res = await axios.post("http://localhost:5001/api/send-otp", payload);
      
      if (res.data.success) {
        setEmailStatus("sent");
      } else {
        setEmailStatus("failed");
        setEmailError(res.data.message || "Failed to dispatch email.");
        setShowSimulatedBanner(true); // Fallback to simulated screen view
      }
    } catch (err) {
      console.error("Local Nodemailer SMTP Express server is not reachable:", err);
      setEmailStatus("failed");
      setEmailError(
        "Nodemailer backend is offline. Start the server in your terminal by typing 'npm run server'."
      );
      setShowSimulatedBanner(true); // Fallback to simulated display so they can still test
    }
  };

  const handleChange = (e) => {
    setForm({
      ...form,
      [e.target.name]: e.target.value
    });
  };

  // Step 1: Submit Credentials
  const handleLogin = async (e) => {
    e.preventDefault();
    setLoading(true);
    setMessage("");
    try {
      const res = await API.post("/auth/login", form);
      if (res.data && (res.data.includes("Login Success") || res.data.success || typeof res.data === "object")) {
        // Prepare user info locally
        const loggedInUser = {
          name: form.email.split("@")[0].charAt(0).toUpperCase() + form.email.split("@")[0].slice(1),
          email: form.email
        };
        setTempUserData({
          user: loggedInUser,
          originalResponse: res.data
        });
        
        // Transition to OTP verification step
        setStep("otp");
        await generateAndSendOtp(form.email);
      } else {
        setMessage("Invalid Email or Password");
        setMessageType("error");
      }
    } catch (error) {
      setMessage("Invalid Email or Password / Server Connection Issue");
      setMessageType("error");
    } finally {
      setLoading(false);
    }
  };

  // Step 2: Verify OTP
  const handleVerifyOtp = (e) => {
    e.preventDefault();
    const enteredOtp = otpDigits.join("");
    setLoading(true);
    setMessage("");

    if (enteredOtp === generatedOtp) {
      const userToSave = tempUserData?.user || {
        name: form.email.split("@")[0].charAt(0).toUpperCase() + form.email.split("@")[0].slice(1),
        email: form.email
      };
      localStorage.setItem("user", JSON.stringify(userToSave));
      
      setMessage("Login Successful! Redirecting...");
      setMessageType("success");
      setTimeout(() => navigate("/dashboard"), 1200);
    } else {
      setMessage("Invalid OTP Verification Code");
      setMessageType("error");
      setLoading(false);
    }
  };

  // Auto-advancing focus mechanics
  const handleDigitChange = (value, index) => {
    if (!/^\d*$/.test(value)) return;
    
    const newDigits = [...otpDigits];
    newDigits[index] = value.slice(-1);
    setOtpDigits(newDigits);

    if (value && index < 5) {
      const nextInput = document.getElementById(`otp-input-${index + 1}`);
      if (nextInput) nextInput.focus();
    }
  };

  const handleKeyDown = (e, index) => {
    if (e.key === "Backspace") {
      if (!otpDigits[index] && index > 0) {
        const prevInput = document.getElementById(`otp-input-${index - 1}`);
        if (prevInput) {
          prevInput.focus();
          const newDigits = [...otpDigits];
          newDigits[index - 1] = "";
          setOtpDigits(newDigits);
        }
      }
    }
  };

  const handlePaste = (e) => {
    e.preventDefault();
    const pasteData = e.clipboardData.getData("text").trim();
    if (/^\d{6}$/.test(pasteData)) {
      const newDigits = pasteData.split("");
      setOtpDigits(newDigits);
      const lastInput = document.getElementById("otp-input-5");
      if (lastInput) lastInput.focus();
    }
  };

  return (
    <div className="auth-container">
      {/* Drifting Neon Decorative Orbs */}
      <div className="auth-bg-orbs">
        <div className="auth-orb auth-orb-1"></div>
        <div className="auth-orb auth-orb-2"></div>
        <div className="auth-orb auth-orb-3"></div>
      </div>

      <div className="auth-card">
        {/* Floating Mock Email Dispatch Notification (shown when local SMTP server is not running or credentials fail) */}
        {step === "otp" && showSimulatedBanner && (
          <div className="otp-notification">
            <div className="otp-notification-header">
              <span className="otp-badge">Simulated Mail Sandbox</span>
              <button className="otp-close-btn" onClick={() => setShowSimulatedBanner(false)}>&times;</button>
            </div>
            <div className="otp-notification-body">
              <p>To: <strong>{form.email}</strong></p>
              <p>Your Secure One-Time Password is:</p>
              <div className="otp-code-display">{generatedOtp}</div>
              <p style={{ fontSize: "10.5px", color: "var(--brand-orange)", marginTop: "8px", marginBottom: "0", lineHeight: "1.4" }}>
                * Nodemailer backend is offline. Run <code>npm run server</code> in your terminal to receive real emails in your inbox!
              </p>
            </div>
          </div>
        )}

        <div className="text-center mb-2">
          <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" style={{ color: "var(--brand-green)" }}>
            <line x1="12" y1="1" x2="12" y2="23"></line>
            <path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"></path>
          </svg>
        </div>

        <h2>{step === "credentials" ? "Welcome Back" : "Security Verification"}</h2>
        <p className="subtitle">
          {step === "credentials" 
            ? "Enter your credentials to access your dashboard" 
            : `Enter the 6-digit OTP code sent to your email address: ${form.email}`
          }
        </p>

        {/* Credentials Form Step */}
        {step === "credentials" && (
          <form onSubmit={handleLogin}>
            <div className="auth-input-group">
              <input
                type="email"
                name="email"
                className="auth-input"
                placeholder="Email Address"
                value={form.email}
                onChange={handleChange}
                required
                disabled={loading}
              />
            </div>

            <div className="auth-input-group">
              <input
                type="password"
                name="password"
                className="auth-input"
                placeholder="Password"
                value={form.password}
                onChange={handleChange}
                required
                disabled={loading}
              />
            </div>

            <button className="auth-btn" type="submit" disabled={loading}>
              {loading ? "Signing In..." : "Sign In"}
            </button>

            {/* Sandbox Developer Bypass */}
            <div className="text-center mt-3">
              <button
                type="button"
                onClick={async () => {
                  const testEmail = form.email || "princeturkar1@gmail.com";
                  const demoUser = {
                    name: testEmail.split("@")[0].charAt(0).toUpperCase() + testEmail.split("@")[0].slice(1),
                    email: testEmail
                  };
                  setTempUserData({
                    user: demoUser,
                    originalResponse: "Sandbox Bypass"
                  });
                  setForm({ ...form, email: testEmail });
                  setStep("otp");
                  await generateAndSendOtp(testEmail);
                }}
                className="btn btn-link text-success p-0 small"
                style={{ textDecoration: "none", fontSize: "12px", fontWeight: "600" }}
              >
                🧪 Demo Sandbox Login (Bypass API)
              </button>
            </div>
          </form>
        )}

        {/* OTP Form Step */}
        {step === "otp" && (
          <form onSubmit={handleVerifyOtp}>
            <div className="otp-container">
              {emailStatus === "sending" && (
                <div className="alert alert-info py-2 w-100 fs-7 text-center" role="alert">
                  Sending email via local Nodemailer...
                </div>
              )}
              {emailStatus === "sent" && (
                <div className="alert alert-success py-2 w-100 fs-7 text-center" role="alert">
                  OTP sent to your Gmail inbox!
                </div>
              )}
              {emailStatus === "failed" && (
                <div className="alert alert-danger py-2 w-100 fs-7 text-center" role="alert" style={{ fontSize: "11px", lineHeight: "1.4" }}>
                  {emailError}
                </div>
              )}

              <div className="otp-digits-wrapper" onPaste={handlePaste}>
                {otpDigits.map((digit, idx) => (
                  <input
                    key={idx}
                    id={`otp-input-${idx}`}
                    type="text"
                    pattern="\d*"
                    maxLength="1"
                    className="otp-digit-input"
                    value={digit}
                    onChange={(e) => handleDigitChange(e.target.value, idx)}
                    onKeyDown={(e) => handleKeyDown(e, idx)}
                    required
                    autoFocus={idx === 0}
                    disabled={loading}
                    placeholder="•"
                  />
                ))}
              </div>

              <button className="auth-btn" type="submit" disabled={loading}>
                {loading ? "Verifying..." : "Verify & Login"}
              </button>

              <div className="otp-cooldown">
                {timer > 0 ? (
                  <span>Resend code in <strong>{timer}s</strong></span>
                ) : (
                  <button
                    type="button"
                    className="otp-resend-btn"
                    onClick={() => generateAndSendOtp(form.email)}
                    disabled={loading}
                  >
                    Resend Verification Code
                  </button>
                )}
              </div>

              {/* Dynamic local SMTP Settings Drawer */}
              <div style={{ marginTop: "20px", width: "100%" }}>
                <button
                  type="button"
                  className="btn btn-link text-success p-0 small"
                  style={{ textDecoration: "none", fontSize: "12px", display: "flex", alignItems: "center", justifyContent: "center", gap: "4px", margin: "0 auto" }}
                  onClick={() => setShowConfigPanel(!showConfigPanel)}
                >
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                    <path d="M12.22 2h-.44a2 2 0 0 0-2 2v.18a2 2 0 0 1-1 1.73l-.43.25a2 2 0 0 1-2 0l-.15-.08a2 2 0 0 0-2.73.73l-.22.38a2 2 0 0 0 .73 2.73l.15.1a2 2 0 0 1 1 1.72v.51a2 2 0 0 1-1 1.74l-.15.09a2 2 0 0 0-.73 2.73l.22.38a2 2 0 0 0 2.73.73l.15-.08a2 2 0 0 1 2 0l.43.25a2 2 0 0 1 1 1.73V20a2 2 0 0 0 2 2h.44a2 2 0 0 0 2-2v-.18a2 2 0 0 1 1-1.73l.43-.25a2 2 0 0 1 2 0l.15.08a2 2 0 0 0 2.73-.73l.22-.39a2 2 0 0 0-.73-2.73l-.15-.08a2 2 0 0 1-1-1.74v-.5a2 2 0 0 1 1-1.74l.15-.1a2 2 0 0 0 .73-2.73l-.22-.38a2 2 0 0 0-2.73-.73l-.15.08a2 2 0 0 1-2 0l-.43-.25a2 2 0 0 1-1-1.73V4a2 2 0 0 0-2-2z"></path>
                    <circle cx="12" cy="12" r="3"></circle>
                  </svg>
                  {showConfigPanel ? "Hide SMTP Custom Settings" : "Configure Custom SMTP"}
                </button>

                {showConfigPanel && (
                  <div className="card p-3 mt-2" style={{ background: "var(--brand-green-light)", border: "1px solid var(--card-border)", borderRadius: "12px", textAlign: "left" }}>
                    <h6 className="fs-7 fw-bold mb-2 text-primary" style={{ fontSize: "12px" }}>Enter Custom SMTP Details</h6>
                    <p style={{ fontSize: "11px", color: "var(--text-secondary)", marginBottom: "10px", lineHeight: "1.4" }}>
                      By default, the server uses your Gmail address (<code>princeturkar1@gmail.com</code>). Enter values below only if you wish to override them:
                    </p>
                    <div className="mb-2">
                      <input
                        type="email"
                        className="form-control form-control-sm"
                        placeholder="Alternative Gmail address"
                        style={{ fontSize: "12px", padding: "6px 10px" }}
                        value={smtpConfig.email}
                        onChange={(e) => setSmtpConfig({...smtpConfig, email: e.target.value})}
                      />
                    </div>
                    <div className="mb-2">
                      <input
                        type="password"
                        className="form-control form-control-sm"
                        placeholder="Alternative Google App Password"
                        style={{ fontSize: "12px", padding: "6px 10px" }}
                        value={smtpConfig.password}
                        onChange={(e) => setSmtpConfig({...smtpConfig, password: e.target.value})}
                      />
                    </div>
                    <button
                      type="button"
                      className="btn btn-brand btn-sm w-100"
                      style={{ fontSize: "11px", padding: "8px" }}
                      onClick={() => {
                        localStorage.setItem("smtp_email", smtpConfig.email);
                        localStorage.setItem("smtp_password", smtpConfig.password);
                        alert("Settings Saved! Alternative credentials applied.");
                        setShowConfigPanel(false);
                      }}
                    >
                      Save Settings
                    </button>
                  </div>
                )}
              </div>

              <div className="otp-back-link" onClick={() => setStep("credentials")}>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                  <line x1="19" y1="12" x2="5" y2="12"></line>
                  <polyline points="12 19 5 12 12 5"></polyline>
                </svg>
                Back to credentials login
              </div>
            </div>
          </form>
        )}

        {message && (
          <div className={`auth-message ${messageType}`}>
            {message}
          </div>
        )}

        <p className="auth-link">
          Don't have an account? <Link to="/register">Sign up</Link>
        </p>
      </div>
    </div>
  );
}

export default Login;