require("dotenv").config();

const express = require("express");
const mongoose = require("mongoose");
const axios = require("axios");
const cors = require("cors");

const app = express();

app.use(cors());
app.use(express.json());

const PORT = process.env.PORT || 3000;

/* =========================
   MongoDB Connection
========================= */

mongoose
  .connect(process.env.MONGO_URI)
  .then(() => {
    console.log("MongoDB Connected");
  })
  .catch((err) => {
    console.log("MongoDB Error:", err.message);
  });

/* =========================
   Schema
========================= */

const logSchema = new mongoose.Schema({
  apiName: String,
  statusCode: Number,
  responseTime: Number,
  checkedAt: {
    type: Date,
    default: Date.now,
  },
});

const Log = mongoose.model("Log", logSchema);

/* =========================
   APIs To Monitor
========================= */

const apis = [
  {
    name: "GitHub API",
    url: "https://api.github.com",
  },
  {
    name: "JSON Placeholder",
    url: "https://jsonplaceholder.typicode.com/posts",
  },
  {
    name: "Dog API",
    url: "https://dog.ceo/api/breeds/image/random",
  },
];

/* =========================
   Check APIs
========================= */

const checkApis = async () => {
  console.log("Checking APIs...");

  for (const api of apis) {
    const start = Date.now();

    try {
      const response = await axios.get(api.url);

      const responseTime = Date.now() - start;

      console.log(
        `${api.name} | ${response.status} | ${responseTime}ms`
      );

      await Log.create({
        apiName: api.name,
        statusCode: response.status,
        responseTime,
      });
    } catch (error) {
      console.log(`${api.name} | Failed`);

      await Log.create({
        apiName: api.name,
        statusCode: 500,
        responseTime: 0,
      });
    }
  }
};

/* =========================
   Routes
========================= */

app.get("/", (req, res) => {
  res.send("API Monitor Running");
});

app.get("/logs", async (req, res) => {
  try {
    const logs = await Log.find().sort({
      checkedAt: -1,
    });

    res.json(logs);
  } catch (error) {
    res.status(500).json({
      message: "Error fetching logs",
    });
  }
});

/* =========================
   Start Server
========================= */

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);

  checkApis();

  setInterval(checkApis, 10000);
});