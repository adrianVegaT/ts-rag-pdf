# PDF Chat — RAG System

A Next.js 16 application that lets you upload a PDF and ask questions about its
content using Retrieval-Augmented Generation (RAG). Built as Week 5 of a 12-month
roadmap transitioning from Laravel/PHP to AI engineering.

## What it does

- Upload a PDF and index its content automatically
- Ask questions in natural language about the document
- Retrieves relevant chunks using semantic search with pgvector
- Answers using Claude with the retrieved context
- Persists documents and chat history across sessions
- Requires authentication before accessing the chat
- Enforces a configurable token limit per account

## How RAG works
```
INGESTION (when you upload a PDF)
PDF → extract text → split into chunks → generate embeddings → store in pgvector

QUERY (when you ask a question)
Question → generate embedding → find similar chunks → pass context to Claude → answer
```

## Tech stack

- Next.js 16 (App Router)
- TypeScript
- Tailwind CSS v4
- Supabase (PostgreSQL + pgvector + Auth)
- Anthropic SDK (`@anthropic-ai/sdk`) — answers
- OpenAI SDK (`openai`) — embeddings
- pdf-parse — PDF text extraction
- react-markdown
- @tailwindcss/typography

## Models

- Answers: `claude-haiku-4-5-20251001` — configurable in `app/_actions/query.ts`
- Embeddings: `text-embedding-3-small` — configurable in `app/_actions/ingest.ts`

## Setup

1. Clone the repository
2. Install dependencies
```bash
npm install
```

3. Create a Supabase project and run this SQL in the SQL Editor:
```sql
CREATE EXTENSION IF NOT EXISTS vector;

CREATE TABLE documents (
    id          uuid DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id     uuid REFERENCES auth.users(id) ON DELETE CASCADE,
    filename    text NOT NULL,
    chunk_text  text NOT NULL,
    embedding   vector(1536),
    created_at  timestamptz DEFAULT now()
);

ALTER TABLE documents ENABLE ROW LEVEL SECURITY;

CREATE POLICY "users see own documents"
ON documents FOR ALL
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);

CREATE TABLE messages (
    id              uuid DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id         uuid REFERENCES auth.users(id) ON DELETE CASCADE,
    question        text NOT NULL,
    response        text NOT NULL,
    input_tokens    int NOT NULL DEFAULT 0,
    output_tokens   int NOT NULL DEFAULT 0,
    model           text NOT NULL,
    created_at      timestamptz DEFAULT now()
);

ALTER TABLE messages ENABLE ROW LEVEL SECURITY;

CREATE POLICY "users see own messages"
ON messages FOR ALL
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);

CREATE OR REPLACE FUNCTION match_documents(
    query_embedding vector(1536),
    match_threshold float,
    match_count int,
    p_user_id uuid,
    p_filename text
)
RETURNS TABLE (
    id uuid,
    chunk_text text,
    similarity float
)
LANGUAGE sql STABLE
AS $$
    SELECT
        documents.id,
        documents.chunk_text,
        1 - (documents.embedding <=> query_embedding) AS similarity
    FROM documents
    WHERE documents.user_id = p_user_id
    AND documents.filename = p_filename
    AND 1 - (documents.embedding <=> query_embedding) > match_threshold
    ORDER BY similarity DESC
    LIMIT match_count;
$$;
```

4. Create a `.env.local` file in the root folder
```bash
ANTHROPIC_API_KEY=your_anthropic_api_key
OPENAI_API_KEY=your_openai_api_key
NEXT_PUBLIC_SUPABASE_URL=your_supabase_url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_supabase_anon_key
NEXT_PUBLIC_TOKEN_LIMIT=15000
```

5. Run the development server
```bash
npm run dev
```

6. Open `http://localhost:3000`

## Project structure
```
app/
├── auth/
│   ├── login/
│   │   └── page.tsx            Login page
│   ├── register/
│   │   └── page.tsx            Register page
│   └── logout/
│       └── route.ts            Logout route handler
├── _actions/
│   ├── ingest.ts               Server Action — PDF processing and embedding generation
│   └── query.ts                Server Action — semantic search and Claude response
├── _components/
│   ├── RAGBox.tsx              Client Component — PDF upload, chat UI and token tracking
│   ├── LoginForm.tsx           Client Component — login form
│   └── RegisterForm.tsx        Client Component — register form
├── globals.css                 Global styles and Tailwind configuration
├── layout.tsx                  Root layout
└── page.tsx                    Home page — protected, loads documents and history
lib/
├── config.ts                   Shared configuration (NEXT_PUBLIC_TOKEN_LIMIT)
└── supabase/
    ├── client.ts               Supabase browser client
    └── server.ts               Supabase server client
proxy.ts                        Session refresh on every request
.env.example                    Environment variables template
```

## Live demo

[https://ts-rag-pdf.vercel.app](https://ts-rag-pdf.vercel.app)

> Demo accounts are limited to 15000 tokens. Create an account and upload a PDF to try it out.

## Context

Built as Week 5 of a 12-month roadmap transitioning from Laravel/PHP to AI
engineering — covering TypeScript, Next.js, RAG systems, and AI agents for
the international market.