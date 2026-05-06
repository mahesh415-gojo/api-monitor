# 🚀 API Monitoring System

A Node.js-based API monitoring tool that tracks API uptime, response time, and failures with alert notifications.

---

## 🔥 Features

* Monitor API endpoints continuously
* Track response time & status
* Detect downtime automatically
* Store logs in MongoDB
* Email alerts for failures
* Simple REST API for logs

---

## 🛠️ Tech Stack

* Node.js
* Express.js
* MongoDB (Mongoose)
* Axios
* Nodemailer

---

## ⚙️ Setup Instructions

### 1. Clone repo

```bash
git clone https://github.com/mahesh415-gojo/api-monitor.git
cd api-monitor
```

### 2. Install dependencies

```bash
npm install
```

### 3. Create .env file

```env
PORT=3000
MONGO_URI=your_mongodb_connection
EMAIL_ENABLED=true
EMAIL_USER=your_email@gmail.com
EMAIL_PASS=your_app_password
```

### 4. Run server

```bash
node server.js
```

---

## 📊 API Endpoints

### Add API to monitor

POST /add-api

### Get logs

GET /logs?url=your_api_url

---

## 🎯 Use Case

This project helps developers monitor API health and get alerts when services go down.

---

## 💼 Author

Mahesh
