'use client'
import { useState, useRef } from 'react'
import ReactMarkdown from 'react-markdown'
import { ingestPDF } from '../_actions/ingest'
import { queryDocument } from '../_actions/query'
import { TOKEN_LIMIT } from '@/lib/config'

interface Message {
    id: string
    question: string
    response: string
    inputTokens: number
    outputTokens: number
    chunks: string[]
    showChunks: boolean
}

interface RAGBoxProps {
    initialTokensUsed: number
    userDocuments: string[]
    history: {
        id: string
        question: string
        response: string
        input_tokens: number
        output_tokens: number
        created_at: string
    }[]
}

export default function RAGBox({ initialTokensUsed, userDocuments, history }: RAGBoxProps) {
    const [messages, setMessages] = useState<Message[]>(history.map(h => ({
        id: h.id,
        question: h.question,
        response: h.response,
        inputTokens: h.input_tokens,
        outputTokens: h.output_tokens,
        chunks: [],
        showChunks: false
    })))
    const [question, setQuestion] = useState('')
    const [loading, setLoading] = useState(false)
    const [ingesting, setIngesting] = useState(false)
    const [error, setError] = useState('')
    const [ingestSuccess, setIngestSuccess] = useState('')
    const [tokensUsed, setTokensUsed] = useState(initialTokensUsed)
    const textareaRef = useRef<HTMLTextAreaElement>(null)
    const fileInputRef = useRef<HTMLInputElement>(null)
    const [filename, setFilename] = useState(userDocuments[0] || '')
    const [availableDocuments, setAvailableDocuments] = useState<string[]>(userDocuments)

    const tokensRemaining = Math.max(0, TOKEN_LIMIT - tokensUsed)
    const limitReached = tokensRemaining <= 0
    const usagePercent = Math.min(100, (tokensUsed / TOKEN_LIMIT) * 100)

    async function handleFileUpload(e: React.ChangeEvent<HTMLInputElement>) {
        const file = e.target.files?.[0]
        if (!file) return
        if (file.type !== 'application/pdf') {
            setError('Only PDF files are supported')
            return
        }

        setIngesting(true)
        setError('')
        setIngestSuccess('')

        try {
            const formData = new FormData()
            formData.append('pdf', file)
            const result = await ingestPDF(formData)
            setFilename(file.name)
            setAvailableDocuments(prev =>
                prev.includes(file.name) ? prev : [...prev, file.name]
            )
            setIngestSuccess(`PDF processed successfully — ${result.chunks} chunks indexed`)
            setMessages([])
        } catch {
            setError('Failed to process PDF. Please try again.')
        }

        setIngesting(false)
    }

    function handleInput(e: React.ChangeEvent<HTMLTextAreaElement>) {
        setQuestion(e.target.value)
        const textarea = textareaRef.current
        if (textarea) {
            textarea.style.height = 'auto'
            textarea.style.height = textarea.scrollHeight + 'px'
        }
    }

    async function handleSubmit() {
        if (!question.trim() || !filename || limitReached) return
        setLoading(true)
        setError('')

        try {
            const result = await queryDocument(question, filename)

            setMessages(prev => [...prev, {
                id: crypto.randomUUID(),
                question,
                response: result.text,
                inputTokens: result.inputTokens,
                outputTokens: result.outputTokens,
                chunks: result.chunks,
                showChunks: false
            }])

            setTokensUsed(result.tokensUsed)
            setQuestion('')

            if (textareaRef.current) {
                textareaRef.current.style.height = 'auto'
            }
        } catch (e: unknown) {
            if (e instanceof Error && e.message === 'Token limit reached') {
                setError('You have reached the token limit for this demo account.')
            } else if (e instanceof Error && e.message === 'No relevant content found in the document') {
                setError('No relevant content found for that question in the document.')
            } else {
                setError('Something went wrong. Please try again.')
            }
        }

        setLoading(false)
    }

    function toggleChunks(id: string) {
        setMessages(prev => prev.map(msg =>
            msg.id === id ? { ...msg, showChunks: !msg.showChunks } : msg
        ))
    }

    return (
        <div className="space-y-4">
            {availableDocuments.length > 1 && (
                <div className="bg-white rounded-xl border border-gray-200 p-4 shadow-sm">
                    <p className="text-sm font-medium text-gray-700 mb-2">Active document</p>
                    <select
                        value={filename}
                        onChange={(e) => {
                            setFilename(e.target.value)
                            setMessages([])
                        }}
                        className="w-full px-4 py-2 rounded-lg border border-gray-200 text-sm text-gray-800 outline-none focus:border-gray-400"
                    >
                        {availableDocuments.map(doc => (
                            <option key={doc} value={doc}>{doc}</option>
                        ))}
                    </select>
                </div>
            )}

            <div className="bg-white rounded-xl border border-gray-200 p-6 shadow-sm flex flex-col items-center text-center gap-3">
                <p className="text-sm font-medium text-gray-700">
                    {filename ? `Active: ${filename}` : 'Upload a PDF'}
                </p>
                <input
                    ref={fileInputRef}
                    type="file"
                    accept=".pdf"
                    onChange={handleFileUpload}
                    className="hidden"
                />
                <button
                    onClick={() => fileInputRef.current?.click()}
                    disabled={ingesting}
                    className="px-4 py-2 border border-gray-300 text-gray-700 text-sm rounded-lg hover:bg-gray-50 hover:border-gray-400 disabled:opacity-50 transition-colors cursor-pointer"
                >
                    {ingesting ? 'Processing...' : 'Choose PDF'}
                </button>
                {filename && (
                    <span className="text-sm text-gray-500">{filename}</span>
                )}
                {ingestSuccess && (
                    <p className="text-sm text-green-600">{ingestSuccess}</p>
                )}
            </div>

            {/* Messages */}
            {messages.map(msg => (
                <div key={msg.id} className="bg-white rounded-xl border border-gray-200 p-6 shadow-sm space-y-3">
                    <p className="text-sm font-medium text-gray-800">{msg.question}</p>
                    <div className="prose prose-sm max-w-none text-gray-800">
                        <ReactMarkdown>{msg.response}</ReactMarkdown>
                    </div>
                    <div className="flex justify-between items-center">
                        <div className="flex gap-4 text-xs text-gray-400">
                            <span>Input: <span className="text-gray-500">{msg.inputTokens}</span></span>
                            <span>Output: <span className="text-gray-500">{msg.outputTokens}</span></span>
                            <span>Total: <span className="text-gray-500">{msg.inputTokens + msg.outputTokens}</span></span>
                        </div>
                        <button
                            onClick={() => toggleChunks(msg.id)}
                            className="text-xs text-gray-400 hover:text-gray-600 transition-colors cursor-pointer"
                        >
                            {msg.showChunks ? 'Hide context' : 'Show context'}
                        </button>
                    </div>
                    {msg.showChunks && (
                        <div className="space-y-2 pt-2 border-t border-gray-100">
                            <p className="text-xs font-medium text-gray-500">Retrieved chunks:</p>
                            {msg.chunks.map((chunk, i) => (
                                <div key={i} className="p-3 bg-gray-50 rounded-lg text-xs text-gray-600">
                                    {chunk.substring(0, 300)}...
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            ))}

            {/* Token usage + input */}
            <div className="bg-white rounded-xl border border-gray-200 p-6 shadow-sm space-y-3">
                <div className="flex justify-between text-xs text-gray-400 mb-1">
                    <span>Token usage</span>
                    <span>{tokensUsed} / {TOKEN_LIMIT}</span>
                </div>
                <div className="w-full bg-gray-100 rounded-full h-1.5">
                    <div
                        className={`h-1.5 rounded-full transition-all ${usagePercent >= 90 ? 'bg-red-400' : usagePercent >= 70 ? 'bg-amber-400' : 'bg-gray-800'}`}
                        style={{ width: `${usagePercent}%` }}
                    />
                </div>

                {limitReached ? (
                    <p className="text-sm text-center text-gray-500 py-2">
                        You have used all your tokens for this demo account.
                    </p>
                ) : !filename ? (
                    <p className="text-sm text-center text-gray-400 py-2">
                        Upload a PDF to start asking questions
                    </p>
                ) : (
                    <>
                        <div className="flex gap-2 items-center">
                            <textarea
                                ref={textareaRef}
                                value={question}
                                onChange={handleInput}
                                placeholder="Ask a question about the document..."
                                rows={1}
                                className="flex-1 px-4 py-2 rounded-lg border border-gray-200 text-sm text-gray-800 outline-none focus:border-gray-400 transition-colors resize-none overflow-hidden"
                            />
                            <button
                                onClick={handleSubmit}
                                disabled={loading}
                                className="px-4 py-2 bg-gray-800 text-white text-sm rounded-lg hover:bg-gray-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors cursor-pointer shrink-0"
                            >
                                {loading ? 'Thinking...' : 'Ask'}
                            </button>
                        </div>
                        {error && <p className="text-sm text-red-500">{error}</p>}
                    </>
                )}
            </div>
        </div>
    )
}