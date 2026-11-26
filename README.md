# WebGen Lab

WebGen Lab is an experimental laboratory for evaluating AI-driven web development through controlled, reproducible scenarios.

This repository currently contains the application foundation. OpenRouter integration, experiment management, persistence, and export workflows will be added incrementally.

## Prerequisites

- Node.js 20.9 or later
- npm

## Local development

Install dependencies and start the development server:

```bash
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) in your browser.

## Quality checks

```bash
npm run lint
npm run typecheck
npm run format:check
npm run build
```

## Technology stack

- Next.js with the App Router
- React
- TypeScript
- Tailwind CSS
- ESLint
- Prettier
