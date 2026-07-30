import { PrismaClient } from "@prisma/client";

// One shared Prisma client for the whole app.
// Other files import this instead of making their own.
export const prisma = new PrismaClient();