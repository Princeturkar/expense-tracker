import { useEffect, useState } from "react";
import { Link, useNavigate, useLocation } from "react-router-dom";

function Navbar() {
  const navigate = useNavigate();
  const location = useLocation();
  const [theme, setTheme] = useState(localStorage.getItem("theme") || "light");

  useEffect(() => {
    document.documentElement.setAttribute("data-theme", theme);
    localStorage.setItem("theme", theme);
  }, [theme]);

  const toggleTheme = () => {
    setTheme(theme === "light" ? "dark" : "light");
  };

  const logout = () => {
    localStorage.removeItem("user");
    navigate("/");
  };

  const navLinks = [
    { path: "/dashboard", label: "Dashboard" },
    { path: "/groups", label: "Groups" },
    { path: "/expenses", label: "Expenses" },
    { path: "/settlements", label: "Settlements" },
    { path: "/balance", label: "Balance" },
    { path: "/charts", label: "Charts" },
    { path: "/report", label: "Report" },
    { path: "/profile", label: "Profile" }
  ];

  return (
    <nav className="navbar navbar-expand-lg top-navbar">
      <div className="container">
        
        <Link className="navbar-brand fw-bold d-flex align-items-center" to="/dashboard">
          <svg className="me-2" width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" style={{ color: "var(--brand-green)" }}>
            <line x1="12" y1="1" x2="12" y2="23"></line>
            <path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"></path>
          </svg>
          ExpenseSplit
        </Link>

        <button
          className="navbar-toggler"
          type="button"
          data-bs-toggle="collapse"
          data-bs-target="#menu"
          aria-controls="menu"
          aria-expanded="false"
          aria-label="Toggle navigation"
          style={{ border: "1px solid var(--card-border)", padding: "6px 10px" }}
        >
          <span className="navbar-toggler-icon" style={{ filter: theme === "dark" ? "invert(1)" : "none" }}></span>
        </button>

        <div className="collapse navbar-collapse" id="menu">
          <ul className="navbar-nav ms-auto align-items-center">
            {navLinks.map((link) => (
              <li className="nav-item" key={link.path}>
                <Link
                  className={`nav-link ${location.pathname === link.path ? "active" : ""}`}
                  to={link.path}
                >
                  {link.label}
                </Link>
              </li>
            ))}

            <li className="nav-item d-flex align-items-center ms-2 my-2 my-lg-0">
              {/* Theme Switcher */}
              <button
                className="theme-switch-btn"
                onClick={toggleTheme}
                title={`Switch to ${theme === "light" ? "Dark" : "Light"} Mode`}
              >
                {theme === "light" ? (
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"></path>
                  </svg>
                ) : (
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <circle cx="12" cy="12" r="5"></circle>
                    <line x1="12" y1="1" x2="12" y2="3"></line>
                    <line x1="12" y1="21" x2="12" y2="23"></line>
                    <line x1="4.22" y1="4.22" x2="5.64" y2="5.64"></line>
                    <line x1="18.36" y1="18.36" x2="19.78" y2="19.78"></line>
                    <line x1="1" y1="12" x2="3" y2="12"></line>
                    <line x1="21" y1="12" x2="23" y2="12"></line>
                    <line x1="4.22" y1="19.78" x2="5.64" y2="18.36"></line>
                    <line x1="18.36" y1="5.64" x2="19.78" y2="4.22"></line>
                  </svg>
                )}
              </button>

              {/* Logout Button */}
              <button
                className="btn-danger-brand btn-sm ms-3"
                onClick={logout}
                style={{ padding: "8px 16px", borderRadius: "8px", fontSize: "14px" }}
              >
                Logout
              </button>
            </li>
          </ul>
        </div>

      </div>
    </nav>
  );
}

export default Navbar;