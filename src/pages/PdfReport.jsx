import { useEffect, useState } from "react";
import jsPDF from "jspdf";
import API from "../services/api";

function PdfReport() {
  const user = JSON.parse(localStorage.getItem("user")) || { name: "User", email: "No Email" };
  const currentMonthName = new Date().toLocaleString("en-IN", { month: "short" });

  const [loading, setLoading] = useState(true);
  const [downloading, setDownloading] = useState(false);
  const [selectedMonth, setSelectedMonth] = useState(currentMonthName);
  const [groups, setGroups] = useState([]);
  const [personalExpenses, setPersonalExpenses] = useState([]);

  // Extracted month helpers
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
      console.log("PdfReport data fetch error", error);
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

  let totalGroupSpentUserShare = 0;
  let totalYouOwe = 0;
  let totalYouAreOwed = 0;
  const groupBreakdown = [];

  groups.forEach(g => {
    try {
      const membersSaved = localStorage.getItem(`group_members_${g.id}`);
      const expensesSaved = localStorage.getItem(`group_expenses_${g.id}`);
      const mList = membersSaved ? JSON.parse(membersSaved) : [];
      const expList = expensesSaved ? JSON.parse(expensesSaved) : [];

      if (!Array.isArray(mList) || mList.length === 0) return;

      const normalExpenses = expList.filter(e => !e.isSettlement && (selectedMonth === "All Time" || getMonthFromDate(e.date) === selectedMonth));
      const settlementsOnly = expList.filter(e => e.isSettlement && (selectedMonth === "All Time" || getMonthFromDate(e.date) === selectedMonth));

      const groupTotalSpent = normalExpenses.reduce((sum, e) => sum + (parseFloat(e.amount) || 0), 0);

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

        if (net > 0.05) {
          totalYouAreOwed += net;
        } else if (net < -0.05) {
          totalYouOwe += Math.abs(net);
        }

        groupBreakdown.push({
          name: g.name,
          totalSpent: groupTotalSpent,
          userShare: sharePerPerson,
          net: net,
          status: net > 0.05 ? "owed" : net < -0.05 ? "owe" : "settled"
        });
      }
    } catch (e) {
      console.error(e);
    }
  });

  const grandCombinedSpending = personalTotal + totalGroupSpentUserShare;

  const downloadPDF = () => {
    setDownloading(true);
    
    // Slight timeout for high-fidelity interactive feel
    setTimeout(() => {
      try {
        const doc = new jsPDF();
        let y = 20;

        // Premium Typography and Borders
        doc.setFillColor(16, 185, 129); // Brand Green
        doc.rect(20, y, 170, 8, "F");
        y += 18;

        doc.setFont("helvetica", "bold");
        doc.setFontSize(22);
        doc.setTextColor(15, 23, 42); // slate-900
        doc.text("EXPENSE SPLIT AUDIT REPORT", 20, y);
        y += 8;

        doc.setFont("helvetica", "normal");
        doc.setFontSize(10);
        doc.setTextColor(100, 116, 139); // slate-500
        doc.text(`Billing Period: ${selectedMonth}  |  Generated on: ${new Date().toLocaleDateString("en-IN")}`, 20, y);
        y += 8;

        doc.setLineWidth(0.5);
        doc.setDrawColor(226, 232, 240); // slate-200
        doc.line(20, y, 190, y);
        y += 12;

        // User profile summary block
        doc.setFont("helvetica", "bold");
        doc.setFontSize(12);
        doc.setTextColor(15, 23, 42);
        doc.text("AUDIT COPY PREPARED FOR:", 20, y);
        y += 6;
        doc.setFont("helvetica", "normal");
        doc.setFontSize(11);
        doc.text(`Name: ${user.name}`, 20, y);
        doc.text(`Email: ${user.email}`, 110, y);
        y += 12;

        // Personal spending block
        doc.setFont("helvetica", "bold");
        doc.setFontSize(12);
        doc.text("PERSONAL SPENDING DETAILS", 20, y);
        y += 6;
        doc.setFont("helvetica", "normal");
        doc.setFontSize(11);
        doc.text(`Personal Ledger Total Spent: INR ${personalTotal.toFixed(2)}`, 20, y);
        y += 12;

        // Group breakdown block
        doc.setFont("helvetica", "bold");
        doc.setFontSize(12);
        doc.text("ACTIVE BOOK LEDGERS", 20, y);
        y += 8;

        if (groupBreakdown.length === 0) {
          doc.setFont("helvetica", "italic");
          doc.setFontSize(11);
          doc.text("No active group splits in this period.", 20, y);
          y += 8;
        } else {
          // Table Headers
          doc.setFont("helvetica", "bold");
          doc.setFontSize(10);
          doc.setTextColor(100, 116, 139);
          doc.text("Group Name", 20, y);
          doc.text("Total Spent", 75, y);
          doc.text("My Share", 115, y);
          doc.text("Status", 155, y);
          y += 4;
          doc.line(20, y, 190, y);
          y += 8;

          doc.setFont("helvetica", "normal");
          doc.setFontSize(10);
          doc.setTextColor(15, 23, 42);

          groupBreakdown.forEach(item => {
            if (y > 270) {
              doc.addPage();
              y = 20;
            }
            doc.text(item.name.substring(0, 24), 20, y);
            doc.text(`INR ${item.totalSpent.toFixed(0)}`, 75, y);
            doc.text(`INR ${item.userShare.toFixed(0)}`, 115, y);

            let statText = "Settled Up";
            if (item.status === "owed") statText = `Owed INR ${item.net.toFixed(0)}`;
            else if (item.status === "owe") statText = `Owes INR ${Math.abs(item.net).toFixed(0)}`;
            
            doc.text(statText, 155, y);
            y += 8;
          });
        }
        y += 4;
        doc.setDrawColor(226, 232, 240);
        doc.line(20, y, 190, y);
        y += 12;

        // Grand Summary
        doc.setFont("helvetica", "bold");
        doc.setFontSize(13);
        doc.text("GRAND FINANCIAL SUMMARY", 20, y);
        y += 8;

        doc.setFont("helvetica", "normal");
        doc.setFontSize(11);
        doc.text(`Grand Combined Spent Share: INR ${grandCombinedSpending.toFixed(2)}`, 20, y);
        y += 6;
        doc.text(`Outstanding You Owe: INR ${totalYouOwe.toFixed(2)}`, 20, y);
        y += 6;
        doc.text(`Outstanding You are Owed: INR ${totalYouAreOwed.toFixed(2)}`, 20, y);
        y += 14;

        // Footer block
        doc.setLineWidth(0.3);
        doc.setDrawColor(200, 200, 200);
        doc.line(20, y, 190, y);
        y += 8;
        doc.setFont("helvetica", "italic");
        doc.setFontSize(9);
        doc.setTextColor(150, 150, 150);
        doc.text("End of Audited Sheets  |  Secured Split-Manager Engine by Antigravity", 20, y);

        doc.save(`expense-report-${selectedMonth.toLowerCase().replace(" ", "-")}.pdf`);
      } catch (err) {
        console.error("PDF generation error", err);
      } finally {
        setDownloading(false);
      }
    }, 800);
  };

  return (
    <>
      {/* Title block */}
      <div className="mb-4 d-flex justify-content-between align-items-center flex-wrap g-3">
        <div>
          <h2 className="section-title fs-2 mb-2" style={{ background: "linear-gradient(135deg, var(--text-primary) 30%, var(--brand-green) 100%)", WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent" }}>
            Export Reports
          </h2>
          <p className="text-secondary-custom small mb-0">Generate and print official audit reports of split books.</p>
        </div>

        {/* Month Selector */}
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
          <h5>Preparing statement copies...</h5>
        </div>
      ) : (
        <div className="row g-4 justify-content-center animate-fade-in">
          <div className="col-md-9 col-lg-7 text-center">
            
            {/* Print Preview Realistic Card */}
            <div className="card-premium text-start p-5 mb-4 position-relative overflow-hidden" style={{ minHeight: "400px", boxShadow: "var(--shadow-xl)" }}>
              
              {/* Top Sheet Margin Glow */}
              <div className="position-absolute top-0 left-0 right-0" style={{ height: "6px", background: "linear-gradient(90deg, var(--brand-green) 0%, var(--indigo) 100%)", width: "100%" }}></div>
  
              <div className="d-flex justify-content-between align-items-center mb-4 flex-wrap g-2">
                <div>
                  <h4 className="fw-bold mb-0 text-primary fs-5">Audit Log Sheet</h4>
                  <span className="text-muted-custom small" style={{ fontSize: "12px" }}>Generated dynamically in real-time</span>
                </div>
                <div className="text-end">
                  <span className="badge bg-secondary rounded-pill px-2.5 py-1" style={{ fontSize: "11px", border: "1px solid var(--card-border)", color: "var(--text-secondary)" }}>Official Copy</span>
                </div>
              </div>
  
              <hr style={{ borderTop: "1px dashed var(--card-border)", margin: "20px 0" }} />
  
              {/* Document body preview */}
              <div style={{ fontFamily: "var(--font-heading)" }}>
                <div className="row g-3 mb-4">
                  <div className="col-6">
                    <span className="text-muted-custom small d-block">User Name</span>
                    <strong className="text-primary fs-6">{user.name}</strong>
                  </div>
                  <div className="col-6 text-end">
                    <span className="text-muted-custom small d-block">Statement Period</span>
                    <strong className="text-primary" style={{ fontSize: "13px" }}>{selectedMonth}</strong>
                  </div>
                </div>
  
                <div className="p-3 card-flat mb-3" style={{ background: "var(--brand-green-light)", border: "1px solid var(--card-border)", margin: 0 }}>
                  <span className="text-muted-custom small d-block mb-1">My Total Combined Spent Share</span>
                  <h3 className="text-owed fw-bold mb-0">₹{grandCombinedSpending.toFixed(2)}</h3>
                </div>
  
                <div className="row g-2 mb-3">
                  <div className="col-6">
                    <div className="p-3 card-flat" style={{ margin: 0 }}>
                      <span className="text-muted-custom small d-block mb-1">You Owe</span>
                      <strong className="text-owe fs-5">₹{totalYouOwe.toFixed(2)}</strong>
                    </div>
                  </div>
                  <div className="col-6">
                    <div className="p-3 card-flat" style={{ margin: 0 }}>
                      <span className="text-muted-custom small d-block mb-1">You are Owed</span>
                      <strong className="text-owed fs-5">₹{totalYouAreOwed.toFixed(2)}</strong>
                    </div>
                  </div>
                </div>
              </div>
  
              <hr style={{ borderTop: "1px dashed var(--card-border)", margin: "20px 0" }} />
  
              <div className="text-center text-muted-custom small" style={{ fontSize: "11px" }}>
                End of Audited Sheets &bull; Safe & Secure Split Tracker
              </div>
            </div>
  
            {/* Download trigger */}
            <button
              className="btn-brand px-5 py-3"
              onClick={downloadPDF}
              disabled={downloading}
              style={{ minWidth: "220px" }}
            >
              {downloading ? (
                <span className="d-flex align-items-center justify-content-center">
                  <span className="spinner-border spinner-border-sm me-2" role="status" aria-hidden="true"></span>
                  Generating document...
                </span>
              ) : (
                <span className="d-flex align-items-center justify-content-center">
                  <svg className="me-2" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path>
                    <polyline points="7 10 12 15 17 10"></polyline>
                    <line x1="12" y1="15" x2="12" y2="3"></line>
                  </svg>
                  Download PDF Report
                </span>
              )}
            </button>
  
          </div>
        </div>
      )}
    </>
  );
}

export default PdfReport;