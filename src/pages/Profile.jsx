import { useState } from "react";
import API from "../services/api";

function Profile() {
  const user = JSON.parse(localStorage.getItem("user")) || { name: "User", email: "No Email" };
  const [resetting, setResetting] = useState(false);
  const [success, setSuccess] = useState(false);

  // UPI and Address Book state variables
  const [myUpi, setMyUpi] = useState(localStorage.getItem("my_upi_id") || "princeturkar1@okaxis");
  const [friendName, setFriendName] = useState("");
  const [friendUpi, setFriendUpi] = useState("");
  const [addressBook, setAddressBook] = useState(
    JSON.parse(localStorage.getItem("user_upi_registry") || `{"Prince": "princeturkar1@okaxis"}`)
  );

  const handleSaveMyUpi = () => {
    localStorage.setItem("my_upi_id", myUpi);
    const registry = { ...addressBook, [user.name]: myUpi };
    setAddressBook(registry);
    localStorage.setItem("user_upi_registry", JSON.stringify(registry));
    alert("Your personal UPI ID saved successfully!");
  };

  const handleAddFriendUpi = (e) => {
    e.preventDefault();
    if (!friendName.trim() || !friendUpi.trim()) return;
    
    const registry = { ...addressBook, [friendName.trim()]: friendUpi.trim() };
    setAddressBook(registry);
    localStorage.setItem("user_upi_registry", JSON.stringify(registry));
    setFriendName("");
    setFriendUpi("");
  };

  const handleDeleteFriendUpi = (name) => {
    const registry = { ...addressBook };
    delete registry[name];
    setAddressBook(registry);
    localStorage.setItem("user_upi_registry", JSON.stringify(registry));
  };

  const handleResetAll = async () => {
    if (!window.confirm("Are you absolutely sure you want to permanently clear all groups, expenses, and settlements? This action cannot be undone.")) {
      return;
    }
    setResetting(true);
    setSuccess(false);

    try {
      // 1. Fetch and purge all groups
      const groupsRes = await API.get("/groups");
      const groups = Array.isArray(groupsRes.data) ? groupsRes.data : [];
      await Promise.all(
        groups.map(g => {
          if (g && g.id) {
            return API.delete(`/groups/${g.id}`).catch(err => console.log(`Failed to delete group ${g.id}`, err));
          }
          return Promise.resolve();
        })
      );

      // 2. Fetch and purge all expenses
      const expensesRes = await API.get("/expenses");
      const expenses = Array.isArray(expensesRes.data) ? expensesRes.data : [];
      await Promise.all(
        expenses.map(e => {
          if (e && e.id) {
            return API.delete(`/expenses/${e.id}`).catch(err => console.log(`Failed to delete expense ${e.id}`, err));
          }
          return Promise.resolve();
        })
      );

      // 3. Fetch and purge all settlements
      const settlementsRes = await API.get("/settlements");
      const settlements = Array.isArray(settlementsRes.data) ? settlementsRes.data : [];
      await Promise.all(
        settlements.map(s => {
          if (s && s.id) {
            return API.delete(`/settlements/${s.id}`).catch(err => console.log(`Failed to delete settlement ${s.id}`, err));
          }
          return Promise.resolve();
        })
      );

      // Clear UPI registers as well
      localStorage.removeItem("user_upi_registry");
      localStorage.removeItem("my_upi_id");
      setMyUpi("princeturkar1@okaxis");
      setAddressBook({"Prince": "princeturkar1@okaxis"});

      setSuccess(true);
      alert("Application successfully reset! All database records have been purged. You can now add clean new ones.");
    } catch (error) {
      console.error("Purging error:", error);
      alert("Something went wrong during reset, but most files may have been cleared. Please refresh the page.");
    } finally {
      setResetting(false);
    }
  };

  return (
    <>
      {/* Title Header */}
      <div className="mb-4">
        <h2 className="section-title fs-2 mb-2" style={{ background: "linear-gradient(135deg, var(--text-primary) 30%, var(--brand-green) 100%)", WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent" }}>
          User Profile & VPA Book
        </h2>
        <p className="text-secondary-custom small mb-0">Manage credentials, setup real-time GPay/PhonePe addresses, and clear application records.</p>
      </div>

      <div className="row g-4">
        {/* Passport Account Card */}
        <div className="col-lg-5">
          <div className="card-premium text-center p-4 animate-fade-in" style={{ position: "sticky", top: "100px" }}>
            {/* Elegant Ring Avatar */}
            <div className="position-relative mx-auto mb-4" style={{ width: "90px", height: "90px" }}>
              <div 
                className="position-absolute top-50 start-50 translate-middle rounded-circle" 
                style={{ 
                  width: "102px", 
                  height: "102px", 
                  background: "linear-gradient(135deg, var(--brand-green) 0%, var(--purple) 100%)", 
                  zIndex: 1, 
                  opacity: 0.8 
                }}
              ></div>
              <div 
                className="position-absolute top-50 start-50 translate-middle rounded-circle" 
                style={{ 
                  width: "96px", 
                  height: "96px", 
                  background: "var(--surface-color)", 
                  zIndex: 2 
                }}
              ></div>
              <div 
                className="position-absolute top-50 start-50 translate-middle rounded-circle d-flex align-items-center justify-content-center fw-bold text-white fs-2" 
                style={{ 
                  width: "86px", 
                  height: "86px", 
                  background: "linear-gradient(135deg, var(--brand-green) 0%, var(--indigo) 100%)", 
                  zIndex: 3,
                  boxShadow: "var(--shadow-md)"
                }}
              >
                {user.name.substring(0, 1).toUpperCase()}
              </div>
            </div>

            {/* Profile Info */}
            <h3 className="mb-1 text-primary">{user.name}</h3>
            <p className="text-muted-custom small mb-4">{user.email}</p>

            {/* My UPI Configuration Panel */}
            <div className="card-flat text-start p-3 mb-4" style={{ border: "1px dashed var(--brand-green)", background: "var(--brand-green-light)" }}>
              <h6 className="fs-7 fw-bold text-success mb-2">My UPI ID (GPay / PhonePe)</h6>
              <p style={{ fontSize: "11px", color: "var(--text-secondary)", marginBottom: "8px" }}>
                Add your UPI ID so friends can scan and pay you directly via QR code.
              </p>
              <div className="input-group">
                <input 
                  type="text" 
                  className="form-control form-control-sm"
                  placeholder="e.g. yourname@okaxis" 
                  value={myUpi}
                  onChange={(e) => setMyUpi(e.target.value.trim())}
                  style={{ fontSize: "12px", borderRight: "none" }}
                />
                <button 
                  className="btn btn-brand btn-sm" 
                  type="button" 
                  onClick={handleSaveMyUpi}
                  style={{ fontSize: "11px", borderTopLeftRadius: 0, borderBottomLeftRadius: 0 }}
                >
                  Save VPA
                </button>
              </div>
            </div>

            <div className="row g-2 text-start">
              <div className="col-12 card-flat p-3 mb-2 d-flex justify-content-between align-items-center" style={{ margin: 0 }}>
                <span className="text-secondary-custom small fw-semibold">Split Status</span>
                <span className="badge bg-success px-2.5 py-1.5 rounded-pill" style={{ fontSize: "11px" }}>Verified Partner</span>
              </div>
              
              <div className="col-12 card-flat p-3 d-flex justify-content-between align-items-center" style={{ margin: 0 }}>
                <span className="text-secondary-custom small fw-semibold">Split Weight</span>
                <span className="fw-bold text-primary" style={{ fontSize: "13px" }}>Equal Share (1.0x)</span>
              </div>
            </div>

            {/* Danger Zone / Reset Application Card */}
            <div className="card-flat p-3 mt-4 text-start" style={{ border: "1px solid rgba(239, 68, 68, 0.2)", background: "rgba(239, 68, 68, 0.02)", margin: 0 }}>
              <h5 className="text-danger fw-bold fs-6 mb-2 d-flex align-items-center">
                <svg className="me-2" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"></path>
                  <line x1="12" y1="9" x2="12" y2="13"></line>
                  <line x1="12" y1="17" x2="12.01" y2="17"></line>
                </svg>
                Danger Zone
              </h5>
              
              <button 
                className="btn btn-outline-danger w-100 py-2 fw-bold d-flex align-items-center justify-content-center"
                style={{ borderRadius: "10px", border: "1.5px solid rgba(239, 68, 68, 0.3)", fontSize: "12px" }}
                onClick={handleResetAll}
                disabled={resetting}
              >
                {resetting ? "Resetting Application..." : "Reset Application Ledger"}
              </button>
            </div>
          </div>
        </div>

        {/* UPI Address Book Panel */}
        <div className="col-lg-7">
          {/* Add Friend's VPA Card */}
          <div className="card-flat mb-4">
            <h5 className="mb-3 fs-6 fw-bold text-muted-custom text-uppercase tracking-wider">UPI Address Book</h5>
            <p className="text-secondary-custom small mb-4">
              Catalog your friends' GPay and PhonePe addresses. When settling debts, the app will automatically generate their live payment QR codes!
            </p>

            <form onSubmit={handleAddFriendUpi} className="row g-2 align-items-end">
              <div className="col-md-5">
                <label className="form-label text-secondary-custom small fw-semibold">Friend's Name</label>
                <input 
                  type="text" 
                  className="form-control"
                  placeholder="e.g. Sam / Rohan"
                  value={friendName}
                  onChange={(e) => setFriendName(e.target.value)}
                  required
                />
              </div>
              <div className="col-md-5">
                <label className="form-label text-secondary-custom small fw-semibold">UPI ID / VPA</label>
                <input 
                  type="text" 
                  className="form-control"
                  placeholder="e.g. sam@okicici"
                  value={friendUpi}
                  onChange={(e) => setFriendUpi(e.target.value.trim())}
                  required
                />
              </div>
              <div className="col-md-2">
                <button type="submit" className="btn btn-brand w-100 py-2.5" style={{ fontSize: "13px" }}>
                  Add
                </button>
              </div>
            </form>
          </div>

          {/* VPA spreadsheet */}
          <div className="card-flat">
            <h5 className="mb-3 fs-6 fw-bold text-muted-custom text-uppercase tracking-wider">Stored Payment Directories</h5>
            
            {Object.keys(addressBook).length === 0 ? (
              <div className="text-center py-4 text-muted small">No payment addresses configured. Add one above!</div>
            ) : (
              <div className="table-responsive">
                <table className="table-premium">
                  <thead>
                    <tr>
                      <th>Friend (Payer Name)</th>
                      <th>Secure UPI Address</th>
                      <th className="text-end">Action</th>
                    </tr>
                  </thead>
                  <tbody>
                    {Object.keys(addressBook).map((name) => (
                      <tr key={name}>
                        <td className="fw-semibold text-primary">{name}</td>
                        <td className="font-monospace fw-bold text-success" style={{ fontSize: "13px" }}>
                          {addressBook[name]}
                        </td>
                        <td className="text-end">
                          <button 
                            type="button" 
                            className="btn btn-sm btn-outline-danger" 
                            style={{ padding: "3px 8px", fontSize: "11px", borderRadius: "8px" }}
                            onClick={() => handleDeleteFriendUpi(name)}
                          >
                            Remove
                          </button>
                        </td>
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

export default Profile;