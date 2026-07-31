import { Queue } from "bullmq";

import { connection } from "./redis";

// The "crawl" queue holds tickets to check watched pages.
export const crawlQueue = new Queue("crawl", { connection });