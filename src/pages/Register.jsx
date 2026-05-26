import { useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import API from "../services/api";

function Register() {
  const navigate = useNavigate();

  const [form, setForm] = useState({
    name: "",
    email: "",
    password: ""
  });

  const [message, setMessage] = useState("");
  const [messageType, setMessageType] = useState("");
  const [loading, setLoading] = useState(false);

  const handleChange = (e) => {
    setForm({
      ...form,
      [e.target.name]: e.target.value
    });
  };

  const handleRegister = async (e) => {
    e.preventDefault();
    setLoading(true);
    setMessage("");

    try {
      await API.post("/auth/register", form);
      
      // Auto-save registration name and email temporarily
      const registeredUser = {
        name: form.name,
        email: form.email
      };
      localStorage.setItem("user", JSON.stringify(registeredUser));
      
      setMessage("Registration Successful! Redirecting to login...");
      setMessageType("success");
      setTimeout(() => navigate("/"), 1500);
    } catch (error) {
      setMessage("Registration Failed. Email might be already in use.");
      setMessageType("error");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="auth-container">
      {/* Drifting Neon Decorative Bubbles */}
      <div className="auth-bg-orbs">
        <div className="auth-orb auth-orb-1"></div>
        <div className="auth-orb auth-orb-2"></div>
        <div className="auth-orb auth-orb-3"></div>
      </div>

      <div className="auth-card">
        <div className="text-center mb-2">
          <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" style={{ color: "var(--brand-green)" }}>
            <line x1="12" y1="1" x2="12" y2="23"></line>
            <path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"></path>
          </svg>
        </div>
        <h2>Create Account</h2>
        <p className="subtitle">Sign up to start splitting expenses with friends</p>

        <form onSubmit={handleRegister}>
          <div className="auth-input-group">
            <input
              type="text"
              name="name"
              placeholder="Full Name"
              className="auth-input"
              value={form.name}
              onChange={handleChange}
              required
              disabled={loading}
            />
          </div>

          <div className="auth-input-group">
            <input
              type="email"
              name="email"
              placeholder="Email Address"
              className="auth-input"
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
              placeholder="Password"
              className="auth-input"
              value={form.password}
              onChange={handleChange}
              required
              disabled={loading}
            />
          </div>

          <button className="auth-btn" type="submit" disabled={loading}>
            {loading ? "Creating Account..." : "Sign Up"}
          </button>
        </form>

        {message && (
          <div className={`auth-message ${messageType}`}>
            {message}
          </div>
        )}

        <p className="auth-link">
          Already have an account? <Link to="/">Sign in</Link>
        </p>
      </div>
    </div>
  );
}

export default Register;