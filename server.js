require("dotenv").config();

process.on("unhandledRejection", err => {
  console.error("Unhandled Error:", err);
});

const express = require("express");
const axios = require("axios");
const mongoose = require("mongoose");
const nodemailer = require("nodemailer");

const app = express();
const PORT = process.env.PORT || 3000;
const SLOW_THRESHOLD = 2000;

app.use(express.json());

// ---------------- EMAIL ----------------
const EMAIL_ENABLED = (process.env.EMAIL_ENABLED || "").toLowerCase() === "true";
const EMAIL_PASS = (process.env.EMAIL_PASS || "").replace(/\s+/g, "");

let transporter = null;

if (EMAIL_ENABLED && process.env.EMAIL_USER && EMAIL_PASS) {
  transporter = nodemailer.createTransport({
    service: "gmail",
    auth: {
      user: process.env.EMAIL_USER,
      pass: EMAIL_PASS
    }
  });
}

async function sendEmail(url) {
  if (!EMAIL_ENABLED || !transporter) {
    console.log("⚠️ Email disabled:", url);
    return;
  }

  try {
    await transporter.sendMail({
      from: process.env.EMAIL_USER,
      to: process.env.EMAIL_TO,
      subject: "🚨 API DOWN ALERT",
      text: `${url} is DOWN!`
    });

    console.log("✅ Email sent:", url);

  } catch (err) {
    console.error("❌ Email error:", err.message);
  }
}

// ---------------- DATABASE FIX ----------------
const MONGO_URI =
  process.env.MONGO_URI || "mongodb://127.0.0.1:27017/api-monitor";

console.log("Using DB:", MONGO_URI);

mongoose.connect(MONGO_URI)
  .then(() => console.log("✅ MongoDB connected"))
  .catch(err => console.log("❌ DB Error:", err));

// ---------------- SCHEMA ----------------
const ApiLog = mongoose.model("ApiLog", new mongoose.Schema({
  url: String,
  status: String,
  responseTime: Number,
  time: { type: Date, default: Date.now }
}));

const ApiList = mongoose.model("ApiList", new mongoose.Schema({
  url: { type: String, unique: true },
  lastAlert: Number
}));

// ---------------- DEFAULT APIs ----------------
async function loadDefaults() {
  const defaults = [
    "https://www.google.com",
    "https://www.youtube.com",
    "https://jsonplaceholder.typicode.com/posts"
  ];

  const count = await ApiList.countDocuments();
  if (count === 0) {
    for (let url of defaults) {
      await ApiList.create({ url });
    }
  }
}
loadDefaults();

// ---------------- CHECK API ----------------
async function checkAPI(url) {
  const start = Date.now();

  try {
    await axios.head(url, { timeout: 5000 });
    const t = Date.now() - start;

    return {
      status: t > SLOW_THRESHOLD ? "SLOW" : "UP",
      responseTime: t
    };

  } catch {
    try {
      await axios.get(url, { timeout: 5000 });
      const t = Date.now() - start;

      return {
        status: t > SLOW_THRESHOLD ? "SLOW" : "UP",
        responseTime: t
      };

    } catch (err) {
      if (err.response) return { status: "SLOW", responseTime: null };
      return { status: "DOWN", responseTime: null };
    }
  }
}

// ---------------- MONITOR ----------------
setInterval(async () => {
  const apis = await ApiList.find();

  for (let api of apis) {
    const result = await checkAPI(api.url);

    console.log("Checking:", api.url, result.status);

    await ApiLog.create({
      url: api.url,
      status: result.status,
      responseTime: result.responseTime
    });

    const now = Date.now();

    if (result.status === "DOWN") {
      if (!api.lastAlert || now - api.lastAlert > 300000) {
        sendEmail(api.url);
        api.lastAlert = now;
        await api.save();
      }
    }
  }
}, 10000);

// ---------------- UPTIME ----------------
async function getUptime(url) {
  const logs = await ApiLog.find({
    url,
    time: { $gte: new Date(Date.now() - 86400000) }
  });

  if (!logs.length) return 0;

  const up = logs.filter(l => l.status === "UP").length;
  return ((up / logs.length) * 100).toFixed(2);
}

