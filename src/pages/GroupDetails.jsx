import { useEffect, useState } from "react";
import { useParams, Link, useNavigate } from "react-router-dom";
import API from "../services/api";

function GroupDetails() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [group, setGroup] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [isEditing, setIsEditing] = useState(false);
  const [editName, setEditName] = useState("");

  // --- Group Members & Expenses States ---
  const [members, setMembers] = useState(() => {
    try {
      const saved = localStorage.getItem(`group_members_${id}`);
      return saved ? JSON.parse(saved) : [];
    } catch (e) {
      console.error("Error loading group members from localStorage:", e);
      return [];
    }
  });
  const [newMemberName, setNewMemberName] = useState("");

  const [groupExpenses, setGroupExpenses] = useState(() => {
    try {
      const saved = localStorage.getItem(`group_expenses_${id}`);
      return saved ? JSON.parse(saved) : [];
    } catch (e) {
      console.error("Error loading group expenses from localStorage:", e);
      return [];
    }
  });
  const [showAddExp, setShowAddExp] = useState(false);
  const [formType, setFormType] = useState("expense"); // "expense" or "settlement"
  const [expForm, setExpForm] = useState({ title: "", amount: "", paidBy: "" });
  const [settleForm, setSettleForm] = useState({ from: "", to: "", amount: "" });

  // Sync to localStorage
  useEffect(() => {
    localStorage.setItem(`group_members_${id}`, JSON.stringify(members));
  }, [members, id]);

  useEffect(() => {
    localStorage.setItem(`group_expenses_${id}`, JSON.stringify(groupExpenses));
  }, [groupExpenses, id]);

  // Set default paidBy when members change or load
  useEffect(() => {
    if (members.length > 0) {
      if (!expForm.paidBy || !members.includes(expForm.paidBy)) {
        setExpForm(prev => ({ ...prev, paidBy: members[0] }));
      }
      
      // Set default settlement payer/receiver
      setSettleForm(prev => {
        const from = prev.from && members.includes(prev.from) ? prev.from : members[0];
        const toCandidates = members.filter(m => m !== from);
        const to = prev.to && members.includes(prev.to) && prev.to !== from 
          ? prev.to 
          : (toCandidates[0] || "");
        return { ...prev, from, to };
      });
    } else {
      setExpForm(prev => ({ ...prev, paidBy: "" }));
      setSettleForm({ from: "", to: "", amount: "" });
    }
  }, [members, expForm.paidBy]);

  const addMember = (e) => {
    e.preventDefault();
    if (!newMemberName.trim()) return;
    const name = newMemberName.trim();
    if (members.includes(name)) {
      alert("Member already exists in this group!");
      return;
    }
    setMembers(prev => [...prev, name]);
    setNewMemberName("");
  };

  const removeMember = (name) => {
    if (window.confirm(`Are you sure you want to remove "${name}" from this group?`)) {
      setMembers(prev => prev.filter(m => m !== name));
    }
  };

  const addGroupExpense = (e) => {
    e.preventDefault();
    if (!expForm.title.trim() || !expForm.amount) return;
    const amt = parseFloat(expForm.amount);
    if (isNaN(amt) || amt <= 0) {
      alert("Please enter a valid amount greater than 0.");
      return;
    }

    const newExp = {
      id: Date.now().toString(),
      title: expForm.title.trim(),
      amount: amt,
      paidBy: expForm.paidBy || members[0] || "You",
      date: new Date().toLocaleDateString("en-IN", {
        day: "numeric",
        month: "short",
        year: "numeric"
      })
    };

    setGroupExpenses(prev => [newExp, ...prev]);
    setExpForm(prev => ({ ...prev, title: "", amount: "" })); // Keep same paidBy for convenience
    setShowAddExp(false);
  };

  const addGroupSettlement = (from, to, amount) => {
    const amt = parseFloat(amount);
    if (isNaN(amt) || amt <= 0) {
      alert("Please enter a valid amount greater than 0.");
      return;
    }
    if (from === to) {
      alert("Payer and receiver cannot be the same person!");
      return;
    }

    const newExp = {
      id: Date.now().toString(),
      title: `Settlement: ${from} paid ${to}`,
      amount: amt,
      paidBy: from,
      transferTo: to,
      isSettlement: true,
      date: new Date().toLocaleDateString("en-IN", {
        day: "numeric",
        month: "short",
        year: "numeric"
      })
    };

    setGroupExpenses(prev => [newExp, ...prev]);
    setSettleForm(prev => ({ ...prev, amount: "" }));
    setShowAddExp(false);
  };

  const handleManualSettlementSubmit = (e) => {
    e.preventDefault();
    addGroupSettlement(settleForm.from, settleForm.to, settleForm.amount);
  };

  const handleOneClickSettle = (from, to, amount) => {
    if (window.confirm(`Mark as Paid? Confirm that "${from}" paid ₹${amount.toFixed(2)} to "${to}" directly.`)) {
      addGroupSettlement(from, to, amount);
    }
  };

  const deleteGroupExpense = (expId) => {
    if (window.confirm("Are you sure you want to delete this expense?")) {
      setGroupExpenses(prev => prev.filter(e => e.id !== expId));
    }
  };

  // --- Splitting & Settlement Calculations ---
  const normalExpenses = groupExpenses.filter(e => !e.isSettlement);
  const settlementsOnly = groupExpenses.filter(e => e.isSettlement);

  const totalSpent = normalExpenses.reduce((sum, e) => sum + e.amount, 0);
  const sharePerPerson = members.length > 0 ? totalSpent / members.length : 0;

  const balances = members.map(m => {
    const paidNormal = normalExpenses
      .filter(e => e.paidBy === m)
      .reduce((sum, e) => sum + e.amount, 0);

    const paidSent = settlementsOnly
      .filter(e => e.paidBy === m)
      .reduce((sum, e) => sum + e.amount, 0);

    const paidReceived = settlementsOnly
      .filter(e => e.transferTo === m)
      .reduce((sum, e) => sum + e.amount, 0);

    const totalPaidCalculated = paidNormal + paidSent - paidReceived;
    const net = totalPaidCalculated - sharePerPerson;
    return { name: m, paid: paidNormal + paidSent, net };
  });

  const settlementsList = [];
  if (members.length > 1 && totalSpent > 0) {
    // Greedy debt minimization algorithm (Splitwise style)
    const netBalances = balances.map(b => ({ ...b }));
    
    // Sort debtors and creditors
    let debtors = netBalances.filter(b => b.net < -0.01).sort((a, b) => a.net - b.net); // most negative first
    let creditors = netBalances.filter(b => b.net > 0.01).sort((a, b) => b.net - a.net); // most positive first
    
    let i = 0; // debtor index
    let j = 0; // creditor index
    
    while (i < debtors.length && j < creditors.length) {
      const debtor = debtors[i];
      const creditor = creditors[j];
      
      const oweAmount = Math.abs(debtor.net);
      const creditAmount = creditor.net;
      
      const settleAmount = Math.min(oweAmount, creditAmount);
      
      if (settleAmount > 0.01) {
        settlementsList.push({
          from: debtor.name,
          to: creditor.name,
          amount: settleAmount
        });
      }
      
      debtor.net += settleAmount;
      creditor.net -= settleAmount;
      
      if (Math.abs(debtor.net) < 0.01) {
        i++;
      }
      if (creditor.net < 0.01) {
        j++;
      }
    }
  }

  useEffect(() => {
    const fetchGroup = async () => {
      try {
        const res = await API.get(`/groups/${id}`);
        if (res.data && res.data.id !== undefined) {
          setGroup({
            id: res.data.id,
            name: res.data.name || "Unnamed Group"
          });
        } else {
          setError("Group not found");
        }
      } catch (err) {
        console.error("Error fetching group:", err);
        setError("Group Details Unavailable");
      } finally {
        setLoading(false);
      }
    };
    fetchGroup();
  }, [id]);

  const deleteGroup = async () => {
    if (!window.confirm("Are you absolutely sure you want to permanently delete this group? This action cannot be undone.")) {
      return;
    }
    try {
      await API.delete(`/groups/${id}`);
      navigate("/groups");
    } catch (err) {
      console.error("Error deleting group:", err);
      alert("Failed to delete group.");
    }
  };

  const handleRename = async (e) => {
    e.preventDefault();
    if (!editName.trim()) return;
    try {
      await API.put(`/groups/${id}`, { name: editName });
      setGroup(prev => ({ ...prev, name: editName }));
      setIsEditing(false);
    } catch (err) {
      console.error("Error renaming group:", err);
      alert("Failed to update group name.");
    }
  };

  if (loading) {
    return (
      <div className="text-center py-5 text-muted animate-fade-in">
        <div className="spinner-border text-success mb-3" role="status"></div>
        <h5>Loading group details...</h5>
      </div>
    );
  }

  if (error || !group) {
    return (
      <div className="card-flat text-center py-5 animate-fade-in">
        <div className="mb-3 text-danger">
          <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
            <circle cx="12" cy="12" r="10"></circle>
            <line x1="12" y1="8" x2="12" y2="12"></line>
            <line x1="12" y1="16" x2="12.01" y2="16"></line>
          </svg>
        </div>
        <h5 className="text-secondary-custom fw-semibold mb-2">{error || "Group Not Found"}</h5>
        <p className="text-muted-custom mb-3 small mx-auto" style={{ maxWidth: "380px" }}>
          If you recently clicked "Reset All Application Data", all old groups were permanently deleted. Please return to your groups page to start fresh!
        </p>
        <Link to="/groups" className="btn-brand d-inline-block px-4 py-2 text-decoration-none">
          Back to My Groups
        </Link>
      </div>
    );
  }

  return (
    <>
      {/* Back Button and Title */}
      <div className="mb-4 animate-fade-in">
        <Link to="/groups" className="text-decoration-none d-inline-flex align-items-center mb-3 text-secondary-custom hover-glow" style={{ transition: "color 0.2s" }}>
          <svg className="me-2" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <line x1="19" y1="12" x2="5" y2="12"></line>
            <polyline points="12 19 5 12 12 5"></polyline>
          </svg>
          Back to Groups
        </Link>
        
        <div className="d-flex justify-content-between align-items-center flex-wrap g-2">
          <div>
            {isEditing ? (
              <form onSubmit={handleRename} className="d-flex align-items-center mb-2 flex-wrap" style={{ gap: "8px" }}>
                <input
                  type="text"
                  className="form-control"
                  style={{
                    background: "var(--card-bg)",
                    border: "2px solid var(--brand-green)",
                    color: "var(--text-primary)",
                    borderRadius: "12px",
                    padding: "8px 16px",
                    fontSize: "1.25rem",
                    fontWeight: "700",
                    maxWidth: "280px",
                    boxShadow: "0 0 15px rgba(40, 199, 111, 0.15)",
                    outline: "none"
                  }}
                  value={editName}
                  onChange={(e) => setEditName(e.target.value)}
                  autoFocus
                  required
                />
                <button type="submit" className="btn-brand px-3 py-2.5 fs-7 fw-bold" style={{ borderRadius: "10px" }}>
                  Save
                </button>
                <button 
                  type="button" 
                  className="btn btn-outline-secondary px-3 py-2.5 fs-7 fw-bold" 
                  style={{ borderRadius: "10px", border: "1.5px solid var(--card-border)", color: "var(--text-muted)" }} 
                  onClick={() => setIsEditing(false)}
                >
                  Cancel
                </button>
              </form>
            ) : (
              <div className="d-flex align-items-center flex-wrap">
                <h2 className="section-title fs-2 mb-1" style={{ background: "linear-gradient(135deg, var(--text-primary) 30%, var(--brand-green) 100%)", WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent" }}>
                  {group.name}
                </h2>
                <button
                  onClick={() => {
                    setEditName(group.name);
                    setIsEditing(true);
                  }}
                  title="Rename Group"
                  style={{
                    background: "none",
                    border: "none",
                    color: "var(--text-muted)",
                    padding: "6px",
                    cursor: "pointer",
                    borderRadius: "8px",
                    transition: "all 0.2s",
                    display: "inline-flex",
                    alignItems: "center",
                    justifyContent: "center",
                    marginLeft: "8px"
                  }}
                  onMouseEnter={(e) => e.currentTarget.style.color = "var(--brand-green)"}
                  onMouseLeave={(e) => e.currentTarget.style.color = "var(--text-muted)"}
                >
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                    <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path>
                    <path d="M18.5 2.5a2.121 2.121 0 1 1 3 3L12 15l-4 1 1-4 9.5-9.5z"></path>
                  </svg>
                </button>
              </div>
            )}
            <p className="text-secondary-custom mb-0 small">Group ID: #{group.id} &bull; Manage split weights and balances</p>
          </div>
          
          <div className="d-flex align-items-center g-2 flex-wrap" style={{ gap: "8px" }}>
            <span className="badge bg-success-light text-success px-3 py-2 rounded-pill fs-7 me-1" style={{ border: "1px solid var(--brand-green)", whiteSpace: "nowrap" }}>
              Active Split Group
            </span>
            <button
              onClick={() => {
                setEditName(group.name);
                setIsEditing(true);
              }}
              className="btn btn-outline-success d-inline-flex align-items-center px-3 py-1.5 fs-7 fw-bold"
              style={{
                borderRadius: "20px",
                border: "1.5px solid rgba(40, 199, 111, 0.3)",
                background: "rgba(40, 199, 111, 0.02)",
                color: "var(--brand-green)",
                transition: "all 0.2s"
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.background = "rgba(40, 199, 111, 0.1)";
                e.currentTarget.style.color = "var(--brand-green)";
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.background = "rgba(40, 199, 111, 0.02)";
                e.currentTarget.style.color = "var(--brand-green)";
              }}
            >
              <svg className="me-1.5" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path>
                <path d="M18.5 2.5a2.121 2.121 0 1 1 3 3L12 15l-4 1 1-4 9.5-9.5z"></path>
              </svg>
              Rename Group
            </button>
            <button
              onClick={deleteGroup}
              className="btn btn-outline-danger d-inline-flex align-items-center px-3 py-1.5 fs-7 fw-bold"
              style={{
                borderRadius: "20px",
                border: "1.5px solid rgba(239, 68, 68, 0.3)",
                background: "rgba(239, 68, 68, 0.02)",
                color: "var(--brand-orange)",
                transition: "all 0.2s"
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.background = "rgba(239, 68, 68, 0.1)";
                e.currentTarget.style.color = "var(--brand-orange)";
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.background = "rgba(239, 68, 68, 0.02)";
                e.currentTarget.style.color = "var(--brand-orange)";
              }}
            >
              <svg className="me-1.5" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                <polyline points="3 6 5 6 21 6"></polyline>
                <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path>
                <line x1="10" y1="11" x2="10" y2="17"></line>
                <line x1="14" y1="11" x2="14" y2="17"></line>
              </svg>
              Delete Group
            </button>
          </div>
        </div>
      </div>

      <div className="row g-4">
        {/* Left Column: Group Expenses */}
        <div className="col-lg-7">
          <div className="card-flat">
            <div className="d-flex justify-content-between align-items-center mb-4">
              <h4 className="section-title fs-5 mb-0 d-flex align-items-center">
                <svg className="me-2" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ color: "var(--brand-green)" }}>
                  <rect x="2" y="4" width="20" height="16" rx="2" ry="2"></rect>
                  <line x1="12" y1="4" x2="12" y2="20"></line>
                  <line x1="2" y1="12" x2="22" y2="12"></line>
                </svg>
                Group Expenses
              </h4>
              <button 
                onClick={() => {
                  if (members.length === 0) {
                    alert("Please add at least one member to the group first!");
                    return;
                  }
                  setShowAddExp(!showAddExp);
                  setExpForm({ title: "", amount: "", paidBy: members[0] || "You" });
                }}
                className={`btn btn-sm ${showAddExp ? "btn-outline-secondary" : "btn-brand"} px-3 py-1.5 fs-7 fw-bold`}
                style={{ borderRadius: "10px" }}
              >
                {showAddExp ? "Cancel" : "+ Add Expense"}
              </button>
            </div>

            {/* Inline Add Expense Form */}
            {showAddExp && (
              <div className="card-flat p-4 mb-4 animate-fade-in" style={{ border: "1.5px solid var(--brand-green-light)", background: "rgba(40, 199, 111, 0.01)", margin: "0 0 24px 0" }}>
                {/* Form Mode Toggle */}
                <div className="d-flex mb-3 border-bottom pb-2" style={{ gap: "16px" }}>
                  <button
                    type="button"
                    onClick={() => setFormType("expense")}
                    style={{
                      background: "none",
                      border: "none",
                      color: formType === "expense" ? "var(--brand-green)" : "var(--text-muted)",
                      fontWeight: "700",
                      fontSize: "13px",
                      borderBottom: formType === "expense" ? "2px solid var(--brand-green)" : "none",
                      paddingBottom: "6px",
                      transition: "all 0.2s"
                    }}
                  >
                    Record Shared Bill
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      if (members.length < 2) {
                        alert("Please add at least 2 members to record a peer-to-peer settlement!");
                        return;
                      }
                      setFormType("settlement");
                    }}
                    style={{
                      background: "none",
                      border: "none",
                      color: formType === "settlement" ? "var(--brand-green)" : "var(--text-muted)",
                      fontWeight: "700",
                      fontSize: "13px",
                      borderBottom: formType === "settlement" ? "2px solid var(--brand-green)" : "none",
                      paddingBottom: "6px",
                      transition: "all 0.2s"
                    }}
                  >
                    Record Payment (Settle Up)
                  </button>
                </div>

                {formType === "expense" ? (
                  <form onSubmit={addGroupExpense}>
                    <h6 className="fs-7 fw-bold text-muted-custom text-uppercase tracking-wider mb-3">Add Shared Group Bill</h6>
                    <div className="row g-3">
                      <div className="col-md-6">
                        <label className="form-label text-secondary-custom small fw-semibold">Description</label>
                        <input
                          type="text"
                          className="form-control"
                          placeholder="e.g. Dinner, Taxi, Groceries"
                          value={expForm.title}
                          onChange={(e) => setExpForm({ ...expForm, title: e.target.value })}
                          required
                        />
                      </div>
                      <div className="col-md-3">
                        <label className="form-label text-secondary-custom small fw-semibold">Amount (₹)</label>
                        <input
                          type="number"
                          min="0.01"
                          step="any"
                          className="form-control"
                          placeholder="0.00"
                          value={expForm.amount}
                          onChange={(e) => setExpForm({ ...expForm, amount: e.target.value })}
                          required
                        />
                      </div>
                      <div className="col-md-3">
                        <label className="form-label text-secondary-custom small fw-semibold">Paid By</label>
                        <select
                          className="form-select text-primary fw-semibold"
                          value={expForm.paidBy}
                          onChange={(e) => setExpForm({ ...expForm, paidBy: e.target.value })}
                          required
                        >
                          {members.map(m => (
                            <option key={m} value={m}>{m}</option>
                          ))}
                        </select>
                      </div>
                    </div>
                    <div className="mt-3 text-end">
                      <button type="submit" className="btn btn-sm btn-success px-4 py-2 fw-bold" style={{ borderRadius: "10px" }}>
                        Save Expense
                      </button>
                    </div>
                  </form>
                ) : (
                  <form onSubmit={handleManualSettlementSubmit}>
                    <h6 className="fs-7 fw-bold text-muted-custom text-uppercase tracking-wider mb-3">Record P2P Settlement Payment</h6>
                    <div className="row g-3">
                      <div className="col-md-4">
                        <label className="form-label text-secondary-custom small fw-semibold">Who paid? (Debtor)</label>
                        <select
                          className="form-select text-primary fw-semibold"
                          value={settleForm.from}
                          onChange={(e) => {
                            const newFrom = e.target.value;
                            const newTo = settleForm.to === newFrom ? members.find(m => m !== newFrom) || "" : settleForm.to;
                            setSettleForm({ ...settleForm, from: newFrom, to: newTo });
                          }}
                          required
                        >
                          {members.map(m => (
                            <option key={m} value={m}>{m}</option>
                          ))}
                        </select>
                      </div>
                      <div className="col-md-4">
                        <label className="form-label text-secondary-custom small fw-semibold">Who received? (Creditor)</label>
                        <select
                          className="form-select text-primary fw-semibold"
                          value={settleForm.to}
                          onChange={(e) => setSettleForm({ ...settleForm, to: e.target.value })}
                          required
                        >
                          {members.filter(m => m !== settleForm.from).map(m => (
                            <option key={m} value={m}>{m}</option>
                          ))}
                        </select>
                      </div>
                      <div className="col-md-4">
                        <label className="form-label text-secondary-custom small fw-semibold">Amount Paid (₹)</label>
                        <input
                          type="number"
                          min="0.01"
                          step="any"
                          className="form-control"
                          placeholder="0.00"
                          value={settleForm.amount}
                          onChange={(e) => setSettleForm({ ...settleForm, amount: e.target.value })}
                          required
                        />
                      </div>
                    </div>
                    <div className="mt-3 text-end">
                      <button type="submit" className="btn btn-sm btn-success px-4 py-2 fw-bold" style={{ borderRadius: "10px" }}>
                        Record Payment
                      </button>
                    </div>
                  </form>
                )}
              </div>
            )}

            {/* Expenses List */}
            {groupExpenses.length === 0 ? (
              <div className="text-center py-5 text-muted">
                <div className="mb-3 text-secondary-custom opacity-75">
                  <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path>
                    <polyline points="14 2 14 8 20 8"></polyline>
                    <line x1="16" y1="13" x2="8" y2="13"></line>
                    <line x1="16" y1="17" x2="8" y2="17"></line>
                    <polyline points="10 9 9 9 8 9"></polyline>
                  </svg>
                </div>
                <h6 className="fw-semibold text-secondary-custom mb-1">No group expenses recorded yet</h6>
                <p className="mb-0 small text-muted-custom">Use the "+ Add Expense" button above to log the first split item!</p>
              </div>
            ) : (
              <div className="pe-1" style={{ maxHeight: "400px", overflowY: "auto" }}>
                {groupExpenses.map((e, idx) => (
                  <div
                    className="list-item align-items-center justify-content-between px-3"
                    key={e.id}
                    style={{ 
                      borderBottom: idx === groupExpenses.length - 1 ? "none" : "1px solid var(--border-color)",
                      background: e.isSettlement ? "rgba(40, 199, 111, 0.02)" : "none"
                    }}
                  >
                    <div className="d-flex align-items-center flex-grow-1">
                      {e.isSettlement ? (
                        <div className="avatar bg-success-light text-success fw-bold d-flex align-items-center justify-content-center" style={{ border: "1.5px solid var(--brand-green)", color: "var(--brand-green)", fontSize: "12px", background: "rgba(40, 199, 111, 0.1)" }}>
                          ✓
                        </div>
                      ) : (
                        <div className="avatar bg-success-light text-success fw-bold" style={{ border: "1.5px solid var(--brand-green)" }}>
                          {e.title ? e.title.substring(0, 1).toUpperCase() : "E"}
                        </div>
                      )}
                      <div className="list-details">
                        <div className="d-flex align-items-center flex-wrap g-1 mb-1">
                          <h5 className="mb-0 me-2 text-primary" style={{ fontStyle: e.isSettlement ? "italic" : "normal" }}>{e.title}</h5>
                          <span className="badge bg-secondary rounded-pill text-muted-custom" style={{ fontSize: "10px", padding: "2px 8px" }}>{e.date}</span>
                        </div>
                        {e.isSettlement ? (
                          <p className="text-muted-custom mb-0 small">
                            Payment from <strong className="text-primary">{e.paidBy}</strong> to <strong className="text-primary">{e.transferTo}</strong>
                          </p>
                        ) : (
                          <p className="text-muted-custom mb-0 small">Paid by <strong className="text-primary">{e.paidBy}</strong></p>
                        )}
                      </div>
                    </div>
                    
                    <div className="d-flex align-items-center ms-3">
                      <span className={`fw-bold fs-5 me-3 ${e.isSettlement ? "text-success" : "text-primary"}`}>
                        {e.isSettlement ? "✓ " : ""}₹{parseFloat(e.amount).toFixed(2)}
                      </span>
                      <button
                        onClick={() => deleteGroupExpense(e.id)}
                        title="Delete record"
                        style={{
                          background: "none",
                          border: "none",
                          color: "var(--brand-orange)",
                          padding: "6px",
                          cursor: "pointer",
                          borderRadius: "8px",
                          transition: "all 0.2s"
                        }}
                        onMouseEnter={(e) => e.currentTarget.style.background = "rgba(239, 68, 68, 0.1)"}
                        onMouseLeave={(e) => e.currentTarget.style.background = "none"}
                      >
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                          <polyline points="3 6 5 6 21 6"></polyline>
                          <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path>
                        </svg>
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Right Column: Group Members & Balances */}
        <div className="col-lg-5">
          {/* Section A: Group Members Manager */}
          <div className="card-flat mb-4">
            <h4 className="section-title fs-5 mb-3 d-flex align-items-center">
              <svg className="me-2" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ color: "var(--brand-green)" }}>
                <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"></path>
                <circle cx="9" cy="7" r="4"></circle>
              </svg>
              Group Members
            </h4>

            {/* List of Member Chips */}
            <div className="d-flex flex-wrap mb-3" style={{ gap: "8px" }}>
              {members.map(m => (
                <div 
                  key={m} 
                  className="d-inline-flex align-items-center px-3 py-1.5 rounded-pill fs-7 text-primary bg-secondary"
                  style={{ border: "1px solid var(--card-border)", transition: "all 0.2s" }}
                >
                  <div 
                    className="rounded-circle d-flex align-items-center justify-content-center text-white fw-bold me-2" 
                    style={{ 
                      width: "20px", 
                      height: "20px", 
                      fontSize: "10px", 
                      background: "linear-gradient(135deg, var(--brand-green) 0%, var(--indigo) 100%)" 
                    }}
                  >
                    {m.substring(0, 1).toUpperCase()}
                  </div>
                  <span className="fw-semibold">{m}</span>
                  <button 
                    onClick={() => removeMember(m)}
                    className="border-0 bg-transparent ms-2 p-0 text-muted hover-glow"
                    title="Remove member"
                    style={{ fontSize: "14px", lineHeight: "1" }}
                  >
                    &times;
                  </button>
                </div>
              ))}
            </div>

            {/* Add Member Form */}
            <form onSubmit={addMember} className="d-flex align-items-center">
              <input
                type="text"
                placeholder="e.g. Prince, Raj, Aman"
                className="form-control py-2 px-3 me-2"
                style={{ fontSize: "13px", borderRadius: "10px" }}
                value={newMemberName}
                onChange={(e) => setNewMemberName(e.target.value)}
                required
              />
              <button className="btn-brand px-3 py-2 fw-bold" style={{ borderRadius: "10px", whiteSpace: "nowrap", fontSize: "13px" }}>
                + Add Member
              </button>
            </form>
          </div>

          {/* Section B: Balance Sheet & Optimized Settlements */}
          <div className="card-flat">
            <h4 className="section-title fs-5 mb-3 d-flex align-items-center">
              <svg className="me-2" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ color: "var(--brand-green)" }}>
                <circle cx="12" cy="12" r="10"></circle>
                <line x1="12" y1="16" x2="12" y2="12"></line>
                <line x1="12" y1="8" x2="12.01" y2="8"></line>
              </svg>
              Balances & Debts
            </h4>

            {groupExpenses.length === 0 ? (
              <div className="text-center py-4 text-muted">
                <div className="mb-2 text-secondary-custom opacity-75">
                  <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                    <polyline points="20 6 9 17 4 12"></polyline>
                  </svg>
                </div>
                <h6 className="fw-semibold text-secondary-custom mb-1 fs-7">All settled up!</h6>
                <p className="mb-0 small text-muted-custom" style={{ fontSize: "12px" }}>No outstanding debts. Add group bills to see ledger calculations.</p>
              </div>
            ) : (
              <div>
                {/* Micro Details Box */}
                <div className="card-flat p-3 mb-3 bg-secondary" style={{ border: "1px solid var(--card-border)", margin: 0 }}>
                  <div className="d-flex justify-content-between align-items-center mb-1">
                    <span className="text-muted-custom small">Total Group Spent</span>
                    <span className="fw-bold text-primary">₹{totalSpent.toFixed(2)}</span>
                  </div>
                  <div className="d-flex justify-content-between align-items-center">
                    <span className="text-muted-custom small">Per-Person Split</span>
                    <span className="fw-bold text-owed">₹{sharePerPerson.toFixed(2)}</span>
                  </div>
                </div>

                {/* Individual Balances List */}
                <div className="mb-4">
                  <h6 className="fs-7 fw-bold text-muted-custom text-uppercase tracking-wider mb-2">Net Balances</h6>
                  {balances.map(b => (
                    <div key={b.name} className="d-flex justify-content-between align-items-center py-2" style={{ borderBottom: "1px solid var(--card-border)" }}>
                      <div className="d-flex align-items-center">
                        <div 
                          className="rounded-circle d-flex align-items-center justify-content-center text-white fw-bold me-2" 
                          style={{ 
                            width: "16px", 
                            height: "16px", 
                            fontSize: "8px", 
                            background: "var(--text-muted)" 
                          }}
                        >
                          {b.name.substring(0, 1).toUpperCase()}
                        </div>
                        <span className="text-primary small fw-semibold">{b.name}</span>
                      </div>
                      <div className="text-end">
                        <span className="text-muted-custom small d-block" style={{ fontSize: "10px" }}>Paid: ₹{b.paid.toFixed(0)}</span>
                        {b.net > 0.01 ? (
                          <span className="text-owed fw-bold small">Gets back ₹{b.net.toFixed(2)}</span>
                        ) : b.net < -0.01 ? (
                          <span className="text-owe fw-bold small">Owes ₹{Math.abs(b.net).toFixed(2)}</span>
                        ) : (
                          <span className="text-muted-custom small fw-semibold" style={{ fontSize: "11px" }}>Settled</span>
                        )}
                      </div>
                    </div>
                  ))}
                </div>

                {/* Splitwise Settlement Directions */}
                <div>
                  <h6 className="fs-7 fw-bold text-muted-custom text-uppercase tracking-wider mb-2">Suggested Settlements</h6>
                  {settlementsList.length === 0 ? (
                    <p className="text-muted-custom small mb-0" style={{ fontSize: "12px" }}>🎉 Everything splits perfectly evenly. No transactions needed!</p>
                  ) : (
                    <div className="d-flex flex-column" style={{ gap: "6px" }}>
                      {settlementsList.map((s, idx) => (
                        <div 
                          key={idx} 
                          className="card-flat p-2.5 d-flex align-items-center justify-content-between flex-wrap"
                          style={{ border: "1px dashed var(--card-border)", background: "none", margin: 0, gap: "6px" }}
                        >
                          <div className="d-flex align-items-center flex-grow-1">
                            <span className="text-primary small fw-semibold">{s.from}</span>
                            <span className="text-muted-custom small d-inline-flex align-items-center mx-2" style={{ fontSize: "11px" }}>
                              owes 
                              <svg className="mx-1" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" style={{ color: "var(--brand-orange)" }}>
                                <line x1="5" y1="12" x2="19" y2="12"></line>
                                <polyline points="12 5 19 12 12 19"></polyline>
                              </svg>
                            </span>
                            <span className="text-primary small fw-semibold">{s.to}</span>
                          </div>
                          
                          <div className="d-flex align-items-center" style={{ gap: "8px" }}>
                            <span className="badge bg-success-light text-success fw-bold px-2.5 py-1" style={{ fontSize: "12px", border: "1px solid var(--brand-green)" }}>
                              ₹{s.amount.toFixed(2)}
                            </span>
                            <button
                              onClick={() => handleOneClickSettle(s.from, s.to, s.amount)}
                              className="btn btn-sm btn-success px-2 py-1 fs-8 fw-bold text-white d-inline-flex align-items-center hover-glow"
                              style={{ borderRadius: "6px", border: "none", fontSize: "10px", background: "var(--brand-green)", cursor: "pointer", transition: "all 0.2s" }}
                              title="Mark this debt as paid"
                            >
                              Settle Up
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

              </div>
            )}
          </div>
        </div>
      </div>
    </>
  );
}

export default GroupDetails;