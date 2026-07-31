import "dotenv/config";
import { Worker } from "bullmq";

import { connection } from "./lib/redis";

const PIPELINE_URL = process.env.PIPELINE_URL ?? "http://localhost:8000";

// The worker: for each "crawl" ticket, snapshot the page via the pipeline.
const worker = new Worker(
  "crawl",
  async (job) => {
    const { sourceId, url } = job.data;
    console.log(`[worker] Checking source ${sourceId}: ${url}`);

    const res = await fetch(`${PIPELINE_URL}/snapshots`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ url }),
    });

    if (!res.ok) throw new Error(`Pipeline returned ${res.status}`);

    const data = await res.json();
    console.log(`[worker] Snapshot for ${url}: ${data.clauses_indexed} clauses indexed`);
    return data;
  },
  { connection }
);

worker.on("completed", (job) => {
  console.log(`[worker] ✅ Job ${job.id} done`);
});

worker.on("failed", (job, err) => {
  console.log(`[worker] ❌ Job ${job?.id} failed: ${err.message}`);
});

console.log("[worker] Waiting for crawl jobs…");