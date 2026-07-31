import cors from "cors";
import express from "express";
import { prisma } from "./lib/prisma";
import { crawlQueue } from "./lib/queue";

const app = express();
app.use(cors());
const PORT = process.env.PORT || 4000;

app.use(express.json());

// Health check — is the server alive?
app.get("/health", (_req, res) => {
  res.json({ status: "ok", service: "papertrail-backend" });
});

// Home — friendly hello.
app.get("/", (_req, res) => {
  res.send("PaperTrail backend is alive! 🐾");
});

// CREATE a user: POST /users  with body { "email": "..." }
app.post("/users", async (req, res) => {
  const { email } = req.body;

  if (!email || typeof email !== "string") {
    return res.status(400).json({ error: "email (string) is required" });
  }

  try {
    const user = await prisma.user.create({ data: { email } });
    return res.status(201).json(user);
  } catch (err) {
    return res
      .status(409)
      .json({ error: "Could not create user — email may already exist" });
  }
});

// LIST all users: GET /users
app.get("/users", async (_req, res) => {
  const users = await prisma.user.findMany();
  return res.json(users);
});

// CREATE a watched source for a user:
// POST /users/:userId/sources  with body { "url": "...", "label": "..." }
app.post("/users/:userId/sources", async (req, res) => {
  const userId = Number(req.params.userId);
  const { url, label } = req.body;

  if (Number.isNaN(userId)) {
    return res.status(400).json({ error: "userId must be a number" });
  }
  if (!url || typeof url !== "string" || !label || typeof label !== "string") {
    return res
      .status(400)
      .json({ error: "url (string) and label (string) are required" });
  }

  try {
    const source = await prisma.watchedSource.create({
      data: { url, label, userId },
    });
    return res.status(201).json(source);
  } catch (err) {
    return res
      .status(400)
      .json({ error: "Could not create source — does that user exist?" });
  }
});

// LIST a user's watched sources: GET /users/:userId/sources
app.get("/users/:userId/sources", async (req, res) => {
  const userId = Number(req.params.userId);

  if (Number.isNaN(userId)) {
    return res.status(400).json({ error: "userId must be a number" });
  }

  const sources = await prisma.watchedSource.findMany({
    where: { userId },
  });
  return res.json(sources);
});

// SET (create or replace) a user's profile:
// PUT /users/:userId/profile  with body { "description": "..." }
app.put("/users/:userId/profile", async (req, res) => {
  const userId = Number(req.params.userId);
  const { description } = req.body;

  if (Number.isNaN(userId)) {
    return res.status(400).json({ error: "userId must be a number" });
  }
  if (!description || typeof description !== "string") {
    return res.status(400).json({ error: "description (string) is required" });
  }

  try {
    const profile = await prisma.profile.upsert({
      where: { userId },
      update: { description },
      create: { description, userId },
    });
    return res.json(profile);
  } catch (err) {
    return res
      .status(400)
      .json({ error: "Could not save profile — does that user exist?" });
  }
});

// GET a user's profile: GET /users/:userId/profile
app.get("/users/:userId/profile", async (req, res) => {
  const userId = Number(req.params.userId);

  if (Number.isNaN(userId)) {
    return res.status(400).json({ error: "userId must be a number" });
  }

  const profile = await prisma.profile.findUnique({
    where: { userId },
  });

  if (!profile) {
    return res.status(404).json({ error: "No profile yet for this user" });
  }
  return res.json(profile);
});

app.listen(PORT, () => {
  console.log(`Backend listening on http://localhost:${PORT}`);
});

// Queue a crawl job for each of a user's watched pages.
app.post("/users/:userId/crawl", async (req, res) => {
  const userId = Number(req.params.userId);
  if (Number.isNaN(userId)) {
    return res.status(400).json({ error: "userId must be a number" });
  }

  const sources = await prisma.watchedSource.findMany({ where: { userId } });
  for (const source of sources) {
    await crawlQueue.add("check-source", {
      sourceId: source.id,
      url: source.url,
      userId,
    });
  }

  return res.json({ queued: sources.length });
});