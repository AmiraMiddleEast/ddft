<!-- GSD:project-start source:PROJECT.md -->
## Project

**Angela App**

A web application for managing the legalization of German documents for use in the United Arab Emirates. The app automates the process of analyzing uploaded documents via AI, looking up the responsible German authorities for pre-authentication (Vorbeglaubigung), and generating a complete routing slip (Laufliste) as a PDF — including the full chain from Vorbeglaubigung through Endbeglaubigung to embassy legalization.

Built as an internal tool for a legalization service provider.

**Core Value:** Upload documents, get a correct and complete Laufliste PDF with the right authorities for each document — fast and without manual research.

### Constraints

- **AI Provider**: Anthropic Claude (with Vision capability for PDF analysis)
- **Target Country**: UAE only (embassy data is static for now)
- **Data Source**: behoerden_db.json is the authority database — needs to be importable and maintainable
- **Single User**: Internal tool, one primary user (the service provider)
- **Language**: App UI can be German or English; Laufliste output is German
<!-- GSD:project-end -->

<!-- GSD:stack-start source:research/STACK.md -->
## Technology Stack

## Recommended Stack
### Core Technologies
| Technology | Version | Purpose | Why Recommended |
|------------|---------|---------|-----------------|
| Next.js | 16.2 | Full-stack React framework | App Router with Server Actions handles file uploads, API routes, and server-side PDF generation in one codebase. No need for a separate backend. Turbopack gives fast dev startup (~400% faster). The de facto standard for React apps in 2026. |
| React | 19.2.5 | UI library | Ships with Next.js 16. Server Actions eliminate boilerplate for form submissions and file uploads. useActionState and useOptimistic are built-in for the review/edit workflow. |
| TypeScript | 6.0.2 | Type safety | Required for Drizzle ORM type inference, Zod schema sharing between client/server, and Claude API response typing. TS 6.0 is the current stable release. |
| Tailwind CSS | 4.2.0 | Styling | CSS-first configuration via @theme directives (no tailwind.config.js needed). Sub-100ms full rebuilds. shadcn/ui is built on it. Perfect for internal tools where speed of development beats custom design. |
### Database
| Technology | Version | Purpose | Why Recommended |
|------------|---------|---------|-----------------|
| SQLite via better-sqlite3 | 12.9.0 | Application database | Single-user internal tool does not need PostgreSQL. Zero infrastructure -- just a file on disk. Synchronous API is actually ideal for SQLite's single-writer model. Fastest SQLite driver for Node.js. Backup = copy one file. |
| Drizzle ORM | 0.45.2 | Database access layer | Type-safe SQL with zero runtime overhead. First-class SQLite + better-sqlite3 support. Schema defined in TypeScript means the Behoerden DB structure gets full type safety. Drizzle Kit handles migrations. Drizzle Studio gives a free DB browser during development. |
### AI / Document Processing
| Technology | Version | Purpose | Why Recommended |
|------------|---------|---------|-----------------|
| @anthropic-ai/sdk | 0.88.0 | Claude API client | Official TypeScript SDK for Claude. Supports document content blocks for PDF analysis with base64 encoding. Type-safe responses. Required by the project constraint (Claude Vision for document analysis). |
| Claude Sonnet 4 (claude-sonnet-4-20250514) | - | Document analysis model | Best cost/quality tradeoff for structured data extraction from German documents. Fast enough for interactive use. Use Sonnet, not Opus -- this is a structured extraction task, not a reasoning task. |
### Authentication
| Technology | Version | Purpose | Why Recommended |
|------------|---------|---------|-----------------|
| better-auth | 1.6.4 | Authentication | Built-in email/password with `emailAndPassword: { enabled: true }` -- one line vs. NextAuth's complex Credentials provider setup. Native Drizzle ORM adapter. Built-in rate limiting and password policies. The Auth.js team joined Better Auth in Sept 2025; Better Auth is the recommended choice for new projects. |
### PDF Generation
| Technology | Version | Purpose | Why Recommended |
|------------|---------|---------|-----------------|
| @react-pdf/renderer | 4.5.1 | Laufliste PDF generation | Define PDF layout as React components -- natural fit for a React/Next.js project. Server-side rendering via `renderToStream()` in API routes. No headless browser needed (unlike Puppeteer). Supports custom fonts (important for German umlauts/special characters). Lightweight and fast. |
### UI Components
| Technology | Version | Purpose | Why Recommended |
|------------|---------|---------|-----------------|
| shadcn/ui (CLI v4) | Latest | Component library | Not a dependency -- components are copied into your source code. Built on Radix UI primitives (accessible, unstyled). Tailwind CSS v4 compatible. Perfect for admin interfaces: tables, forms, dialogs, dropdowns are all available. No version lock-in. |
| Radix UI | Latest | Accessible primitives | Underlying library for shadcn/ui. Handles keyboard navigation, focus management, screen readers. Vendored through shadcn/ui, not installed directly. |
### Validation
| Technology | Version | Purpose | Why Recommended |
|------------|---------|---------|-----------------|
| Zod | 4.3.6 | Schema validation | Define validation schemas once, use on client (form validation) and server (API route / Server Action validation). Type inference eliminates duplicate type definitions. Standard choice with Next.js Server Actions. |
### Supporting Libraries
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| lucide-react | Latest | Icons | Default icon set for shadcn/ui. Consistent, tree-shakeable. |
| sonner | Latest | Toast notifications | Lightweight toast library. shadcn/ui has a built-in Sonner integration. Use for success/error feedback after document uploads and PDF generation. |
| nuqs | Latest | URL state management | Type-safe search params. Use for filter/search state in document history and Behoerden admin views so URLs are shareable/bookmarkable. |
| date-fns | Latest | Date formatting | Lightweight date utility. Use for formatting German dates (dd.MM.yyyy) in the Laufliste and UI. Supports locales including de. |
### Development Tools
| Tool | Purpose | Notes |
|------|---------|-------|
| drizzle-kit | Database migrations & studio | Run `npx drizzle-kit studio` for visual DB browser. `npx drizzle-kit generate` + `npx drizzle-kit migrate` for schema changes. |
| eslint + eslint-config-next | Linting | Ships with `create-next-app`. No extra config needed. |
| prettier + prettier-plugin-tailwindcss | Code formatting | Auto-sorts Tailwind classes. Eliminates formatting debates. |
## Installation
# Initialize Next.js project
# Core dependencies
# Dev dependencies
# Initialize shadcn/ui
# Add commonly needed shadcn components
## Alternatives Considered
| Recommended | Alternative | When to Use Alternative |
|-------------|-------------|-------------------------|
| Next.js | Remix / React Router 7 | If you need nested routing patterns or prefer loader/action conventions. Next.js wins here because of Server Actions for file uploads and the larger ecosystem. |
| SQLite + better-sqlite3 | PostgreSQL + pg | If multiple concurrent users write to the DB simultaneously or you need full-text search at scale. Overkill for a single-user internal tool. |
| Drizzle ORM | Prisma | If you prefer a more opinionated ORM with a GUI migration tool. Prisma adds more runtime overhead and its SQLite support is less mature than Drizzle's. |
| better-auth | Auth.js (NextAuth v5) | If you need 60+ OAuth providers. Auth.js v5 is perpetual beta; its team joined Better Auth. For simple password auth, Better Auth is dramatically simpler. |
| @react-pdf/renderer | Puppeteer + HTML-to-PDF | If you need pixel-perfect HTML/CSS rendering in PDFs. Puppeteer is heavier (downloads Chrome), slower, and uses more memory. React-PDF is sufficient for the structured Laufliste format. |
| @react-pdf/renderer | pdfmake / PDFKit | If you prefer imperative PDF generation. @react-pdf/renderer's declarative React components are more maintainable and natural in a React project. |
| Tailwind CSS | CSS Modules | If you have a designer producing detailed mockups. For an internal tool, Tailwind's utility classes are faster to build with. |
| better-auth | No auth (env var password) | If you want the absolute simplest approach. A hardcoded password check in middleware works for a single-user tool but lacks session management and is harder to change. Better Auth adds minimal complexity for proper session handling. |
## What NOT to Use
| Avoid | Why | Use Instead |
|-------|-----|-------------|
| Prisma | Heavier runtime, slower cold starts, less ergonomic SQLite support, generated client adds build complexity | Drizzle ORM -- lighter, faster, better SQLite integration |
| NextAuth / Auth.js v5 | Perpetual beta since 2023. Credentials provider is intentionally limited and discouraged by the maintainers. Complex setup for simple password auth. Auth.js team joined Better Auth. | better-auth -- email/password is a first-class feature, not an afterthought |
| Puppeteer for PDF | Downloads a full Chrome binary (~280MB). Each PDF render spawns a browser process. Massive overkill for generating a structured routing slip document. | @react-pdf/renderer -- lightweight, server-side, no browser dependency |
| Express.js / separate API | Unnecessary when Next.js API routes and Server Actions handle all backend needs. Adding Express means two servers, two deployments, split configuration. | Next.js API routes + Server Actions |
| MongoDB | Document DB is wrong fit here. The Behoerden data is relational (Bundesland -> document types -> authorities). Needs joins for lookup. | SQLite with Drizzle ORM |
| Chakra UI / Material UI | Heavy runtime CSS-in-JS. Slower, larger bundle. Opinionated styling conflicts with Tailwind. | shadcn/ui + Tailwind CSS (zero runtime, full control) |
| tRPC | Adds complexity for type-safe API calls that Server Actions already solve. Only useful if you have a separate client/server architecture. | Next.js Server Actions (built-in type safety with Zod) |
## Stack Patterns by Variant
- Use Vercel Blob Storage for uploaded PDFs instead of local filesystem
- SQLite will NOT work on Vercel (serverless, ephemeral filesystem) -- switch to Turso (libsql) or PostgreSQL
- This is an important decision to make early
- Use local filesystem for uploaded PDFs (simplest)
- SQLite works perfectly -- single file, no database server
- Deploy with Docker or PM2 behind Nginx
- This is the recommended deployment model for a single-user internal tool
- Use Claude's Message Batches API for cost savings (50% cheaper)
- Queue uploads and process asynchronously
- Not needed for MVP but good to know for scaling
## Version Compatibility
| Package A | Compatible With | Notes |
|-----------|-----------------|-------|
| Next.js 16.2 | React 19.2.x | Bundled together. Do not install React separately. |
| Next.js 16.2 | TypeScript 6.0.x | Supported natively. `create-next-app` configures it. |
| Tailwind CSS 4.2 | Next.js 16.2 | Native PostCSS integration. No extra plugins needed. |
| shadcn/ui CLI v4 | Tailwind CSS 4.x + React 19.x | Scaffolds with correct versions. Run `npx shadcn@latest init`. |
| Drizzle ORM 0.45.x | better-sqlite3 12.x | First-class integration. Import from `drizzle-orm/better-sqlite3`. |
| better-auth 1.6.x | Drizzle ORM 0.45.x | Native adapter via `better-auth/adapters/drizzle`. Specify `provider: "sqlite"`. |
| @react-pdf/renderer 4.5.x | React 19.x | Compatible. Uses its own renderer, not react-dom. |
| @anthropic-ai/sdk 0.88.x | TypeScript 6.0.x | Full type support. Document content blocks are typed. |
| Zod 4.3.x | TypeScript 6.0.x | Full inference support. Works with Server Actions natively. |
## Key Integration Notes
### Claude PDF Analysis Setup
### Behoerden Database Migration
### PDF Generation Architecture
## Sources
- [Next.js 16.1 Blog](https://nextjs.org/blog/next-16-1) -- version and features verified (HIGH confidence)
- [Anthropic TypeScript SDK on npm](https://www.npmjs.com/package/@anthropic-ai/sdk) -- version 0.88.0 verified (HIGH confidence)
- [Claude PDF Support Docs](https://platform.claude.com/docs/en/build-with-claude/pdf-support) -- API format and limits verified (HIGH confidence)
- [Better Auth Installation](https://better-auth.com/docs/installation) -- setup process and Drizzle adapter verified (HIGH confidence)
- [Better Auth Drizzle Adapter](https://better-auth.com/docs/adapters/drizzle) -- SQLite adapter configuration verified (HIGH confidence)
- [Drizzle ORM SQLite Docs](https://orm.drizzle.team/docs/quick-sqlite/better-sqlite3/) -- better-sqlite3 integration verified (HIGH confidence)
- [shadcn/ui CLI v4 Changelog](https://ui.shadcn.com/docs/changelog/2026-03-cli-v4) -- March 2026 release verified (HIGH confidence)
- [Tailwind CSS v4.2 Release](https://www.infoq.com/news/2026/04/tailwind-css-4-2-webpack/) -- version and features verified (HIGH confidence)
- [@react-pdf/renderer on npm](https://www.npmjs.com/package/@react-pdf/renderer) -- version 4.5.1 verified (HIGH confidence)
- [Zod v4 Release Notes](https://zod.dev/v4) -- version 4.3.6 verified (HIGH confidence)
- [better-sqlite3 on npm](https://www.npmjs.com/package/better-sqlite3) -- version 12.9.0 verified (HIGH confidence)
- [Auth.js joins Better Auth Discussion](https://github.com/nextauthjs/next-auth/discussions/13252) -- Auth.js team transition verified (MEDIUM confidence)
<!-- GSD:stack-end -->

<!-- GSD:conventions-start source:CONVENTIONS.md -->
## Conventions

Conventions not yet established. Will populate as patterns emerge during development.
<!-- GSD:conventions-end -->

<!-- GSD:architecture-start source:ARCHITECTURE.md -->
## Architecture

Architecture not yet mapped. Follow existing patterns found in the codebase.
<!-- GSD:architecture-end -->

<!-- GSD:skills-start source:skills/ -->
## Project Skills

No project skills found. Add skills to any of: `.claude/skills/`, `.agents/skills/`, `.cursor/skills/`, or `.github/skills/` with a `SKILL.md` index file.
<!-- GSD:skills-end -->

<!-- GSD:workflow-start source:GSD defaults -->
## GSD Workflow Enforcement

Before using Edit, Write, or other file-changing tools, start work through a GSD command so planning artifacts and execution context stay in sync.

Use these entry points:
- `/gsd-quick` for small fixes, doc updates, and ad-hoc tasks
- `/gsd-debug` for investigation and bug fixing
- `/gsd-execute-phase` for planned phase work

Do not make direct repo edits outside a GSD workflow unless the user explicitly asks to bypass it.
<!-- GSD:workflow-end -->



<!-- GSD:profile-start -->
## Developer Profile

> Profile not yet configured. Run `/gsd-profile-user` to generate your developer profile.
> This section is managed by `generate-claude-profile` -- do not edit manually.
<!-- GSD:profile-end -->
