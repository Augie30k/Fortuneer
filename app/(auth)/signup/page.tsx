'use client'

import { createClient } from '@/lib/supabase-client'
import { useRouter } from 'next/navigation'
import { useState } from 'react'

export default function SignupPage() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [success, setSuccess] = useState(false)
  const router = useRouter()
  const supabase = createClient()

  const handleSignup = async () => {
    setLoading(true)
    setError(null)
    const { error } = await supabase.auth.signUp({ email, password })
    if (error) {
      setError(error.message)
      setLoading(false)
      return
    }
    setSuccess(true)
    setLoading(false)
  }

  if (success) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#07071A]">
        <div className="w-full max-w-md p-8 rounded-2xl border border-white/10 bg-[#0D0B28] text-center">
          <h1 className="text-3xl font-bold text-[#EEE8F5] mb-2">Check your email</h1>
          <p className="text-[#8B8BA8]">We sent a confirmation link to <span className="text-[#FCD34D]">{email}</span></p>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-[#07071A]">
      <div className="w-full max-w-md p-8 rounded-2xl border border-white/10 bg-[#0D0B28]">
        <h1 className="text-3xl font-bold text-[#EEE8F5] mb-2">Create account</h1>
        <p className="text-[#8B8BA8] mb-8">Start your journey to financial freedom</p>

        {error && <p className="text-red-400 text-sm mb-4">{error}</p>}

        <div className="space-y-4">
          <input
            type="email"
            placeholder="Email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="w-full px-4 py-3 rounded-lg bg-[#12103A] border border-white/10 text-[#EEE8F5] placeholder-[#8B8BA8] focus:outline-none focus:border-[#6D28D9]"
          />
          <input
            type="password"
            placeholder="Password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="w-full px-4 py-3 rounded-lg bg-[#12103A] border border-white/10 text-[#EEE8F5] placeholder-[#8B8BA8] focus:outline-none focus:border-[#6D28D9]"
          />
          <button
            onClick={handleSignup}
            disabled={loading}
            className="w-full py-3 rounded-lg bg-[#FCD34D] text-[#07071A] font-bold hover:bg-[#D97706] transition-colors disabled:opacity-50"
          >
            {loading ? 'Creating account...' : 'Create Account'}
          </button>
        </div>

        <p className="text-[#8B8BA8] text-sm mt-6 text-center">
          Already have an account?{' '}
          <a href="/login" className="text-[#A78BFA] hover:underline">Sign in</a>
        </p>
      </div>
    </div>
  )
}