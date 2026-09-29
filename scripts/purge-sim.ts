// One-off maintenance: remove SIMULATED events (new spec: live data only).
import { PrismaClient } from "@prisma/client";
const db = new PrismaClient();
async function main() {
  const sim = await db.cityEvent.deleteMany({ where: { dataOrigin: "SIMULATED" } });
  console.log("deleted SIMULATED events:", sim.count);
  const remaining = await db.cityEvent.groupBy({ by: ["dataOrigin"], _count: true });
  console.log("remaining:", JSON.stringify(remaining));
  await db.$disconnect();
}
main();
