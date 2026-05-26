import { useEffect, useState } from "react";
import API from "../services/api";

function Expenses() {
  const [expenses, setExpenses] = useState([]);
  const [search, setSearch] = useState("");
  const [form, setForm] = useState({
    title: "",
    amount: "",
    paidBy: ""
  });
  const [loading, setLoading] = useState(true);
  const [adding, setAdding] = useState(false);

  const loadExpenses = async () => {
    try {
      const res = await API.get("/expenses");
      setExpenses(res.data || []);
    } catch (e) {
      console.log("Error loading expenses");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadExpenses();
  }, []);

  const handleChange = (e) => {
    setForm({
      ...form,
      [e.target.name]: e.target.value
    });
  };

  const addExpense = async (e) => {
    e.preventDefault();
    if (!form.title || !form.amount || !form.paidBy) return;
    setAdding(true);
    try {
      await API.post("/expenses", form);
      setForm({ title: "", amount: "", paidBy: "" });
      await loadExpenses();
    } catch (err) {
      console.log("Error adding expense");
    } finally {
      setAdding(false);
    }
  };

  // Dynamically classify categories to display gorgeous UI badges
  const getCategoryDetails = (title = "") => {
    const text = title.toLowerCase();
    if (text.includes("dinner") || text.includes("food") || text.includes("restaurant") || text.includes("lunch") || text.includes("cafe")) {
      return { label: "Food 🍔", bg: "rgba(239, 68, 68, 0.08)", color: "var(--pink)" };
    }
    if (text.includes("movie") || text.includes("ticket") || text.includes("show") || text.includes("game") || text.includes("play")) {
      return { label: "Entertainment 🎬", bg: "rgba(139, 92, 246, 0.08)", color: "var(--purple)" };
    }
    if (text.includes("cab") || text.includes("hotel") || text.includes("trip") || text.includes("flight") || text.includes("travel") || text.includes("fuel")) {
      return { label: "Travel ✈️", bg: "rgba(59, 130, 246, 0.08)", color: "var(--blue)" };
    }
    if (text.includes("groceries") || text.includes("milk") || text.includes("market") || text.includes("supermarket")) {
      return { label: "Groceries 🛒", bg: "rgba(16, 185, 129, 0.08)", color: "var(--brand-green)" };
    }
    return { label: "General 💸", bg: "var(--brand-orange-light)", color: "var(--brand-orange)" };
  };

  const filteredExpenses = expenses.filter((e) => {
    const titleMatch = e.title?.toLowerCase().includes(search.toLowerCase());
    const paidByMatch = e.paidBy?.toLowerCase().includes(search.toLowerCase());
    return titleMatch || paidByMatch;
  });

  return (
    <>
      {/* Title block */}
      <div className="mb-4 d-flex justify-content-between align-items-center flex-wrap g-3">
        <div>
          <h2 className="section-title fs-2 mb-2" style={{ background: "linear-gradient(135deg, var(--text-primary) 30%, var(--brand-green) 100%)", WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent" }}>
            Expenses
          </h2>
          <p className="text-secondary-custom small mb-0">Record personal shares and see split logs.</p>
        </div>
      </div>

      {/* Grid: Form and List */}
      <div className="row g-4">
        {/* Form Panel */}
        <div className="col-lg-5">
          <div className="card-flat" style={{ position: "sticky", top: "100px" }}>
            <h5 className="mb-4 fs-6 fw-bold text-muted-custom text-uppercase tracking-wider">Add New Expense</h5>
            <form onSubmit={addExpense}>
              <div className="mb-3">
                <label className="form-label text-secondary-custom small fw-semibold">Description</label>
                <input
                  type="text"
                  name="title"
                  placeholder="e.g. Pizza, Movie tickets"
                  className="form-control"
                  value={form.title}
                  onChange={handleChange}
                  required
                />
              </div>

              <div className="mb-3">
                <label className="form-label text-secondary-custom small fw-semibold">Amount (₹)</label>
                <input
                  type="number"
                  name="amount"
                  placeholder="0.00"
                  className="form-control"
                  value={form.amount}
                  onChange={handleChange}
                  required
                />
              </div>

              <div className="mb-4">
                <label className="form-label text-secondary-custom small fw-semibold">Paid By</label>
                <input
                  type="text"
                  name="paidBy"
                  placeholder="Who paid this bill?"
                  className="form-control"
                  value={form.paidBy}
                  onChange={handleChange}
                  required
                />
              </div>

              <button className="btn-brand w-100" type="submit" disabled={adding}>
                {adding ? "Saving bill..." : "Save Expense"}
              </button>
            </form>
          </div>
        </div>

        {/* List Panel */}
        <div className="col-lg-7">
          <div className="card-flat">
            <div className="d-flex justify-content-between align-items-center mb-4 flex-wrap g-2">
              <h5 className="mb-0 fs-6 fw-bold text-muted-custom text-uppercase tracking-wider">All Expenses</h5>
              
              {/* Client-side Live Search Bar */}
              <div className="position-relative" style={{ maxWidth: "200px" }}>
                <input
                  type="text"
                  className="form-control py-1 px-3"
                  placeholder="Search bills..."
                  style={{ fontSize: "13px", paddingRight: "30px" }}
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                />
                <span className="position-absolute end-0 top-50 translate-middle-y me-2 text-muted" style={{ fontSize: "14px" }}>
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                    <circle cx="11" cy="11" r="8"></circle>
                    <line x1="21" y1="21" x2="16.65" y2="16.65"></line>
                  </svg>
                </span>
              </div>
            </div>

            {loading ? (
              <div className="text-center py-5 text-muted">
                <div className="spinner-border text-success mb-3" role="status"></div>
                <h5>Fetching ledger...</h5>
              </div>
            ) : filteredExpenses.length === 0 ? (
              <div className="text-center py-5 text-muted">
                <p className="mb-0 small">No expense logs found matching search criteria.</p>
              </div>
            ) : (
              <div className="pe-1" style={{ maxHeight: "420px", overflowY: "auto" }}>
                {filteredExpenses.map((e, idx) => {
                  const cat = getCategoryDetails(e.title);
                  return (
                    <div
                      className="list-item align-items-center justify-content-between px-3"
                      key={e.id}
                      style={{ borderBottom: idx === filteredExpenses.length - 1 ? "none" : "1px solid var(--border-color)" }}
                    >
                      <div className="d-flex align-items-center flex-grow-1">
                        <div className="avatar">
                          {e.title ? e.title.substring(0, 1).toUpperCase() : "E"}
                        </div>
                        <div className="list-details">
                          <div className="d-flex align-items-center flex-wrap g-1 mb-1">
                            <h5 className="mb-0 me-2 text-primary">{e.title}</h5>
                            <span 
                              className="badge rounded-pill" 
                              style={{ 
                                background: cat.bg, 
                                color: cat.color, 
                                fontSize: "11px",
                                fontWeight: "600",
                                padding: "4px 10px"
                              }}
                            >
                              {cat.label}
                            </span>
                          </div>
                          <p className="text-muted-custom mb-0 small">Paid by <strong className="text-primary">{e.paidBy}</strong></p>
                        </div>
                      </div>
                      
                      <div className="list-amount ms-3">
                        <span className="text-primary fw-bold fs-5">₹{e.amount}</span>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      </div>
    </>
  );
}

export default Expenses;
