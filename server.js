require("dotenv").config();

const express = require("express");
const axios = require("axios");
const mongoose = require("mongoose");
const nodemailer = require("nodemailer");

const app = express();

const PORT = process.env.PORT || 3000;
const SLOW_THRESHOLD = 2000;

app.use(express.json());

/* =========================
   MongoDB Connection
========================= */

mongoose
  .connect(process.env.MONGO_URI)
  .then(() => console.log("MongoDB Connected"))
  .catch((err) => console.log("MongoDB Error:", err));

/* =========================
   Schema
========================= */

const apiLogSchema = new mongoose.Schema({
  url: String,
  status: String,
  responseTime: Number,
  statusCode: Number,
  checkedAt: {
    type: Date,
    default: Date.now,
  },
});

const ApiLog = mongoose.model("ApiLog", apiLogSchema);

/* =========================
   Email Setup
========================= */

const transporter = nodemailer.createTransport({
  service: "gmail",
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASS,
  },
});

/* =========================
   APIs To Monitor
========================= */

let monitoredApis = [
  "https://jsonplaceholder.typicode.com/posts",
  "https://api.github.com",
];

/* =========================
   Send Email Alert
========================= */

async function sendEmailAlert(url, error) {
  try {
    await transporter.sendMail({
      from: process.env.EMAIL_USER,
      to: process.env.ALERT_EMAIL,
      subject: "API DOWN ALERT 🚨",
      text: `API Failed: ${url}\n\nError: ${error}`,
    });

    console.log("Alert email sent");
  } catch (err) {
    console.log("Email Error:", err.message);
  }
}

/* =========================
   API Health Checker
========================= */

async function checkApi(url) {
  const start = Date.now();

  try {
    const response = await axios.get(url);

    const responseTime = Date.now() - start;

    const log = new ApiLog({
      url,
      status: "UP",
      responseTime,
      statusCode: response.status,
    });

    await log.save();

    console.log(
      `✅ ${url} | ${response.status} | ${responseTime}ms`
    );

    if (responseTime > SLOW_THRESHOLD) {
      console.log(`⚠ Slow API Detected: ${url}`);
    }
  } catch (error) {
    const responseTime = Date.now() - start;

    const log = new ApiLog({
      url,
      status: "DOWN",
      responseTime,
      statusCode: error.response?.status || 500,
    });

    await log.save();

    console.log(`❌ ${url} DOWN`);

    await sendEmailAlert(url, error.message);
  }
}

/* =========================
   Run Monitoring
========================= */

setInterval(() => {
  monitoredApis.forEach((url) => {
    checkApi(url);
  });
}, 60000);

/* =========================
   Routes
========================= */

app.get("/", (req, res) => {
  res.send("API Monitoring System Running 🚀");
});

/* Get All Logs */

app.get("/logs", async (req, res) => {
  try {
    const logs = await ApiLog.find().sort({ checkedAt: -1 });

    res.json(logs);
  } catch (err) {
    res.status(500).json({
      error: err.message,
    });
  }
});

/* Add API */

app.post("/add-api", (req, res) => {
  const { url } = req.body;

  if (!url) {
    return res.status(400).json({
      error: "URL required",
    });
  }

  monitoredApis.push(url);

  res.json({
    message: "API Added",
    monitoredApis,
  });
});

/* =========================
   Start Server
========================= */

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});