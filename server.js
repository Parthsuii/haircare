// server.js
const express = require("express");
const session = require("express-session");
const mongoose = require("mongoose");
const dotenv = require("dotenv");
const path = require("path");
const User = require("./models/User");
const { generateCarePlanFetch } = require("./gemini-fetch");

dotenv.config();

console.log("GEMINI_API_KEY:", process.env.GEMINI_API_KEY); // Debugging
console.log("MONGO_URI:", process.env.MONGO_URI); // Debugging

mongoose.set("strictQuery", true);

const app = express();
app.set("view engine", "ejs");
app.set("views", path.join(__dirname, "views"));

app.use(express.urlencoded({ extended: true }));
app.use(express.static(path.join(__dirname, "public")));
app.use(
  session({
    secret: "haircare_secret",
    resave: false,
    saveUninitialized: true,
  })
);

mongoose
  .connect(process.env.MONGO_URI)
  .then(() => console.log("MongoDB Connected"))
  .catch((err) => console.log("MongoDB Error:", err));

app.get("/", (req, res) => {
  res.redirect("/login");
});

app.get("/login", (req, res) => {
  res.render("login");
});

app.get("/register", (req, res) => {
  res.render("register");
});

app.post("/register", async (req, res) => {
  const { username, password } = req.body;
  const user = new User({ username, password });
  await user.save();
  res.redirect("/login");
});

app.post("/login", async (req, res) => {
  const { username, password } = req.body;
  const user = await User.findOne({ username, password });
  if (user) {
    req.session.user = user;
    res.redirect("/survey");
  } else {
    res.send("Invalid credentials");
  }
});

app.get("/survey", (req, res) => {
  if (!req.session.user) return res.redirect("/login");
  res.render("survey", { username: req.session.user.username });
});

app.post("/survey", async (req, res) => {
  if (!req.session.user) return res.redirect("/login");

  const surveyData = req.body;
  console.log("Survey Data Received:", JSON.stringify(surveyData, null, 2)); // Debug input
  const carePlan = await generateCarePlanFetch(surveyData, process.env.GEMINI_API_KEY);

  console.log("Data sent to result.ejs:", JSON.stringify(carePlan, null, 2)); // Debug output
  res.render("result", {
    username: req.session.user.username,
    ingredients: carePlan.ingredients || [],
    washFrequency: carePlan.washFrequency || "Not specified",
    recommendations: carePlan.recommendations || [],
    instructions: carePlan.instructions || {},
    error: carePlan.error,
    rawResponse: carePlan.rawResponse || "No raw response available",
  });
});

app.get("/logout", (req, res) => {
  req.session.destroy(() => {
    res.redirect("/login");
  });
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, process.env.HOST || "0.0.0.0", () => {
  console.log(`Server running on http://${process.env.HOST || "localhost"}:${PORT}`);
});