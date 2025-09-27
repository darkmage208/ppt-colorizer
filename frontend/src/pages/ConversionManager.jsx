import { useState, useEffect } from 'react'
import { useAuth } from '../contexts/AuthContext'
import { toast } from 'react-hot-toast'
import {
  Upload,
  FileText,
  Users,
  Play,
  Download,
  Trash2,
  CheckCircle,
  Clock,
  AlertCircle,
  Plus,
  RotateCcw,
  Database,
  Target
} from 'lucide-react'
import api from '../utils/api'

const ConversionManager = () => {
  const [activeTab, setActiveTab] = useState('work')
  const [conversionFiles, setConversionFiles] = useState([])
  const [individualFiles, setIndividualFiles] = useState([])
  const [conversionGroups, setConversionGroups] = useState([])
  const [selectedConversionFile, setSelectedConversionFile] = useState(null)
  const [loading, setLoading] = useState(false)
  const [uploadProgress, setUploadProgress] = useState({})


  // Fetch conversion files
  const fetchConversionFiles = async () => {
    try {
      const response = await api.get('/conversions/conversion-files/')
      setConversionFiles(response.data)
    } catch (error) {
      console.error('Error fetching conversion files:', error)
      toast.error('Failed to fetch conversion files')
    }
  }

  // Fetch individual files
  const fetchIndividualFiles = async (conversionFileId) => {
    if (!conversionFileId) return
    try {
      const response = await api.get(`/conversions/individual-files/${conversionFileId}`)
      setIndividualFiles(response.data)
    } catch (error) {
      console.error('Error fetching individual files:', error)
      toast.error('Failed to fetch individual files')
    }
  }

  // Fetch conversion groups
  const fetchConversionGroups = async () => {
    try {
      const response = await api.get('/conversions/groups/')
      setConversionGroups(response.data)
    } catch (error) {
      console.error('Error fetching conversion groups:', error)
      toast.error('Failed to fetch conversion groups')
    }
  }

  useEffect(() => {
    fetchConversionFiles()
    fetchConversionGroups()
  }, [])

  // Auto-refresh for active conversions
  useEffect(() => {
    const hasActiveConversions = conversionGroups.some(g => g.status === 'processing' || g.status === 'pending')
    if (hasActiveConversions) {
      const interval = setInterval(() => {
        fetchConversionGroups()
      }, 1500) // Refresh every 1.5 seconds for better responsiveness
      return () => clearInterval(interval)
    }
  }, [conversionGroups])

  useEffect(() => {
    if (selectedConversionFile) {
      fetchIndividualFiles(selectedConversionFile.id)
    }
  }, [selectedConversionFile])

  // Upload conversion file
  const handleUploadConversionFile = async (event) => {
    const file = event.target.files[0]
    if (!file) return

    const name = prompt('Enter a name for this conversion file:')
    if (!name) return

    setLoading(true)
    const formData = new FormData()
    formData.append('name', name)
    formData.append('conversion_file', file)

    try {
      await api.post('/conversions/conversion-files/', formData, {
        headers: {
          'Content-Type': 'multipart/form-data'
        }
      })
      toast.success('Conversion file uploaded successfully!')
      fetchConversionFiles()
    } catch (error) {
      console.error('Error uploading conversion file:', error)
      toast.error('Failed to upload conversion file')
    } finally {
      setLoading(false)
      event.target.value = ''
    }
  }

  // Upload individual file(s)
  const handleUploadIndividualFile = async (event) => {
    const files = Array.from(event.target.files)
    if (!files.length || !selectedConversionFile) return

    setLoading(true)

    try {
      // Upload each file
      for (const file of files) {
        const name = file.name.replace('.txt', '').replace(/[^a-zA-Z0-9-_]/g, '_')

        const formData = new FormData()
        formData.append('conversion_file_id', selectedConversionFile.id)
        formData.append('name', name)
        formData.append('individual_file', file)

        await api.post('/conversions/individual-files/', formData, {
          headers: {
            'Content-Type': 'multipart/form-data'
          }
        })
      }

      toast.success(`${files.length} individual file(s) uploaded successfully!`)
      fetchIndividualFiles(selectedConversionFile.id)
    } catch (error) {
      console.error('Error uploading individual files:', error)
      const errorMessage = error.response?.data?.detail || 'Failed to upload some individual files'
      toast.error(errorMessage)
    } finally {
      setLoading(false)
      event.target.value = ''
    }
  }

  // Start conversion
  const handleStartConversion = async (conversionFileId) => {
    setLoading(true)
    try {
      await api.post(`/conversions/start-conversion/${conversionFileId}`, {})
      toast.success('Conversion started successfully!')

      // Force immediate refresh of conversion groups
      await fetchConversionGroups()

      // Force a second refresh after a short delay to catch any quick status changes
      setTimeout(() => {
        fetchConversionGroups()
      }, 1000)

    } catch (error) {
      console.error('Error starting conversion:', error)
      toast.error('Failed to start conversion')
    } finally {
      setLoading(false)
    }
  }

  // Download result file
  const handleDownloadResult = async (groupId, resultId, filename) => {
    try {
      const response = await api.get(
        `/conversions/groups/${groupId}/download/${resultId}`,
        {
          responseType: 'blob'
        }
      )

      const url = window.URL.createObjectURL(new Blob([response.data]))
      const link = document.createElement('a')
      link.href = url
      link.setAttribute('download', filename)
      document.body.appendChild(link)
      link.click()
      link.remove()
      window.URL.revokeObjectURL(url)

      toast.success('File downloaded successfully!')
    } catch (error) {
      console.error('Error downloading file:', error)
      toast.error('Failed to download file')
    }
  }

  // Delete conversion group
  const handleDeleteGroup = async (groupId) => {
    if (!confirm('Are you sure you want to delete this conversion group?')) return

    try {
      await api.delete(`/conversions/groups/${groupId}`)
      toast.success('Conversion group deleted successfully!')
      fetchConversionGroups()
    } catch (error) {
      console.error('Error deleting group:', error)
      toast.error('Failed to delete conversion group')
    }
  }

  // Delete result file
  const handleDeleteResult = async (resultId) => {
    if (!confirm('Are you sure you want to delete this result file?')) return

    try {
      await api.delete(`/conversions/results/${resultId}`)
      toast.success('Result file deleted successfully!')
      fetchConversionGroups()
    } catch (error) {
      console.error('Error deleting result:', error)
      toast.error('Failed to delete result file')
    }
  }

  const getStatusIcon = (status) => {
    switch (status) {
      case 'completed':
        return <CheckCircle className="h-5 w-5 text-green-500" />
      case 'processing':
        return <Clock className="h-5 w-5 text-blue-500 animate-spin" />
      case 'pending':
        return <Clock className="h-5 w-5 text-yellow-500" />
      case 'error':
        return <AlertCircle className="h-5 w-5 text-red-500" />
      default:
        return <Clock className="h-5 w-5 text-gray-500" />
    }
  }

  const getStatusColor = (status) => {
    switch (status) {
      case 'completed':
        return 'text-green-600 bg-green-50 dark:bg-green-900/20 dark:text-green-400'
      case 'processing':
        return 'text-blue-600 bg-blue-50 dark:bg-blue-900/20 dark:text-blue-400'
      case 'pending':
        return 'text-yellow-600 bg-yellow-50 dark:bg-yellow-900/20 dark:text-yellow-400'
      case 'error':
        return 'text-red-600 bg-red-50 dark:bg-red-900/20 dark:text-red-400'
      default:
        return 'text-gray-600 bg-gray-50 dark:bg-gray-900/20 dark:text-gray-400'
    }
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="bg-white dark:bg-dark-card rounded-2xl shadow-lg p-6 border border-gray-200/50 dark:border-dark-border">
        <div className="flex items-center space-x-3 mb-4">
          <div className="p-3 bg-gradient-to-br from-orange-500 to-amber-600 rounded-xl">
            <RotateCcw className="h-6 w-6 text-white" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-gray-800 dark:text-dark-text">Conversion Manager</h1>
            <p className="text-gray-600 dark:text-dark-muted">Manage genetic data conversions and processing</p>
          </div>
        </div>

        {/* Tab Navigation */}
        <div className="flex space-x-1 bg-gray-100 dark:bg-dark-hover p-1 rounded-xl">
          <button
            onClick={() => setActiveTab('work')}
            className={`flex-1 flex items-center justify-center space-x-2 px-4 py-2 rounded-lg text-sm font-medium transition-all duration-200 ${
              activeTab === 'work'
                ? 'bg-white dark:bg-dark-card text-orange-600 dark:text-orange-400 shadow-sm'
                : 'text-gray-600 dark:text-dark-muted hover:text-orange-600 dark:hover:text-orange-400'
            }`}
          >
            <Upload className="h-4 w-4" />
            <span>Work</span>
          </button>
          <button
            onClick={() => setActiveTab('results')}
            className={`flex-1 flex items-center justify-center space-x-2 px-4 py-2 rounded-lg text-sm font-medium transition-all duration-200 ${
              activeTab === 'results'
                ? 'bg-white dark:bg-dark-card text-orange-600 dark:text-orange-400 shadow-sm'
                : 'text-gray-600 dark:text-dark-muted hover:text-orange-600 dark:hover:text-orange-400'
            }`}
          >
            <Target className="h-4 w-4" />
            <span>Results</span>
          </button>
        </div>
      </div>

      {/* Tab Content */}
      {activeTab === 'work' && (
        <div className="space-y-6">
          {/* Step 1: Select Conversion File */}
          <div className="bg-white dark:bg-dark-card rounded-2xl shadow-lg p-6 border border-gray-200/50 dark:border-dark-border">
            <div className="flex items-center justify-between mb-4">
              <div>
                <h2 className="text-lg font-semibold text-gray-800 dark:text-dark-text">Step 1: Select Conversion File</h2>
                <p className="text-gray-600 dark:text-dark-muted">Choose or upload a conversion file containing Name → RsID mappings</p>
              </div>
              <label className="flex items-center space-x-2 px-4 py-2 bg-gradient-to-r from-orange-500 to-amber-600 text-white rounded-xl cursor-pointer hover:from-orange-600 hover:to-amber-700 transition-all duration-200">
                <Plus className="h-4 w-4" />
                <span>Upload New</span>
                <input
                  type="file"
                  accept=".txt"
                  onChange={handleUploadConversionFile}
                  className="hidden"
                  disabled={loading}
                />
              </label>
            </div>

            {/* Conversion Files Selection */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {conversionFiles.map((file) => (
                <div
                  key={file.id}
                  className={`p-4 border rounded-xl cursor-pointer transition-all duration-200 ${
                    selectedConversionFile?.id === file.id
                      ? 'border-orange-500 bg-orange-50 dark:bg-orange-900/20'
                      : 'border-gray-200 dark:border-dark-border hover:border-orange-300 dark:hover:border-orange-600'
                  }`}
                  onClick={() => setSelectedConversionFile(file)}
                >
                  <div className="flex items-center space-x-3">
                    <FileText className={`h-5 w-5 ${selectedConversionFile?.id === file.id ? 'text-orange-600' : 'text-gray-400'}`} />
                    <div className="flex-1 min-w-0">
                      <h3 className="text-sm font-medium text-gray-900 dark:text-dark-text truncate">{file.name}</h3>
                      <p className="text-xs text-gray-500 dark:text-dark-muted">{file.filename}</p>
                      <p className="text-xs text-gray-500 dark:text-dark-muted">{(file.file_size / 1024).toFixed(1)} KB</p>
                    </div>
                    {selectedConversionFile?.id === file.id && (
                      <CheckCircle className="h-5 w-5 text-orange-600" />
                    )}
                  </div>
                </div>
              ))}
              {conversionFiles.length === 0 && (
                <div className="col-span-full text-center py-8 text-gray-500 dark:text-dark-muted">
                  No conversion files available. Upload one to get started.
                </div>
              )}
            </div>
          </div>

          {/* Step 2: Upload Individual Files */}
          {selectedConversionFile && (
            <div className="bg-white dark:bg-dark-card rounded-2xl shadow-lg p-6 border border-gray-200/50 dark:border-dark-border">
              <div className="flex items-center justify-between mb-4">
                <div>
                  <h2 className="text-lg font-semibold text-gray-800 dark:text-dark-text">Step 2: Upload Individual Files</h2>
                  <p className="text-gray-600 dark:text-dark-muted">Upload multiple individual data files for processing</p>
                </div>
                <label className="flex items-center space-x-2 px-4 py-2 bg-gradient-to-r from-blue-500 to-indigo-600 text-white rounded-xl cursor-pointer hover:from-blue-600 hover:to-indigo-700 transition-all duration-200">
                  <Upload className="h-4 w-4" />
                  <span>Add Files</span>
                  <input
                    type="file"
                    accept=".txt"
                    onChange={handleUploadIndividualFile}
                    className="hidden"
                    disabled={loading}
                    multiple
                  />
                </label>
              </div>

              {/* Individual Files Grid */}
              <div className="space-y-3">
                {individualFiles.map((file) => (
                  <div key={file.id} className="flex items-center space-x-4 p-3 bg-gray-50 dark:bg-dark-hover rounded-lg">
                    <Users className="h-5 w-5 text-blue-500 flex-shrink-0" />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between">
                        <h3 className="text-sm font-medium text-gray-900 dark:text-dark-text truncate">{file.name}</h3>
                        <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                          file.is_uploaded ? 'bg-green-100 text-green-800 dark:bg-green-900/20 dark:text-green-400' : 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/20 dark:text-yellow-400'
                        }`}>
                          {file.is_uploaded ? 'Ready' : 'Uploading'}
                        </span>
                      </div>
                      <p className="text-xs text-gray-500 dark:text-dark-muted">{file.filename} • {(file.file_size / 1024).toFixed(1)} KB</p>
                      {!file.is_uploaded && (
                        <div className="mt-2">
                          <div className="w-full bg-gray-200 dark:bg-dark-border rounded-full h-2">
                            <div
                              className="bg-gradient-to-r from-blue-500 to-indigo-600 h-2 rounded-full transition-all duration-300"
                              style={{ width: `${file.upload_progress}%` }}
                            ></div>
                          </div>
                          <span className="text-xs text-gray-600 dark:text-dark-muted">{file.upload_progress}%</span>
                        </div>
                      )}
                    </div>
                  </div>
                ))}
                {individualFiles.length === 0 && (
                  <div className="text-center py-8 text-gray-500 dark:text-dark-muted">
                    No individual files uploaded yet
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Step 3: Start Conversion */}
          {selectedConversionFile && individualFiles.filter(f => f.is_uploaded).length > 0 && (
            <div className="bg-white dark:bg-dark-card rounded-2xl shadow-lg p-6 border border-gray-200/50 dark:border-dark-border">
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="text-lg font-semibold text-gray-800 dark:text-dark-text">Step 3: Start Conversion</h2>
                  <p className="text-gray-600 dark:text-dark-muted">
                    Ready to process {individualFiles.filter(f => f.is_uploaded).length} files with {selectedConversionFile.name}
                  </p>
                </div>
                <button
                  onClick={() => handleStartConversion(selectedConversionFile.id)}
                  disabled={loading}
                  className="flex items-center space-x-2 px-6 py-3 bg-gradient-to-r from-green-500 to-emerald-600 text-white rounded-xl disabled:opacity-50 disabled:cursor-not-allowed hover:from-green-600 hover:to-emerald-700 transition-all duration-200 font-medium"
                >
                  <Play className="h-5 w-5" />
                  <span>Start Conversion</span>
                </button>
              </div>

              {/* Active Conversions Progress */}
              {conversionGroups.filter(g => g.status === 'processing' || g.status === 'pending').length > 0 && (
                <div className="mt-6 space-y-4">
                  <h3 className="text-md font-semibold text-gray-800 dark:text-dark-text">Active Conversions</h3>
                  {conversionGroups.filter(g => g.status === 'processing' || g.status === 'pending').map((group) => (
                    <div key={group.id} className="p-4 bg-blue-50 dark:bg-blue-900/20 rounded-lg border border-blue-200 dark:border-blue-800">
                      <div className="flex items-center justify-between mb-2">
                        <h4 className="text-sm font-medium text-gray-900 dark:text-dark-text">{group.name}</h4>
                        <span className="text-sm text-blue-600 dark:text-blue-400">{group.progress}%</span>
                      </div>
                      <div className="w-full bg-blue-200 dark:bg-blue-800 rounded-full h-2 mb-2">
                        <div
                          className="bg-gradient-to-r from-blue-500 to-indigo-600 h-2 rounded-full transition-all duration-300"
                          style={{ width: `${group.progress}%` }}
                        ></div>
                      </div>
                      <p className="text-xs text-gray-600 dark:text-dark-muted">
                        Processing {group.processed_outputs} / {group.total_outputs} outputs
                      </p>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {activeTab === 'results' && (
        <div className="space-y-6">
          {/* Results Header */}
          <div className="bg-white dark:bg-dark-card rounded-2xl shadow-lg p-6 border border-gray-200/50 dark:border-dark-border">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-lg font-semibold text-gray-800 dark:text-dark-text">Conversion Results</h2>
                <p className="text-gray-600 dark:text-dark-muted">View and download your processed conversion groups</p>
              </div>
              <div className="flex items-center space-x-2 text-sm text-gray-600 dark:text-dark-muted">
                <Target className="h-4 w-4" />
                <span>{conversionGroups.length} groups</span>
              </div>
            </div>
          </div>

          {/* Conversion Groups */}
          {conversionGroups.length > 0 ? (
            <div className="space-y-6">
              {conversionGroups.map((group) => (
                <div key={group.id} className="bg-white dark:bg-dark-card rounded-2xl shadow-lg border border-gray-200/50 dark:border-dark-border overflow-hidden">
                  {/* Group Header */}
                  <div className="p-6 border-b border-gray-200/50 dark:border-dark-border">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center space-x-4">
                        {getStatusIcon(group.status)}
                        <div>
                          <h3 className="text-lg font-semibold text-gray-800 dark:text-dark-text">{group.name}</h3>
                          <p className="text-gray-600 dark:text-dark-muted">
                            Source: {group.individual_file?.name} • Created {new Date(group.created_at).toLocaleDateString()}
                          </p>
                        </div>
                      </div>
                      <div className="flex items-center space-x-3">
                        <span className={`inline-flex items-center px-3 py-1 rounded-full text-sm font-medium ${getStatusColor(group.status)}`}>
                          {group.status}
                        </span>
                        <button
                          onClick={() => handleDeleteGroup(group.id)}
                          className="p-2 text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg transition-colors"
                          title="Delete Group"
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </div>
                    </div>

                    {/* Progress Bar for Processing */}
                    {group.status === 'processing' && (
                      <div className="mt-4">
                        <div className="flex items-center justify-between text-sm text-gray-600 dark:text-dark-muted mb-2">
                          <span>Processing outputs...</span>
                          <span>{group.progress}%</span>
                        </div>
                        <div className="w-full bg-gray-200 dark:bg-dark-hover rounded-full h-2">
                          <div
                            className="bg-gradient-to-r from-blue-500 to-indigo-600 h-2 rounded-full transition-all duration-300"
                            style={{ width: `${group.progress}%` }}
                          ></div>
                        </div>
                        <div className="text-sm text-gray-600 dark:text-dark-muted mt-1">
                          {group.processed_outputs} / {group.total_outputs} outputs completed
                        </div>
                      </div>
                    )}

                    {/* Error Message */}
                    {group.error_message && (
                      <div className="mt-4 p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg">
                        <div className="flex items-center space-x-2">
                          <AlertCircle className="h-4 w-4 text-red-500 flex-shrink-0" />
                          <p className="text-red-600 dark:text-red-400 text-sm">{group.error_message}</p>
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Result Files */}
                  {group.results && group.results.length > 0 ? (
                    <div className="p-6">
                      <div className="flex items-center justify-between mb-4">
                        <h4 className="text-md font-semibold text-gray-800 dark:text-dark-text">
                          Output Files ({group.results.length})
                        </h4>
                        <span className="text-sm text-gray-600 dark:text-dark-muted">
                          Total: {group.results.reduce((sum, result) => sum + result.total_records, 0)} records
                        </span>
                      </div>

                      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                        {group.results.map((result) => (
                          <div key={result.id} className="bg-gray-50 dark:bg-dark-hover rounded-lg p-4 border border-gray-200 dark:border-dark-border">
                            <div className="flex items-start justify-between">
                              <div className="flex-1 min-w-0">
                                <div className="flex items-center space-x-2 mb-2">
                                  <FileText className="h-4 w-4 text-emerald-500 flex-shrink-0" />
                                  <h5 className="text-sm font-medium text-gray-800 dark:text-dark-text truncate">
                                    {result.output_name}
                                  </h5>
                                </div>
                                <div className="space-y-1">
                                  <p className="text-xs text-gray-600 dark:text-dark-muted">
                                    {result.total_records.toLocaleString()} records
                                  </p>
                                  <p className="text-xs text-gray-600 dark:text-dark-muted">
                                    {(result.file_size / 1024).toFixed(1)} KB
                                  </p>
                                  <p className="text-xs text-gray-500 dark:text-dark-muted">
                                    {result.filename}
                                  </p>
                                </div>
                              </div>
                            </div>

                            <div className="flex items-center space-x-2 mt-3">
                              <button
                                onClick={() => handleDownloadResult(group.id, result.id, result.filename)}
                                className="flex-1 flex items-center justify-center space-x-2 px-3 py-2 bg-emerald-100 text-emerald-700 dark:bg-emerald-900/20 dark:text-emerald-400 rounded-lg hover:bg-emerald-200 dark:hover:bg-emerald-900/40 transition-colors text-sm font-medium"
                              >
                                <Download className="h-3 w-3" />
                                <span>Download</span>
                              </button>
                              <button
                                onClick={() => handleDeleteResult(result.id)}
                                className="p-2 text-red-600 hover:bg-red-100 dark:hover:bg-red-900/20 rounded-lg transition-colors"
                                title="Delete File"
                              >
                                <Trash2 className="h-3 w-3" />
                              </button>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  ) : group.status === 'completed' ? (
                    <div className="p-6 text-center text-gray-500 dark:text-dark-muted">
                      <FileText className="h-8 w-8 mx-auto mb-2 opacity-50" />
                      <p className="text-sm">No output files generated</p>
                    </div>
                  ) : group.status === 'pending' ? (
                    <div className="p-6 text-center text-gray-500 dark:text-dark-muted">
                      <Clock className="h-8 w-8 mx-auto mb-2 opacity-50" />
                      <p className="text-sm">Waiting to start processing...</p>
                    </div>
                  ) : null}
                </div>
              ))}
            </div>
          ) : (
            <div className="bg-white dark:bg-dark-card rounded-2xl shadow-lg p-12 border border-gray-200/50 dark:border-dark-border text-center">
              <Target className="h-16 w-16 text-gray-300 dark:text-dark-muted mx-auto mb-4" />
              <h3 className="text-xl font-semibold text-gray-800 dark:text-dark-text mb-2">No Results Yet</h3>
              <p className="text-gray-600 dark:text-dark-muted mb-4">
                Start a conversion in the Work tab to see results here
              </p>
              <button
                onClick={() => setActiveTab('work')}
                className="inline-flex items-center space-x-2 px-4 py-2 bg-gradient-to-r from-orange-500 to-amber-600 text-white rounded-lg hover:from-orange-600 hover:to-amber-700 transition-all duration-200"
              >
                <Upload className="h-4 w-4" />
                <span>Go to Work Tab</span>
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  )
}

export default ConversionManager