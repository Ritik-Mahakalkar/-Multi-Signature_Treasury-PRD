import { useEffect, useState } from "react";
import { api } from "./api";
import "./App.css";

export default function App() {
  const [treasuries, setTreasuries] = useState([]);
  const [selectedTreasury, setSelectedTreasury] = useState(null);
  const [proposals, setProposals] = useState([]);
  const [currentSigner, setCurrentSigner] = useState("");
  const [message, setMessage] = useState("");

  
  const [newTreasury, setNewTreasury] = useState({
    name: "Treasury",
    signers: "Ritik,test2,test3",
  });


  const [depositForm, setDepositForm] = useState({
    token: "USDC",
    amount: 10000,
  });

 
  const [proposalForm, setProposalForm] = useState({
    category: "Operations",
    metadata: "",
    isEmergency: false,
    to: "",
    token: "USDC",
    amount: "",
    note: "",
  });

  useEffect(() => {
    loadTreasuries();
  }, []);

  
  const loadTreasuries = async () => {
    try {
      const res = await api.getTreasuries();
      setTreasuries(res.data.treasuries || []);
    } catch (err) {
      console.log("Error loading treasuries:", err);
    }
  };

 
  const loadProposals = async (id) => {
    try {
      const res = await api.getProposals(id);
      setProposals(res.data.proposals || []);
    } catch (err) {
      console.log("Error loading proposals:", err);
    }
  };


  const notify = (msg) => {
    setMessage(msg);
    setTimeout(() => setMessage(""), 3000);
  };

 
  const handleSelectTreasury = (t) => {
    setSelectedTreasury(t);
    setCurrentSigner(t.signers[0]); 
    loadProposals(t._id);
  };

  
  const handleCreateTreasury = async (e) => {
    e.preventDefault();

    const signers = newTreasury.signers
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean);

    if (!newTreasury.name || signers.length === 0) {
      return notify("Treasury name + at least 1 signer required");
    }

    try {
      await api.createTreasury({
        name: newTreasury.name,
        signers,
      });

      await loadTreasuries();
      notify("Treasury Created");
    } catch (err) {
      notify(err.response?.data?.error || err.message);
    }
  };

  
  const handleDeposit = async (e) => {
    e.preventDefault();

    if (!selectedTreasury) return notify("Select a treasury first");

    if (!depositForm.token || Number(depositForm.amount) <= 0) {
      return notify("Enter valid token and amount");
    }

    try {
      await api.deposit(selectedTreasury._id, {
        token: depositForm.token,
        amount: Number(depositForm.amount),
      });

      await loadTreasuries();
      notify("Funds Deposited");
    } catch (err) {
      notify(err.response?.data?.error || err.message);
    }
  };


  const handleCreateProposal = async (e) => {
    e.preventDefault();

    if (!proposalForm.metadata || !proposalForm.to || !proposalForm.amount) {
      return notify("Please fill all fields");
    }

    const amountNum = Number(proposalForm.amount);
    if (amountNum <= 0) {
      return notify("Amount must be > 0");
    }

    try {
      await api.createProposal(selectedTreasury._id, {
        creator: currentSigner,
        category: proposalForm.category,
        metadata: proposalForm.metadata,
        isEmergency: proposalForm.isEmergency,
        transactions: [
          {
            to: proposalForm.to,
            token: proposalForm.token,
            amount: amountNum,
            note: proposalForm.note,
          },
        ],
      });

      notify("Proposal Created");
      loadProposals(selectedTreasury._id);
    } catch (err) {
      notify(err.response?.data?.error || err.message);
    }
  };

  
  const signProposal = async (p) => {
    try {
      await api.signProposal(p._id, { signer: currentSigner });
      notify("Signature Added");
      loadProposals(p.treasuryId);
    } catch (err) {
      notify(err.response?.data?.error || err.message);
    }
  };

 
  const executeProposal = async (p) => {
    try {
      await api.executeProposal(p._id);
      notify("Proposal Executed");
      loadProposals(p.treasuryId);
      loadTreasuries();
    } catch (err) {
      notify(err.response?.data?.error || err.message);
    }
  };


  const requiredSign = (p) => {
    if (!selectedTreasury) return 0;
    return Math.ceil(
      selectedTreasury.signers.length * (p.requiredSignerRatio || 0)
    );
  };


  const timeRemaining = (p) => {
    if (!p.timeLockReadyAt || p.isEmergency) return 0;
    const now = Math.floor(Date.now() / 1000);
    return Math.max(0, p.timeLockReadyAt - now);
  };

  return (
    <div className="container">
      <h1 className="title">Multi-Sig Treasury Dashboard</h1>

      {message && <div className="message-box">{message}</div>}

      
      {selectedTreasury && (
        <div style={{ marginBottom: 20 }}>
          <strong>Current Signer: </strong>
          <select
            className="input"
            style={{ width: 220, marginLeft: 10 }}
            value={currentSigner}
            onChange={(e) => setCurrentSigner(e.target.value)}
          >
            {selectedTreasury.signers.map((s) => (
              <option key={s}>{s}</option>
            ))}
          </select>
        </div>
      )}

      <div className="grid-3">

        
        <div className="left-panel">
         
          <div className="card">
            <div className="card-title">Create Treasury</div>

            <form onSubmit={handleCreateTreasury}>
              <input
                className="input"
                placeholder="Treasury Name"
                value={newTreasury.name}
                onChange={(e) =>
                  setNewTreasury({ ...newTreasury, name: e.target.value })
                }
              />

              <input
                className="input"
                placeholder="Signers (comma separated)"
                value={newTreasury.signers}
                onChange={(e) =>
                  setNewTreasury({
                    ...newTreasury,
                    signers: e.target.value,
                  })
                }
              />

              <button className="btn btn-blue">Create</button>
            </form>
          </div>

         
          <div className="card">
            <div className="card-title">Treasuries</div>

            {treasuries.map((t) => (
              <div
                key={t._id}
                onClick={() => handleSelectTreasury(t)}
                className={`treasury-item ${
                  selectedTreasury?._id === t._id ? "treasury-selected" : ""
                }`}
              >
                <strong>{t.name}</strong>
                <div className="text-small">
                  Signers: {t.signers.join(", ")}
                </div>
                <div className="text-small">
                  Balances:{" "}
                  {Object.entries(t.balances || {})
                    .map(([k, v]) => `${k}: ${v}`)
                    .join(", ") || "none"}
                </div>
              </div>
            ))}
          </div>
        </div>

       
        <div>
          {!selectedTreasury ? (
            <h3 style={{ color: "#777", marginTop: 50 }}>
              Select a treasury to continue
            </h3>
          ) : (
            <>
            
              <div className="card">
                <div className="card-title">Deposit</div>

                <form onSubmit={handleDeposit}>
                  <input
                    className="input"
                    placeholder="Token"
                    value={depositForm.token}
                    onChange={(e) =>
                      setDepositForm({ ...depositForm, token: e.target.value })
                    }
                  />

                  <input
                    className="input"
                    type="number"
                    placeholder="Amount"
                    value={depositForm.amount}
                    onChange={(e) =>
                      setDepositForm({
                        ...depositForm,
                        amount: e.target.value,
                      })
                    }
                  />

                  <button className="btn btn-green">Deposit</button>
                </form>
              </div>

             
              <div className="card">
                <div className="card-title">Create Proposal</div>

                <form onSubmit={handleCreateProposal}>
                  <select
                    className="input"
                    value={proposalForm.category}
                    onChange={(e) =>
                      setProposalForm({
                        ...proposalForm,
                        category: e.target.value,
                      })
                    }
                  >
                    <option value="Operations">Operations</option>
                    <option value="Marketing">Marketing</option>
                    <option value="Development">Development</option>
                    <option value="Emergency">Emergency</option>
                  </select>

                  <input
                    className="input"
                    placeholder="Description"
                    value={proposalForm.metadata}
                    onChange={(e) =>
                      setProposalForm({
                        ...proposalForm,
                        metadata: e.target.value,
                      })
                    }
                  />

                  <input
                    className="input"
                    placeholder="Recipient Address"
                    value={proposalForm.to}
                    onChange={(e) =>
                      setProposalForm({ ...proposalForm, to: e.target.value })
                    }
                  />

                  <input
                    className="input"
                    placeholder="Token"
                    value={proposalForm.token}
                    onChange={(e) =>
                      setProposalForm({
                        ...proposalForm,
                        token: e.target.value,
                      })
                    }
                  />

                  <input
                    className="input"
                    placeholder="Amount"
                    type="number"
                    value={proposalForm.amount}
                    onChange={(e) =>
                      setProposalForm({
                        ...proposalForm,
                        amount: e.target.value,
                      })
                    }
                  />

                  <input
                    className="input"
                    placeholder="Note"
                    value={proposalForm.note}
                    onChange={(e) =>
                      setProposalForm({
                        ...proposalForm,
                        note: e.target.value,
                      })
                    }
                  />

                  <label className="checkbox-row">
                    <input
                      type="checkbox"
                      checked={proposalForm.isEmergency}
                      onChange={(e) =>
                        setProposalForm({
                          ...proposalForm,
                          isEmergency: e.target.checked,
                        })
                      }
                    />{" "}
                    Emergency Proposal
                  </label>

                  <button className="btn btn-blue">Create Proposal</button>
                </form>
              </div>

             
              <div className="card">
                <div className="card-title">Proposals</div>

                {proposals.map((p) => {
                  const req = requiredSign(p);
                  const left = timeRemaining(p);
                  const enough = p.signatures.length >= req;

                  const disableExecute =
                    p.status === "EXECUTED" || (!p.isEmergency && left > 0) || !enough;

                  return (
                    <div className="proposal-card" key={p._id}>
                      <div className="proposal-header">
                        <div>
                          #{p._id.slice(-4)} – {p.category}
                          {p.isEmergency && (
                            <span style={{ color: "red" }}> [EMERGENCY]</span>
                          )}
                        </div>
                        <div
                          className={`status-badge ${
                            p.status === "EXECUTED"
                              ? "status-executed"
                              : "status-pending"
                          }`}
                        >
                          {p.status}
                        </div>
                      </div>

                      <div className="text-small">
                        Creator: {p.creator}
                        <br />
                        Signers: {p.signatures.join(", ")}
                        <br />
                        Required: {req}
                        <br />
                        {!p.isEmergency && left > 0
                          ? `Time lock: ${left}s`
                          : ""}
                      </div>

                      <div className="text-small" style={{ marginTop: 10 }}>
                        {p.transactions.map((tx, i) => (
                          <div key={i}>
                            • {tx.amount} {tx.token} → {tx.to} ({tx.note})
                          </div>
                        ))}
                      </div>

                      <div className="flex-row">
                        <button
                          className="btn btn-dark"
                          onClick={() => signProposal(p)}
                        >
                          Sign as {currentSigner}
                        </button>

                        <button
                          className="btn btn-green"
                          disabled={disableExecute}
                          onClick={() => executeProposal(p)}
                        >
                          Execute
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
