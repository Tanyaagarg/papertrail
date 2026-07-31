import cors from "cors";
import express from "express";
import { prisma } from "./lib/prisma";
import { crawlQueue } from "./lib/queue";


const app = express();
app.use(cors());
const PORT = process.env.PORT || 4000;
const PIPELINE_URL = process.env.PIPELINE_URL ?? "http://localhost:8000";

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

// CREATE a watched source (no duplicate URL or label per user).
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

  // No duplicate URL for this user.
  const dupUrl = await prisma.watchedSource.findFirst({ where: { userId, url } });
  if (dupUrl) {
    return res.status(409).json({ error: "You're already watching this URL." });
  }

  // No duplicate label for this user.
  const dupLabel = await prisma.watchedSource.findFirst({
    where: { userId, label },
  });
  if (dupLabel) {
    return res
      .status(409)
      .json({ error: "You already have a page with that label." });
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

// DELETE a watched source, and wipe its snapshots/vectors so re-adding is fresh.
app.delete("/users/:userId/sources/:sourceId", async (req, res) => {
  const userId = Number(req.params.userId);
  const sourceId = Number(req.params.sourceId);

  if (Number.isNaN(userId) || Number.isNaN(sourceId)) {
    return res.status(400).json({ error: "userId and sourceId must be numbers" });
  }

  // Find it first so we know its URL.
  const source = await prisma.watchedSource.findFirst({
    where: { id: sourceId, userId },
  });
  if (!source) {
    return res.status(404).json({ error: "Source not found" });
  }

  // Remove it from the watch list (MySQL).
  await prisma.watchedSource.delete({ where: { id: source.id } });

  // If nobody else watches this exact URL, purge its snapshots + vectors too.
  const stillUsed = await prisma.watchedSource.count({
    where: { url: source.url },
  });
  if (stillUsed === 0) {
    try {
      await fetch(`${PIPELINE_URL}/purge`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url: source.url }),
      });
    } catch {
      // best-effort: the watch list is already updated even if purge fails
    }
  }

  return res.json({ deleted: 1 });
});