import { defineRailway, github, preserve, project, service } from "railway/iac";

// Both services deploy from this repo's main branch. New code is shipped by the
// GitHub Actions workflow (.github/workflows/deploy.yml) on every push to main.
const REPO = "poolpartyco/fanfest-leaderboard";
const BRANCH = "main";

export default defineRailway(() => {
  // Web SPA. No start command, so Railpack detects the Vite app, runs the
  // build, and static-serves dist/ (with SPA fallback) via Caddy.
  // Env (set out-of-band, baked at build time): VITE_SUPABASE_URL,
  // VITE_SUPABASE_ANON_KEY.
  const web = service("web", {
    source: github(REPO, { branch: BRANCH }),
    build: "npm run build",
    // Set out-of-band (secrets stay out of source). preserve() keeps the
    // existing Railway values so `config apply` never deletes them.
    env: {
      VITE_SUPABASE_URL: preserve(),
      VITE_SUPABASE_ANON_KEY: preserve(),
    },
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
    env: {
      VITE_SUPABASE_URL: preserve(),
      SUPABASE_SERVICE_ROLE_KEY: preserve(),
      HIGHLIGHTLY_API_KEY: preserve(),
    },
  });

  return project("fanfest-poolparty", {
    resources: [web, poller],
  });
});
