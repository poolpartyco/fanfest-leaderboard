# Soccer Leaderboard

Simple Vite + React + TypeScript frontend that reads a local JSON file and turns it into a soccer leaderboard.

## Data model

The app reads from `src/data/leaderboard.json`.

- `users` contains the four players with stable ids.
- `matches` contains each fixture, the final winner, and every user's pick.
- The leaderboard awards 3 points for each correct pick.

## Development

Install dependencies and run the app with:

```bash
npm install
npm run dev
```

Build for production with:

```bash
npm run build
```
