'use server'
import Anthropic from '@anthropic-ai/sdk'
import OpenAI from 'openai'
import { createClient } from '@/lib/supabase/server'
import { TOKEN_LIMIT } from '@/lib/config'

const anthropic = new Anthropic({
    apiKey: process.env.ANTHROPIC_API_KEY
})

const openai = new OpenAI({
    apiKey: process.env.OPENAI_API_KEY
})

export async function getTokensUsed(): Promise<number> {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) return 0

    const { data } = await supabase
        .from('messages')
        .select('input_tokens, output_tokens')
        .eq('user_id', user.id)

    if (!data) return 0

    return data.reduce((acc, msg) => acc + msg.input_tokens + msg.output_tokens, 0)
}

export async function getUserDocuments(): Promise<string[]> {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) return []

    const { data } = await supabase
        .from('documents')
        .select('filename')
        .eq('user_id', user.id)

    if (!data) return []

    return [...new Set(data.map(d => d.filename))]
}

export async function getMessageHistory(): Promise<{
    id: string
    question: string
    response: string
    input_tokens: number
    output_tokens: number
    created_at: string
}[]> {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) return []

    const { data } = await supabase
        .from('messages')
        .select('id, question, response, input_tokens, output_tokens, created_at')
        .eq('user_id', user.id)
        .order('created_at', { ascending: true })

    return data ?? []
}

export async function queryDocument(question: string, filename: string): Promise<{
    text: string
    inputTokens: number
    outputTokens: number
    tokensUsed: number
    tokensRemaining: number
    chunks: string[]
}> {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) throw new Error('Unauthorized')

    const tokensUsed = await getTokensUsed()
    if (tokensUsed >= TOKEN_LIMIT) throw new Error('Token limit reached')

    // Generar embedding de la pregunta
    const embeddingResponse = await openai.embeddings.create({
        model: 'text-embedding-3-small',
        input: question
    })

    const questionEmbedding = embeddingResponse.data[0].embedding

    // Buscar chunks similares en Supabase usando pgvector
    const { data: chunks } = await supabase.rpc('match_documents', {
        query_embedding: questionEmbedding,
        match_threshold: 0.5,
        match_count: 5,
        p_user_id: user.id,
        p_filename: filename
    })

    if (!chunks || chunks.length === 0) {
        throw new Error('No relevant content found in the document')
    }

    const context = chunks.map((c: { chunk_text: string }) => c.chunk_text).join('\n\n')

    // Llamar a Claude con el contexto
    const msg = await anthropic.messages.create({
        model: 'claude-haiku-4-5-20251001',
        max_tokens: 1024,
        messages: [{
            role: 'user',
            content: `Answer the following question based only on the provided context.
                      If the answer is not in the context, say so clearly.

                    Context:
                    ${context}

                    Question: ${question}`
        }]
    })

    const bloque = msg.content[0]
    const text = bloque?.type === 'text' ? bloque.text : ''

    const newTokensUsed = tokensUsed + msg.usage.input_tokens + msg.usage.output_tokens

    // Guardar en messages para el tracking de tokens
    await supabase.from('messages').insert({
        user_id: user.id,
        question,
        response: text,
        input_tokens: msg.usage.input_tokens,
        output_tokens: msg.usage.output_tokens,
        model: msg.model
    })

    return {
        text,
        inputTokens: msg.usage.input_tokens,
        outputTokens: msg.usage.output_tokens,
        tokensUsed: newTokensUsed,
        tokensRemaining: Math.max(0, TOKEN_LIMIT - newTokensUsed),
        chunks: chunks.map((c: { chunk_text: string }) => c.chunk_text)
    }
}