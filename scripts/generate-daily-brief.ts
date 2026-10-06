import { dateSchema } from "../src/features/daily-brief/model.js";
import { footballBrief } from "../server/daily-brief/footballProvider.js";
import { localBriefStore } from "../server/daily-brief/localStore.js";
import { runBrief } from "../server/daily-brief/pipeline.js";
const dateArg = process.argv.find(value => value.startsWith("--date="))?.slice(7);
if (dateArg && !dateSchema.safeParse(dateArg).success) throw new Error("Use --date=YYYY-MM-DD");
const results = await runBrief(localBriefStore(), footballBrief, { ...(dateArg ? { date: dateArg } : {}) });
console.log(JSON.stringify({ results, storage: ".local/daily-brief", scope: "local only" }, null, 2));
if (results?.some(row => row.status === "failed")) process.exitCode = 1;
