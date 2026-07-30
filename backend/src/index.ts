import express from "express";

// Create the Express app — this is our "kitchen" that handles requests.
const app = express();

// The door number the server listens on. 4000 keeps it clear of the
// frontend, which will later use 3000.
const PORT = process.env.PORT || 4000;

// A "health check" endpoint. Visiting /health tells us the server is alive.
// Tools and other services will knock here to check we're okay.
app.get("/health", (_req, res) => {
  res.json({ status: "ok", service: "papertrail-backend" });
});

// The home door. Visiting / shows a friendly hello.
app.get("/", (_req, res) => {
  res.send("PaperTrail backend is alive! 🐾");
});

// Start listening. Once running, it prints the address in the terminal.
app.listen(PORT, () => {
  console.log(`Backend listening on http://localhost:${PORT}`);
});