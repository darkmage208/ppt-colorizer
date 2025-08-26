import { useState, useEffect } from 'react'
import { useForm } from 'react-hook-form'
import api from '../utils/api'
import toast from 'react-hot-toast'
import { Upload, FileText, Database, Trash2, Plus } from 'lucide-react'
import ConfirmDialog from '../components/ConfirmDialog'
import { useAuth } from '../contexts/AuthContext'

const AdminDashboard = () => {
  const { user } = useAuth()
  const [templates, setTemplates] = useState([])
  const [excelData, setExcelData] = useState([])
  const [users, setUsers] = useState([])
  const [loading, setLoading] = useState(true)
  const [activeTab, setActiveTab] = useState(user?.role === 'superadmin' ? 'templates' : 'users')
  const [showCreateUserModal, setShowCreateUserModal] = useState(false)
  const [newUserRole, setNewUserRole] = useState('user')
  const [templateUploadProgress, setTemplateUploadProgress] = useState(0)
  const [excelUploadProgress, setExcelUploadProgress] = useState(0)
  const [isTemplateUploading, setIsTemplateUploading] = useState(false)
  const [isExcelUploading, setIsExcelUploading] = useState(false)
  const [confirmDialog, setConfirmDialog] = useState({ 
    isOpen: false, 
    type: '', 
    item: null,
    title: '',
    message: ''
  })

  const { register: registerTemplate, handleSubmit: handleTemplateSubmit, reset: resetTemplate, formState: { errors: templateErrors } } = useForm()
  const { register: registerExcel, handleSubmit: handleExcelSubmit, reset: resetExcel, formState: { errors: excelErrors } } = useForm()
  const { register: registerUser, handleSubmit: handleUserSubmit, reset: resetUser, formState: { errors: userErrors } } = useForm()

  useEffect(() => {
    fetchData()
  }, [])

  const fetchData = async () => {
    try {
      const [templatesRes, excelRes, usersRes] = await Promise.all([
        api.get('/templates/'),
        api.get('/excel-data/'),
        api.get('/users/')
      ])
      
      setTemplates(templatesRes.data)
      setExcelData(excelRes.data)
      setUsers(usersRes.data)
    } catch (error) {
      toast.error('Failed to fetch data')
    } finally {
      setLoading(false)
    }
  }

  const handleTemplateUpload = async (data) => {
    const formData = new FormData()
    formData.append('file', data.file[0])

    setIsTemplateUploading(true)
    setTemplateUploadProgress(0)

    try {
      await api.post(`/templates/?name=${encodeURIComponent(data.name)}`, formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
        onUploadProgress: (progressEvent) => {
          const progress = Math.round((progressEvent.loaded * 100) / progressEvent.total)
          setTemplateUploadProgress(progress)
        }
      })
      toast.success('Template uploaded successfully')
      resetTemplate()
      fetchData()
    } catch (error) {
      const errorMessage = error.response?.data?.detail
      if (Array.isArray(errorMessage)) {
        toast.error(errorMessage.map(err => err.msg).join(', '))
      } else {
        toast.error(errorMessage || 'Failed to upload template')
      }
    } finally {
      setIsTemplateUploading(false)
      setTemplateUploadProgress(0)
    }
  }

  const handleExcelUpload = async (data) => {
    const formData = new FormData()
    formData.append('file', data.file[0])

    setIsExcelUploading(true)
    setExcelUploadProgress(0)

    try {
      await api.post(`/excel-data/?name=${encodeURIComponent(data.name)}`, formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
        onUploadProgress: (progressEvent) => {
          const progress = Math.round((progressEvent.loaded * 100) / progressEvent.total)
          setExcelUploadProgress(progress)
        }
      })
      toast.success('Excel data uploaded successfully')
      resetExcel()
      fetchData()
    } catch (error) {
      const errorMessage = error.response?.data?.detail
      if (Array.isArray(errorMessage)) {
        toast.error(errorMessage.map(err => err.msg).join(', '))
      } else {
        toast.error(errorMessage || 'Failed to upload Excel data')
      }
    } finally {
      setIsExcelUploading(false)
      setExcelUploadProgress(0)
    }
  }

  const openDeleteConfirm = (type, item) => {
    const isTemplate = type === 'template'
    setConfirmDialog({
      isOpen: true,
      type,
      item,
      title: `Delete ${isTemplate ? 'Template' : 'Excel Data'}`,
      message: `Are you sure you want to delete "${item.name}"? This action cannot be undone.`
    })
  }

  const closeDeleteConfirm = () => {
    setConfirmDialog({ isOpen: false, type: '', item: null, title: '', message: '' })
  }

  const handleDelete = async () => {
    const { type, item } = confirmDialog
    try {
      if (type === 'template') {
        await api.delete(`/templates/${item.id}`)
        toast.success('Template deleted')
      } else if (type === 'excel') {
        await api.delete(`/excel-data/${item.id}`)
        toast.success('Excel data deleted')
      }
      fetchData()
    } catch (error) {
      toast.error(`Failed to delete ${type === 'template' ? 'template' : 'Excel data'}`)
    }
  }

  const updateUserRole = async (userId, newRole) => {
    try {
      await api.put(`/users/${userId}`, { role: newRole })
      toast.success('User role updated')
      fetchData()
    } catch (error) {
      toast.error('Failed to update user role')
    }
  }

  const toggleUserStatus = async (userId, currentStatus) => {
    try {
      await api.put(`/users/${userId}`, { is_active: !currentStatus })
      toast.success(`User ${!currentStatus ? 'activated' : 'deactivated'} successfully`)
      fetchData()
    } catch (error) {
      toast.error('Failed to update user status')
    }
  }

  const handleCreateUser = async (data) => {
    try {
      const userData = {
        username: data.username,
        email: data.email,
        password: data.password
      }
      
      await api.post(`/users/?role=${newUserRole}`, userData)
      toast.success('User created successfully')
      resetUser()
      setShowCreateUserModal(false)
      setNewUserRole('user')
      fetchData()
    } catch (error) {
      const errorMessage = error.response?.data?.detail
      if (Array.isArray(errorMessage)) {
        toast.error(errorMessage.map(err => err.msg).join(', '))
      } else {
        toast.error(errorMessage || 'Failed to create user')
      }
    }
  }

  if (loading) {
    return (
      <div className="flex justify-center items-center min-h-96">
        <div className="relative">
          <div className="animate-spin rounded-full h-16 w-16 border-4 border-emerald-200 dark:border-emerald-800"></div>
          <div className="animate-spin rounded-full h-16 w-16 border-4 border-emerald-600 dark:border-emerald-400 border-t-transparent absolute top-0 left-0"></div>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-6 p-6 bg-gradient-to-br from-gray-50 via-emerald-50/30 to-teal-50/30 dark:from-dark-bg dark:via-dark-bg dark:to-dark-bg min-h-screen">
      <div className="bg-white/80 dark:bg-dark-card backdrop-blur-sm shadow-xl rounded-2xl border border-white/20 dark:border-dark-border">
        <div className="px-6 lg:px-8 py-6 border-b border-gray-100/50 dark:border-dark-border">
          <h1 className="text-2xl lg:text-3xl font-bold text-gray-900 dark:text-dark-text">Admin Dashboard</h1>
          <p className="text-gray-600 dark:text-dark-muted mt-1">Manage templates, Excel data, and users</p>
        </div>

        <div className="border-b border-gray-200 dark:border-dark-border">
          <nav className="flex space-x-8 px-6">
            {user?.role === 'superadmin' && ['templates', 'excel-data', 'users'].map((tab) => (
              <button
                key={tab}
                onClick={() => setActiveTab(tab)}
                className={`py-4 px-1 border-b-2 font-medium text-sm ${
                  activeTab === tab
                    ? 'border-emerald-500 text-emerald-600 dark:border-emerald-400 dark:text-emerald-400'
                    : 'border-transparent text-gray-500 dark:text-dark-muted hover:text-gray-700 dark:hover:text-dark-text'
                }`}
              >
                {tab.charAt(0).toUpperCase() + tab.slice(1).replace('-', ' ')}
              </button>
            ))}
            {user?.role === 'admin' && ['users'].map((tab) => (
              <button
                key={tab}
                onClick={() => setActiveTab(tab)}
                className={`py-4 px-1 border-b-2 font-medium text-sm ${
                  activeTab === tab
                    ? 'border-emerald-500 text-emerald-600 dark:border-emerald-400 dark:text-emerald-400'
                    : 'border-transparent text-gray-500 dark:text-dark-muted hover:text-gray-700 dark:hover:text-dark-text'
                }`}
              >
                {tab.charAt(0).toUpperCase() + tab.slice(1).replace('-', ' ')}
              </button>
            ))}
          </nav>
        </div>

        <div className="p-6">
          {activeTab === 'templates' && user?.role === 'superadmin' && (
            <div className="space-y-6">
              <div className="bg-gray-50 dark:bg-dark-hover p-4 rounded-lg">
                <h3 className="text-lg font-medium text-gray-900 dark:text-dark-text mb-4 flex items-center">
                  <Plus className="h-5 w-5 mr-2" />
                  Upload New Template
                </h3>
                <form onSubmit={handleTemplateSubmit(handleTemplateUpload)} className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-dark-text">Template Name</label>
                    <input
                      {...registerTemplate('name', { required: 'Template name is required' })}
                      type="text"
                      className="mt-1 block w-full border border-gray-300 dark:border-dark-border rounded-md px-3 py-2 bg-white dark:bg-dark-bg text-gray-900 dark:text-dark-text focus:ring-emerald-500 focus:border-emerald-500 dark:focus:ring-emerald-400 dark:focus:border-emerald-400"
                      placeholder="Enter template name"
                    />
                    {templateErrors.name && (
                      <p className="mt-1 text-sm text-red-600">{templateErrors.name.message}</p>
                    )}
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-dark-text">PowerPoint File</label>
                    <input
                      {...registerTemplate('file', { 
                        required: 'Please select a PowerPoint file',
                        validate: {
                          fileType: (files) => {
                            if (files?.[0]?.name && !files[0].name.endsWith('.pptx')) {
                              return 'Only .pptx files are allowed'
                            }
                            return true
                          }
                        }
                      })}
                      type="file"
                      accept=".pptx"
                      className="mt-1 block w-full border border-gray-300 dark:border-dark-border rounded-md px-3 py-2 bg-white dark:bg-dark-bg text-gray-900 dark:text-dark-text focus:ring-emerald-500 focus:border-emerald-500 dark:focus:ring-emerald-400 dark:focus:border-emerald-400"
                    />
                    {templateErrors.file && (
                      <p className="mt-1 text-sm text-red-600">{templateErrors.file.message}</p>
                    )}
                  </div>
                  
                  {isTemplateUploading && (
                    <div className="space-y-2">
                      <div className="flex justify-between items-center">
                        <span className="text-sm font-medium text-gray-700 dark:text-dark-text">Uploading...</span>
                        <span className="text-sm text-gray-500 dark:text-dark-muted">{templateUploadProgress}%</span>
                      </div>
                      <div className="w-full bg-gray-200 dark:bg-dark-border rounded-full h-2">
                        <div 
                          className="bg-emerald-600 dark:bg-emerald-400 h-2 rounded-full transition-all duration-300"
                          style={{ width: `${templateUploadProgress}%` }}
                        ></div>
                      </div>
                    </div>
                  )}
                  
                  <button
                    type="submit"
                    disabled={isTemplateUploading}
                    className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md text-white bg-emerald-600 hover:bg-emerald-700 dark:bg-emerald-700 dark:hover:bg-emerald-800 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    <Upload className="h-4 w-4 mr-2" />
                    {isTemplateUploading ? 'Uploading...' : 'Upload Template'}
                  </button>
                </form>
              </div>

              <div>
                <h3 className="text-lg font-medium text-gray-900 dark:text-dark-text mb-4">Existing Templates</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {templates.map((template) => (
                    <div key={template.id} className="bg-white dark:bg-dark-card border border-gray-200 dark:border-dark-border rounded-lg p-4">
                      <div className="flex items-start justify-between">
                        <div className="flex items-center">
                          <FileText className="h-8 w-8 text-blue-500 mr-3" />
                          <div>
                            <h4 className="text-lg font-medium text-gray-900 dark:text-dark-text">{template.name}</h4>
                            <p className="text-sm text-gray-500 dark:text-dark-muted">Version {template.version}</p>
                            <p className="text-sm text-gray-500 dark:text-dark-muted">{template.filename}</p>
                          </div>
                        </div>
                        <button
                          onClick={() => openDeleteConfirm('template', template)}
                          className="text-red-600 dark:text-red-400 hover:text-red-800 dark:hover:text-red-300 p-1 rounded hover:bg-red-50 dark:hover:bg-red-900/10 transition-colors"
                          title="Delete Template"
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

          {activeTab === 'excel-data' && user?.role === 'superadmin' && (
            <div className="space-y-6">
              <div className="bg-gray-50 dark:bg-dark-hover p-4 rounded-lg">
                <h3 className="text-lg font-medium text-gray-900 dark:text-dark-text mb-4 flex items-center">
                  <Plus className="h-5 w-5 mr-2" />
                  Upload New Excel Data
                </h3>
                <form onSubmit={handleExcelSubmit(handleExcelUpload)} className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-dark-text">Patient Name</label>
                    <input
                      {...registerExcel('name', { required: 'Patient name is required' })}
                      type="text"
                      className="mt-1 block w-full border border-gray-300 dark:border-dark-border rounded-md px-3 py-2 bg-white dark:bg-dark-bg text-gray-900 dark:text-dark-text focus:ring-emerald-500 focus:border-emerald-500 dark:focus:ring-emerald-400 dark:focus:border-emerald-400"
                      placeholder="Enter patient name (e.g., John Doe)"
                    />
                    {excelErrors.name && (
                      <p className="mt-1 text-sm text-red-600">{excelErrors.name.message}</p>
                    )}
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-dark-text">Excel File</label>
                    <input
                      {...registerExcel('file', { 
                        required: 'Please select an Excel file',
                        validate: {
                          fileType: (files) => {
                            if (files?.[0]?.name) {
                              const fileName = files[0].name.toLowerCase()
                              if (!fileName.endsWith('.xlsx') && !fileName.endsWith('.xls')) {
                                return 'Only .xlsx and .xls files are allowed'
                              }
                            }
                            return true
                          }
                        }
                      })}
                      type="file"
                      accept=".xlsx,.xls"
                      className="mt-1 block w-full border border-gray-300 dark:border-dark-border rounded-md px-3 py-2 bg-white dark:bg-dark-bg text-gray-900 dark:text-dark-text focus:ring-emerald-500 focus:border-emerald-500 dark:focus:ring-emerald-400 dark:focus:border-emerald-400"
                    />
                    {excelErrors.file && (
                      <p className="mt-1 text-sm text-red-600">{excelErrors.file.message}</p>
                    )}
                  </div>
                  
                  {isExcelUploading && (
                    <div className="space-y-2">
                      <div className="flex justify-between items-center">
                        <span className="text-sm font-medium text-gray-700 dark:text-dark-text">Uploading...</span>
                        <span className="text-sm text-gray-500 dark:text-dark-muted">{excelUploadProgress}%</span>
                      </div>
                      <div className="w-full bg-gray-200 dark:bg-dark-border rounded-full h-2">
                        <div 
                          className="bg-emerald-600 dark:bg-emerald-400 h-2 rounded-full transition-all duration-300"
                          style={{ width: `${excelUploadProgress}%` }}
                        ></div>
                      </div>
                    </div>
                  )}
                  
                  <button
                    type="submit"
                    disabled={isExcelUploading}
                    className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md text-white bg-emerald-600 hover:bg-emerald-700 dark:bg-emerald-700 dark:hover:bg-emerald-800 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    <Upload className="h-4 w-4 mr-2" />
                    {isExcelUploading ? 'Uploading...' : 'Upload Excel Data'}
                  </button>
                </form>
              </div>

              <div>
                <h3 className="text-lg font-medium text-gray-900 dark:text-dark-text mb-4">Existing Excel Data</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {excelData.map((data) => (
                    <div key={data.id} className="bg-white dark:bg-dark-card border border-gray-200 dark:border-dark-border rounded-lg p-4">
                      <div className="flex items-start justify-between">
                        <div className="flex items-center">
                          <Database className="h-8 w-8 text-emerald-500 dark:text-emerald-400 mr-3" />
                          <div>
                            <h4 className="text-lg font-medium text-gray-900 dark:text-dark-text">{data.name}</h4>
                            <p className="text-sm text-gray-500 dark:text-dark-muted">Version {data.version}</p>
                            <p className="text-sm text-gray-500 dark:text-dark-muted">{data.filename}</p>
                          </div>
                        </div>
                        <button
                          onClick={() => openDeleteConfirm('excel', data)}
                          className="text-red-600 dark:text-red-400 hover:text-red-800 dark:hover:text-red-300 p-1 rounded hover:bg-red-50 dark:hover:bg-red-900/10 transition-colors"
                          title="Delete Excel Data"
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

          {activeTab === 'users' && (
            <div>
              <div className="flex justify-between items-center mb-4">
                <h3 className="text-lg font-medium text-gray-900 dark:text-dark-text">User Management</h3>
                <button
                  onClick={() => setShowCreateUserModal(true)}
                  className="inline-flex items-center px-4 py-2 bg-gradient-to-r from-emerald-500 to-teal-600 text-white text-sm font-medium rounded-xl shadow-md hover:shadow-lg transform hover:scale-105 transition-all duration-200"
                >
                  <Plus className="h-4 w-4 mr-2" />
                  Add User
                </button>
              </div>
              <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-gray-200 dark:divide-dark-border">
                  <thead className="bg-gray-50 dark:bg-dark-hover">
                    <tr>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-dark-muted uppercase tracking-wider">
                        User
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-dark-muted uppercase tracking-wider">
                        Email
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-dark-muted uppercase tracking-wider">
                        Role
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-dark-muted uppercase tracking-wider">
                        Status
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-dark-muted uppercase tracking-wider">
                        Actions
                      </th>
                    </tr>
                  </thead>
                  <tbody className="bg-white dark:bg-dark-card divide-y divide-gray-200 dark:divide-dark-border">
                    {users.map((tableUser) => (
                      <tr key={tableUser.id}>
                        <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900 dark:text-dark-text">
                          {tableUser.username}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-dark-muted">
                          {tableUser.email}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <select
                            value={tableUser.role}
                            onChange={(e) => updateUserRole(tableUser.id, e.target.value)}
                            disabled={tableUser.role === 'superadmin' && user?.role !== 'superadmin'}
                            className="text-sm border border-gray-200 dark:border-dark-border rounded-xl px-3 py-1 bg-white/50 dark:bg-dark-bg text-gray-900 dark:text-dark-text backdrop-blur-sm focus:ring-2 focus:ring-emerald-500 dark:focus:ring-emerald-400 focus:border-transparent transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed"
                          >
                            <option value="user">User</option>
                            <option value="admin">Admin</option>
                            {user?.role === 'superadmin' && <option value="superadmin">Superadmin</option>}
                          </select>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <span className={`inline-flex px-2 text-xs font-semibold rounded-full ${
                            tableUser.is_active
                              ? 'bg-green-100 text-green-800 dark:bg-green-900/20 dark:text-green-400'
                              : 'bg-red-100 text-red-800 dark:bg-red-900/20 dark:text-red-400'
                          }`}>
                            {tableUser.is_active ? 'Active' : 'Inactive'}
                          </span>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                          <button
                            onClick={() => toggleUserStatus(tableUser.id, tableUser.is_active)}
                            disabled={tableUser.role === 'superadmin' && user?.role !== 'superadmin'}
                            className={`inline-flex items-center px-3 py-1 rounded-xl text-xs font-medium border transition-all duration-200 hover:scale-105 disabled:opacity-50 disabled:cursor-not-allowed ${
                              tableUser.is_active 
                                ? "text-red-700 dark:text-red-400 border-red-200 dark:border-red-800 bg-red-50 dark:bg-red-900/10 hover:bg-red-100 dark:hover:bg-red-900/20 hover:border-red-300 dark:hover:border-red-600" 
                                : "text-green-700 dark:text-green-400 border-green-200 dark:border-green-800 bg-green-50 dark:bg-green-900/10 hover:bg-green-100 dark:hover:bg-green-900/20 hover:border-green-300 dark:hover:border-green-600"
                            }`}
                          >
                            {tableUser.is_active ? 'Deactivate' : 'Activate'}
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Professional Confirm Dialog */}
      <ConfirmDialog
        isOpen={confirmDialog.isOpen}
        onClose={closeDeleteConfirm}
        onConfirm={handleDelete}
        title={confirmDialog.title}
        message={
          confirmDialog.item ? (
            <div className="space-y-2">
              <p>{confirmDialog.message}</p>
              <div className="bg-gray-50 dark:bg-dark-hover rounded-lg p-3 mt-3">
                <div className="text-sm text-gray-700 dark:text-dark-text">
                  <p><span className="font-medium">Name:</span> {confirmDialog.item.name}</p>
                  <p><span className="font-medium">Version:</span> {confirmDialog.item.version}</p>
                  <p><span className="font-medium">Filename:</span> {confirmDialog.item.filename}</p>
                  <p><span className="font-medium">ID:</span> #{confirmDialog.item.id}</p>
                </div>
              </div>
            </div>
          ) : confirmDialog.message
        }
        confirmText={`Delete ${confirmDialog.type === 'template' ? 'Template' : 'Excel Data'}`}
        cancelText="Cancel"
        type="danger"
      />

      {/* Create User Modal */}
      {showCreateUserModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white dark:bg-dark-card rounded-2xl shadow-2xl max-w-md w-full mx-4">
            <div className="px-6 py-4 border-b border-gray-200 dark:border-dark-border">
              <h3 className="text-lg font-semibold text-gray-900 dark:text-dark-text">Create New User</h3>
            </div>
            <form onSubmit={handleUserSubmit(handleCreateUser)} className="p-6 space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-dark-text mb-2">
                  Username
                </label>
                <input
                  {...registerUser('username', { required: 'Username is required' })}
                  type="text"
                  className="w-full border border-gray-300 dark:border-dark-border rounded-md px-3 py-2 bg-white dark:bg-dark-bg text-gray-900 dark:text-dark-text focus:ring-emerald-500 focus:border-emerald-500"
                  placeholder="Enter username"
                />
                {userErrors.username && (
                  <p className="mt-1 text-sm text-red-600">{userErrors.username.message}</p>
                )}
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-dark-text mb-2">
                  Email
                </label>
                <input
                  {...registerUser('email', { 
                    required: 'Email is required',
                    pattern: {
                      value: /^[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}$/i,
                      message: 'Invalid email address'
                    }
                  })}
                  type="email"
                  className="w-full border border-gray-300 dark:border-dark-border rounded-md px-3 py-2 bg-white dark:bg-dark-bg text-gray-900 dark:text-dark-text focus:ring-emerald-500 focus:border-emerald-500"
                  placeholder="Enter email"
                />
                {userErrors.email && (
                  <p className="mt-1 text-sm text-red-600">{userErrors.email.message}</p>
                )}
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-dark-text mb-2">
                  Password
                </label>
                <input
                  {...registerUser('password', { 
                    required: 'Password is required',
                    minLength: {
                      value: 6,
                      message: 'Password must be at least 6 characters'
                    }
                  })}
                  type="password"
                  className="w-full border border-gray-300 dark:border-dark-border rounded-md px-3 py-2 bg-white dark:bg-dark-bg text-gray-900 dark:text-dark-text focus:ring-emerald-500 focus:border-emerald-500"
                  placeholder="Enter password"
                />
                {userErrors.password && (
                  <p className="mt-1 text-sm text-red-600">{userErrors.password.message}</p>
                )}
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-dark-text mb-2">
                  Role
                </label>
                <select
                  value={newUserRole}
                  onChange={(e) => setNewUserRole(e.target.value)}
                  className="w-full border border-gray-300 dark:border-dark-border rounded-md px-3 py-2 bg-white dark:bg-dark-bg text-gray-900 dark:text-dark-text focus:ring-emerald-500 focus:border-emerald-500"
                >
                  <option value="user">User</option>
                  {user?.role === 'superadmin' && <option value="admin">Admin</option>}
                  {user?.role === 'superadmin' && <option value="superadmin">Superadmin</option>}
                </select>
              </div>
              
              <div className="flex justify-end space-x-3 pt-4">
                <button
                  type="button"
                  onClick={() => {
                    setShowCreateUserModal(false)
                    resetUser()
                    setNewUserRole('user')
                  }}
                  className="px-4 py-2 text-sm font-medium text-gray-700 dark:text-dark-text bg-gray-100 dark:bg-dark-hover hover:bg-gray-200 dark:hover:bg-dark-border rounded-lg transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 text-sm font-medium text-white bg-emerald-600 hover:bg-emerald-700 rounded-lg transition-colors"
                >
                  Create User
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}

export default AdminDashboard