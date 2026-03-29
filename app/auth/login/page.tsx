import LoginForm from '@/app/_components/LoginForm'

export default function LoginPage() {
    return (
        <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
            <div className="w-full max-w-md">
                <h1 className="text-2xl font-medium text-gray-800 mb-6 text-center">
                    Sign in
                </h1>
                <LoginForm />
            </div>
        </div>
    )
}