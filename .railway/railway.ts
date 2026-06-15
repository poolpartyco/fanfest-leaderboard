import { defineRailway, github, project, service } from "railway/iac";

// Both services deploy from this repo. Pointed at feature/improvements for the
// initial rollout (switch the branch here when promoting to main).
const REPO = "poolpartyco/fanfest-leaderboard";
const BRANCH = "feature/improvements";

export default defineRailway(() => {
  // Web SPA. No start command, so Railpack detects the Vite app, runs the
  // build, and static-serves dist/ (with SPA fallback) via Caddy.
  // Env (set out-of-band, baked at build time): VITE_SUPABASE_URL,
  // VITE_SUPABASE_ANON_KEY.
  const web = service("web", {
    source: github(REPO, { branch: BRANCH }),
    build: "npm run build",
  });

  // Budget-aware poller. Runs on a cron schedule instead of a long-running
  // server; no build step needed (tsx/dotenv are runtime deps). NEVER restart
  // so a finished run isn't relaunched between scheduled ticks.
  // Env (set out-of-band): VITE_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY,
  // HIGHLIGHTLY_API_KEY.
  const poller = service("poller", {
    source: github(REPO, { branch: BRANCH }),
    build: "echo 'poller: no build step'",
    start: "npm run poll",
    deploy: {
      cronSchedule: "*/7 * * * *",
      restartPolicyType: "NEVER",
    },
  });

  return project("fanfest-poolparty", {
    resources: [web, poller],
  });
});
