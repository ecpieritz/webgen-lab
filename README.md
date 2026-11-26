# WebGen Lab

WebGen Lab is a controlled environment for running reproducible AI-driven web development experiments through OpenRouter. It preserves the original conversation, request and response artifacts, generation metadata, and the final conversation export without rewriting model output.

The first experiment profile is intentionally fixed:

- Model: `openai/gpt-5`
- Reasoning effort: `medium`
- User turns: `3`
- Assistant responses: `3`
- Conversation language: English

The application does not add system messages, developer messages, hidden instructions, model fallbacks, or automatic retries.

## Features

- Server-side OpenRouter integration with schema validation
- Durable experiment sessions backed by Neon Postgres
- Full conversation context on every request
- Manual review between each turn
- Hard limit of three valid assistant responses
- Original request and response artifact persistence
- JSON conversation export after the third completed turn
- Response metadata, token usage, finish reason, and reasoning details
- Automated workflow tests that do not consume API credits

## Prerequisites

- Node.js 20.9 or later
- npm
- An OpenRouter API key with access and sufficient credits for `openai/gpt-5`
- A PostgreSQL database, such as a Neon integration connected through Vercel

## Installation

Clone the repository and install its dependencies:

```bash
npm install
```

Create a local environment file from the committed example.

macOS or Linux:

```bash
cp .env.example .env.local
```

Windows PowerShell:

```powershell
Copy-Item .env.example .env.local
```

Set the server-side API key in `.env.local`:

```env
OPENROUTER_API_KEY=your_openrouter_api_key
OPENROUTER_MODEL=openai/gpt-5
OPENROUTER_REASONING_EFFORT=medium
DATABASE_URL=postgresql://user:password@host/database
```

Do not rename the key to a `NEXT_PUBLIC_` variable. OpenRouter credentials must never be exposed to browser code. Environment files are ignored by Git except for `.env.example`.

## Environment variables

| Variable                      | Required | Description                                          |
| ----------------------------- | -------- | ---------------------------------------------------- |
| `OPENROUTER_API_KEY`          | Yes      | Server-side credential used to call OpenRouter       |
| `OPENROUTER_MODEL`            | Yes      | Must be exactly `openai/gpt-5`                       |
| `OPENROUTER_REASONING_EFFORT` | Yes      | Must be exactly `medium`                             |
| `DATABASE_URL`                | Yes      | PostgreSQL connection string used by the Neon driver |

The application validates the OpenRouter configuration at runtime. It does not accept a different model or reasoning effort for the first assessment profile.

## Local development

Start the development server:

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) in a browser.

If `.env.local` changes while the server is running, restart the development server so Next.js reloads the environment.

## Deploying to Vercel

### 1. Import the repository

Create or select a Vercel project connected to this repository. Vercel detects the Next.js application and uses the existing `npm run build` command.

### 2. Connect Neon Postgres

From the Vercel project:

1. Open **Storage** or the **Marketplace**.
2. Install the Neon Postgres integration.
3. Connect it to the project for the **Production** and **Preview** environments.
4. Use `DATABASE` as the custom variable prefix so the generated connection variable is named `DATABASE_URL`.
5. Keep the connection variable marked as sensitive.

The application creates these tables automatically during its first database operation:

- `webgen_conversation_sessions`
- `webgen_experiment_attempts`
- `webgen_conversation_exports`

No manual SQL migration is required for the initial schema. The connected database user must be allowed to create tables and indexes.

### 3. Configure OpenRouter

Add the following environment variables under **Settings → Environment Variables** and scope them to **Production**:

```env
OPENROUTER_API_KEY=your_openrouter_api_key
OPENROUTER_MODEL=openai/gpt-5
OPENROUTER_REASONING_EFFORT=medium
```

Add them to **Preview** as well if preview deployments need to run real experiments. Every deployment with access to the key can consume OpenRouter credits.

### 4. Redeploy

Environment variable and integration changes only apply to new deployments. Redeploy the latest commit after connecting Neon or changing any variable.

After the deployment succeeds:

1. Open the deployment URL.
2. Create a new experiment.
3. Submit the first request once.
4. Confirm that the response appears and the counter advances to `1 / 3`.
5. Continue with the remaining turns only after reviewing each response.

Sessions created by an older deployment that used in-memory storage are not migrated. Always create a new experiment after deploying the Postgres-backed version.

### 5. Protect the deployment

The application does not currently implement user authentication. A public deployment exposes endpoints that can create experiments and consume OpenRouter credits. Use Vercel Deployment Protection or another access-control layer, and rotate any credential that has been exposed in source code, logs, screenshots, or messages.

## Running an experiment

1. Select **New experiment** to create an isolated session.
2. Enter the initial website request in English and select **Send turn 1**.
3. Review the complete assistant response before writing the second request.
4. Send a natural improvement request as turn 2.
5. Review the second response, then send the final requirement as turn 3.
6. After the third valid response, confirm that the session is marked as completed.
7. Select **Export conversation** or **Export JSON** to download `conversation.json`.

