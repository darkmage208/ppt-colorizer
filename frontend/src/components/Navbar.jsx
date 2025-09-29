import { Link, useNavigate, useLocation } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'
import { LogOut, Settings, User, LayoutDashboard, Briefcase, Menu, X, FileText, RefreshCw } from 'lucide-react'
import { useState } from 'react'

const Navbar = () => {
  const { user, logout } = useAuth()
  const navigate = useNavigate()
  const location = useLocation()
  const [isMenuOpen, setIsMenuOpen] = useState(false)

  const handleLogout = () => {
    logout()
    navigate('/login')
  }

  const isActiveRoute = (path) => location.pathname === path

  const toggleMenu = () => setIsMenuOpen(!isMenuOpen)

  if (!user) {
    return null
  }

  return (
    <nav className="dark:bg-dark-card/90 bg-white/80 backdrop-blur-md shadow-lg border-b dark:border-dark-border border-gray-200/50 sticky top-0 z-50">
      <div className="container mx-auto px-4 sm:px-6">
        <div className="flex justify-between items-center h-16">
          {/* Logo */}
          <div className="flex items-center">
            <Link to="/" className="flex items-center space-x-3 group">
              <img src="/logo.png" alt="gabo logo" className="h-10 sm:h-14" />
            </Link>
          </div>

          {/* Desktop Navigation */}
          <div className="hidden lg:flex items-center space-x-2">
            <Link
              to="/"
              className={`flex items-center space-x-2 px-4 py-2 rounded-xl text-sm font-medium transition-all duration-200 ${
                isActiveRoute('/') 
                  ? 'bg-gradient-to-r from-emerald-500 to-teal-600 text-white shadow-md dark:shadow-emerald-500/20' 
                  : 'text-gray-600 dark:text-dark-muted hover:bg-blue-50 dark:hover:bg-dark-hover hover:text-blue-600 dark:hover:text-emerald-400'
              }`}
            >
              <LayoutDashboard className="h-4 w-4" />
              <span>Dashboard</span>
            </Link>
            
            <Link
              to="/jobs"
              className={`flex items-center space-x-2 px-4 py-2 rounded-xl text-sm font-medium transition-all duration-200 ${
                isActiveRoute('/jobs') 
                  ? 'bg-gradient-to-r from-emerald-500 to-teal-600 text-white shadow-md dark:shadow-emerald-500/20' 
                  : 'text-gray-600 dark:text-dark-muted hover:bg-blue-50 dark:hover:bg-dark-hover hover:text-blue-600 dark:hover:text-emerald-400'
              }`}
            >
              <Briefcase className="h-4 w-4" />
              <span>Jobs</span>
            </Link>
            
            {(user.role === 'admin' || user.role === 'superadmin') && (
              <Link
                to="/admin"
                className={`flex items-center space-x-2 px-4 py-2 rounded-xl text-sm font-medium transition-all duration-200 ${
                  isActiveRoute('/admin')
                    ? 'bg-gradient-to-r from-violet-500 to-purple-600 text-white shadow-md dark:shadow-violet-500/20'
                    : 'text-gray-600 dark:text-dark-muted hover:bg-purple-50 dark:hover:bg-dark-hover hover:text-purple-600 dark:hover:text-violet-400'
                }`}
              >
                <Settings className="h-4 w-4" />
                <span>Admin</span>
              </Link>
            )}

            {user.role === 'superadmin' && (
              <>
                <Link
                  to="/vcf"
                  className={`flex items-center space-x-2 px-4 py-2 rounded-xl text-sm font-medium transition-all duration-200 ${
                    isActiveRoute('/vcf')
                      ? 'bg-gradient-to-r from-red-500 to-pink-600 text-white shadow-md dark:shadow-red-500/20'
                      : 'text-gray-600 dark:text-dark-muted hover:bg-red-50 dark:hover:bg-dark-hover hover:text-red-600 dark:hover:text-red-400'
                  }`}
                >
                  <FileText className="h-4 w-4" />
                  <span>VCF Manager</span>
                </Link>
                <Link
                  to="/conversion"
                  className={`flex items-center space-x-2 px-4 py-2 rounded-xl text-sm font-medium transition-all duration-200 ${
                    isActiveRoute('/conversion')
                      ? 'bg-gradient-to-r from-orange-500 to-amber-600 text-white shadow-md dark:shadow-orange-500/20'
                      : 'text-gray-600 dark:text-dark-muted hover:bg-orange-50 dark:hover:bg-dark-hover hover:text-orange-600 dark:hover:text-orange-400'
                  }`}
                >
                  <RefreshCw className="h-4 w-4" />
                  <span>RSID Conversion</span>
                </Link>
              </>
            )}
            
            {/* User section for desktop */}
            <div className="flex items-center space-x-3 ml-4 pl-4 border-l border-gray-200 dark:border-dark-border">
              <div className="flex items-center space-x-2 bg-gradient-to-r from-gray-50 to-gray-100 dark:from-dark-hover dark:to-dark-border px-3 py-2 rounded-xl">
                <div className="p-1 bg-gradient-to-br from-emerald-500 to-teal-600 rounded-lg">
                  <User className="h-3 w-3 text-white" />
                </div>
                <span className="text-sm font-medium text-gray-700 dark:text-dark-text">{user.username}</span>
                {user.role === 'admin' && (
                  <span className="bg-gradient-to-r from-violet-500 to-purple-600 text-white px-2 py-1 rounded-lg text-xs font-semibold">
                    Admin
                  </span>
                )}
                {user.role === 'superadmin' && (
                  <span className="bg-gradient-to-r from-red-500 to-pink-600 text-white px-2 py-1 rounded-lg text-xs font-semibold">
                    Superadmin
                  </span>
                )}
              </div>
              
              <button
                onClick={handleLogout}
                className="p-2 text-gray-600 dark:text-dark-muted hover:text-red-600 dark:hover:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-xl transition-all duration-200 group"
                title="Logout"
              >
                <LogOut className="h-4 w-4 group-hover:translate-x-0.5 transition-transform" />
              </button>
            </div>
          </div>

          {/* Mobile menu button */}
          <div className="lg:hidden">
            <button
              onClick={toggleMenu}
              className="p-2 text-gray-600 dark:text-dark-muted hover:bg-gray-100 dark:hover:bg-dark-hover rounded-xl transition-all duration-200"
            >
              {isMenuOpen ? <X className="h-6 w-6" /> : <Menu className="h-6 w-6" />}
            </button>
          </div>
        </div>

        {/* Mobile Navigation Menu */}
        {isMenuOpen && (
          <div className="lg:hidden absolute left-0 right-0 top-16 bg-white dark:bg-dark-card border-b dark:border-dark-border shadow-lg">
            <div className="px-4 py-4 space-y-3">
              {/* User info for mobile */}
              <div className="flex items-center space-x-3 pb-3 border-b border-gray-200 dark:border-dark-border">
                <div className="p-2 bg-gradient-to-br from-emerald-500 to-teal-600 rounded-lg">
                  <User className="h-4 w-4 text-white" />
                </div>
                <div>
                  <div className="text-sm font-medium text-gray-700 dark:text-dark-text">{user.username}</div>
                  {user.role === 'admin' && (
                    <span className="bg-gradient-to-r from-violet-500 to-purple-600 text-white px-2 py-1 rounded text-xs font-semibold">
                      Admin
                    </span>
                  )}
                  {user.role === 'superadmin' && (
                    <span className="bg-gradient-to-r from-red-500 to-pink-600 text-white px-2 py-1 rounded text-xs font-semibold">
                      Superadmin
                    </span>
                  )}
                </div>
              </div>

              {/* Mobile navigation links */}
              <Link
                to="/"
                onClick={() => setIsMenuOpen(false)}
                className={`flex items-center space-x-3 px-4 py-3 rounded-xl text-base font-medium transition-all duration-200 ${
                  isActiveRoute('/') 
                    ? 'bg-gradient-to-r from-emerald-500 to-teal-600 text-white shadow-md' 
                    : 'text-gray-600 dark:text-dark-muted hover:bg-gray-50 dark:hover:bg-dark-hover'
                }`}
              >
                <LayoutDashboard className="h-5 w-5" />
                <span>Dashboard</span>
              </Link>
              
              <Link
                to="/jobs"
                onClick={() => setIsMenuOpen(false)}
                className={`flex items-center space-x-3 px-4 py-3 rounded-xl text-base font-medium transition-all duration-200 ${
                  isActiveRoute('/jobs') 
                    ? 'bg-gradient-to-r from-emerald-500 to-teal-600 text-white shadow-md' 
                    : 'text-gray-600 dark:text-dark-muted hover:bg-gray-50 dark:hover:bg-dark-hover'
                }`}
              >
                <Briefcase className="h-5 w-5" />
                <span>Jobs</span>
              </Link>
              
              {(user.role === 'admin' || user.role === 'superadmin') && (
                <Link
                  to="/admin"
                  onClick={() => setIsMenuOpen(false)}
                  className={`flex items-center space-x-3 px-4 py-3 rounded-xl text-base font-medium transition-all duration-200 ${
                    isActiveRoute('/admin')
                      ? 'bg-gradient-to-r from-violet-500 to-purple-600 text-white shadow-md'
                      : 'text-gray-600 dark:text-dark-muted hover:bg-gray-50 dark:hover:bg-dark-hover'
                  }`}
                >
                  <Settings className="h-5 w-5" />
                  <span>Admin</span>
                </Link>
              )}

              {user.role === 'superadmin' && (
                <>
                  <Link
                    to="/vcf"
                    onClick={() => setIsMenuOpen(false)}
                    className={`flex items-center space-x-3 px-4 py-3 rounded-xl text-base font-medium transition-all duration-200 ${
                      isActiveRoute('/vcf')
                        ? 'bg-gradient-to-r from-red-500 to-pink-600 text-white shadow-md'
                        : 'text-gray-600 dark:text-dark-muted hover:bg-gray-50 dark:hover:bg-dark-hover'
                    }`}
                  >
                    <FileText className="h-5 w-5" />
                    <span>VCF Manager</span>
                  </Link>
                  <Link
                    to="/conversion"
                    onClick={() => setIsMenuOpen(false)}
                    className={`flex items-center space-x-3 px-4 py-3 rounded-xl text-base font-medium transition-all duration-200 ${
                      isActiveRoute('/conversion')
                        ? 'bg-gradient-to-r from-orange-500 to-amber-600 text-white shadow-md'
                        : 'text-gray-600 dark:text-dark-muted hover:bg-gray-50 dark:hover:bg-dark-hover'
                    }`}
                  >
                    <RefreshCw className="h-5 w-5" />
                    <span>RSID Conversion</span>
                  </Link>
                </>
              )}
              
              {/* Mobile logout button */}
              <button
                onClick={handleLogout}
                className="flex items-center space-x-3 px-4 py-3 rounded-xl text-base font-medium text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 transition-all duration-200 w-full text-left"
              >
                <LogOut className="h-5 w-5" />
                <span>Logout</span>
              </button>
            </div>
          </div>
        )}
      </div>
    </nav>
  )
}

export default Navbar