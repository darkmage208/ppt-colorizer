import { useState, useEffect, useRef } from 'react'
import { useAuth } from '../contexts/AuthContext'
import { toast } from 'react-hot-toast'
import api from '../utils/api'
import {
  Upload,
  Download,
  Trash2,
  Play,
  CheckCircle,
  AlertCircle,
  Clock,
  Settings
} from 'lucide-react'

const VcfManager = () => {
  const { user } = useAuth()
  const [vcfFiles, setVcfFiles] = useState([])
  const [conversions, setConversions] = useState([])
  const [loading, setLoading] = useState(false)
  const [uploading, setUploading] = useState(false)
  const [uploadProgress, setUploadProgress] = useState(0)
  const [selectedFile, setSelectedFile] = useState(null)
  const [fileName, setFileName] = useState('')
  const [activeTab, setActiveTab] = useState('files')

  // Check if user is superadmin
  if (user?.role !== 'superadmin') {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <AlertCircle className="mx-auto h-12 w-12 text-red-400" />
          <h1 className="mt-2 text-xl font-bold text-gray-900 dark:text-gray-100">Access Denied</h1>
          <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
            This feature is only available to SuperAdmins.
          </p>
        </div>
      </div>
    )
  }

  const fetchVcfFiles = async () => {
    try {
      setLoading(true)
      const response = await api.get('/vcf/files')
      setVcfFiles(response.data)
    } catch (error) {
      console.error('Error fetching VCF files:', error)
      toast.error('Failed to load VCF files')
    } finally {
      setLoading(false)
    }
  }

  const fetchConversions = async () => {
    try {
      setLoading(true)
      const response = await api.get('/vcf/conversions')
      setConversions(response.data)
    } catch (error) {
      console.error('Error fetching conversions:', error)
      toast.error('Failed to load conversions')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    if (activeTab === 'files') {
      fetchVcfFiles()
    } else {
      fetchConversions()
    }
  }, [activeTab])

  const progressUpdateInterval = useRef(null)
  const activeConversionsRef = useRef([])

  // Track active conversions and update progress individually
  useEffect(() => {
    if (activeTab === 'conversions') {
      // Update the ref with current active conversions
      activeConversionsRef.current = conversions.filter(c =>
        c.status.toLowerCase() === 'pending' || c.status.toLowerCase() === 'processing'
      ).map(c => c.id)

      // Start interval if there are active conversions and no interval is running
      if (activeConversionsRef.current.length > 0 && !progressUpdateInterval.current) {
        progressUpdateInterval.current = setInterval(async () => {
          // Get current active conversion IDs
          const activeIds = activeConversionsRef.current

          if (activeIds.length === 0) {
            // No more active conversions, clear interval
            clearInterval(progressUpdateInterval.current)
            progressUpdateInterval.current = null
            return
          }

          // Update each active conversion
          const updatePromises = activeIds.map(async (conversionId) => {
            try {
              const response = await api.get(`/vcf/conversions/${conversionId}`)
              return response.data
            } catch (error) {
              console.error(`Error updating conversion ${conversionId}:`, error)
              return null
            }
          })

          const updatedConversions = await Promise.all(updatePromises)

          // Update state with new data
          setConversions(prevConversions => {
            return prevConversions.map(conversion => {
              const updatedConversion = updatedConversions.find(uc => uc && uc.id === conversion.id)
              return updatedConversion || conversion
            })
          })

          // Update activeConversionsRef for next iteration
          const stillActiveIds = updatedConversions
            .filter(uc => uc && (uc.status.toLowerCase() === 'pending' || uc.status.toLowerCase() === 'processing'))
            .map(uc => uc.id)

          activeConversionsRef.current = stillActiveIds

        }, 1500) // Update every 1.5 seconds
      }

      // Clear interval if no active conversions
      if (activeConversionsRef.current.length === 0 && progressUpdateInterval.current) {
        clearInterval(progressUpdateInterval.current)
        progressUpdateInterval.current = null
      }
    }

    // Cleanup when tab changes or component unmounts
    return () => {
      if (progressUpdateInterval.current) {
        clearInterval(progressUpdateInterval.current)
        progressUpdateInterval.current = null
      }
    }
  }, [activeTab, conversions])

  const handleFileSelect = (event) => {
    const file = event.target.files[0]
    if (file) {
      if (!file.name.toLowerCase().endsWith('.vcf') && !file.name.toLowerCase().endsWith('.vcf.gz')) {
        toast.error('Please select a VCF file (.vcf or .vcf.gz)')
        return
      }
      setSelectedFile(file)
      setFileName(file.name)
    }
  }

  const handleUpload = async () => {
    if (!selectedFile) {
      toast.error('Please select a file first')
      return
    }

    const formData = new FormData()
    formData.append('file', selectedFile)
    if (fileName !== selectedFile.name) {
      formData.append('name', fileName)
    }

    setUploading(true)
    setUploadProgress(0)

    try {
      await api.post('/vcf/upload', formData, {
        headers: {
          'Content-Type': 'multipart/form-data'
        },
        onUploadProgress: (progressEvent) => {
          const percentCompleted = Math.round((progressEvent.loaded * 100) / progressEvent.total)
          setUploadProgress(percentCompleted)
        }
      })
      toast.success('VCF file uploaded successfully!')
      setSelectedFile(null)
      setFileName('')
      setUploadProgress(0)
      fetchVcfFiles()
    } catch (error) {
      console.error('Upload error:', error)
      toast.error(error.response?.data?.detail || 'Failed to upload file')
    } finally {
      setUploading(false)
      setUploadProgress(0)
    }
  }

  const handleDelete = async (fileId) => {
    if (!confirm('Are you sure you want to delete this VCF file? This will also delete all associated conversion files.')) {
      return
    }

    try {
      await api.delete(`/vcf/files/${fileId}`)
      toast.success('VCF file deleted successfully!')
      fetchVcfFiles()
    } catch (error) {
      console.error('Delete error:', error)
      toast.error('Failed to delete file')
    }
  }

  const handleDeleteConversion = async (conversionId) => {
    if (!confirm('Are you sure you want to delete this conversion? This will also delete the generated TXT file if it exists.')) {
      return
    }

    try {
      await api.delete(`/vcf/conversions/${conversionId}`)
      toast.success('Conversion deleted successfully!')
      fetchConversions()
    } catch (error) {
      console.error('Delete conversion error:', error)
      toast.error('Failed to delete conversion')
    }
  }

  const handleConvert = async (fileId) => {
    try {
      await api.post(`/vcf/${fileId}/convert`)
      toast.success('VCF conversion started!')
      setTimeout(fetchConversions, 1000) // Refresh conversions after a delay
    } catch (error) {
      console.error('Conversion error:', error)
      toast.error(error.response?.data?.detail || 'Failed to start conversion')
    }
  }

  const handleDownload = async (conversionId) => {
    try {
      toast.loading('Preparing download...')

      const response = await api.get(`/vcf/conversions/${conversionId}/download`, {
        responseType: 'blob'
      })

      const blob = response.data
      const url = window.URL.createObjectURL(blob)
      const a = document.createElement('a')
      const contentDisposition = response.headers['content-disposition']
      const filename = contentDisposition ?
        contentDisposition.split('filename=')[1].replace(/"/g, '') :
        `conversion_${conversionId}_result.txt`

      a.style.display = 'none'
      a.href = url
      a.download = filename
      document.body.appendChild(a)
      a.click()
      document.body.removeChild(a)
      window.URL.revokeObjectURL(url)

      toast.dismiss()
      toast.success(`Downloaded: ${filename}`)
    } catch (error) {
      console.error('Download error:', error)
      toast.dismiss()
      if (error.response?.status === 404) {
        toast.error('File not found. The conversion may have failed or been deleted.')
      } else if (error.response?.status === 400) {
        toast.error('Conversion not completed yet. Please wait for it to finish.')
      } else {
        toast.error('Failed to download file. Please try again.')
      }
    }
  }

  const formatFileSize = (bytes) => {
    if (bytes === 0) return '0 Bytes'
    const k = 1024
    const sizes = ['Bytes', 'KB', 'MB', 'GB']
    const i = Math.floor(Math.log(bytes) / Math.log(k))
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i]
  }

  const formatDate = (dateString) => {
    return new Date(dateString).toLocaleString()
  }

  const getStatusIcon = (status) => {
    switch (status.toLowerCase()) {
      case 'completed':
        return <CheckCircle className="h-5 w-5 text-green-500" />
      case 'error':
        return <AlertCircle className="h-5 w-5 text-red-500" />
      case 'processing':
        return <Settings className="h-5 w-5 text-blue-500 animate-spin" />
      default:
        return <Clock className="h-5 w-5 text-yellow-500" />
    }
  }

  return (
    <div className="max-w-7xl mx-auto">
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-900 dark:text-gray-100">VCF File Manager</h1>
        <p className="mt-2 text-sm text-gray-600 dark:text-gray-400">
          Upload, convert, and manage VCF files (SuperAdmin only)
        </p>
      </div>

      {/* Tab Navigation */}
      <div className="border-b border-gray-200 dark:border-gray-700 mb-6">
        <nav className="-mb-px flex space-x-8">
          <button
            onClick={() => setActiveTab('files')}
            className={`py-2 px-1 border-b-2 font-medium text-sm ${
              activeTab === 'files'
                ? 'border-blue-500 text-blue-600 dark:text-blue-400'
                : 'border-transparent text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300 hover:border-gray-300 dark:hover:border-gray-600'
            }`}
          >
            VCF Files
          </button>
          <button
            onClick={() => setActiveTab('conversions')}
            className={`py-2 px-1 border-b-2 font-medium text-sm ${
              activeTab === 'conversions'
                ? 'border-blue-500 text-blue-600 dark:text-blue-400'
                : 'border-transparent text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300 hover:border-gray-300 dark:hover:border-gray-600'
            }`}
          >
            Conversions
          </button>
        </nav>
      </div>

      {/* Upload Section - only show on files tab */}
      {activeTab === 'files' && (
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 p-6 mb-6">
          <h2 className="text-lg font-medium text-gray-900 dark:text-gray-100 mb-4">Upload VCF File</h2>

          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                Select VCF File (.vcf or .vcf.gz)
              </label>
              <input
                type="file"
                accept=".vcf,.vcf.gz"
                onChange={handleFileSelect}
                className="block w-full text-sm text-gray-500 dark:text-gray-400 file:mr-4 file:py-2 file:px-4 file:rounded-md file:border-0 file:text-sm file:font-medium file:bg-blue-50 dark:file:bg-blue-900 file:text-blue-700 dark:file:text-blue-300 hover:file:bg-blue-100 dark:hover:file:bg-blue-800"
              />
            </div>

            {selectedFile && (
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Display Name (optional)
                </label>
                <input
                  type="text"
                  value={fileName}
                  onChange={(e) => setFileName(e.target.value)}
                  placeholder="Enter a display name for this file"
                  className="block w-full px-3 py-2 border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500 placeholder-gray-400 dark:placeholder-gray-500"
                />
              </div>
            )}

            <button
              onClick={handleUpload}
              disabled={!selectedFile || uploading}
              className="inline-flex items-center px-4 py-2 bg-blue-600 dark:bg-blue-700 text-white text-sm font-medium rounded-md hover:bg-blue-700 dark:hover:bg-blue-600 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <Upload className="h-5 w-5 mr-2" />
              {uploading ? 'Uploading...' : 'Upload VCF File'}
            </button>

            {/* Upload Progress Bar */}
            {uploading && (
              <div className="mt-4">
                <div className="flex justify-between text-sm text-gray-700 dark:text-gray-300 mb-1">
                  <span>Uploading...</span>
                  <span>{uploadProgress}%</span>
                </div>
                <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-2">
                  <div
                    className="bg-blue-600 dark:bg-blue-500 h-2 rounded-full transition-all duration-300"
                    style={{ width: `${uploadProgress}%` }}
                  ></div>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Content based on active tab */}
      {activeTab === 'files' ? (
        // VCF Files Table
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 overflow-hidden">
          <div className="px-6 py-4 border-b border-gray-200 dark:border-gray-700">
            <h2 className="text-lg font-medium text-gray-900 dark:text-gray-100">Uploaded VCF Files</h2>
          </div>

          {loading ? (
            <div className="p-8 text-center">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 dark:border-blue-400 mx-auto"></div>
              <p className="mt-2 text-sm text-gray-500 dark:text-gray-400">Loading VCF files...</p>
            </div>
          ) : vcfFiles.length === 0 ? (
            <div className="p-8 text-center">
              <p className="text-gray-500 dark:text-gray-400">No VCF files uploaded yet.</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
                <thead className="bg-gray-50 dark:bg-gray-700">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">#</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">Name</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">Size</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">Uploaded</th>
                    <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">Actions</th>
                  </tr>
                </thead>
                <tbody className="bg-white dark:bg-gray-800 divide-y divide-gray-200 dark:divide-gray-700">
                  {vcfFiles.map((file, index) => (
                    <tr key={file.id}>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-400">
                        {index + 1}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="text-sm font-medium text-gray-900 dark:text-gray-100">{file.name}</div>
                        <div className="text-sm text-gray-500 dark:text-gray-400">{file.filename}</div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-400">
                        {formatFileSize(file.file_size)}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-400">
                        {formatDate(file.created_at)}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                        <button
                          onClick={() => handleConvert(file.id)}
                          className="inline-flex items-center px-3 py-1 bg-green-600 dark:bg-green-700 text-white text-xs font-medium rounded hover:bg-green-700 dark:hover:bg-green-600 mr-2"
                        >
                          <Play className="h-4 w-4 mr-1" />
                          Convert
                        </button>
                        <button
                          onClick={() => handleDelete(file.id)}
                          className="inline-flex items-center px-3 py-1 bg-red-600 dark:bg-red-700 text-white text-xs font-medium rounded hover:bg-red-700 dark:hover:bg-red-600"
                        >
                          <Trash2 className="h-4 w-4 mr-1" />
                          Delete
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      ) : (
        // Conversions Table
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 overflow-hidden">
          <div className="px-6 py-4 border-b border-gray-200 dark:border-gray-700">
            <h2 className="text-lg font-medium text-gray-900 dark:text-gray-100">VCF Conversions</h2>
          </div>

          {loading ? (
            <div className="p-8 text-center">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 dark:border-blue-400 mx-auto"></div>
              <p className="mt-2 text-sm text-gray-500 dark:text-gray-400">Loading conversions...</p>
            </div>
          ) : conversions.length === 0 ? (
            <div className="p-8 text-center">
              <p className="text-gray-500 dark:text-gray-400">No conversions yet.</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
                <thead className="bg-gray-50 dark:bg-gray-700">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">#</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">VCF File</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">Status</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">Progress</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">Started</th>
                    <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">Actions</th>
                  </tr>
                </thead>
                <tbody className="bg-white dark:bg-gray-800 divide-y divide-gray-200 dark:divide-gray-700">
                  {conversions.map((conversion, index) => (
                    <tr key={conversion.id}>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-400">
                        {index + 1}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="text-sm font-medium text-gray-900 dark:text-gray-100">{conversion.vcf_file.name}</div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="flex items-center">
                          {getStatusIcon(conversion.status)}
                          <span className="ml-2 text-sm text-gray-900 dark:text-gray-100 capitalize">
                            {conversion.status.toLowerCase() === 'pending' ? 'Queued' :
                             conversion.status.toLowerCase() === 'processing' ? 'Converting' :
                             conversion.status.toLowerCase() === 'completed' ? 'Completed' :
                             conversion.status.toLowerCase() === 'error' ? 'Failed' :
                             conversion.status.toLowerCase()}
                          </span>
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-400">
                        <div className="flex items-center">
                          <div className="w-16 bg-gray-200 dark:bg-gray-700 rounded-full h-2 mr-2">
                            <div
                              className="bg-blue-600 dark:bg-blue-500 h-2 rounded-full"
                              style={{ width: `${conversion.progress}%` }}
                            ></div>
                          </div>
                          <span>{conversion.progress}%</span>
                        </div>
                        {conversion.total_variants > 0 && (
                          <div className="text-xs text-gray-400 dark:text-gray-500">
                            {conversion.processed_variants}/{conversion.total_variants} variants
                          </div>
                        )}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-400">
                        {formatDate(conversion.created_at)}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                        <div className="flex items-center justify-end space-x-2">
                          {conversion.status.toLowerCase() === 'completed' && (
                            <button
                              onClick={() => handleDownload(conversion.id)}
                              className="inline-flex items-center px-3 py-1 bg-blue-600 dark:bg-blue-700 text-white text-xs font-medium rounded hover:bg-blue-700 dark:hover:bg-blue-600"
                            >
                              <Download className="h-4 w-4 mr-1" />
                              Download
                            </button>
                          )}
                          <button
                            onClick={() => handleDeleteConversion(conversion.id)}
                            className="inline-flex items-center px-3 py-1 bg-red-600 dark:bg-red-700 text-white text-xs font-medium rounded hover:bg-red-700 dark:hover:bg-red-600"
                          >
                            <Trash2 className="h-4 w-4 mr-1" />
                            Delete
                          </button>
                        </div>
                        {conversion.status.toLowerCase() === 'error' && (
                          <div className="text-xs text-red-600 dark:text-red-400 mt-1">
                            {conversion.error_message}
                          </div>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}
    </div>
  )
}

export default VcfManager