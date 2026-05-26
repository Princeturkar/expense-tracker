import Navbar from "./Navbar";

function Layout({ children }) {
  return (
    <div className="app-container">
      {/* Decorative Ambient Background Glows */}
      <div className="ambient-glow-wrapper">
        <div className="ambient-glow-1"></div>
        <div className="ambient-glow-2"></div>
      </div>
      
      <Navbar />
      <div className="main-content">
        {children}
      </div>
    </div>
  );
}

export default Layout;
