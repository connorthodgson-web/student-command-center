# Architecture

## Architecture Goal

Create a clean MVP architecture for an assistant-first student app.

The architecture should support:
- natural-language task capture
- student/class/task data
- AI chat over workload
- reminder settings
- future expansion into deeper academic support

## Frontend

Framework:
- Next.js App Router
- TypeScript
- Tailwind CSS

Frontend priorities:
- clean structure
- easy-to-read pages and components
- calm UI
- assistant-first flows

## Backend

Initial backend approach:
- Next.js API routes

Initial API areas:
- task creation and retrieval
- class creation and retrieval
- natural-language task parsing
- AI chat
- reminder settings

## Database

Planned database:
- Supabase Postgres

Core early entities:
- User
- Class
- Task
- ReminderPreference
- ChatMessage

The schema should be simple and flexible.

## AI Layer

Planned AI usage:
- parse natural-language student inputs into structured task data
- answer chat questions about workload and schedule
- support future reminders and personalization

Important principle:
The AI layer should support the assistant experience.
It should not pretend certainty when information is ambiguous.

## Reminders

Early reminder work should focus on:
- reminder preference models
- route structure
- placeholder architecture
- future daily summary and due-soon logic

Do not overbuild scheduling infrastructure yet.

## Deployment

Planned deployment:
- Vercel for app hosting
- Supabase for backend services
- OpenAI API for assistant capabilities

## Engineering Principles

- beginner-friendly
- small iterations
- low abstraction unless clearly helpful
- preserve readability
- optimize for shipping a useful MVP
- do not overengineer
