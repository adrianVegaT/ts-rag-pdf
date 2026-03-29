'use client'
import { useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useRouter } from 'next/navigation'
import Link from 'next/link'

export default function RegisterForm() {
    const [email, setEmail] = useState('')
    const [password, setPassword] = useState('')
    const [error, setError] = useState('')
    const [loading, setLoading] = useState(false)
    const router = useRouter()
    const supabase = createClient()

    async function handleSubmit(e: React.FormEvent) {
        e.preventDefault()
        setLoading(true)
        setError('')

        const { error } = await supabase.auth.signUp({
            email,
            password
        })

        if (error) {
            setError(error.message)
            setLoading(false)
            return
        }

        router.push('/')
        router.refresh()
    }

    return (
        <form onSubmit={handleSubmit} className="bg-white rounded-xl border border-gray-200 p-6 shadow-sm space-y-4">
            <div>
                <label className="block text-sm text-gray-600 mb-1">Email</label>
                <input
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    required
                    className="w-full px-4 py-2 rounded-lg border border-gray-200 text-sm text-gray-800 outline-none focus:border-gray-400 transition-colors"
                />
            </div>
            <div>
                <label className="block text-sm text-gray-600 mb-1">Password</label>
                <input
                    type="password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    required
                    className="w-full px-4 py-2 rounded-lg border border-gray-200 text-sm text-gray-800 outline-none focus:border-gray-400 transition-colors"
                />
            </div>

            {error && <p className="text-sm text-red-500">{error}</p>}

            <button
                type="submit"
                disabled={loading}
                className="w-full py-2 bg-gray-800 text-white text-sm rounded-lg hover:bg-gray-700 disabled:opacity-50 transition-colors"
            >
                {loading ? 'Creating account...' : 'Create account'}
            </button>

            <p className="text-sm text-gray-500 text-center">
                Already have an account?{' '}
                <Link href="/auth/login" className="text-gray-800 underline">
                    Sign in
                </Link>
            </p>
        </form>
    )
}
