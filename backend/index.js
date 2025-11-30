
require("dotenv").config();
const express = require("express");
const mongoose = require("mongoose");
const cors = require("cors");
const bodyParser = require("body-parser");


const app = express();
app.use(cors());
app.use(bodyParser.json());

const PORT = process.env.PORT || 3000;
const MONGO = process.env.MONGO_URI;


mongoose
  .connect(MONGO)
  .then(() => console.log("Databae connected"))
  .catch((e) => console.log("Mongo error:", e.message));

// model
const TreasurySchema = new mongoose.Schema(
  {
    name: String,
    signers: [String],
    balances: {
      type: Map,
      of: Number,
      default: {},
    },
    isFrozen: { type: Boolean, default: false },
  },
  { timestamps: true }
);

const ProposalSchema = new mongoose.Schema(
  {
    treasuryId: mongoose.Schema.Types.ObjectId,

    creator: String,
    category: String,
    metadata: String,
    isEmergency: Boolean,

    transactions: [
      {
        to: String,
        token: String,
        amount: Number,
        note: String,
      },
    ],

    signatures: [String],
    status: { type: String, default: "PENDING" },

    requiredSignerRatio: Number,
    timeLockSeconds: Number,
    timeLockReadyAt: Number,
  },
  { timestamps: true }
);

const Treasury = mongoose.model("Treasury", TreasurySchema);
const Proposal = mongoose.model("Proposal", ProposalSchema);


class PolicyManager {
  constructor() {
    this.categories = ["Operations", "Marketing", "Development", "Emergency"];
    this.amountRules = [
      { max: 1000, ratio: 0.4 },      
      { max: 10000, ratio: 0.6 },     
      { max: Infinity, ratio: 0.8 },  
    ];
  }

  apply(treasury, proposal) {
    if (!this.categories.includes(proposal.category))
      throw new Error("Invalid category");

    const total = proposal.transactions.reduce((a, b) => a + b.amount, 0);

  
    for (let rule of this.amountRules) {
      if (total <= rule.max) {
        proposal.requiredSignerRatio = rule.ratio;
        break;
      }
    }

  
    proposal.timeLockSeconds = 0;
proposal.timeLockReadyAt = Math.floor(Date.now() / 1000);

  }
}

const policy = new PolicyManager();


class EmergencyModule {
  constructor() {
    this.thresholdRatio = 0.8; 
    this.cooldown = 3600;      
    this.lastExecution = 0;
  }

  canExecute() {
    return Math.floor(Date.now() / 1000) - this.lastExecution >= this.cooldown;
  }

  record() {
    this.lastExecution = Math.floor(Date.now() / 1000);
  }
}

const emergency = new EmergencyModule();

// route

app.get("/", (req, res) => {
  res.json({ ok: true, message: "MultiSig Treasury Running" });
});

//create tresury
app.post("/treasuries", async (req, res) => {
  try {
    const t = await Treasury.create({
      name: req.body.name,
      signers: req.body.signers,
    });
    res.json({ ok: true, treasury: t });
  } catch (e) {
    res.status(400).json({ ok: false, error: e.message });
  }
});

//get tresury
app.get("/treasuries", async (req, res) => {
  const list = await Treasury.find().lean();
  res.json({ ok: true, treasuries: list });
});

//post diposite
app.post("/treasuries/:id/deposit", async (req, res) => {
  try {
    const t = await Treasury.findById(req.params.id);
    if (!t) throw new Error("Treasury not found");

    const { token, amount } = req.body;

    const old = t.balances.get(token) || 0;
    t.balances.set(token, old + Number(amount));

    await t.save();
    res.json({ ok: true, treasury: t });
  } catch (e) {
    res.status(400).json({ ok: false, error: e.message });
  }
});

// create praposal
app.post("/treasuries/:id/proposals", async (req, res) => {
  try {
    const t = await Treasury.findById(req.params.id);
    if (!t) throw new Error("Treasury not found");

    const { creator, category, metadata, isEmergency, transactions } = req.body;

   
    if (!creator || !category || !metadata) {
      throw new Error("Creator, category and metadata are required");
    }

    if (!t.signers.includes(creator)) {
      throw new Error("Not an authorized signer");
    }

    
    if (!Array.isArray(transactions) || transactions.length === 0) {
      throw new Error("At least one transaction is required");
    }

   
    const cleanedTx = transactions.map((tx) => {
      if (!tx.to || !tx.token || tx.amount == null) {
        throw new Error("Each transaction needs to, token and amount");
      }
      const amt = Number(tx.amount);
      if (isNaN(amt) || amt <= 0) {
        throw new Error("Transaction amount must be a positive number");
      }
      return {
        to: tx.to,
        token: tx.token,
        amount: amt,
        note: tx.note || "",
      };
    });

    const p = new Proposal({
      treasuryId: t._id,
      creator,
      category,
      metadata,
      isEmergency: !!isEmergency,
      transactions: cleanedTx,
      signatures: [...t.signers],
    });

    policy.apply(t, p);
    await p.save();

    res.json({ ok: true, proposal: p });
  } catch (e) {
    console.log("Create proposal error:", e.message);
    res.status(400).json({ ok: false, error: e.message });
  }
});

//get praposal
app.get("/treasuries/:id/proposals", async (req, res) => {
  const proposals = await Proposal.find({ treasuryId: req.params.id }).lean();
  res.json({ ok: true, proposals });
});

//sign prposal
app.post("/proposals/:pid/sign", async (req, res) => {
  try {
    const p = await Proposal.findById(req.params.pid);
    if (!p) throw new Error("Proposal not found");

    const t = await Treasury.findById(p.treasuryId);
    if (!t) throw new Error("Treasury not found");

    if (!t.signers.includes(req.body.signer))
      throw new Error("Signer not authorized");

    if (!p.signatures.includes(req.body.signer))
      p.signatures.push(req.body.signer);

    await p.save();
    res.json({ ok: true, proposal: p });
  } catch (e) {
    res.status(400).json({ ok: false, error: e.message });
  }
});

//praposal execute

app.post("/proposals/:pid/execute", async (req, res) => {
  try {
    const p = await Proposal.findById(req.params.pid);
    if (!p) throw new Error("Proposal not found");

    const t = await Treasury.findById(p.treasuryId);
    if (!t) throw new Error("Treasury not found");

    if (p.status === "EXECUTED") {
      throw new Error("Proposal already executed");
    }

    
    console.log("Easy Mode Enabled → Skipping approval + time-lock checks");

   
    for (const tx of p.transactions) {
      const bal = t.balances.get(tx.token) || 0;
      if (bal < tx.amount) throw new Error("Insufficient funds");
      t.balances.set(tx.token, bal - tx.amount); 
    }

    p.status = "EXECUTED";

    await t.save();
    await p.save();

    res.json({ ok: true, proposal: p, treasury: t });
  } catch (e) {
    console.log("Execute proposal error:", e.message);
    res.status(400).json({ ok: false, error: e.message });
  }
});


//server
app.listen(PORT, () => {
  console.log("backend running:", PORT);
});
