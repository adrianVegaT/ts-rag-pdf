'use server'
import OpenAI from 'openai'
import { createClient } from '@/lib/supabase/server'
import * as pdfParse from 'pdf-parse'

const openai = new OpenAI({
    apiKey: process.env.OPENAI_API_KEY
})

function splitIntoChunks(text: string, chunkSize: number = 500): string[] {
    const words = text.split(/\s+/)
    const chunks: string[] = []
    let current: string[] = []
    let count = 0

    for (const word of words) {
        current.push(word)
        count++

        if (count >= chunkSize) {
            chunks.push(current.join(' '))
            current = []
            count = 0
        }
    }

    if (current.length > 0) {
        chunks.push(current.join(' '))
    }

    return chunks
}

export async function ingestPDF(formData: FormData): Promise<{ success: boolean, chunks: number }> {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) throw new Error('Unauthorized')

    const file = formData.get('pdf') as File
    if (!file) throw new Error('No file provided')

    // Extraer texto del PDF
    const arrayBuffer = await file.arrayBuffer()
    const buffer = Buffer.from(arrayBuffer)
    const pdfData = await pdfParse.default(buffer)
    const text = pdfData.text


    if (!text.trim()) throw new Error('Could not extract text from PDF')

    // Dividir en chunks
    const chunks = splitIntoChunks(text, 500)

    // Borrar documentos anteriores del usuario para este archivo
    await supabase
        .from('documents')
        .delete()
        .eq('user_id', user.id)
        .eq('filename', file.name)

    // Generar embeddings y guardar en Supabase
    for (const chunk of chunks) {
        const embeddingResponse = await openai.embeddings.create({
            model: 'text-embedding-3-small',
            input: chunk
        })

        const embedding = embeddingResponse.data[0].embedding

        await supabase.from('documents').insert({
            user_id: user.id,
            filename: file.name,
            chunk_text: chunk,
            embedding
        })
    }

    return { success: true, chunks: chunks.length }
}