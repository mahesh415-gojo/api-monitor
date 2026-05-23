require("dotenv").config();

const express = require("express");
const mongoose = require("mongoose");
const axios = require("axios");
const cors = require("cors");
const nodemailer = require("nodemailer");

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());


// MongoDB Schema
const apiSchema = new mongoose.Schema({
  name: String,
  url: String,
  status: Number,
  responseTime: Number,
  timestamp: {
    type: Date,
    default: Date.now
  }
});

const Api = mongoose.model("Api", apiSchema);


// Email transporter
const transporter = nodemailer.createTransport({
  service: "gmail",
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASS
  }
});


// APIs to monitor
const apis = [
  {
    name: "GitHub API",
    url: "https://api.github.com"
  },
  {
    name: "JSONPlaceholder",
    url: "https://jsonplaceholder.typicode.com/posts"
  }
];


// Send email alert
async function sendAlert(apiName) {
  try {
    await transporter.sendMail({
      from: process.env.EMAIL_USER,
      to: process.env.ALERT_EMAIL,
      subject: `🚨 API Down Alert`,
      text: `${apiName} API is DOWN`
    });

    console.log("📧 Alert email sent");
  } catch (error) {
    console.log("Email error:", error.message);
  }
}


// Check APIs
async function checkApis() {
  console.log("Checking APIs...");

  for (const api of apis) {
    const start = Date.now();

    try {
      const response = await axios.get(api.url);

      const responseTime = Date.now() - start;

      const apiData = new Api({
        name: api.name,
        url: api.url,
        status: response.status,
        responseTime
      });

      await apiData.save();

      console.log(
        `✅ ${api.name} | ${response.status} | ${responseTime}ms`
      );

    } catch (error) {

      const apiData = new Api({
        name: api.name,
        url: api.url,
        status: 500,
        responseTime: 0
      });

      await apiData.save();

      console.log(`❌ ${api.name} DOWN`);

      await sendAlert(api.name);
    }
  }
}


// API routes
app.get("/api/data", async (req, res) => {
  try {

    const data = await Api.find()
      .sort({ timestamp: -1 })
      .limit(20);

    res.json(data);

  } catch (error) {
    res.status(500).json({
      message: error.message
    });
  }
});


// MongoDB connection + server start
mongoose.connect(process.env.MONGO_URI)

.then(() => {

  console.log("✅ MongoDB Connected");

  app.listen(PORT, () => {

    console.log(`🚀 Server running on port ${PORT}`);

    checkApis();

    setInterval(checkApis, 10000);

  });

})

.catch((err) => {

  console.log(
    "❌ MongoDB connection failed:",
    err.message
  );

});