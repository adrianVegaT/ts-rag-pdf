import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import RAGBox from './_components/RAGBox'
import { getMessageHistory, getTokensUsed, getUserDocuments } from './_actions/query'

export default async function Home() {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) {
        redirect('/auth/login')
    }

    const tokensUsed = await getTokensUsed()
    const userDocuments = await getUserDocuments()
    const history = await getMessageHistory()

    return (
        <div className="min-h-screen bg-gray-50 flex flex-col items-center justify-center p-4">
            <div className="w-full max-w-2xl">
                <div className="flex justify-between items-center mb-6">
                    <div>
                        <h1 className="text-2xl font-medium text-gray-800">PDF Chat</h1>
                        <p className="text-sm text-gray-500 mt-1">
                            Upload a PDF and ask questions about it
                        </p>
                    </div>
                    <form action="/auth/logout" method="POST">
                        <button
                            type="submit"
                            className="text-sm text-gray-600 border border-gray-300 px-3 py-1.5 rounded-lg hover:bg-gray-100 hover:border-gray-400 transition-colors cursor-pointer"
                        >
                            Sign out
                        </button>
                    </form>
                </div>

                <div className="mb-4 p-4 bg-blue-50 border border-blue-100 rounded-xl text-sm text-blue-700">
                    <p className="font-medium mb-1">Demo account</p>
                    <p>
                        Upload a PDF and ask questions about its content.
                        This demo is limited to <span className="font-medium">{parseInt(process.env.NEXT_PUBLIC_TOKEN_LIMIT || '15000')} tokens</span> per account.
                    </p>
                </div>

                <RAGBox
                    initialTokensUsed={tokensUsed}
                    userDocuments={userDocuments}
                    history={history}
                />
            </div>
        </div>
    )
}