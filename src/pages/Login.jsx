import { useState, useEffect } from "react";
import { useNavigate, Link } from "react-router-dom";
import API from "../services/api";
import OTP_API from "../services/otpApi";

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
  const [step, setStep] = useState("credentials");

  const [otpDigits, setOtpDigits] = useState(["", "", "", "", "", ""]);

  const [generatedOtp, setGeneratedOtp] = useState("");

  const [timer, setTimer] = useState(30);

  const [tempUserData, setTempUserData] = useState(null);

  // SMTP configuration
  const [smtpConfig, setSmtpConfig] = useState({
    email: localStorage.getItem("smtp_email") || "",
    password: localStorage.getItem("smtp_password") || ""
  });

  const [showConfigPanel, setShowConfigPanel] = useState(false);

  const [emailStatus, setEmailStatus] = useState("");

  const [emailError, setEmailError] = useState("");

  const [showSimulatedBanner, setShowSimulatedBanner] = useState(false);

  // Handle countdown timer
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

  // Generate OTP and send
  const generateAndSendOtp = async (targetEmail) => {

    const code = Math.floor(
      100000 + Math.random() * 900000
    ).toString();

    setGeneratedOtp(code);

    setOtpDigits(["", "", "", "", "", ""]);

    setTimer(30);

    setShowSimulatedBanner(false);

    setEmailStatus("sending");

    setEmailError("");

    try {

      const payload = {
        email: targetEmail,
        otpCode: code,
        smtpConfig:
          smtpConfig.email &&
          smtpConfig.password
            ? {
                user: smtpConfig.email,
                pass: smtpConfig.password
              }
            : null
      };

      // UPDATED API
      const res = await OTP_API.post(
        "/send-otp",
        payload
      );

      if (res.data.success) {

        setEmailStatus("sent");

      } else {

        setEmailStatus("failed");

        setEmailError(
          res.data.message ||
          "Failed to dispatch email."
        );

        setShowSimulatedBanner(true);
      }

    } catch (err) {

      console.error(
        "OTP Backend Error:",
        err
      );

      setEmailStatus("failed");

      setEmailError(
        "OTP backend server is offline."
      );

      setShowSimulatedBanner(true);
    }
  };

  const handleChange = (e) => {

    setForm({
      ...form,
      [e.target.name]: e.target.value
    });
  };

  // Step 1: Login
  const handleLogin = async (e) => {

    e.preventDefault();

    setLoading(true);

    setMessage("");

    try {

      const res = await API.post(
        "/auth/login",
        form
      );

      if (
        res.data &&
        (
          res.data.includes("Login Success") ||
          res.data.success ||
          typeof res.data === "object"
        )
      ) {

        const loggedInUser = {
          name:
            form.email
              .split("@")[0]
              .charAt(0)
              .toUpperCase() +
            form.email
              .split("@")[0]
              .slice(1),

          email: form.email
        };

        setTempUserData({
          user: loggedInUser,
          originalResponse: res.data
        });

        setStep("otp");

        await generateAndSendOtp(form.email);

      } else {

        setMessage(
          "Invalid Email or Password"
        );

        setMessageType("error");
      }

    } catch (error) {

      setMessage(
        "Invalid Email or Password / Server Connection Issue"
      );

      setMessageType("error");

    } finally {

      setLoading(false);
    }
  };

  // Verify OTP
  const handleVerifyOtp = (e) => {

    e.preventDefault();

    const enteredOtp = otpDigits.join("");

    setLoading(true);

    setMessage("");

    if (enteredOtp === generatedOtp) {

      const userToSave =
        tempUserData?.user || {
          name:
            form.email
              .split("@")[0]
              .charAt(0)
              .toUpperCase() +
            form.email
              .split("@")[0]
              .slice(1),

          email: form.email
        };

      localStorage.setItem(
        "user",
        JSON.stringify(userToSave)
      );

      setMessage(
        "Login Successful! Redirecting..."
      );

      setMessageType("success");

      setTimeout(
        () => navigate("/dashboard"),
        1200
      );

    } else {

      setMessage(
        "Invalid OTP Verification Code"
      );

      setMessageType("error");

      setLoading(false);
    }
  };

  // OTP digit handling
  const handleDigitChange = (
    value,
    index
  ) => {

    if (!/^\d*$/.test(value)) return;

    const newDigits = [...otpDigits];

    newDigits[index] = value.slice(-1);

    setOtpDigits(newDigits);

    if (value && index < 5) {

      const nextInput =
        document.getElementById(
          `otp-input-${index + 1}`
        );

      if (nextInput) nextInput.focus();
    }
  };

  const handleKeyDown = (
    e,
    index
  ) => {

    if (e.key === "Backspace") {

      if (!otpDigits[index] && index > 0) {

        const prevInput =
          document.getElementById(
            `otp-input-${index - 1}`
          );

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

    const pasteData =
      e.clipboardData
        .getData("text")
        .trim();

    if (/^\d{6}$/.test(pasteData)) {

      const newDigits =
        pasteData.split("");

      setOtpDigits(newDigits);

      const lastInput =
        document.getElementById(
          "otp-input-5"
        );

      if (lastInput) lastInput.focus();
    }
  };

  return (
    <div className="auth-container">

      <div className="auth-card">

        <h2>
          {step === "credentials"
            ? "Welcome Back"
            : "Security Verification"}
        </h2>

        <p className="subtitle">
          {step === "credentials"
            ? "Enter your credentials"
            : `OTP sent to ${form.email}`}
        </p>

        {/* LOGIN FORM */}
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

            <button
              className="auth-btn"
              type="submit"
              disabled={loading}
            >

              {loading
                ? "Signing In..."
                : "Sign In"}

            </button>

          </form>
        )}

        {/* OTP FORM */}
        {step === "otp" && (

          <form onSubmit={handleVerifyOtp}>

            <div
              className="otp-digits-wrapper"
              onPaste={handlePaste}
            >

              {otpDigits.map(
                (digit, idx) => (

                  <input
                    key={idx}
                    id={`otp-input-${idx}`}
                    type="text"
                    maxLength="1"
                    className="otp-digit-input"
                    value={digit}
                    onChange={(e) =>
                      handleDigitChange(
                        e.target.value,
                        idx
                      )
                    }
                    onKeyDown={(e) =>
                      handleKeyDown(
                        e,
                        idx
                      )
                    }
                    required
                  />
                )
              )}

            </div>

            <button
              className="auth-btn"
              type="submit"
            >
              Verify & Login
            </button>

            <div className="otp-cooldown">

              {timer > 0 ? (

                <span>
                  Resend code in{" "}
                  <strong>
                    {timer}s
                  </strong>
                </span>

              ) : (

                <button
                  type="button"
                  className="otp-resend-btn"
                  onClick={() =>
                    generateAndSendOtp(
                      form.email
                    )
                  }
                >
                  Resend Verification Code
                </button>
              )}

            </div>

          </form>
        )}

        {message && (
          <div
            className={`auth-message ${messageType}`}
          >
            {message}
          </div>
        )}

        <p className="auth-link">

          Don't have an account?{" "}

          <Link to="/register">
            Sign up
          </Link>

        </p>

      </div>

    </div>
  );
}

export default Login;
