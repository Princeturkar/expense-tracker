import { useEffect, useState } from "react";
import API from "../services/api";

function Balance() {
  const user = JSON.parse(localStorage.getItem("user")) || { name: "User" };
  const currentMonthName = new Date().toLocaleString("en-IN", { month: "short" });

  const [loading, setLoading] = useState(true);
  const [selectedMonth, setSelectedMonth] = useState(currentMonthName);
  const [groups, setGroups] = useState([]);
  const [personalExpenses, setPersonalExpenses] = useState([]);

  // Extracted month helpers
  const getMonthFromDate = (dateStr) => {
    if (!dateStr) return "";
    const parts = dateStr.split(" ");
    if (parts.length === 3) {
      return parts[1]; // e.g. "May"
    }
    const dateObj = new Date(dateStr);
    if (!isNaN(dateObj.getTime())) {
      return dateObj.toLocaleString("en-IN", { month: "short" });
    }
    return "";
  };

  const getExpenseMonth = (e) => {
    const dateVal = e.date || e.createdAt || e.created_at || e.timestamp;
    if (!dateVal) return currentMonthName;
    return getMonthFromDate(dateVal);
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
      console.log("Balance data fetch error", error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  // Compute month choices dynamically (All Time, and any recorded months)
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

  // Perform month-filtered calculations
  const filteredPersonal = personalExpenses.filter(e => {
    if (selectedMonth === "All Time") return true;
    return getExpenseMonth(e) === selectedMonth;
  });

  const personalTotal = filteredPersonal.reduce((sum, e) => sum + (parseFloat(e.amount) || 0), 0);
  const personalCount = filteredPersonal.length;

  let totalGroupSpentUserShare = 0;
  let totalGroupPaidUser = 0;
  let totalYouOwe = 0;
  let totalYouAreOwed = 0;
  let totalGroupRecords = 0;
  const groupRows = [];

  groups.forEach(g => {
    try {
      const membersSaved = localStorage.getItem(`group_members_${g.id}`);
      const expensesSaved = localStorage.getItem(`group_expenses_${g.id}`);
      const mList = membersSaved ? JSON.parse(membersSaved) : [];
      const expList = expensesSaved ? JSON.parse(expensesSaved) : [];

      if (!Array.isArray(mList) || mList.length === 0) {
        return;
      }

      // Filter group expenses to selected month
      const normalExpenses = expList.filter(e => !e.isSettlement && (selectedMonth === "All Time" || getMonthFromDate(e.date) === selectedMonth));
      const settlementsOnly = expList.filter(e => e.isSettlement && (selectedMonth === "All Time" || getMonthFromDate(e.date) === selectedMonth));

      const groupTotalSpent = normalExpenses.reduce((sum, e) => sum + (parseFloat(e.amount) || 0), 0);
      const groupRecordsCount = normalExpenses.length + settlementsOnly.length;
      totalGroupRecords += groupRecordsCount;

      if (mList.includes(user.name)) {
        const sharePerPerson = groupTotalSpent / mList.length;
        
        const paidNormal = normalExpenses
          .filter(e => e.paidBy === user.name)
          .reduce((sum, e) => sum + (parseFloat(e.amount) || 0), 0);

        const paidSent = settlementsOnly
          .filter(e => e.paidBy === user.name)
          .reduce((sum, e) => sum + (parseFloat(e.amount) || 0), 0);

        const paidReceived = settlementsOnly
          .filter(e => e.transferTo === user.name)
          .reduce((sum, e) => sum + (parseFloat(e.amount) || 0), 0);

        const userPaid = paidNormal + paidSent - paidReceived;
        const net = userPaid - sharePerPerson;

        totalGroupSpentUserShare += sharePerPerson;
        totalGroupPaidUser += paidNormal;

        if (net > 0.05) {
          totalYouAreOwed += net;
        } else if (net < -0.05) {
          totalYouOwe += Math.abs(net);
        }

        groupRows.push({
          id: g.id,
          name: g.name,
          totalSpent: groupTotalSpent,
          userShare: sharePerPerson,
          net: net,
          status: net > 0.05 ? "owed" : net < -0.05 ? "owe" : "settled"
        });
      } else {
        groupRows.push({
          id: g.id,
          name: g.name,
          totalSpent: groupTotalSpent,
          userShare: 0,
          net: 0,
          status: "not_member"
        });
      }
    } catch (e) {
      console.error("Error aggregating group balance for", g.id, e);
    }
  });

  const mySpentShareTotal = personalTotal + totalGroupSpentUserShare;
  const myTotalPaidTotal = personalTotal + totalGroupPaidUser;
  const totalLoggedEntries = personalCount + totalGroupRecords;

  const personalPercentage = mySpentShareTotal > 0 ? (personalTotal / mySpentShareTotal) * 100 : 0;
  const groupPercentage = mySpentShareTotal > 0 ? (totalGroupSpentUserShare / mySpentShareTotal) * 100 : 0;

  return (
    <>
      {/* Title block & Month Selector */}
      <div className="mb-4 d-flex justify-content-between align-items-center flex-wrap g-3">
        <div>
          <h2 className="section-title fs-2 mb-2" style={{ background: "linear-gradient(135deg, var(--text-primary) 30%, var(--brand-green) 100%)", WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent" }}>
            Balance Summary
          </h2>
          <p className="text-secondary-custom small mb-0">Total spending weight and data logs across all books.</p>
        </div>
        
        {/* Glassmorphic Dropdown Selector */}
        <div className="d-flex align-items-center">
          <label className="text-secondary-custom small me-2 mb-0 fw-semibold">Billing Month:</label>
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
          <h5>Loading balance metrics...</h5>
        </div>
      ) : (
        <>
          {/* Statistics Grid */}
          <div className="row g-4 mb-4 animate-fade-in">
            {/* My Spent Share */}
            <div className="col-md-6">
              <div className="card-premium card-glow text-center p-4">
                <div className="mx-auto mb-3 d-flex align-items-center justify-content-center" style={{ width: "54px", height: "54px", background: "var(--brand-green-light)", borderRadius: "16px", color: "var(--brand-green)" }}>
                  <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                    <line x1="12" y1="1" x2="12" y2="23"></line>
                    <path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"></path>
                  </svg>
                </div>
                <h4 className="text-muted-custom fs-7 fw-bold text-uppercase tracking-wider mb-2">My Total Spending (Share)</h4>
                <h1 className="fw-extrabold text-owed mb-1" style={{ fontSize: "36px", fontFamily: "var(--font-heading)" }}>
                  ₹{mySpentShareTotal.toFixed(2)}
                </h1>
                <p className="text-secondary-custom small mb-0">Personal bills + user shares in groups ({selectedMonth})</p>
              </div>
            </div>

            {/* Total Records */}
            <div className="col-md-6">
              <div className="card-premium text-center p-4">
                <div className="mx-auto mb-3 d-flex align-items-center justify-content-center" style={{ width: "54px", height: "54px", background: "var(--brand-orange-light)", borderRadius: "16px", color: "var(--brand-orange)" }}>
                  <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path>
                    <polyline points="14 2 14 8 20 8"></polyline>
                    <line x1="16" y1="13" x2="8" y2="13"></line>
                    <line x1="16" y1="17" x2="8" y2="17"></line>
                  </svg>
                </div>
                <h4 className="text-muted-custom fs-7 fw-bold text-uppercase tracking-wider mb-2">Logged Entries</h4>
                <h1 className="fw-extrabold text-primary mb-1" style={{ fontSize: "36px", fontFamily: "var(--font-heading)" }}>
                  {totalLoggedEntries}
                </h1>
                <p className="text-secondary-custom small mb-0">Active bills & settlements registered ({selectedMonth})</p>
              </div>
            </div>

            {/* You Owe */}
            <div className="col-md-6">
              <div className="card-flat d-flex align-items-center p-3" style={{ borderLeft: "4px solid var(--brand-orange)", margin: 0 }}>
                <div className="d-flex align-items-center justify-content-center me-3" style={{ width: "42px", height: "42px", background: "var(--brand-orange-light)", borderRadius: "12px", color: "var(--brand-orange)" }}>
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                    <line x1="18" y1="6" x2="6" y2="18"></line>
                    <line x1="6" y1="6" x2="18" y2="18"></line>
                  </svg>
                </div>
                <div>
                  <span className="text-muted-custom small d-block">You Owe Globally ({selectedMonth})</span>
                  <strong className="text-owe fs-5">₹{totalYouOwe.toFixed(2)}</strong>
                </div>
              </div>
            </div>

            {/* You are Owed */}
            <div className="col-md-6">
              <div className="card-flat d-flex align-items-center p-3" style={{ borderLeft: "4px solid var(--brand-green)", margin: 0 }}>
                <div className="d-flex align-items-center justify-content-center me-3" style={{ width: "42px", height: "42px", background: "var(--brand-green-light)", borderRadius: "12px", color: "var(--brand-green)" }}>
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                    <polyline points="20 6 9 17 4 12"></polyline>
                  </svg>
                </div>
                <div>
                  <span className="text-muted-custom small d-block">You are Owed Globally ({selectedMonth})</span>
                  <strong className="text-owed fs-5">₹{totalYouAreOwed.toFixed(2)}</strong>
                </div>
              </div>
            </div>
          </div>

          {/* Spend Weight Segment Visualizer */}
          <div className="card-flat mb-4 animate-fade-in">
            <h5 className="mb-3 fs-6 fw-bold text-muted-custom text-uppercase tracking-wider">Spending Segment Split</h5>
            <p className="text-secondary-custom mb-3 small">Comparison of personal expenses vs. your shares of active group ledgers.</p>
            
            <div className="mb-2">
              <div className="progress" style={{ height: "14px", background: "var(--card-border)", borderRadius: "7px", overflow: "hidden" }}>
                <div 
                  className="progress-bar bg-success" 
                  role="progressbar" 
                  style={{ width: `${personalPercentage}%`, background: "linear-gradient(90deg, var(--brand-green) 0%, #10b981cc 100%)" }}
                  aria-valuenow={personalPercentage} 
                  aria-valuemin="0" 
                  aria-valuemax="100"
                ></div>
                <div 
                  className="progress-bar bg-indigo" 
                  role="progressbar" 
                  style={{ width: `${groupPercentage}%`, background: "linear-gradient(90deg, var(--indigo) 0%, var(--purple) 100%)" }}
                  aria-valuenow={groupPercentage} 
                  aria-valuemin="0" 
                  aria-valuemax="100"
                ></div>
              </div>
            </div>
            <div className="d-flex justify-content-between text-secondary-custom small">
              <span className="d-flex align-items-center">
                <span className="d-inline-block me-1.5 rounded-circle" style={{ width: "10px", height: "10px", background: "var(--brand-green)" }}></span>
                Personal: ₹{personalTotal.toFixed(2)} ({personalPercentage.toFixed(0)}%)
              </span>
              <span className="d-flex align-items-center">
                <span className="d-inline-block me-1.5 rounded-circle" style={{ width: "10px", height: "10px", background: "var(--indigo)" }}></span>
                Group Share: ₹{totalGroupSpentUserShare.toFixed(2)} ({groupPercentage.toFixed(0)}%)
              </span>
            </div>
          </div>

          {/* Detailed Group Spread Table */}
          <div className="card-flat animate-fade-in">
            <h5 className="mb-4 fs-6 fw-bold text-muted-custom text-uppercase tracking-wider">Group Split Book Ledger</h5>
            {groupRows.length === 0 ? (
              <div className="text-center py-4 text-muted small">
                No active groups found in this billing period.
              </div>
            ) : (
              <div className="table-responsive">
                <table className="table align-middle" style={{ color: "var(--text-primary)" }}>
                  <thead>
                    <tr className="text-secondary-custom border-bottom" style={{ borderColor: "var(--card-border)" }}>
                      <th scope="col" className="pb-3 border-0 small fw-bold">Group Book</th>
                      <th scope="col" className="pb-3 border-0 text-center small fw-bold">Book Total Spent</th>
                      <th scope="col" className="pb-3 border-0 text-center small fw-bold">My Spent Share</th>
                      <th scope="col" className="pb-3 border-0 text-end small fw-bold">Settlement Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {groupRows.map((row) => (
                      <tr key={row.id} className="border-bottom" style={{ borderColor: "var(--card-border)" }}>
                        <td className="py-3 fw-semibold border-0">{row.name}</td>
                        <td className="py-3 text-center border-0 text-secondary-custom">₹{row.totalSpent.toFixed(2)}</td>
                        <td className="py-3 text-center border-0 text-primary fw-bold">₹{row.userShare.toFixed(2)}</td>
                        <td className="py-3 text-end border-0">
                          {row.status === "owed" && (
                            <span className="badge px-3 py-1.5 rounded-pill bg-success-light text-success" style={{ border: "1px solid var(--brand-green)" }}>
                              You are Owed ₹{row.net.toFixed(2)}
                            </span>
                          )}
                          {row.status === "owe" && (
                            <span className="badge px-3 py-1.5 rounded-pill bg-danger-light text-danger" style={{ border: "1px solid var(--brand-orange)" }}>
                              You Owe ₹{Math.abs(row.net).toFixed(2)}
                            </span>
                          )}
                          {row.status === "settled" && (
                            <span className="badge px-3 py-1.5 rounded-pill bg-secondary text-secondary-custom" style={{ border: "1.5px solid var(--card-border)" }}>
                              Settled Up
                            </span>
                          )}
                          {row.status === "not_member" && (
                            <span className="badge px-3 py-1.5 rounded-pill bg-light text-muted-custom" style={{ border: "1.5px solid var(--card-border)" }}>
                              Not in Book
                            </span>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </>
      )}
    </>
  );
}

export default Balance;