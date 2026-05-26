import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import API from "../services/api";

function Groups() {
  const [groups, setGroups] = useState([]);
  const [name, setName] = useState("");
  const [loading, setLoading] = useState(true);

  const getGroupStatus = (groupId) => {
    try {
      const membersSaved = localStorage.getItem(`group_members_${groupId}`);
      const expensesSaved = localStorage.getItem(`group_expenses_${groupId}`);
      const mList = membersSaved ? JSON.parse(membersSaved) : [];
      const expList = expensesSaved ? JSON.parse(expensesSaved) : [];

      if (!Array.isArray(mList) || mList.length === 0) {
        return { isSettled: true, text: "No members", count: 0, total: 0, outstanding: 0 };
      }
      if (!Array.isArray(expList) || expList.length === 0) {
        return { isSettled: true, text: "No expenses", count: 0, total: 0, outstanding: 0 };
      }

      const normalExpenses = expList.filter(e => !e.isSettlement);
      const settlementsOnly = expList.filter(e => e.isSettlement);

      const totalSpent = normalExpenses.reduce((sum, e) => sum + (parseFloat(e.amount) || 0), 0);
      const sharePerPerson = mList.length > 0 ? totalSpent / mList.length : 0;

      const balances = mList.map(m => {
        const paidNormal = normalExpenses
          .filter(e => e.paidBy === m)
          .reduce((sum, e) => sum + (parseFloat(e.amount) || 0), 0);

        const paidSent = settlementsOnly
          .filter(e => e.paidBy === m)
          .reduce((sum, e) => sum + (parseFloat(e.amount) || 0), 0);

        const paidReceived = settlementsOnly
          .filter(e => e.transferTo === m)
          .reduce((sum, e) => sum + (parseFloat(e.amount) || 0), 0);

        const totalPaidCalculated = paidNormal + paidSent - paidReceived;
        const net = totalPaidCalculated - sharePerPerson;
        return { name: m, net };
      });

      const debtors = balances.filter(b => b.net < -0.05);
      const creditors = balances.filter(b => b.net > 0.05);

      if (debtors.length === 0 && creditors.length === 0) {
        return { isSettled: true, text: "Settled Up", count: 0, total: totalSpent, outstanding: 0 };
      }

      const totalOutstanding = balances
        .filter(b => b.net > 0.05)
        .reduce((sum, b) => sum + b.net, 0);

      const uniquePeopleInvolved = new Set([
        ...debtors.map(d => d.name),
        ...creditors.map(c => c.name)
      ]);

      return {
        isSettled: false,
        text: "Active Debts",
        count: uniquePeopleInvolved.size,
        total: totalSpent,
        outstanding: totalOutstanding
      };
    } catch (err) {
      console.error("Error calculating group status:", err);
      return { isSettled: true, text: "Active", count: 0, total: 0, outstanding: 0 };
    }
  };

  const loadGroups = async () => {
    try {
      const res = await API.get("/groups");
      const data = Array.isArray(res.data) ? res.data : [];
      // Clean and robust check: exclude invalid/corrupt empty records (which happen when Lombok compiles incorrectly)
      const validGroups = data.filter(g => g && g.id !== undefined && g.id !== null && Object.keys(g).length > 0);
      setGroups(validGroups);
    } catch (e) {
      console.log("Error loading groups");
      setGroups([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadGroups();
  }, []);

  const addGroup = async (e) => {
    e.preventDefault();
    if (!name.trim()) return;
    try {
      await API.post("/groups", { name });
      setName("");
      loadGroups();
    } catch (err) {
      console.log("Error adding group");
    }
  };

  const deleteGroup = async (e, groupId) => {
    e.preventDefault();
    e.stopPropagation();
    if (!window.confirm("Are you absolutely sure you want to permanently delete this group?")) {
      return;
    }
    try {
      await API.delete(`/groups/${groupId}`);
      loadGroups();
    } catch (err) {
      console.log("Error deleting group:", err);
      alert("Failed to delete group.");
    }
  };

  const editGroup = async (e, groupId, currentName) => {
    e.preventDefault();
    e.stopPropagation();
    const newName = window.prompt("Enter new group name:", currentName || "");
    if (newName === null) return;
    if (!newName.trim()) {
      alert("Group name cannot be empty!");
      return;
    }
    try {
      await API.put(`/groups/${groupId}`, { name: newName });
      loadGroups();
    } catch (err) {
      console.log("Error editing group:", err);
      alert("Failed to edit group.");
    }
  };

  // Helper to pick a premium gradient class based on index
  const getGradientClass = (idx) => {
    const classes = ["", "accent", "purple", ""];
    return classes[idx % classes.length];
  };

  return (
    <>
      <div className="mb-4">
        <h2 className="section-title fs-2 mb-2" style={{ background: "linear-gradient(135deg, var(--text-primary) 30%, var(--brand-green) 100%)", WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent" }}>
          My Groups
        </h2>
        <p className="text-secondary-custom small mb-0">Create new split-groups or browse existing ones.</p>
      </div>

      {/* Add Group Sleek Card */}
      <div className="card-flat mb-4">
        <h5 className="mb-3 fs-6 fw-bold text-muted-custom text-uppercase tracking-wider">Start a New Group</h5>
        <form onSubmit={addGroup} className="d-flex align-items-center">
          <div className="flex-grow-1 me-2 position-relative">
            <input
              type="text"
              className="form-control"
              placeholder="e.g. Goa Trip 2026, Flatmates"
              value={name}
              onChange={(e) => setName(e.target.value)}
              required
            />
          </div>
          <button className="btn-brand" style={{ whiteSpace: "nowrap", padding: "12px 24px" }}>
            <span className="d-flex align-items-center">
              <svg className="me-2" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <line x1="12" y1="5" x2="12" y2="19"></line>
                <line x1="5" y1="12" x2="19" y2="12"></line>
              </svg>
              Create Group
            </span>
          </button>
        </form>
      </div>

      {/* Groups Grid */}
      {loading ? (
        <div className="text-center py-5 text-muted">
          <div className="spinner-border text-success mb-3" role="status"></div>
          <h5>Loading groups...</h5>
        </div>
      ) : groups.length === 0 ? (
        <div className="card-flat text-center py-5">
          <div className="mb-3 text-muted">
            <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
              <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"></path>
              <circle cx="9" cy="7" r="4"></circle>
              <path d="M23 21v-2a4 4 0 0 0-3-3.87"></path>
              <path d="M16 3.13a4 4 0 0 1 0 7.75"></path>
            </svg>
          </div>
          <h5 className="text-secondary-custom fw-semibold mb-2">No groups created yet</h5>
          <p className="text-muted-custom mb-0 small">Use the form above to add your first expense-split group!</p>
        </div>
      ) : (
        <div className="group-grid">
          {groups.map((g, idx) => {
            if (!g) return null;
            const status = getGroupStatus(g.id);
            return (
              <Link
                to={`/groups/${g.id}`}
                className="group-card"
                key={g.id || idx}
              >
                {/* Clean Status Badge */}
                {status.isSettled ? (
                  <div className="group-card-badge settled">
                    ✓ Settled
                  </div>
                ) : (
                  <div className="group-card-badge owe">
                    ₹{status.outstanding.toFixed(0)} Owed
                  </div>
                )}

                <div className="group-card-header">
                  <div className={`avatar ${getGradientClass(idx)}`}>
                    {g.name && typeof g.name === "string" ? g.name.substring(0, 2).toUpperCase() : "GP"}
                  </div>
                  <div>
                    <h5 className="mb-0 text-primary">{g.name || "Unnamed Group"}</h5>
                    <p className="text-muted-custom mb-0 small" style={{ fontSize: "12px" }}>
                      {status.isSettled ? (
                        status.total > 0 
                          ? `Fully settled up • Total: ₹${status.total.toFixed(0)}` 
                          : "No expenses recorded yet"
                      ) : (
                        `${status.count} members have outstanding splits`
                      )}
                    </p>
                  </div>
                </div>

                 <div className="group-card-body mt-2">
                  <hr style={{ borderTop: "1px solid var(--card-border)", margin: "10px 0" }} />
                  <div className="d-flex justify-content-between align-items-center">
                    <div className="d-flex align-items-center">
                      <span className="text-muted-custom small me-2">Group ID</span>
                      <span className="badge bg-secondary rounded-pill px-2 py-1" style={{ fontSize: "11px" }}>#{g.id || idx}</span>
                    </div>
                    <div className="d-flex align-items-center" style={{ gap: "6px" }}>
                      <button
                        onClick={(e) => editGroup(e, g.id, g.name)}
                        title="Edit Group Name"
                        style={{
                          background: "none",
                          border: "none",
                          color: "var(--brand-green)",
                          padding: "6px",
                          cursor: "pointer",
                          borderRadius: "8px",
                          transition: "all 0.2s",
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "center"
                        }}
                        onMouseEnter={(e) => e.currentTarget.style.background = "rgba(40, 199, 111, 0.1)"}
                        onMouseLeave={(e) => e.currentTarget.style.background = "none"}
                      >
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                          <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path>
                          <path d="M18.5 2.5a2.121 2.121 0 1 1 3 3L12 15l-4 1 1-4 9.5-9.5z"></path>
                        </svg>
                      </button>
                      <button
                        onClick={(e) => deleteGroup(e, g.id)}
                        title="Delete Group"
                        style={{
                          background: "none",
                          border: "none",
                          color: "var(--brand-orange)",
                          padding: "6px",
                          cursor: "pointer",
                          borderRadius: "8px",
                          transition: "all 0.2s",
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "center"
                        }}
                        onMouseEnter={(e) => e.currentTarget.style.background = "rgba(239, 68, 68, 0.1)"}
                        onMouseLeave={(e) => e.currentTarget.style.background = "none"}
                      >
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                          <polyline points="3 6 5 6 21 6"></polyline>
                          <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path>
                          <line x1="10" y1="11" x2="10" y2="17"></line>
                          <line x1="14" y1="11" x2="14" y2="17"></line>
                        </svg>
                      </button>
                    </div>
                  </div>
                </div>
              </Link>
            );
          })}
        </div>
      )}
    </>
  );
}

export default Groups;