Only successful responses with a `stop` finish reason and non-empty content count as completed turns. Connection, authentication, storage, or invalid-response failures do not advance the turn counter. The interface never submits the next turn automatically.

After the third valid response, the session rejects additional prompts. Create a new experiment when another independent run is required.

## Export format

The main `conversation.json` file follows this structure:

```json
{
  "model": "openai/gpt-5",
  "reasoning": {
    "effort": "medium"
  },
  "messages": [
    {
      "role": "user",
      "content": "Original user request"
    },
    {
      "role": "assistant",
      "content": "Original assistant response"
    }
  ]
}
```

A completed assessment export contains exactly six messages in chronological order: three user messages alternating with three assistant messages. Assistant reasoning details are retained when OpenRouter returns them.

Exporting also stores the exact same content in Postgres. If an export already exists, the application only accepts it when its contents are identical.

## Stored artifacts

Each attempted OpenRouter request is stored in Postgres under its UUID-based session. The application creates the required schema automatically on its first database operation:

```text
webgen_conversation_sessions
├── session configuration and status
└── complete ordered message history

webgen_experiment_attempts
├── original request artifact
└── original response artifact and transport metadata

webgen_conversation_exports
└── exact conversation.json content
```

Request artifacts contain the exact JSON sent to OpenRouter. Response artifacts contain the original upstream body. The stored metadata includes timestamps, status, content type, URL, and attempt number.

Database records may contain private assessment data and model output. Restrict access to the Neon project and review exported content before copying or sharing it.

## Session lifecycle

Conversation sessions are persisted in Postgres and remain available across local restarts, Vercel deployments, cold starts, and separate Function instances. An atomic status update prevents two requests from processing the same session at the same time.

The application stores a session as `processing` while OpenRouter is generating a response and returns it to `active` when a handled failure occurs. A successful third response marks it as `completed` permanently.

## Tests

Run the automated test suite:

```bash
npm test
```

Run tests in watch mode during development:

```bash
npm run test:watch
```

The tests mock OpenRouter and storage boundaries. They validate request parameters, credential handling, conversation ordering, context preservation, turn limits, and JSON export without making network requests or consuming API credits. Mock responses are infrastructure fixtures and must not be treated as assessment evidence.

## Quality checks

Run the complete local validation set before committing changes:

```bash
npm run format:check
npm run lint
npm run typecheck
npm test
npm run build
```

Use `npm run format` to apply the configured Prettier rules.

## Production build

Create and run an optimized local build:

```bash
npm run build
npm start
```

The production process requires the same server-side environment variables as local development. On Vercel, connect a Neon Marketplace integration to the project and expose its connection string as `DATABASE_URL` for each target environment.

## Troubleshooting

### The application reports missing or invalid environment variables

Confirm that `.env.local` exists, that `OPENROUTER_API_KEY` is not empty, and that the fixed model and reasoning values match `.env.example`. Restart the server after changing the file.

### OpenRouter rejects a request

Verify that the API key is active, has sufficient credits, and can access `openai/gpt-5`. The application does not fall back to a different model and does not retry failed requests automatically.

### Export remains unavailable

Export is enabled only after three valid assistant responses. Failed requests do not count as turns. Their original request and response artifacts remain available in `webgen_experiment_attempts` when an upstream response was received and persistence succeeded.

### The database cannot be initialized

Confirm that `DATABASE_URL` is available in the current environment and points to a writable PostgreSQL database. Environment changes only apply to new Vercel deployments, so redeploy the application after connecting or updating Neon.

### The API returns `EXPERIMENT_STORAGE_FAILED`

Confirm that the deployed commit contains the Postgres-backed storage implementation and that `DATABASE_URL` is scoped to the deployment environment. This error on an older deployment can indicate that it is still trying to write to the read-only Vercel Function filesystem.

### A session remains in `processing`

The session is marked as `processing` before the OpenRouter request starts. Handled API and persistence errors return it to `active`. If the Function is terminated unexpectedly while waiting for the model, inspect the session row in Neon before attempting another request.

## Project structure

```text
src/
├── app/                 Next.js pages and API routes
├── components/chat/     Experiment interface components
├── features/chat/       Conversation, turn, and export workflows
└── lib/
    ├── http/            API error responses
    ├── database/        Neon client and automatic schema initialization
    ├── openrouter/      OpenRouter client, schemas, and configuration
    └── storage/         Original artifact persistence
tests/                   Automated workflow and client tests
```

## Security notes

- Keep API keys exclusively in server-side environment variables.
- Never commit `.env.local`, experiment artifacts, submissions, or confidential assessment documents.
- Treat all model-generated code as untrusted.
- Do not execute generated installation scripts or commands without manual inspection.
- Run generated websites separately from this application and without access to the OpenRouter key.
- Rotate a credential immediately if it is exposed in source code, logs, screenshots, or messages.

## Technology stack

- Next.js App Router
- React
- TypeScript
- Tailwind CSS
- Zod
- Neon Postgres
- Vitest
- ESLint
- Prettier
