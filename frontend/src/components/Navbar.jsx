import { Link, useNavigate } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'
import { LogOut, Settings, User, FileText } from 'lucide-react'

const Navbar = () => {
  const { user, logout } = useAuth()
  const navigate = useNavigate()

  const handleLogout = () => {
    logout()
    navigate('/login')
  }

  if (!user) {
    return null
  }

  return (
    <nav className="bg-white shadow-lg border-b">
      <div className="container mx-auto px-4">
        <div className="flex justify-between h-16">
          <div className="flex items-center">
            <Link to="/" className="flex items-center space-x-2">
              <FileText className="h-8 w-8 text-blue-600" />
              <span className="text-xl font-bold text-gray-800">PPT Colorizer</span>
            </Link>
          </div>

          <div className="flex items-center space-x-4">
            <Link
              to="/"
              className="text-gray-600 hover:text-blue-600 px-3 py-2 rounded-md text-sm font-medium"
            >
              Dashboard
            </Link>
            <Link
              to="/jobs"
              className="text-gray-600 hover:text-blue-600 px-3 py-2 rounded-md text-sm font-medium"
            >
              Jobs
            </Link>
            {user.role === 'admin' && (
              <Link
                to="/admin"
                className="text-gray-600 hover:text-blue-600 px-3 py-2 rounded-md text-sm font-medium flex items-center space-x-1"
              >
                <Settings className="h-4 w-4" />
                <span>Admin</span>
              </Link>
            )}
            
            <div className="flex items-center space-x-2">
              <div className="flex items-center space-x-1 text-sm text-gray-600">
                <User className="h-4 w-4" />
                <span>{user.username}</span>
                {user.role === 'admin' && (
                  <span className="bg-blue-100 text-blue-800 px-2 py-1 rounded-full text-xs">
                    Admin
                  </span>
                )}
              </div>
              <button
                onClick={handleLogout}
                className="text-gray-600 hover:text-red-600 p-2 rounded-md"
                title="Logout"
              >
                <LogOut className="h-4 w-4" />
              </button>
            </div>
          </div>
        </div>
      </div>
    </nav>
  )
}

export default Navbar