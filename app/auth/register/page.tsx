import RegisterForm from '@/app/_components/RegisterForm'

export default function RegisterPage() {
    return (
        <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
            <div className="w-full max-w-md">
                <h1 className="text-2xl font-medium text-gray-800 mb-6 text-center">
                    Create account
                </h1>
                <RegisterForm />
            </div>
        </div>
    )
}