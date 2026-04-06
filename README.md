# JPEGDy

Web-based Jeopardy game built with React, TypeScript, and Vite.

## Run Locally

```bash
npm install
npm run dev
```

## Build

```bash
npm run build
```

The production build is emitted to `dist/`.

## Deploy To Vercel

This repository includes a [`vercel.json`](vercel.json) file so Vercel can build the app with `npm run build` and serve the static output from `dist/`.

Deploy steps:

1. Push this repository to GitHub, GitLab, or Bitbucket.
2. Import the repository in Vercel.
3. Keep the default framework detection, or leave the project as a static Vite app.
4. Confirm the build command is `npm run build` and the output directory is `dist`.

Notes:

- `questions.json` stays at the repository root and is imported by the app at build time.
- `jpeg-core.png` is also imported from the repository root, so Vercel will bundle it automatically.
