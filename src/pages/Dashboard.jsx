import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import API from "../services/api";
import {
  BarChart, Bar, XAxis, YAxis,
  Tooltip, ResponsiveContainer, CartesianGrid
} from "recharts";

function Dashboard() {
  const navigate = useNavigate();
  const user = JSON.parse(localStorage.getItem("user")) || { name: "User" };

  const [loading, setLoading] = useState(true);
  const [expenses, setExpenses] = useState([]);
  const [settlements, setSettlements] = useState([]);
  const [balance, setBalance] = useState({ totalExpenses: 0, totalRecords: 0 });

  const loadDashboardData = async () => {
    try {
      const [expRes, setRes, balRes] = await Promise.all([
        API.get("/expenses"),
        API.get("/settlements"),
        API.get("/balance")
      ]);
      setExpenses(expRes.data || []);
      setSettlements(setRes.data || []);
      setBalance(balRes.data || { totalExpenses: 0, totalRecords: 0 });
    } catch (err) {
      console.error("Error loading dashboard data:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadDashboardData();
  }, []);

  const totalSettled = settlements.reduce((sum, s) => sum + (s.amount || 0), 0);
  const netOutstanding = Math.max(0, balance.totalExpenses - totalSettled);

  // Generate dynamic chart data based on actual expenses in the database
  const getChartData = () => {
    if (expenses.length === 0) {
      return [
        { month: "Empty", amount: 0 }
      ];
    }
    // Group expenses by title/description for visualization
    const groups = {};
    expenses.forEach((e) => {
      const title = e.title || "General";
      groups[title] = (groups[title] || 0) + (e.amount || 0);
    });
    return Object.keys(groups).slice(0, 5).map(key => ({
      month: key.length > 10 ? key.substring(0, 10) + ".." : key,
      amount: groups[key]
    }));
  };

  const chartData = getChartData();

  // Sort expenses so that newly added/most recent ones are shown first
  const sortedExpenses = [...expenses].sort((a, b) => {
    const idA = parseFloat(a.id) || 0;
    const idB = parseFloat(b.id) || 0;
    if (idB !== idA) return idB - idA;
    const dateA = new Date(a.createdAt || a.created_at || a.date || a.timestamp || 0).getTime();
    const dateB = new Date(b.createdAt || b.created_at || b.date || b.timestamp || 0).getTime();
    return dateB - dateA;
  });

  // Custom tooltips for the chart
  const CustomTooltip = ({ active, payload }) => {
    if (active && payload && payload.length) {
      return (
        <div style={{
          background: "var(--surface-color)",
          border: "1px solid var(--card-border)",
          padding: "10px 14px",
          borderRadius: "10px",
          boxShadow: "var(--shadow-md)"
        }}>
          <p style={{ margin: 0, fontWeight: 700, color: "var(--text-primary)" }}>{payload[0].payload.month}</p>
          <p style={{ margin: 0, color: "var(--brand-green)", fontWeight: 600 }}>₹{payload[0].value}</p>
        </div>
      );
    }
    return null;
  };

  if (loading) {
    return (
      <div className="text-center py-5 text-muted animate-fade-in">
        <div className="spinner-border text-success mb-3" role="status"></div>
        <h5>Aggregating ledger data...</h5>
      </div>
    );
  }

  return (
    <>
      {/* Greetings Block */}
      <div className="mb-4 animate-fade-in">
        <h4 className="text-muted-custom mb-1 fs-6">Welcome back,</h4>
        <h2 className="section-title fs-2 mb-2" style={{ background: "linear-gradient(135deg, var(--text-primary) 30%, var(--brand-green) 100%)", WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent" }}>
          {user.name}
        </h2>
        <p className="text-secondary-custom mb-0 small">Here is a quick snapshot of your group splits and outstanding balances.</p>
      </div>

      {/* Summary Cards Grid */}
      <div className="row g-4 mb-4">
        <div className="col-md-4">
          <div className="card-flat card-glow d-flex align-items-center justify-content-between">
            <div>
              <h6 className="text-muted-custom mb-2 text-uppercase fs-7 fw-bold tracking-wider">Total combined spend</h6>
              <h3 className="mb-0 text-owed fs-3">₹{balance.totalExpenses}</h3>
            </div>
            <div style={{ background: "var(--brand-green-light)", padding: "14px", borderRadius: "14px", color: "var(--brand-green)" }}>
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <rect x="2" y="4" width="20" height="16" rx="2" ry="2"></rect>
                <line x1="12" y1="4" x2="12" y2="20"></line>
                <line x1="2" y1="12" x2="22" y2="12"></line>
              </svg>
            </div>
          </div>
        </div>
        
        <div className="col-md-4">
          <div className="card-flat d-flex align-items-center justify-content-between" style={{ borderLeft: "4px solid var(--brand-orange)" }}>
            <div>
              <h6 className="text-muted-custom mb-2 text-uppercase fs-7 fw-bold tracking-wider">Net Outstanding</h6>
              <h3 className="mb-0 text-owe fs-3">₹{netOutstanding}</h3>
            </div>
            <div style={{ background: "var(--brand-orange-light)", padding: "14px", borderRadius: "14px", color: "var(--brand-orange)" }}>
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M10 22H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v10"></path>
                <path d="M14 11h8"></path>
                <path d="m18 7-4 4 4 4"></path>
              </svg>
            </div>
          </div>
        </div>

        <div className="col-md-4">
          <div className="card-flat d-flex align-items-center justify-content-between" style={{ borderLeft: "4px solid var(--brand-green)" }}>
            <div>
              <h6 className="text-muted-custom mb-2 text-uppercase fs-7 fw-bold tracking-wider">Total Settled</h6>
              <h3 className="mb-0 text-owed fs-3">₹{totalSettled}</h3>
            </div>
            <div style={{ background: "var(--brand-green-light)", padding: "14px", borderRadius: "14px", color: "var(--brand-green)" }}>
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M14 22h6a2 2 0 0 0 2-2V4a2 2 0 0 0-2-2H4a2 2 0 0 0-2 2v10"></path>
                <path d="M10 11H2"></path>
                <path d="m6 7 4 4-4 4"></path>
              </svg>
            </div>
          </div>
        </div>
      </div>

      <div className="row g-4">
        {/* Left Column: Recent Activity Feed */}
        <div className="col-lg-8">
          <div className="card-flat">
            <h4 className="section-title fs-5 mb-4 d-flex align-items-center">
              <svg className="me-2" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ color: "var(--brand-green)" }}>
                <polyline points="22 12 18 12 15 21 9 3 6 12 2 12"></polyline>
              </svg>
              Newly Added Expenses
            </h4>
            
            {sortedExpenses.length === 0 ? (
              <div className="text-center py-5 text-muted">
                <div className="mb-3 text-secondary-custom opacity-75">
                  <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                    <circle cx="12" cy="12" r="10"></circle>
                    <polyline points="12 6 12 12 16 14"></polyline>
                  </svg>
                </div>
                <h6 className="fw-semibold text-secondary-custom mb-1">No recent activity</h6>
                <p className="mb-0 small text-muted-custom">Add your first expense to begin tracking splits in real-time.</p>
              </div>
            ) : (
              sortedExpenses.slice(0, 5).map((e, idx) => (
                <div className="list-item align-items-center" key={e.id || idx}>
                  <div className="avatar">
                    {e.title ? e.title.substring(0, 1).toUpperCase() : "E"}
                  </div>
                  <div className="list-details">
                    <h5>{e.title}</h5>
                    <p className="text-muted-custom mb-0 small">Paid by <strong className="text-primary">{e.paidBy}</strong></p>
                  </div>
                  <div className="list-amount">
                    <span className="text-owed d-block small" style={{ fontSize: "11px" }}>Amount</span>
                    <span className="text-primary fw-bold">₹{e.amount}</span>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

        {/* Right Column: Chart */}
        <div className="col-lg-4">
          <div className="card-flat">
            <h4 className="section-title fs-5 mb-4 d-flex align-items-center">
              <svg className="me-2" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ color: "var(--brand-green)" }}>
                <path d="M12 20v-6M6 20V10M18 20V4"></path>
              </svg>
              Spending trends
            </h4>
            
            <ResponsiveContainer width="100%" height={215}>
              <BarChart data={chartData} margin={{ top: 10, right: 5, left: -25, bottom: 0 }}>
                <defs>
                  <linearGradient id="barGradient" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="var(--brand-green)" stopOpacity={1} />
                    <stop offset="100%" stopColor="var(--brand-green)" stopOpacity={0.15} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="var(--card-border)" />
                <XAxis dataKey="month" fontSize={11} stroke="var(--text-muted)" tickLine={false} axisLine={false} />
                <YAxis fontSize={11} stroke="var(--text-muted)" tickLine={false} axisLine={false} />
                <Tooltip content={<CustomTooltip />} cursor={{ fill: "var(--brand-green-light)", radius: 8 }} />
                <Bar dataKey="amount" fill="url(#barGradient)" radius={[8, 8, 0, 0]} barSize={28} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      {/* Floating Plus Button to Add Expense */}
      <button 
        className="floating-btn" 
        title="Add New Expense"
        onClick={() => navigate("/expenses")}
      >
        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
          <line x1="12" y1="5" x2="12" y2="19"></line>
          <line x1="5" y1="12" x2="19" y2="12"></line>
        </svg>
      </button>
    </>
  );
}

export default Dashboard;