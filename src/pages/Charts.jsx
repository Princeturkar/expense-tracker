import { useEffect, useState } from "react";
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer,
  AreaChart, Area, CartesianGrid
} from "recharts";
import API from "../services/api";

function Charts() {
  const user = JSON.parse(localStorage.getItem("user")) || { name: "User" };
  const currentMonthName = new Date().toLocaleString("en-IN", { month: "short" });

  const [loading, setLoading] = useState(true);
  const [selectedMonth, setSelectedMonth] = useState(currentMonthName);
  const [groups, setGroups] = useState([]);
  const [personalExpenses, setPersonalExpenses] = useState([]);

  // Extracted helpers
  const getMonthFromDate = (dateStr) => {
    if (!dateStr) return "";
    const parts = dateStr.split(" ");
    if (parts.length === 3) {
      return parts[1];
    }
    const dateObj = new Date(dateStr);
    if (!isNaN(dateObj.getTime())) {
      return dateObj.toLocaleString("en-IN", { month: "short" });
    }
    return "";
  };

  const getDayFromDate = (dateStr) => {
    if (!dateStr) return 1;
    const parts = dateStr.split(" ");
    if (parts.length === 3) {
      const d = parseInt(parts[0]);
      return isNaN(d) ? 1 : d;
    }
    const dateObj = new Date(dateStr);
    if (!isNaN(dateObj.getTime())) {
      return dateObj.getDate();
    }
    return 1;
  };

  const getExpenseMonth = (e) => {
    const dateVal = e.date || e.createdAt || e.created_at || e.timestamp;
    if (!dateVal) return currentMonthName;
    return getMonthFromDate(dateVal);
  };

  const getExpenseDay = (e) => {
    const dateVal = e.date || e.createdAt || e.created_at || e.timestamp;
    if (!dateVal) return 1;
    return getDayFromDate(dateVal);
  };

  const loadData = async () => {
    try {
      setLoading(true);
      const [groupsRes, expensesRes] = await Promise.all([
        API.get("/groups"),
        API.get("/expenses")
      ]);
      
      const gData = Array.isArray(groupsRes.data) ? groupsRes.data : [];
      const validGroups = gData.filter(g => g && g.id !== undefined && g.id !== null && Object.keys(g).length > 0);
      setGroups(validGroups);
      
      setPersonalExpenses(Array.isArray(expensesRes.data) ? expensesRes.data : []);
    } catch (error) {
      console.log("Charts data fetch error", error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  // Compute month options dynamically
  const allRecordedMonths = new Set([currentMonthName]);
  personalExpenses.forEach(e => {
    const m = getExpenseMonth(e);
    if (m) allRecordedMonths.add(m);
  });
  groups.forEach(g => {
    try {
      const saved = localStorage.getItem(`group_expenses_${g.id}`);
      const expenses = saved ? JSON.parse(saved) : [];
      expenses.forEach(e => {
        const m = getMonthFromDate(e.date);
        if (m) allRecordedMonths.add(m);
      });
    } catch (e) {
      console.error(e);
    }
  });

  const monthOptions = ["All Time", ...Array.from(allRecordedMonths)];

  // 1. Prepare Split Volume Comparisons (Bar Chart): Personal spent vs Group shares
  const filteredPersonal = personalExpenses.filter(e => {
    if (selectedMonth === "All Time") return true;
    return getExpenseMonth(e) === selectedMonth;
  });
  const personalTotal = filteredPersonal.reduce((sum, e) => sum + (parseFloat(e.amount) || 0), 0);

  const barData = [
    { label: "Personal", amount: parseFloat(personalTotal.toFixed(2)) }
  ];

  const groupSharesData = [];
  groups.forEach(g => {
    try {
      const membersSaved = localStorage.getItem(`group_members_${g.id}`);
      const expensesSaved = localStorage.getItem(`group_expenses_${g.id}`);
      const mList = membersSaved ? JSON.parse(membersSaved) : [];
      const expList = expensesSaved ? JSON.parse(expensesSaved) : [];

      if (mList.includes(user.name)) {
        const normalExpenses = expList.filter(e => !e.isSettlement && (selectedMonth === "All Time" || getMonthFromDate(e.date) === selectedMonth));
        const groupTotalSpent = normalExpenses.reduce((sum, e) => sum + (parseFloat(e.amount) || 0), 0);
        const sharePerPerson = mList.length > 0 ? groupTotalSpent / mList.length : 0;
        
        if (sharePerPerson > 0) {
          barData.push({
            label: g.name.length > 10 ? g.name.substring(0, 10) + ".." : g.name,
            amount: parseFloat(sharePerPerson.toFixed(2))
          });
        }
      }
    } catch (e) {
      console.error(e);
    }
  });

  // 2. Prepare Chronological Spending Trends (Area Chart)
  // If "All Time": Group user's spending by month
  // If specific month: Group user's spending by day number (1 to 31)
  let trendData = [];
  if (selectedMonth === "All Time") {
    const monthlyGroups = {};
    
    // Personal expenses
    personalExpenses.forEach(e => {
      const m = getExpenseMonth(e);
      if (m) {
        monthlyGroups[m] = (monthlyGroups[m] || 0) + (parseFloat(e.amount) || 0);
      }
    });

    // Group shares
    groups.forEach(g => {
      try {
        const membersSaved = localStorage.getItem(`group_members_${g.id}`);
        const expensesSaved = localStorage.getItem(`group_expenses_${g.id}`);
        const mList = membersSaved ? JSON.parse(membersSaved) : [];
        const expList = expensesSaved ? JSON.parse(expensesSaved) : [];

        if (mList.includes(user.name)) {
          const normalExpenses = expList.filter(e => !e.isSettlement);
          normalExpenses.forEach(e => {
            const m = getMonthFromDate(e.date);
            if (m && mList.length > 0) {
              const userShare = (parseFloat(e.amount) || 0) / mList.length;
              monthlyGroups[m] = (monthlyGroups[m] || 0) + userShare;
            }
          });
        }
      } catch (e) {
        console.error(e);
      }
    });

    const monthOrder = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
    trendData = Object.keys(monthlyGroups)
      .sort((a, b) => monthOrder.indexOf(a) - monthOrder.indexOf(b))
      .map(m => ({
        label: m,
        amount: parseFloat(monthlyGroups[m].toFixed(2))
      }));
  } else {
    // Group by day of selectedMonth
    const dailyGroups = {};
    
    // Seed current month days to show a continuous timeline
    for (let day = 1; day <= 31; day++) {
      dailyGroups[day] = 0;
    }

    // Personal expenses
    filteredPersonal.forEach(e => {
      const d = getExpenseDay(e);
      dailyGroups[d] = (dailyGroups[d] || 0) + (parseFloat(e.amount) || 0);
    });

    // Group shares
    groups.forEach(g => {
      try {
        const membersSaved = localStorage.getItem(`group_members_${g.id}`);
        const expensesSaved = localStorage.getItem(`group_expenses_${g.id}`);
        const mList = membersSaved ? JSON.parse(membersSaved) : [];
        const expList = expensesSaved ? JSON.parse(expensesSaved) : [];

        if (mList.includes(user.name)) {
          const normalExpenses = expList.filter(e => !e.isSettlement && getMonthFromDate(e.date) === selectedMonth);
          normalExpenses.forEach(e => {
            const d = getDayFromDate(e.date);
            if (mList.length > 0) {
              const userShare = (parseFloat(e.amount) || 0) / mList.length;
              dailyGroups[d] = (dailyGroups[d] || 0) + userShare;
            }
          });
        }
      } catch (e) {
        console.error(e);
      }
    });

    trendData = Object.keys(dailyGroups)
      .map(d => parseInt(d))
      .sort((a, b) => a - b)
      .map(d => ({
        label: `${d} ${selectedMonth}`,
        amount: parseFloat(dailyGroups[d].toFixed(2))
      }))
      // Filter out trailing zeroes to keep chart readable, but ensure at least 7 days are shown
      .filter((point, idx, arr) => {
        if (point.amount > 0) return true;
        // Keep points that are within the current date of the month to show up-to-date timeline
        const dayNum = idx + 1;
        const todayDay = new Date().getDate();
        const todayMonth = new Date().toLocaleString("en-IN", { month: "short" });
        if (selectedMonth === todayMonth) {
          return dayNum <= todayDay;
        }
        return dayNum <= 15; // default view for past months
      });
  }

  if (trendData.length === 0) {
    trendData = [{ label: selectedMonth, amount: 0 }];
  }

  // Custom tooltips
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
          <p style={{ margin: 0, fontWeight: 700, color: "var(--text-primary)" }}>{payload[0].payload.label}</p>
          <p style={{ margin: 0, color: "var(--brand-green)", fontWeight: 600 }}>₹{payload[0].value.toFixed(2)}</p>
        </div>
      );
    }
    return null;
  };

  return (
    <>
      {/* Title Header & Month Filter */}
      <div className="mb-4 d-flex justify-content-between align-items-center flex-wrap g-3">
        <div>
          <h2 className="section-title fs-2 mb-2" style={{ background: "linear-gradient(135deg, var(--text-primary) 30%, var(--brand-green) 100%)", WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent" }}>
            Expense Analytics
          </h2>
          <p className="text-secondary-custom small mb-0">Visual analysis of monthly split sheets and spending weights.</p>
        </div>

        {/* Dropdown Selector */}
        <div className="d-flex align-items-center">
          <label className="text-secondary-custom small me-2 mb-0 fw-semibold">Period:</label>
          <select 
            className="form-select py-1.5 px-3 rounded-pill" 
            style={{ 
              fontSize: "13px", 
              background: "var(--surface-color)", 
              border: "1.5px solid var(--card-border)", 
              color: "var(--text-primary)", 
              width: "auto",
              cursor: "pointer"
            }}
            value={selectedMonth}
            onChange={(e) => setSelectedMonth(e.target.value)}
          >
            {monthOptions.map(m => (
              <option key={m} value={m}>{m}</option>
            ))}
          </select>
        </div>
      </div>

      {loading ? (
        <div className="text-center py-5 text-muted animate-fade-in">
          <div className="spinner-border text-success mb-3" role="status"></div>
          <h5>Generating visual summaries...</h5>
        </div>
      ) : (
        <div className="row g-4 animate-fade-in">
          {/* Curved Area Chart: chronological trends */}
          <div className="col-md-6">
            <div className="card-flat">
              <h5 className="mb-4 fs-6 fw-bold text-muted-custom text-uppercase tracking-wider">
                {selectedMonth === "All Time" ? "Spending Trends Over Time" : `Spending Trends (${selectedMonth})`}
              </h5>
              <ResponsiveContainer width="100%" height={300}>
                <AreaChart data={trendData} margin={{ top: 10, right: 5, left: -20, bottom: 0 }}>
                  <defs>
                    <linearGradient id="areaGradient" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="var(--brand-green)" stopOpacity={0.4} />
                      <stop offset="95%" stopColor="var(--brand-green)" stopOpacity={0.0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="var(--card-border)" />
                  <XAxis dataKey="label" fontSize={10} stroke="var(--text-muted)" tickLine={false} axisLine={false} />
                  <YAxis fontSize={10} stroke="var(--text-muted)" tickLine={false} axisLine={false} />
                  <Tooltip content={<CustomTooltip />} />
                  <Area type="monotone" dataKey="amount" stroke="var(--brand-green)" strokeWidth={3} fillOpacity={1} fill="url(#areaGradient)" />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* Bar Chart: split volume comparison */}
          <div className="col-md-6">
            <div className="card-flat">
              <h5 className="mb-4 fs-6 fw-bold text-muted-custom text-uppercase tracking-wider">
                Ledger Shares Breakdown ({selectedMonth})
              </h5>
              <ResponsiveContainer width="100%" height={300}>
                <BarChart data={barData} margin={{ top: 10, right: 5, left: -20, bottom: 0 }}>
                  <defs>
                    <linearGradient id="glowBarGradient" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="var(--purple)" stopOpacity={1} />
                      <stop offset="100%" stopColor="var(--indigo)" stopOpacity={0.2} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="var(--card-border)" />
                  <XAxis dataKey="label" fontSize={10} stroke="var(--text-muted)" tickLine={false} axisLine={false} />
                  <YAxis fontSize={10} stroke="var(--text-muted)" tickLine={false} axisLine={false} />
                  <Tooltip content={<CustomTooltip />} cursor={{ fill: "rgba(139, 92, 246, 0.05)", radius: 8 }} />
                  <Bar dataKey="amount" fill="url(#glowBarGradient)" radius={[8, 8, 0, 0]} barSize={28} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

export default Charts;