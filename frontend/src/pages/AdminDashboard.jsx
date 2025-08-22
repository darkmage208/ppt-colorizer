import { useState, useEffect } from 'react'
import { useForm } from 'react-hook-form'
import api from '../utils/api'
import toast from 'react-hot-toast'
import { Upload, FileText, Database, Trash2, Plus } from 'lucide-react'

const AdminDashboard = () => {
  const [templates, setTemplates] = useState([])
  const [excelData, setExcelData] = useState([])
  const [users, setUsers] = useState([])
  const [loading, setLoading] = useState(true)
  const [activeTab, setActiveTab] = useState('templates')
  const [templateUploadProgress, setTemplateUploadProgress] = useState(0)
  const [excelUploadProgress, setExcelUploadProgress] = useState(0)
  const [isTemplateUploading, setIsTemplateUploading] = useState(false)
  const [isExcelUploading, setIsExcelUploading] = useState(false)

  const { register: registerTemplate, handleSubmit: handleTemplateSubmit, reset: resetTemplate, formState: { errors: templateErrors } } = useForm()
  const { register: registerExcel, handleSubmit: handleExcelSubmit, reset: resetExcel, formState: { errors: excelErrors } } = useForm()

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

  const deleteTemplate = async (id) => {
    if (window.confirm('Are you sure you want to delete this template?')) {
      try {
        await api.delete(`/templates/${id}`)
        toast.success('Template deleted')
        fetchData()
      } catch (error) {
        toast.error('Failed to delete template')
      }
    }
  }

  const deleteExcelData = async (id) => {
    if (window.confirm('Are you sure you want to delete this Excel data?')) {
      try {
        await api.delete(`/excel-data/${id}`)
        toast.success('Excel data deleted')
        fetchData()
      } catch (error) {
        toast.error('Failed to delete Excel data')
      }
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

  if (loading) {
    return (
      <div className="flex justify-center items-center min-h-96">
        <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-blue-500"></div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div className="bg-white shadow rounded-lg">
        <div className="px-6 py-4 border-b border-gray-200">
          <h1 className="text-2xl font-bold text-gray-900">Admin Dashboard</h1>
          <p className="text-gray-600">Manage templates, Excel data, and users</p>
        </div>

        <div className="border-b border-gray-200">
          <nav className="flex space-x-8 px-6">
            {['templates', 'excel-data', 'users'].map((tab) => (
              <button
                key={tab}
                onClick={() => setActiveTab(tab)}
                className={`py-4 px-1 border-b-2 font-medium text-sm ${
                  activeTab === tab
                    ? 'border-blue-500 text-blue-600'
                    : 'border-transparent text-gray-500 hover:text-gray-700'
                }`}
              >
                {tab.charAt(0).toUpperCase() + tab.slice(1).replace('-', ' ')}
              </button>
            ))}
          </nav>
        </div>

        <div className="p-6">
          {activeTab === 'templates' && (
            <div className="space-y-6">
              <div className="bg-gray-50 p-4 rounded-lg">
                <h3 className="text-lg font-medium mb-4 flex items-center">
                  <Plus className="h-5 w-5 mr-2" />
                  Upload New Template
                </h3>
                <form onSubmit={handleTemplateSubmit(handleTemplateUpload)} className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700">Template Name</label>
                    <input
                      {...registerTemplate('name', { required: 'Template name is required' })}
                      type="text"
                      className="mt-1 block w-full border border-gray-300 rounded-md px-3 py-2"
                      placeholder="Enter template name"
                    />
                    {templateErrors.name && (
                      <p className="mt-1 text-sm text-red-600">{templateErrors.name.message}</p>
                    )}
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700">PowerPoint File</label>
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
                      className="mt-1 block w-full border border-gray-300 rounded-md px-3 py-2"
                    />
                    {templateErrors.file && (
                      <p className="mt-1 text-sm text-red-600">{templateErrors.file.message}</p>
                    )}
                  </div>
                  
                  {isTemplateUploading && (
                    <div className="space-y-2">
                      <div className="flex justify-between items-center">
                        <span className="text-sm font-medium text-gray-700">Uploading...</span>
                        <span className="text-sm text-gray-500">{templateUploadProgress}%</span>
                      </div>
                      <div className="w-full bg-gray-200 rounded-full h-2">
                        <div 
                          className="bg-blue-600 h-2 rounded-full transition-all duration-300"
                          style={{ width: `${templateUploadProgress}%` }}
                        ></div>
                      </div>
                    </div>
                  )}
                  
                  <button
                    type="submit"
                    disabled={isTemplateUploading}
                    className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md text-white bg-blue-600 hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    <Upload className="h-4 w-4 mr-2" />
                    {isTemplateUploading ? 'Uploading...' : 'Upload Template'}
                  </button>
                </form>
              </div>

              <div>
                <h3 className="text-lg font-medium mb-4">Existing Templates</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {templates.map((template) => (
                    <div key={template.id} className="bg-white border border-gray-200 rounded-lg p-4">
                      <div className="flex items-start justify-between">
                        <div className="flex items-center">
                          <FileText className="h-8 w-8 text-blue-500 mr-3" />
                          <div>
                            <h4 className="text-lg font-medium text-gray-900">{template.name}</h4>
                            <p className="text-sm text-gray-500">Version {template.version}</p>
                            <p className="text-sm text-gray-500">{template.filename}</p>
                          </div>
                        </div>
                        <button
                          onClick={() => deleteTemplate(template.id)}
                          className="text-red-600 hover:text-red-800"
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

          {activeTab === 'excel-data' && (
            <div className="space-y-6">
              <div className="bg-gray-50 p-4 rounded-lg">
                <h3 className="text-lg font-medium mb-4 flex items-center">
                  <Plus className="h-5 w-5 mr-2" />
                  Upload New Excel Data
                </h3>
                <form onSubmit={handleExcelSubmit(handleExcelUpload)} className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700">Data Name</label>
                    <input
                      {...registerExcel('name', { required: 'Data name is required' })}
                      type="text"
                      className="mt-1 block w-full border border-gray-300 rounded-md px-3 py-2"
                      placeholder="Enter data name"
                    />
                    {excelErrors.name && (
                      <p className="mt-1 text-sm text-red-600">{excelErrors.name.message}</p>
                    )}
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700">Excel File</label>
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
                      className="mt-1 block w-full border border-gray-300 rounded-md px-3 py-2"
                    />
                    {excelErrors.file && (
                      <p className="mt-1 text-sm text-red-600">{excelErrors.file.message}</p>
                    )}
                  </div>
                  
                  {isExcelUploading && (
                    <div className="space-y-2">
                      <div className="flex justify-between items-center">
                        <span className="text-sm font-medium text-gray-700">Uploading...</span>
                        <span className="text-sm text-gray-500">{excelUploadProgress}%</span>
                      </div>
                      <div className="w-full bg-gray-200 rounded-full h-2">
                        <div 
                          className="bg-green-600 h-2 rounded-full transition-all duration-300"
                          style={{ width: `${excelUploadProgress}%` }}
                        ></div>
                      </div>
                    </div>
                  )}
                  
                  <button
                    type="submit"
                    disabled={isExcelUploading}
                    className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md text-white bg-blue-600 hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    <Upload className="h-4 w-4 mr-2" />
                    {isExcelUploading ? 'Uploading...' : 'Upload Excel Data'}
                  </button>
                </form>
              </div>

              <div>
                <h3 className="text-lg font-medium mb-4">Existing Excel Data</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {excelData.map((data) => (
                    <div key={data.id} className="bg-white border border-gray-200 rounded-lg p-4">
                      <div className="flex items-start justify-between">
                        <div className="flex items-center">
                          <Database className="h-8 w-8 text-green-500 mr-3" />
                          <div>
                            <h4 className="text-lg font-medium text-gray-900">{data.name}</h4>
                            <p className="text-sm text-gray-500">Version {data.version}</p>
                            <p className="text-sm text-gray-500">{data.filename}</p>
                          </div>
                        </div>
                        <button
                          onClick={() => deleteExcelData(data.id)}
                          className="text-red-600 hover:text-red-800"
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
              <h3 className="text-lg font-medium mb-4">User Management</h3>
              <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-gray-200">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        User
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Email
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Role
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Status
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Actions
                      </th>
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-gray-200">
                    {users.map((user) => (
                      <tr key={user.id}>
                        <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                          {user.username}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                          {user.email}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <select
                            value={user.role}
                            onChange={(e) => updateUserRole(user.id, e.target.value)}
                            className="text-sm border border-gray-300 rounded px-2 py-1"
                          >
                            <option value="user">User</option>
                            <option value="admin">Admin</option>
                          </select>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <span className={`inline-flex px-2 text-xs font-semibold rounded-full ${
                            user.is_active
                              ? 'bg-green-100 text-green-800'
                              : 'bg-red-100 text-red-800'
                          }`}>
                            {user.is_active ? 'Active' : 'Inactive'}
                          </span>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                          <button
                            onClick={() => updateUserRole(user.id, user.is_active ? false : true)}
                            className="text-blue-600 hover:text-blue-900"
                          >
                            {user.is_active ? 'Deactivate' : 'Activate'}
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
    </div>
  )
}

export default AdminDashboard