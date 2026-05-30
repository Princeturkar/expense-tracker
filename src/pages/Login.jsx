import { useState, useEffect } from "react";
import { useNavigate, Link } from "react-router-dom";
import API from "../services/api";
import OTP_API from "../services/otpApi";

function Login() {

  const navigate = useNavigate();

  const [form, setForm] = useState({
    email: "",
    password: ""
  });

  const [message, setMessage] = useState("");
  const [messageType, setMessageType] = useState("");
  const [loading, setLoading] = useState(false);

  const [step, setStep] = useState("credentials");

  const [otpDigits, setOtpDigits] = useState(["", "", "", "", "", ""]);

  const [generatedOtp, setGeneratedOtp] = useState("");

  const [timer, setTimer] = useState(30);

  const [tempUserData, setTempUserData] = useState(null);

  const [emailStatus, setEmailStatus] = useState("");

  const [emailError, setEmailError] = useState("");

  useEffect(() => {

    let interval = null;

    if (step === "otp" && timer > 0) {

      interval = setInterval(() => {
        setTimer((prev) => prev - 1);
      }, 1000);

    }

    return () => clearInterval(interval);

  }, [step, timer]);

  // Send OTP
  const generateAndSendOtp = async (targetEmail) => {

    const code = Math.floor(
      100000 + Math.random() * 900000
    ).toString();

    setGeneratedOtp(code);

    setOtpDigits(["", "", "", "", "", ""]);

    setTimer(30);

    setEmailStatus("sending");

    setEmailError("");

    try {

      const payload = {
        email: targetEmail,
        otpCode: code
      };

      const res = await OTP_API.post(
        "/send-otp",
        payload
      );

      if (res.data.success) {

        setEmailStatus("sent");

      } else {

        setEmailStatus("failed");

        setEmailError(
          res.data.message || "Failed to send OTP"
        );
      }

    } catch (err) {

      console.error(err);

      setEmailStatus("failed");

      setEmailError(
        "OTP backend server error"
      );
    }
  };

  const handleChange = (e) => {

    setForm({
      ...form,
      [e.target.name]: e.target.value
    });
  };

  // Login
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
          user: loggedInUser
        });

        setStep("otp");

        await generateAndSendOtp(form.email);

      } else {

        setMessage("Invalid Email or Password");

        setMessageType("error");
      }

    } catch (error) {

      setMessage(
        "Invalid Email or Password / Server Error"
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

    if (enteredOtp === generatedOtp) {

      localStorage.setItem(
        "user",
        JSON.stringify(tempUserData.user)
      );

      setMessage("Login Successful!");

      setMessageType("success");

      setTimeout(() => {
        navigate("/dashboard");
      }, 1000);

    } else {

      setMessage("Invalid OTP");

      setMessageType("error");
    }
  };

  const handleDigitChange = (value, index) => {

    if (!/^\d*$/.test(value)) return;

    const newDigits = [...otpDigits];

    newDigits[index] = value.slice(-1);

    setOtpDigits(newDigits);

    if (value && index < 5) {

      const nextInput = document.getElementById(
        `otp-input-${index + 1}`
      );

      if (nextInput) nextInput.focus();
    }
  };

  return (

    <div className="auth-container">

      <div className="auth-card">

        <h2>
          {step === "credentials"
            ? "Welcome Back"
            : "OTP Verification"}
        </h2>

        {/* LOGIN FORM */}
        {step === "credentials" && (

          <form onSubmit={handleLogin}>

            <input
              type="email"
              name="email"
              placeholder="Email"
              value={form.email}
              onChange={handleChange}
              required
            />

            <input
              type="password"
              name="password"
              placeholder="Password"
              value={form.password}
              onChange={handleChange}
              required
            />

            <button type="submit">

              {loading
                ? "Signing In..."
                : "Sign In"}

            </button>

          </form>
        )}

        {/* OTP FORM */}
        {step === "otp" && (

          <form onSubmit={handleVerifyOtp}>

            <p>
              OTP sent to:
              <strong> {form.email}</strong>
            </p>

            {emailStatus === "sending" && (
              <p>Sending OTP...</p>
            )}

            {emailStatus === "sent" && (
              <p style={{ color: "green" }}>
                OTP sent successfully
              </p>
            )}

            {emailStatus === "failed" && (
              <p style={{ color: "red" }}>
                {emailError}
              </p>
            )}

            <div
              style={{
                display: "flex",
                gap: "10px",
                justifyContent: "center"
              }}
            >

              {otpDigits.map((digit, idx) => (

                <input
                  key={idx}
                  id={`otp-input-${idx}`}
                  type="text"
                  maxLength="1"
                  value={digit}
                  onChange={(e) =>
                    handleDigitChange(
                      e.target.value,
                      idx
                    )
                  }
                  required
                  style={{
                    width: "45px",
                    height: "45px",
                    textAlign: "center",
                    fontSize: "20px"
                  }}
                />
              ))}

            </div>

            <button type="submit">
              Verify OTP
            </button>

            {timer > 0 ? (

              <p>
                Resend OTP in {timer}s
              </p>

            ) : (

              <button
                type="button"
                onClick={() =>
                  generateAndSendOtp(form.email)
                }
              >
                Resend OTP
              </button>
            )}

          </form>
        )}

        {message && (
          <p className={messageType}>
            {message}
          </p>
        )}

        <p>

          Don't have an account?
          <Link to="/register">
            Register
          </Link>

        </p>

      </div>

    </div>
  );
}

export default Login;
