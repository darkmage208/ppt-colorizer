import { useState, useEffect } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useForm } from 'react-hook-form'
import { useAuth } from '../contexts/AuthContext'
import { LogIn, FileText, Sparkles, Zap, Palette } from 'lucide-react'

const Login = () => {
  const [isLoading, setIsLoading] = useState(false)
  const { register, handleSubmit, formState: { errors } } = useForm()
  const { login, user, loading } = useAuth()
  const navigate = useNavigate()

  useEffect(() => {
    if (user && !loading) {
      navigate('/', { replace: true })
    }
  }, [user, loading, navigate])

  const onSubmit = async (data) => {
    setIsLoading(true)
    const success = await login(data.email, data.password)
    if (success) {
      navigate('/', { replace: true })
    }
    setIsLoading(false)
  }

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center dark:bg-dark-bg bg-gradient-to-br from-blue-50 via-indigo-50 to-purple-50">
        <div className="relative">
          <div className="animate-spin rounded-full h-32 w-32 border-4 border-blue-200 dark:border-emerald-800"></div>
          <div className="animate-spin rounded-full h-32 w-32 border-4 border-blue-600 dark:border-emerald-500 border-t-transparent absolute top-0 left-0"></div>
        </div>
      </div>
    )
  }

  if (user) {
    return null
  }

  return (
    <div className="min-h-screen flex">
      {/* Left side - Branding */}
      <div className="hidden lg:flex lg:w-1/2 bg-gradient-to-br from-emerald-900 via-teal-800 to-cyan-900 relative overflow-hidden">
        <div className="absolute inset-0 bg-black/30"></div>
        <div className="absolute inset-0">
          <div className="absolute top-20 left-20 w-72 h-72 bg-emerald-500/10 rounded-full blur-3xl"></div>
          <div className="absolute bottom-20 right-20 w-96 h-96 bg-teal-500/10 rounded-full blur-3xl"></div>
          <div className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 w-64 h-64 bg-cyan-400/10 rounded-full blur-2xl"></div>
        </div>
        
        <div className="relative z-10 flex flex-col justify-center px-20 text-white">
          <div className="flex items-center mb-8">
            <img src="/logo.png" alt="gabo logo" className="h-16" />
          </div>
          
          <h2 className="text-4xl font-bold leading-tight mb-6">
            Transform Your
            <span className="block text-transparent bg-clip-text bg-gradient-to-r from-emerald-300 to-teal-300">
              Presentations
            </span>
          </h2>
          
          <p className="text-xl text-emerald-100 mb-8 leading-relaxed">
            Automatically apply intelligent color schemes to your PowerPoint presentations 
            based on Excel data and genetic analysis.
          </p>
          
          <div className="space-y-4">
            <div className="flex items-center">
              <div className="p-2 bg-white/20 rounded-lg mr-4">
                <Zap className="h-5 w-5" />
              </div>
              <span className="text-emerald-100">Automated Processing</span>
            </div>
            <div className="flex items-center">
              <div className="p-2 bg-white/20 rounded-lg mr-4">
                <Sparkles className="h-5 w-5" />
              </div>
              <span className="text-emerald-100">Smart Color Mapping</span>
            </div>
            <div className="flex items-center">
              <div className="p-2 bg-white/20 rounded-lg mr-4">
                <FileText className="h-5 w-5" />
              </div>
              <span className="text-emerald-100">Multiple Export Formats</span>
            </div>
          </div>
        </div>
      </div>

      {/* Right side - Login Form */}
      <div className="w-full lg:w-1/2 flex items-center justify-center px-6 py-12 bg-white dark:bg-dark-bg">
        <div className="max-w-md w-full space-y-8">
          {/* Mobile logo */}
          <div className="lg:hidden flex justify-center">
            <img src="/logo.png" alt="gabo logo" className="h-14" />
          </div>

          <div className="text-center">
            <h2 className="text-3xl font-bold text-gray-900 dark:text-dark-text mb-2">Welcome back</h2>
            <p className="text-gray-600 dark:text-dark-muted">
              Don't have an account?{' '}
              <Link
                to="/register"
                className="font-semibold text-blue-600 dark:text-emerald-500 hover:text-blue-500 dark:hover:text-emerald-400 transition-colors"
              >
                Sign up
              </Link>
            </p>
          </div>

          <form className="space-y-6" onSubmit={handleSubmit(onSubmit)}>
            <div className="space-y-4">
              <div>
                <label htmlFor="email" className="block text-sm font-medium text-gray-700 dark:text-dark-muted mb-2">
                  Email address
                </label>
                <input
                  {...register('email', { 
                    required: 'Email is required',
                    pattern: {
                      value: /^[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}$/i,
                      message: 'Invalid email address'
                    }
                  })}
                  type="email"
                  className="w-full px-4 py-3 border border-gray-300 dark:border-dark-border dark:bg-dark-card dark:text-dark-text rounded-xl focus:ring-2 focus:ring-blue-500 dark:focus:ring-emerald-500 focus:border-transparent transition-all duration-200 placeholder-gray-400 dark:placeholder-dark-muted"
                  placeholder="Enter your email"
                />
                {errors.email && (
                  <p className="mt-2 text-sm text-red-600 flex items-center">
                    <span className="mr-1">⚠</span>
                    {errors.email.message}
                  </p>
                )}
              </div>

              <div>
                <label htmlFor="password" className="block text-sm font-medium text-gray-700 dark:text-dark-muted mb-2">
                  Password
                </label>
                <input
                  {...register('password', { required: 'Password is required' })}
                  type="password"
                  className="w-full px-4 py-3 border border-gray-300 dark:border-dark-border dark:bg-dark-card dark:text-dark-text rounded-xl focus:ring-2 focus:ring-blue-500 dark:focus:ring-emerald-500 focus:border-transparent transition-all duration-200 placeholder-gray-400 dark:placeholder-dark-muted"
                  placeholder="Enter your password"
                />
                {errors.password && (
                  <p className="mt-2 text-sm text-red-600 flex items-center">
                    <span className="mr-1">⚠</span>
                    {errors.password.message}
                  </p>
                )}
              </div>
            </div>

            <button
              type="submit"
              disabled={isLoading}
              className="w-full relative bg-gradient-to-r from-emerald-600 to-teal-600 text-white py-3 px-6 rounded-xl font-semibold shadow-lg hover:shadow-xl dark:shadow-emerald-500/20 transform hover:scale-[1.02] transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed disabled:transform-none group"
            >
              <span className="flex items-center justify-center">
                {isLoading ? (
                  <>
                    <div className="animate-spin rounded-full h-5 w-5 border-2 border-white border-t-transparent mr-3"></div>
                    Signing in...
                  </>
                ) : (
                  <>
                    <LogIn className="h-5 w-5 mr-3 group-hover:translate-x-1 transition-transform" />
                    Sign in
                  </>
                )}
              </span>
            </button>
          </form>
        </div>
      </div>
    </div>
  )
}

export default Login