// ---------------- DASHBOARD ----------------
app.get("/", (req, res) => {
  res.send(`
  <html>
  <head>
    <style>
      body { background:#0b1b34;color:white;text-align:center;font-family:Arial }
      .grid { display:flex;flex-wrap:wrap;justify-content:center }
      .card {
        width:260px;margin:15px;padding:20px;border-radius:10px;
        word-break:break-all
      }
      .UP{background:green}
      .SLOW{background:orange}
      .DOWN{background:red}
      #alertBox {
        position:fixed;top:20px;right:20px;background:red;padding:10px;display:none
      }
    </style>
  </head>

  <body>
  <h1>🚀 API Monitor</h1>

  <input id="url" placeholder="https://example.com">
  <button onclick="add()">Add</button>

  <div id="summary"></div>
  <div id="alertBox"></div>
  <div class="grid" id="cards"></div>

  <script>
  let lastDown=[];

  async function load(){
    const res = await fetch("/status");
    const data = await res.json();

    let up=0,slow=0,down=0;
    let currentDown=[];

    const c=document.getElementById("cards");
    c.innerHTML="";

    data.forEach(api=>{
      if(api.status==="UP") up++;
      else if(api.status==="SLOW") slow++;
      else down++;

      if(api.status==="DOWN") currentDown.push(api._id);

      c.innerHTML+=\`
        <div class="card \${api.status}">
          <b>\${api._id}</b><br><br>
          Status:\${api.status}<br>
          Response:\${api.responseTime||"-"} ms<br>
          Uptime:\${api.uptime}%<br><br>

          <button onclick="graph('\${api._id}')">Graph</button>
          <button onclick="removeApi('\${api._id}',this)">Remove</button>
        </div>
      \`;
    });

    document.getElementById("summary").innerText =
      "UP:"+up+" | SLOW:"+slow+" | DOWN:"+down;

    const newDown=currentDown.filter(x=>!lastDown.includes(x));

    if(newDown.length){
      const box=document.getElementById("alertBox");
      box.innerHTML="🚨 DOWN: "+newDown.join(",");
      box.style.display="block";
      setTimeout(()=>box.style.display="none",3000);
    }

    lastDown=currentDown;
  }

  async function add(){
    const url=document.getElementById("url").value.trim();
    await fetch("/add-api",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({url})});
    load();
  }

  async function removeApi(url,btn){
    await fetch("/remove-api",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({url})});
    btn.parentElement.remove();
  }

  function graph(url){
    window.open("/graph?url="+encodeURIComponent(url));
  }

  load();
  setInterval(load,5000);
  </script>
  </body>
  </html>
  `);
});

// ---------------- STATUS ----------------
app.get("/status", async (req, res) => {
  const urls = (await ApiList.find()).map(x => x.url);

  const data = await ApiLog.aggregate([
    { $match: { url: { $in: urls } } },
    { $sort: { time: -1 } },
    {
      $group: {
        _id: "$url",
        status: { $first: "$status" },
        responseTime: { $first: "$responseTime" }
      }
    }
  ]);

  for (let d of data) {
    d.uptime = await getUptime(d._id);
  }

  res.json(data);
});

// ---------------- ADD ----------------
app.post("/add-api", async (req, res) => {
  const { url } = req.body;
  await ApiList.updateOne({ url }, { url }, { upsert: true });
  res.json({ ok:true });
});

// ---------------- REMOVE ----------------
app.post("/remove-api", async (req, res) => {
  const { url } = req.body;
  await ApiList.deleteOne({ url });
  await ApiLog.deleteMany({ url });
  res.json({ ok:true });
});

// ---------------- GRAPH ----------------
app.get("/graph", async (req, res) => {
  const { url } = req.query;

  res.send(`
  <html>
  <script src="https://cdn.jsdelivr.net/npm/chart.js"></script>
  <body style="background:#0b1b34;color:white;text-align:center">
  <h2>${url}</h2>
  <canvas id="c"></canvas>

  <script>
  fetch("/logs?url=${url}")
  .then(r=>r.json())
  .then(d=>{
    new Chart(document.getElementById("c"),{
      type:"line",
      data:{
        labels:d.map(x=>new Date(x.time).toLocaleTimeString()),
        datasets:[{
          label:"Response",
          data:d.map(x=>x.responseTime||null),
          borderColor:"yellow"
        }]
      }
    });
  });
  </script>
  </body>
  </html>
  `);
});

// ---------------- LOGS ----------------
app.get("/logs", async (req, res) => {
  const logs = await ApiLog.find({ url: req.query.url })
    .sort({ time: -1 })
    .limit(20);

  res.json(logs.reverse());
});

// ---------------- START ----------------
app.listen(PORT, () => {
  console.log("🚀 Server running on port", PORT);
});