import { useEffect, useState } from "react";
import axios from "axios";
import API from "../services/api";

function Settlements() {
  const [settlements, setSettlements] = useState([]);
  const [groups, setGroups] = useState([]);
  const [selectedGroupId, setSelectedGroupId] = useState("");
  const [groupMembers, setGroupMembers] = useState([]);
  const [form, setForm] = useState({
    fromUser: "",
    toUser: "",
    amount: ""
  });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [upiId, setUpiId] = useState(localStorage.getItem("default_settle_upi") || "princeturkar1@okaxis");
  const [payingWithRzp, setPayingWithRzp] = useState(false);

  const loadGroups = async () => {
    try {
      const res = await API.get("/groups");
      const data = Array.isArray(res.data) ? res.data : [];
      const valid = data.filter(g => g && g.id !== undefined && g.id !== null && Object.keys(g).length > 0);
      setGroups(valid);
    } catch (e) {
      console.error("Error loading groups in settlements:", e);
    }
  };

  const loadData = async () => {
    try {
      const res = await API.get("/settlements");
      setSettlements(res.data || []);
    } catch (e) {
      console.log("Error loading settlements");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
    loadGroups();

    // Dynamically load Razorpay SDK
    const script = document.createElement("script");
    script.src = "https://checkout.razorpay.com/v1/checkout.js";
    script.async = true;
    document.body.appendChild(script);

    return () => {
      document.body.removeChild(script);
    };
  }, []);

  useEffect(() => {
    if (selectedGroupId) {
      try {
        const saved = localStorage.getItem(`group_members_${selectedGroupId}`);
        const members = saved ? JSON.parse(saved) : [];
        setGroupMembers(members);
        
        if (members.length > 0) {
          const defaultFrom = members[0];
          const defaultTo = members.find(m => m !== defaultFrom) || "";
          setForm(prev => ({
            ...prev,
            fromUser: defaultFrom,
            toUser: defaultTo
          }));
        } else {
          setForm(prev => ({
            ...prev,
            fromUser: "",
            toUser: ""
          }));
        }
      } catch (e) {
        console.error("Error parsing group members:", e);
        setGroupMembers([]);
      }
    } else {
      setGroupMembers([]);
      setForm(prev => ({
        ...prev,
        fromUser: "",
        toUser: ""
      }));
    }
  }, [selectedGroupId]);
  // Automatically retrieve the receiver's stored UPI ID whenever they are selected
  useEffect(() => {
    if (form.toUser) {
      try {
        const registry = JSON.parse(localStorage.getItem("user_upi_registry") || "{}");
        if (registry[form.toUser]) {
          setUpiId(registry[form.toUser]);
        } else {
          // Graceful fallback default
          if (form.toUser.toLowerCase() === "prince") {
            setUpiId("princeturkar1@okaxis");
          } else {
            setUpiId("");
          }
        }
      } catch (err) {
        console.error("Error reading UPI registry:", err);
      }
    } else {
      setUpiId("");
    }
  }, [form.toUser]);

  const handleChange = (e) => {
    setForm({
      ...form,
      [e.target.name]: e.target.value
    });
  };

  const addSettlement = async (e) => {
    e.preventDefault();
    if (!form.fromUser || !form.toUser || !form.amount) return;
    const amt = parseFloat(form.amount);
    if (isNaN(amt) || amt <= 0) {
      alert("Please enter a valid amount greater than 0.");
      return;
    }
    if (selectedGroupId && form.fromUser === form.toUser) {
      alert("Payer and receiver cannot be the same person!");
      return;
    }

    // Validate UPI ID format if a QR Code is generated (amount > 0 and receiver is selected)
    if (form.toUser && parseFloat(form.amount) > 0) {
      const upiRegex = /^[a-zA-Z0-9.\-_]{2,256}@[a-zA-Z]{2,64}$/;
      if (!upiId || !upiRegex.test(upiId)) {
        alert("Please enter a valid UPI ID (VPA) format (e.g. name@bankhandle) before recording the settlement payment.");
        return;
      }
    }
    
    setSaving(true);
    try {
      // 1. Post to global backend API
      await API.post("/settlements", {
        fromUser: form.fromUser,
        toUser: form.toUser,
        amount: amt
      });

      // 2. If group is selected, also log it into that group's local storage ledger
      if (selectedGroupId) {
        const newGroupSettle = {
          id: Date.now().toString(),
          title: `Settlement: ${form.fromUser} paid ${form.toUser}`,
          amount: amt,
          paidBy: form.fromUser,
          transferTo: form.toUser,
          isSettlement: true,
          date: new Date().toLocaleDateString("en-IN", {
            day: "numeric",
            month: "short",
            year: "numeric"
          })
        };

        const savedExp = localStorage.getItem(`group_expenses_${selectedGroupId}`);
        const expList = savedExp ? JSON.parse(savedExp) : [];
        localStorage.setItem(`group_expenses_${selectedGroupId}`, JSON.stringify([newGroupSettle, ...expList]));
      }

      setForm({
        fromUser: "",
        toUser: "",
        amount: ""
      });
      setSelectedGroupId("");
      await loadData();
    } catch (err) {
      console.log("Error adding settlement:", err);
    } finally {
      setSaving(false);
    }
  };

  const handleRazorpayPayment = async () => {
    if (!form.fromUser || !form.toUser || !form.amount) {
      alert("Please select the debtor, creditor, and transaction amount first!");
      return;
    }
    const amt = parseFloat(form.amount);
    if (isNaN(amt) || amt <= 0) {
      alert("Please enter a valid amount greater than 0.");
      return;
    }
    if (selectedGroupId && form.fromUser === form.toUser) {
      alert("Payer and receiver cannot be the same person!");
      return;
    }

    setPayingWithRzp(true);
    try {
      // 1. Contact the local Express server to create the order
      const response = await axios.post("http://localhost:5001/api/create-order", {
        amount: amt
      });

      if (!response.data.success) {
        throw new Error(response.data.message || "Failed to create Razorpay Order.");
      }

      const { keyId, orderId, amount } = response.data;

      // 2. Configure the Razorpay options
      const options = {
        key: keyId,
        amount: amount,
        currency: "INR",
        name: "Expense Splits",
        description: `Settlement payment from ${form.fromUser} to ${form.toUser}`,
        order_id: orderId,
        handler: async function (paymentResponse) {
          alert(`🎉 Payment Successful! Reference ID: ${paymentResponse.razorpay_payment_id}`);
          
          // Automatically trigger form submission to save the settlement ledger
          setSaving(true);
          try {
            await API.post("/settlements", {
              fromUser: form.fromUser,
              toUser: form.toUser,
              amount: amt
            });

            if (selectedGroupId) {
              const newGroupSettle = {
                id: Date.now().toString(),
                title: `Settlement: ${form.fromUser} paid ${form.toUser}`,
                amount: amt,
                paidBy: form.fromUser,
                transferTo: form.toUser,
                isSettlement: true,
                date: new Date().toLocaleDateString("en-IN", {
                  day: "numeric",
                  month: "short",
                  year: "numeric"
                })
              };

              const savedExp = localStorage.getItem(`group_expenses_${selectedGroupId}`);
              const expList = savedExp ? JSON.parse(savedExp) : [];
              localStorage.setItem(`group_expenses_${selectedGroupId}`, JSON.stringify([newGroupSettle, ...expList]));
            }

            setForm({
              fromUser: "",
              toUser: "",
              amount: ""
            });
            setSelectedGroupId("");
            await loadData();
          } catch (ledgerError) {
            console.error("Failed to commit settlement ledger:", ledgerError);
            alert("Payment was successful, but we failed to update the local database. Please record the payment details manually.");
          } finally {
            setSaving(false);
          }
        },
        prefill: {
          name: form.fromUser,
          email: `${form.fromUser.toLowerCase()}@example.com`,
          method: "upi",
          vpa: upiId || "success@razorpay"
        },
        theme: {
          color: "#10b981" // Match our brand green!
        },
        modal: {
          ondismiss: function () {
            alert("Payment window closed. Settlement was not recorded.");
          }
        }
      };

      const rzpObj = new window.Razorpay(options);
      rzpObj.open();

    } catch (err) {
      console.error("Razorpay initiation failed:", err);
      alert(
        err.response?.data?.message || 
        err.message || 
        "Failed to initiate Razorpay transaction. Please make sure the local server is running by typing 'npm run server'."
      );
    } finally {
      setPayingWithRzp(false);
    }
  };

  return (
    <>
      {/* Title Header */}
      <div className="mb-4">
        <h2 className="section-title fs-2 mb-2" style={{ background: "linear-gradient(135deg, var(--text-primary) 30%, var(--brand-green) 100%)", WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent" }}>
          Settlements Ledger
        </h2>
        <p className="text-secondary-custom small mb-0">Track and log debts settled between group members.</p>
      </div>

      <div className="row g-4">
        {/* Form Panel */}
        <div className="col-lg-5">
          <div className="card-flat" style={{ position: "sticky", top: "100px" }}>
            <h5 className="mb-4 fs-6 fw-bold text-muted-custom text-uppercase tracking-wider">Record a Settlement</h5>
            <form onSubmit={addSettlement}>
              {/* Group Selector Dropdown */}
              <div className="mb-3">
                <label className="form-label text-secondary-custom small fw-semibold">Group (Optional)</label>
                <select
                  className="form-select text-primary fw-semibold"
                  value={selectedGroupId}
                  onChange={(e) => setSelectedGroupId(e.target.value)}
                >
                  <option value="">Personal / General (No Group)</option>
                  {groups.map(g => (
                    <option key={g.id} value={g.id}>{g.name}</option>
                  ))}
                </select>
              </div>

              {selectedGroupId && groupMembers.length === 0 ? (
                <div className="alert alert-warning py-2 px-3 small mb-3" style={{ borderRadius: "10px", fontSize: "12px", background: "rgba(249, 115, 22, 0.08)", color: "var(--brand-orange)", border: "1px solid rgba(249, 115, 22, 0.2)" }}>
                  ⚠️ This group has no members. Please add members in the group details page first.
                </div>
              ) : null}

              <div className="mb-3">
                <label className="form-label text-secondary-custom small fw-semibold">From (Debtor)</label>
                {selectedGroupId && groupMembers.length > 0 ? (
                  <select
                    name="fromUser"
                    className="form-select text-primary fw-semibold"
                    value={form.fromUser}
                    onChange={(e) => {
                      const newFrom = e.target.value;
                      const newTo = form.toUser === newFrom ? groupMembers.find(m => m !== newFrom) || "" : form.toUser;
                      setForm(prev => ({ ...prev, fromUser: newFrom, toUser: newTo }));
                    }}
                    required
                  >
                    {groupMembers.map(m => (
                      <option key={m} value={m}>{m}</option>
                    ))}
                  </select>
                ) : (
                  <input
                    type="text"
                    name="fromUser"
                    placeholder="Who is paying?"
                    className="form-control"
                    value={form.fromUser}
                    onChange={handleChange}
                    required
                  />
                )}
              </div>

              <div className="mb-3">
                <label className="form-label text-secondary-custom small fw-semibold">To (Creditor)</label>
                {selectedGroupId && groupMembers.length > 0 ? (
                  <select
                    name="toUser"
                    className="form-select text-primary fw-semibold"
                    value={form.toUser}
                    onChange={handleChange}
                    required
                  >
                    {groupMembers.filter(m => m !== form.fromUser).map(m => (
                      <option key={m} value={m}>{m}</option>
                    ))}
                  </select>
                ) : (
                  <input
                    type="text"
                    name="toUser"
                    placeholder="Who is receiving?"
                    className="form-control"
                    value={form.toUser}
                    onChange={handleChange}
                    required
                  />
                )}
              </div>

              <div className="mb-4">
                <label className="form-label text-secondary-custom small fw-semibold">Amount Paid (₹)</label>
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

              {/* Dynamic QR Code Payment Card */}
              {form.toUser && parseFloat(form.amount) > 0 && (
                <div className="card-premium p-3 mb-4 text-center animate-fade-in" style={{ background: "linear-gradient(135deg, var(--brand-green-light) 0%, rgba(99, 102, 241, 0.04) 100%)", border: "1px dashed var(--brand-green)", borderRadius: "16px" }}>
                  <div className="d-flex align-items-center justify-content-center gap-2 mb-2">
                    <div style={{ background: "var(--brand-green)", color: "white", padding: "4px 8px", borderRadius: "8px", fontSize: "11px", fontWeight: "700" }}>UPI LIVE</div>
                    <h6 className="fs-7 fw-bold mb-0 text-owed" style={{ fontSize: "14px" }}>Scan to Pay Friend Instantly</h6>
                  </div>
                  
                  <p style={{ fontSize: "11.5px", color: "var(--text-secondary)", marginBottom: "12px", lineHeight: "1.4" }}>
                    Scan using Google Pay, PhonePe, Paytm, or BHIM. Pre-filled with amount: <strong className="text-owed">₹{form.amount}</strong>.
                  </p>

                  <div className="mb-3">
                    <label className="form-label text-secondary-custom small fw-semibold text-start w-100 mb-1" style={{ fontSize: "11.5px", textAlign: "left" }}>Creditor's UPI ID / VPA</label>
                    <input 
                      type="text" 
                      className="form-control form-control-sm text-center font-monospace fw-bold"
                      placeholder="e.g. name@okaxis" 
                      value={upiId}
                      onChange={(e) => {
                        const newUpi = e.target.value.trim();
                        setUpiId(newUpi);
                        localStorage.setItem("default_settle_upi", newUpi);
                      }}
                      style={{ fontSize: "13px", padding: "8px 12px", letterSpacing: "0.2px" }}
                      required
                    />
                  </div>

                  {upiId ? (
                    <div className="my-2 d-inline-block p-3 bg-white border" style={{ borderRadius: "20px", boxShadow: "var(--shadow-md)" }}>
                      <img 
                        src={`https://api.qrserver.com/v1/create-qr-code/?size=180x180&data=${encodeURIComponent(
                          `upi://pay?pa=${upiId}&pn=${form.toUser}&am=${parseFloat(form.amount).toFixed(2)}&tn=Settlement%20Splits&cu=INR`
                        )}`}
                        alt="Dynamic UPI QR Code" 
                        style={{ width: "160px", height: "160px", display: "block" }}
                      />
                      <div className="mt-2 text-center" style={{ fontSize: "11px", color: "#64748b", fontWeight: "700", display: "flex", flexDirection: "column", alignItems: "center", justifyItems: "center", justifyContent: "center", gap: "6px" }}>
                        <div className="d-flex align-items-center gap-1">
                          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" className="text-success">
                            <rect x="3" y="11" width="18" height="11" rx="2" ry="2"></rect>
                            <path d="M7 11V7a5 5 0 0 1 10 0v4"></path>
                          </svg>
                          Secure UPI Sandbox
                        </div>
                        
                        <button
                          type="button"
                          className="btn btn-outline-success btn-sm w-100 py-1"
                          style={{ fontSize: "10.5px", borderRadius: "8px", fontWeight: "700", padding: "4px 8px" }}
                          onClick={(e) => {
                            e.preventDefault();
                            alert(`⚡ Simulated QR Scan Successful!\n₹${form.amount} has been paid securely to ${form.toUser} (${upiId}).`);
                            document.getElementById("settlement-submit-btn").click();
                          }}
                        >
                          📲 Simulate GPay QR Scan
                        </button>
                      </div>
                    </div>
                  ) : (
                    <div className="alert alert-warning py-2 mb-0" style={{ fontSize: "11px", borderRadius: "10px" }}>
                      Please enter a valid UPI ID (e.g. name@ybl) to generate the payment QR code.
                    </div>
                  )}
                </div>
              )}

              {form.toUser && parseFloat(form.amount) > 0 ? (
                <div className="d-flex flex-column gap-2">
                  <button 
                    type="button" 
                    className="btn btn-primary w-100 py-2.5 fw-bold d-flex align-items-center justify-content-center gap-2"
                    style={{ 
                      borderRadius: "12px", 
                      background: "linear-gradient(135deg, #3399cc 0%, #007bb6 100%)", 
                      border: "none",
                      boxShadow: "0 4px 14px rgba(51, 153, 204, 0.3)",
                      fontSize: "14px",
                      transition: "transform 0.15s ease, opacity 0.15s ease",
                      fontFamily: "var(--font-heading)"
                    }}
                    onClick={handleRazorpayPayment}
                    disabled={payingWithRzp || saving}
                  >
                    {payingWithRzp ? (
                      <>
                        <span className="spinner-border spinner-border-sm" role="status" aria-hidden="true"></span>
                        Opening Gateway...
                      </>
                    ) : (
                      <>
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                          <rect x="2" y="5" width="20" height="14" rx="2" ry="2"></rect>
                          <line x1="2" y1="10" x2="22" y2="10"></line>
                        </svg>
                        Pay with Razorpay (Cards/UPI)
                      </>
                    )}
                  </button>

                  <button id="settlement-submit-btn" className="btn-brand w-100" type="submit" disabled={saving || payingWithRzp}>
                    {saving ? "Logging settlement..." : "Record Manual Payment"}
                  </button>
                </div>
              ) : (
                <button className="btn-brand w-100" type="submit" disabled={saving}>
                  {saving ? "Logging settlement..." : "Record Payment"}
                </button>
              )}
            </form>
          </div>
        </div>

        {/* ledger Panel */}
        <div className="col-lg-7">
          <div className="card-flat mb-4">
            <h5 className="mb-4 fs-6 fw-bold text-muted-custom text-uppercase tracking-wider">Directional Transaction Flows</h5>

            {loading ? (
              <div className="text-center py-5 text-muted">
                <div className="spinner-border text-success mb-3" role="status"></div>
                <h5>Loading ledger flows...</h5>
              </div>
            ) : settlements.length === 0 ? (
              <div className="text-center py-4 text-muted small">
                No active settlement transactions recorded yet.
              </div>
            ) : (
              <div className="pe-1" style={{ maxHeight: "350px", overflowY: "auto" }}>
                {settlements.map((s, idx) => (
                  <div
                    className="list-item align-items-center justify-content-between px-3 my-2"
                    key={s.id || idx}
                    style={{ background: "var(--brand-green-light)", border: "1px dashed var(--brand-green)", borderRadius: "14px" }}
                  >
                    {/* Debtor Profile */}
                    <div className="d-flex align-items-center">
                      <div className="avatar accent" style={{ width: "38px", height: "38px", borderRadius: "10px", fontSize: "14px", marginRight: "10px" }}>
                        {s.fromUser.substring(0, 1).toUpperCase()}
                      </div>
                      <span className="fw-semibold text-primary">{s.fromUser}</span>
                    </div>
                    
                    {/* Transaction Connector Line */}
                    <div className="text-center px-2 flex-grow-1 position-relative d-none d-sm-block">
                      <span className="badge px-3 py-1 rounded-pill mb-1" style={{ background: "var(--surface-color)", color: "var(--brand-green)", border: "1.5px solid var(--brand-green)", fontSize: "12px", fontWeight: "700" }}>
                        settled ₹{s.amount}
                      </span>
                      <div style={{ height: "2px", background: "var(--brand-green)", position: "relative", width: "100%", margin: "8px 0" }}>
                        <div style={{ position: "absolute", right: "0", top: "-4px", width: "10px", height: "10px", borderRadius: "50%", background: "var(--brand-green)" }}></div>
                      </div>
                    </div>
                    
                    {/* Mobile transaction indicator */}
                    <div className="d-sm-none text-center px-1">
                      <span className="badge bg-success text-white px-2 py-1 rounded-pill small" style={{ fontSize: "11px" }}>₹{s.amount} &rarr;</span>
                    </div>

                    {/* Creditor Profile */}
                    <div className="d-flex align-items-center">
                      <span className="fw-semibold text-primary">{s.toUser}</span>
                      <div className="avatar" style={{ width: "38px", height: "38px", borderRadius: "10px", fontSize: "14px", marginLeft: "10px", marginRight: "0" }}>
                        {s.toUser.substring(0, 1).toUpperCase()}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="card-flat">
            <h5 className="mb-3 fs-6 fw-bold text-muted-custom text-uppercase tracking-wider">Settlements spreadsheet</h5>
            
            {loading ? (
              <div className="text-center py-4 text-muted small">Loading records...</div>
            ) : settlements.length === 0 ? (
              <div className="text-center py-3 text-muted small">No spreadsheet rows.</div>
            ) : (
              <div className="table-responsive">
                <table className="table-premium">
                  <thead>
                    <tr>
                      <th>Payer (From)</th>
                      <th>Receiver (To)</th>
                      <th className="text-end">Amount</th>
                    </tr>
                  </thead>
                  <tbody>
                    {settlements.map((s, idx) => (
                      <tr key={s.id || idx}>
                        <td className="fw-semibold text-primary">{s.fromUser}</td>
                        <td className="fw-semibold text-primary">{s.toUser}</td>
                        <td className="text-end fw-bold text-owed">₹{s.amount}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      </div>
    </>
  );
}

export default Settlements;