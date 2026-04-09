import { FormEvent, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../lib/auth'
import { authApi } from '../lib/api'
import Spinner from '../components/ui/Spinner'

export default function Login() {
  const { login } = useAuth()
  const navigate = useNavigate()
  const [tab, setTab] = useState<'login' | 'register'>('login')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [fullName, setFullName] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  const submit = async (e: FormEvent) => {
    e.preventDefault()
    setError('')
    setLoading(true)
    try {
      if (tab === 'register') {
        await authApi.register(email, password, fullName)
      }
      await login(email, password)
      navigate('/')
    } catch (err: any) {
      setError(err?.response?.data?.detail || 'Something went wrong. Please try again.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-indigo-50 flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        {/* Logo / header */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-14 h-14 bg-blue-600 rounded-2xl mb-4 shadow-lg">
            <span className="text-white text-2xl font-bold">Z</span>
          </div>
          <h1 className="text-2xl font-bold text-slate-800">Teacher-Z</h1>
          <p className="text-slate-500 text-sm mt-1">AI-Powered Lesson Generator</p>
        </div>

        <div className="card p-6">
          {/* Tabs */}
          <div className="flex border-b border-slate-200 mb-5 -mx-6 px-6">
            {(['login', 'register'] as const).map((t) => (
              <button
                key={t}
                className={`flex-1 pb-3 text-sm font-medium capitalize border-b-2 -mb-px transition-colors
                  ${tab === t ? 'border-blue-500 text-blue-600' : 'border-transparent text-slate-500'}`}
                onClick={() => { setTab(t); setError('') }}
              >
                {t === 'login' ? 'Sign In' : 'Create Account'}
              </button>
            ))}
          </div>

          <form onSubmit={submit} className="space-y-4">
            {tab === 'register' && (
              <div>
                <label className="label">Full Name</label>
                <input
                  className="input"
                  type="text"
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  placeholder="Ms. Johnson"
                />
              </div>
            )}
            <div>
              <label className="label">Email</label>
              <input
                className="input"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="teacher@school.edu"
                required
              />
            </div>
            <div>
              <label className="label">Password</label>
              <input
                className="input"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder={tab === 'register' ? 'At least 8 characters' : '••••••••'}
                required
                minLength={tab === 'register' ? 8 : undefined}
              />
            </div>

            {error && (
              <div className="bg-red-50 border border-red-200 rounded-lg px-3 py-2 text-sm text-red-700">
                {error}
              </div>
            )}

            <button type="submit" className="btn-primary w-full justify-center py-2.5" disabled={loading}>
              {loading && <Spinner size="sm" />}
              {tab === 'login' ? 'Sign In' : 'Create Account'}
            </button>
          </form>

          {/* Demo credentials hint */}
          <p className="text-xs text-slate-400 text-center mt-4">
            First time? Create an account to get started. No email verification required.
          </p>
        </div>
      </div>
    </div>
  )
}
