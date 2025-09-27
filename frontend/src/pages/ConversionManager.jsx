import { useState, useEffect } from 'react'
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
  Target
} from 'lucide-react'
import api from '../utils/api'

const ConversionManager = () => {
  const [activeTab, setActiveTab] = useState('work')
  const [conversionFiles, setConversionFiles] = useState([])
  const [individualFiles, setIndividualFiles] = useState([])
  const [conversionGroups, setConversionGroups] = useState([])
  const [selectedConversionFile, setSelectedConversionFile] = useState(null)
  const [selectedIndividualFiles, setSelectedIndividualFiles] = useState(new Set())
  const [selectedGroup, setSelectedGroup] = useState(null)
  const [loading, setLoading] = useState(false)
  const [downloadingFiles, setDownloadingFiles] = useState(new Set())
  const [confirmDialog, setConfirmDialog] = useState({
    open: false,
    title: '',
    message: '',
    onConfirm: null,
    onCancel: null,
    confirmText: 'Confirm',
    cancelText: 'Cancel',
    type: 'default' // 'default', 'warning', 'danger'
  })


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

  // Fetch all individual files (completely independent)
  const fetchIndividualFiles = async () => {
    try {
      const response = await api.get('/conversions/individual-files/')
      setIndividualFiles(response.data)
    } catch (error) {
      console.error('Error fetching individual files:', error)

      if (error.response?.status === 404 || error.response?.status === 405) {
        setIndividualFiles([])
        console.warn('Independent individual files endpoint not available. Backend needs to be updated.')
      } else {
        toast.error('Failed to fetch individual files')
      }
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
    fetchIndividualFiles()
    fetchConversionGroups()
  }, [])

  // Auto-refresh for active conversions
  useEffect(() => {
    const hasActiveConversions = conversionGroups.some(g => g.status === 'processing' || g.status === 'pending')
    if (hasActiveConversions) {
      const interval = setInterval(() => {
        // Refresh both conversion groups and individual files for complete real-time updates
        fetchConversionGroups()
        fetchIndividualFiles()
      }, 1500) // Refresh every 1.5 seconds for better responsiveness
      return () => clearInterval(interval)
    }
  }, [conversionGroups])


  // Auto-select first group when groups change and update selected group data
  useEffect(() => {
    const sortedGroups = getSortedGroups()
    if (sortedGroups.length > 0 && !selectedGroup) {
      setSelectedGroup(sortedGroups[0])
    } else if (sortedGroups.length === 0) {
      setSelectedGroup(null)
    } else if (selectedGroup) {
      // Update selected group with latest data or select first if current one doesn't exist
      const updatedGroup = conversionGroups.find(g => g.id === selectedGroup.id)
      if (updatedGroup) {
        // Update selected group with latest data for real-time updates
        setSelectedGroup(updatedGroup)
      } else {
        // If selected group no longer exists, select first available (most recent)
        setSelectedGroup(sortedGroups[0])
      }
    }
  }, [conversionGroups])

  // Get sorted groups by most recent first
  const getSortedGroups = () => {
    return [...conversionGroups].sort((a, b) => new Date(b.created_at) - new Date(a.created_at))
  }

  // Custom confirmation dialog helper
  const showConfirmDialog = (title, message, onConfirm, options = {}) => {
    return new Promise((resolve) => {
      setConfirmDialog({
        open: true,
        title,
        message,
        onConfirm: () => {
          onConfirm?.()
          setConfirmDialog(prev => ({ ...prev, open: false }))
          resolve(true)
        },
        onCancel: () => {
          setConfirmDialog(prev => ({ ...prev, open: false }))
          resolve(false)
        },
        confirmText: options.confirmText || 'Confirm',
        cancelText: options.cancelText || 'Cancel',
        type: options.type || 'default'
      })
    })
  }

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

  // Upload individual file(s) - completely independent
  const handleUploadIndividualFile = async (event) => {
    const files = Array.from(event.target.files)
    if (!files.length) return

    setLoading(true)

    try {
      // Upload each file independently
      for (const file of files) {
        const name = file.name.replace('.txt', '').replace(/[^a-zA-Z0-9-_]/g, '_')

        const formData = new FormData()
        formData.append('name', name)
        formData.append('individual_file', file)

        await api.post('/conversions/individual-files/', formData, {
          headers: {
            'Content-Type': 'multipart/form-data'
          }
        })
      }

      toast.success(`${files.length} individual file(s) uploaded successfully!`)
      fetchIndividualFiles()
    } catch (error) {
      console.error('Error uploading individual files:', error)
      const errorMessage = error.response?.data?.detail || 'Failed to upload some individual files'
      toast.error(errorMessage)
    } finally {
      setLoading(false)
      event.target.value = ''
    }
  }

  // Delete conversion file
  const handleDeleteConversionFile = async (fileId) => {
    const file = conversionFiles.find(f => f.id === fileId)
    const proceed = await showConfirmDialog(
      'Delete Conversion File',
      <div className="space-y-3">
        <p>Are you sure you want to delete this conversion file?</p>
        {file && (
          <div className="bg-gray-50 dark:bg-gray-800 p-3 rounded border">
            <p className="font-medium text-gray-900 dark:text-gray-100">{file.name}</p>
            <p className="text-sm text-gray-600 dark:text-gray-400 break-all">
              {file.filename}
            </p>
            <p className="text-sm text-gray-600 dark:text-gray-400">
              {(file.file_size / 1024).toFixed(1)} KB
            </p>
          </div>
        )}
        <p className="text-red-600 dark:text-red-400 text-sm">
          ⚠️ This action cannot be undone.
        </p>
      </div>,
      null,
      {
        confirmText: 'Delete',
        cancelText: 'Cancel',
        type: 'danger'
      }
    )
    if (!proceed) return

    try {
      await api.delete(`/conversions/conversion-files/${fileId}`)
      toast.success('Conversion file deleted successfully!')

      // If the deleted file was selected, deselect it
      if (selectedConversionFile?.id === fileId) {
        setSelectedConversionFile(null)
      }

      fetchConversionFiles()
    } catch (error) {
      console.error('Error deleting conversion file:', error)
      toast.error('Failed to delete conversion file')
    }
  }

  // Delete individual file
  const handleDeleteIndividualFile = async (fileId) => {
    const file = individualFiles.find(f => f.id === fileId)
    const proceed = await showConfirmDialog(
      'Delete Individual File',
      <div className="space-y-3">
        <p>Are you sure you want to delete this individual file?</p>
        {file && (
          <div className="bg-gray-50 dark:bg-gray-800 p-3 rounded border">
            <p className="font-medium text-gray-900 dark:text-gray-100">{file.name}</p>
            <p className="text-sm text-gray-600 dark:text-gray-400 break-all">
              {file.filename}
            </p>
            <p className="text-sm text-gray-600 dark:text-gray-400">
              {(file.file_size / 1024).toFixed(1)} KB
            </p>
          </div>
        )}
        <p className="text-red-600 dark:text-red-400 text-sm">
          ⚠️ This action cannot be undone.
        </p>
      </div>,
      null,
      {
        confirmText: 'Delete',
        cancelText: 'Cancel',
        type: 'danger'
      }
    )
    if (!proceed) return

    try {
      await api.delete(`/conversions/individual-files/${fileId}`)
      toast.success('Individual file deleted successfully!')

      // Remove from selected files if it was selected
      setSelectedIndividualFiles(prev => {
        const newSet = new Set(prev)
        newSet.delete(fileId)
        return newSet
      })

      fetchIndividualFiles()
    } catch (error) {
      console.error('Error deleting individual file:', error)
      toast.error('Failed to delete individual file')
    }
  }

  // Start conversion with selected files (completely independent)
  const handleStartConversion = async () => {
    if (!selectedConversionFile || selectedIndividualFiles.size === 0) {
      toast.error('Please select a conversion file and at least one individual file')
      return
    }

    setLoading(true)
    try {
      const selectedFiles = Array.from(selectedIndividualFiles)

      await api.post('/conversions/start-conversion/', {
        conversion_file_id: selectedConversionFile.id,
        individual_file_ids: selectedFiles
      })

      toast.success(`Conversion started for ${selectedFiles.length} file(s)!`)

      // Clear selections after starting conversion
      setSelectedIndividualFiles(new Set())

      // Force immediate refresh of conversion groups
      await fetchConversionGroups()

      // Force a second refresh after a short delay to catch any quick status changes
      setTimeout(() => {
        fetchConversionGroups()
      }, 1000)

    } catch (error) {
      console.error('Error starting conversion:', error)
      const errorMessage = error.response?.data?.detail || error.response?.data?.message || 'Failed to start conversion'
      toast.error(errorMessage)
    } finally {
      setLoading(false)
    }
  }

  // Download result file with loading state
  const handleDownloadResult = async (groupId, resultId, filename, fileSize = 0) => {
    // Warn for large files (>3MB)
    if (fileSize > 3 * 1024 * 1024) {
      const proceed = await showConfirmDialog(
        'Large File Download',
        <div className="space-y-2">
          <p>This file is <strong>{(fileSize / (1024 * 1024)).toFixed(1)}MB</strong> and may take some time to download.</p>
          <div className="text-sm text-gray-600 break-all bg-gray-50 dark:bg-gray-800 p-2 rounded">
            {filename}
          </div>
          <p>Do you want to continue?</p>
        </div>,
        null,
        {
          confirmText: 'Download',
          cancelText: 'Cancel',
          type: 'warning'
        }
      )
      if (!proceed) return
    }

    // Add to downloading set
    setDownloadingFiles(prev => new Set([...prev, resultId]))

    try {
      // Show immediate feedback with proper styling for long filenames
      toast.loading(
        <div className="flex flex-col">
          <span className="font-medium">Preparing download...</span>
          <span className="text-sm text-gray-600 break-all">{filename}</span>
        </div>,
        {
          id: `download-${resultId}`,
          style: {
            maxWidth: '400px',
            width: '400px'
          }
        }
      )

      const response = await api.get(
        `/conversions/groups/${groupId}/download/${resultId}`,
        {
          responseType: 'blob',
          timeout: 60000, // 60 second timeout for large files
        }
      )

      // Create and trigger download
      const url = window.URL.createObjectURL(new Blob([response.data]))
      const link = document.createElement('a')
      link.href = url
      link.setAttribute('download', filename)
      document.body.appendChild(link)
      link.click()
      link.remove()
      window.URL.revokeObjectURL(url)

      // Success feedback with proper styling
      toast.success(
        <div className="flex flex-col">
          <span className="font-medium">Downloaded successfully!</span>
          <span className="text-sm text-gray-600 break-all">{filename}</span>
        </div>,
        {
          id: `download-${resultId}`,
          style: {
            maxWidth: '400px',
            width: '400px'
          }
        }
      )
    } catch (error) {
      console.error('Error downloading file:', error)

      // Enhanced error messages
      let errorMessage = 'Failed to download file'
      if (error.code === 'ECONNABORTED') {
        errorMessage = 'Download timeout - file may be too large'
      } else if (error.response?.status === 404) {
        errorMessage = 'File not found'
      } else if (error.response?.status === 403) {
        errorMessage = 'Access denied'
      } else if (!navigator.onLine) {
        errorMessage = 'No internet connection'
      }

      toast.error(errorMessage, { id: `download-${resultId}` })
    } finally {
      // Remove from downloading set
      setDownloadingFiles(prev => {
        const newSet = new Set(prev)
        newSet.delete(resultId)
        return newSet
      })
    }
  }

  // Download all files in a group
  const handleDownloadAllResults = async (groupId, results) => {
    const totalSize = results.reduce((sum, result) => sum + result.file_size, 0)

    if (totalSize > 10 * 1024 * 1024) { // >10MB
      const proceed = await showConfirmDialog(
        'Bulk Download Warning',
        <div className="space-y-3">
          <p>You're about to download <strong>{results.length} files</strong> with a total size of <strong>{(totalSize / (1024 * 1024)).toFixed(1)}MB</strong>.</p>
          <div className="bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded p-3">
            <p className="text-sm text-amber-800 dark:text-amber-200">
              ⚠️ This may take some time and consume significant bandwidth.
            </p>
          </div>
          <p>Do you want to continue?</p>
        </div>,
        null,
        {
          confirmText: 'Download All',
          cancelText: 'Cancel',
          type: 'warning'
        }
      )
      if (!proceed) return
    }

    // Download files sequentially to avoid overwhelming the server
    for (const result of results) {
      if (!downloadingFiles.has(result.id)) {
        await handleDownloadResult(groupId, result.id, result.filename, result.file_size)
        // Small delay between downloads
        await new Promise(resolve => setTimeout(resolve, 500))
      }
    }
  }

  // Delete conversion
  const handleDeleteGroup = async (groupId) => {
    const group = conversionGroups.find(g => g.id === groupId)
    const proceed = await showConfirmDialog(
      'Delete Conversion',
      <div className="space-y-3">
        <p>Are you sure you want to delete this conversion?</p>
        {group && (
          <div className="bg-gray-50 dark:bg-gray-800 p-3 rounded border">
            <p className="font-medium text-gray-900 dark:text-gray-100">{group.name}</p>
            <p className="text-sm text-gray-600 dark:text-gray-400">
              Source: {group.individual_file?.name}
            </p>
            {group.results && group.results.length > 0 && (
              <p className="text-sm text-gray-600 dark:text-gray-400">
                Contains {group.results.length} result files
              </p>
            )}
          </div>
        )}
        <p className="text-red-600 dark:text-red-400 text-sm">
          ⚠️ This action cannot be undone and will delete all associated files.
        </p>
      </div>,
      null,
      {
        confirmText: 'Delete',
        cancelText: 'Cancel',
        type: 'danger'
      }
    )
    if (!proceed) return

    try {
      await api.delete(`/conversions/groups/${groupId}`)
      toast.success('Conversion deleted successfully!')
      fetchConversionGroups()
    } catch (error) {
      console.error('Error deleting conversion:', error)
      toast.error('Failed to delete conversion')
    }
  }

  // Delete result file
  const handleDeleteResult = async (resultId) => {
    const result = selectedGroup?.results?.find(r => r.id === resultId)
    const proceed = await showConfirmDialog(
      'Delete Result File',
      <div className="space-y-3">
        <p>Are you sure you want to delete this result file?</p>
        {result && (
          <div className="bg-gray-50 dark:bg-gray-800 p-3 rounded border">
            <p className="font-medium text-gray-900 dark:text-gray-100">{result.output_name}</p>
            <p className="text-sm text-gray-600 dark:text-gray-400 break-all">
              {result.filename}
            </p>
            <p className="text-sm text-gray-600 dark:text-gray-400">
              {result.total_records.toLocaleString()} records • {
                result.file_size > 1024 * 1024
                  ? `${(result.file_size / (1024 * 1024)).toFixed(1)} MB`
                  : `${(result.file_size / 1024).toFixed(1)} KB`
              }
            </p>
          </div>
        )}
        <p className="text-red-600 dark:text-red-400 text-sm">
          ⚠️ This action cannot be undone.
        </p>
      </div>,
      null,
      {
        confirmText: 'Delete',
        cancelText: 'Cancel',
        type: 'danger'
      }
    )
    if (!proceed) return

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
                <p className="text-gray-600 dark:text-dark-muted">Upload and select one conversion file containing Name → RsID mappings (independent of individual files)</p>
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
                  className={`p-4 border rounded-xl transition-all duration-200 relative group ${
                    selectedConversionFile?.id === file.id
                      ? 'border-orange-500 bg-orange-50 dark:bg-orange-900/20'
                      : 'border-gray-200 dark:border-dark-border hover:border-orange-300 dark:hover:border-orange-600'
                  }`}
                >
                  <div
                    className="flex items-center space-x-3 cursor-pointer"
                    onClick={() => setSelectedConversionFile(file)}
                  >
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
                  <button
                    onClick={(e) => {
                      e.stopPropagation()
                      handleDeleteConversionFile(file.id)
                    }}
                    className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 p-1 text-red-600 hover:bg-red-100 dark:hover:bg-red-900/20 rounded transition-all duration-200"
                    title="Delete conversion file"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
              ))}
              {conversionFiles.length === 0 && (
                <div className="col-span-full text-center py-8 text-gray-500 dark:text-dark-muted">
                  No conversion files available. Upload one to get started.
                </div>
              )}
            </div>
          </div>

          {/* Step 2: Upload and Select Individual Files */}
          <div className="bg-white dark:bg-dark-card rounded-2xl shadow-lg p-6 border border-gray-200/50 dark:border-dark-border">
            <div className="flex items-center justify-between mb-4">
              <div>
                <h2 className="text-lg font-semibold text-gray-800 dark:text-dark-text">Step 2: Upload and Select Individual Files</h2>
                <p className="text-gray-600 dark:text-dark-muted">Upload individual data files independently and select multiple files for processing</p>
              </div>
              <label className={`flex items-center space-x-2 px-4 py-2 rounded-xl transition-all duration-200 ${
                loading
                  ? 'bg-gray-400 cursor-not-allowed text-white'
                  : 'bg-gradient-to-r from-blue-500 to-indigo-600 text-white cursor-pointer hover:from-blue-600 hover:to-indigo-700'
              }`}>
                <Upload className="h-4 w-4" />
                <span>{loading ? 'Uploading...' : 'Upload Individual Files'}</span>
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

            {individualFiles.filter(f => f.is_uploaded).length > 0 && (
              <div className="mb-4 p-3 bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg">
                <div className="flex items-center justify-between">
                  <p className="text-sm text-gray-700 dark:text-gray-300">
                    <strong>{selectedIndividualFiles.size}</strong> of <strong>{individualFiles.filter(f => f.is_uploaded).length}</strong> file(s) selected for conversion
                  </p>
                  <div className="flex space-x-2">
                    <button
                      onClick={() => {
                        const uploadedFiles = individualFiles.filter(f => f.is_uploaded).map(f => f.id)
                        setSelectedIndividualFiles(new Set(uploadedFiles))
                      }}
                      className="text-xs px-2 py-1 bg-blue-100 text-blue-700 dark:bg-blue-900/20 dark:text-blue-400 rounded hover:bg-blue-200 dark:hover:bg-blue-900/40 transition-colors"
                    >
                      Select All
                    </button>
                    <button
                      onClick={() => setSelectedIndividualFiles(new Set())}
                      className="text-xs px-2 py-1 bg-gray-100 text-gray-700 dark:bg-gray-700 dark:text-gray-300 rounded hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors"
                    >
                      Clear
                    </button>
                  </div>
                </div>
              </div>
            )}

            {/* Individual Files Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {individualFiles.map((file) => (
                <div
                  key={file.id}
                  className={`p-4 border rounded-xl transition-all duration-200 relative group cursor-pointer ${
                    selectedIndividualFiles.has(file.id) && file.is_uploaded
                      ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/20 shadow-md'
                      : file.is_uploaded
                        ? 'border-gray-200 dark:border-dark-border hover:border-blue-300 dark:hover:border-blue-600 hover:shadow-md'
                        : 'border-gray-200 dark:border-dark-border bg-gray-50 dark:bg-gray-800/50'
                  }`}
                  onClick={() => {
                    if (file.is_uploaded) {
                      setSelectedIndividualFiles(prev => {
                        const newSet = new Set(prev)
                        if (newSet.has(file.id)) {
                          newSet.delete(file.id)
                        } else {
                          newSet.add(file.id)
                        }
                        return newSet
                      })
                    }
                  }}
                >
                  {/* Card Header */}
                  <div className="flex items-start justify-between mb-3">
                    <div className="flex items-center space-x-3">
                      {selectedIndividualFiles.has(file.id) && file.is_uploaded ? (
                        <CheckCircle className="h-5 w-5 text-blue-600 flex-shrink-0" />
                      ) : (
                        <Users className={`h-5 w-5 flex-shrink-0 ${
                          file.is_uploaded ? 'text-blue-500' : 'text-gray-400'
                        }`} />
                      )}
                      <div className="flex-1 min-w-0">
                        <h3 className="text-sm font-medium text-gray-900 dark:text-dark-text truncate">
                          {file.name}
                        </h3>
                      </div>
                    </div>

                    {/* Status Badge */}
                    <span className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${
                      file.is_uploaded
                        ? 'bg-green-100 text-green-800 dark:bg-green-900/20 dark:text-green-400'
                        : 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/20 dark:text-yellow-400'
                    }`}>
                      {file.is_uploaded ? 'Ready' : 'Uploading'}
                    </span>
                  </div>

                  {/* File Details */}
                  <div className="space-y-2">
                    <p className="text-xs text-gray-500 dark:text-dark-muted truncate">
                      {file.filename}
                    </p>
                    <p className="text-xs text-gray-500 dark:text-dark-muted">
                      Size: {(file.file_size / 1024).toFixed(1)} KB
                    </p>
                    <p className="text-xs text-gray-400 dark:text-gray-500">
                      Uploaded: {new Date(file.created_at).toLocaleDateString()}
                    </p>
                  </div>

                  {/* Upload Progress */}
                  {!file.is_uploaded && (
                    <div className="mt-4 space-y-2">
                      <div className="w-full bg-gray-200 dark:bg-dark-border rounded-full h-2">
                        <div
                          className="bg-gradient-to-r from-blue-500 to-indigo-600 h-2 rounded-full transition-all duration-300"
                          style={{ width: `${file.upload_progress || 0}%` }}
                        ></div>
                      </div>
                      <div className="flex justify-between items-center">
                        <span className="text-xs text-gray-600 dark:text-dark-muted">
                          Progress: {file.upload_progress || 0}%
                        </span>
                        {file.upload_progress === 100 && (
                          <span className="text-xs text-blue-600 dark:text-blue-400 font-medium">
                            Processing...
                          </span>
                        )}
                      </div>
                    </div>
                  )}

                  {/* Selection Indicator */}
                  {selectedIndividualFiles.has(file.id) && file.is_uploaded && (
                    <div className="absolute top-2 right-2">
                      <div className="w-3 h-3 bg-blue-600 rounded-full border-2 border-white dark:border-gray-800"></div>
                    </div>
                  )}

                  {/* Delete Button */}
                  <button
                    onClick={(e) => {
                      e.stopPropagation()
                      handleDeleteIndividualFile(file.id)
                    }}
                    className="opacity-0 group-hover:opacity-100 transition-opacity duration-200 absolute bottom-2 right-2 p-1.5 text-red-500 hover:text-red-700 dark:text-red-400 dark:hover:text-red-300 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-md"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
              ))}
              {individualFiles.length === 0 && (
                <div className="text-center py-8 text-gray-500 dark:text-dark-muted">
                  No individual files uploaded yet
                </div>
              )}
            </div>
          </div>

          {/* Step 3: Start Conversion */}
          <div className="bg-white dark:bg-dark-card rounded-2xl shadow-lg p-6 border border-gray-200/50 dark:border-dark-border">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-lg font-semibold text-gray-800 dark:text-dark-text">Step 3: Start Conversion</h2>
                {selectedConversionFile && selectedIndividualFiles.size > 0 ? (
                  <div className="space-y-2">
                    <p className="text-gray-600 dark:text-dark-muted">
                      Ready to process <strong>{selectedIndividualFiles.size}</strong> individual file(s) with conversion file <strong>{selectedConversionFile.name}</strong>
                    </p>
                    <div className="text-sm text-blue-600 dark:text-blue-400">
                      ✓ Files are independently managed and can be uploaded/deleted separately
                    </div>
                  </div>
                ) : (
                  <div className="space-y-2">
                    <p className="text-gray-600 dark:text-dark-muted">
                      Select one conversion file and multiple individual files to start processing
                    </p>
                    <div className="text-sm text-gray-500 dark:text-gray-400">
                      Files can be uploaded and managed independently of each other
                    </div>
                  </div>
                )}
              </div>
              <button
                onClick={handleStartConversion}
                disabled={loading || !selectedConversionFile || selectedIndividualFiles.size === 0}
                className="flex items-center space-x-2 px-6 py-3 bg-gradient-to-r from-green-500 to-emerald-600 text-white rounded-xl disabled:opacity-50 disabled:cursor-not-allowed hover:from-green-600 hover:to-emerald-700 transition-all duration-200 font-medium"
              >
                <Play className="h-5 w-5" />
                <span>Start Conversion</span>
              </button>
            </div>

            {/* Active Conversions Progress */}
            {getSortedGroups().filter(g => g.status === 'processing' || g.status === 'pending').length > 0 && (
              <div className="mt-6 space-y-4">
                <h3 className="text-md font-semibold text-gray-800 dark:text-dark-text">Active Conversions</h3>
                {getSortedGroups().filter(g => g.status === 'processing' || g.status === 'pending').map((group) => (
                  <div key={group.id} className="p-4 bg-blue-50 dark:bg-blue-900/20 rounded-lg border border-blue-200 dark:border-blue-800">
                    <div className="flex items-center justify-between mb-2">
                      <h4 className="text-sm font-medium text-gray-900 dark:text-dark-text">
                        #{getSortedGroups().findIndex(g => g.id === group.id) + 1} {group.name}
                      </h4>
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
                <span>{conversionGroups.length} Conversions</span>
              </div>
            </div>
          </div>

          {/* Main Results Layout */}
          {conversionGroups.length > 0 ? (
            <div className="bg-white dark:bg-dark-card rounded-2xl shadow-lg border border-gray-200/50 dark:border-dark-border overflow-hidden">
              <div className="flex h-[600px]">
                {/* Left Sidebar - Conversions List */}
                <div className="w-80 border-r border-gray-200/50 dark:border-dark-border flex flex-col">
                  <div className="p-4 border-b border-gray-200/50 dark:border-dark-border">
                    <h3 className="text-md font-semibold text-gray-800 dark:text-dark-text">Conversions</h3>
                    <p className="text-sm text-gray-600 dark:text-dark-muted">{conversionGroups.length} conversions available</p>
                  </div>
                  <div className="flex-1 overflow-y-auto">
                    <div className="space-y-1 p-2">
                      {getSortedGroups().map((group, index) => (
                        <div
                          key={group.id}
                          className={`p-4 rounded-lg cursor-pointer transition-all duration-200 ${
                            selectedGroup?.id === group.id
                              ? 'bg-orange-50 dark:bg-orange-900/20 border border-orange-200 dark:border-orange-800'
                              : 'hover:bg-gray-50 dark:hover:bg-dark-hover border border-transparent'
                          }`}
                          onClick={() => setSelectedGroup(group)}
                        >
                          <div className="flex items-start space-x-3">
                            {getStatusIcon(group.status)}
                            <div className="flex-1 min-w-0">
                              <h4 className="text-sm font-medium text-gray-800 dark:text-dark-text truncate">
                                #{index + 1} {group.name}
                              </h4>
                              <p className="text-xs text-gray-600 dark:text-dark-muted truncate">
                                {group.individual_file?.name}
                              </p>
                              <div className="flex items-center justify-between mt-2">
                                <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${getStatusColor(group.status)}`}>
                                  {group.status}
                                </span>
                                {group.results && (
                                  <span className="text-xs text-gray-500 dark:text-dark-muted">
                                    {group.results.length} files
                                  </span>
                                )}
                              </div>

                              {/* Progress Bar for Processing Groups */}
                              {group.status === 'processing' && (
                                <div className="mt-2">
                                  <div className="flex items-center justify-between text-xs text-gray-600 dark:text-dark-muted mb-1">
                                    <span>Processing...</span>
                                    <span>{group.progress}%</span>
                                  </div>
                                  <div className="w-full bg-gray-200 dark:bg-dark-hover rounded-full h-1">
                                    <div
                                      className="bg-gradient-to-r from-blue-500 to-indigo-600 h-1 rounded-full transition-all duration-300"
                                      style={{ width: `${group.progress}%` }}
                                    ></div>
                                  </div>
                                  <div className="text-xs text-gray-500 dark:text-dark-muted mt-1">
                                    {group.processed_outputs} / {group.total_outputs}
                                  </div>
                                </div>
                              )}
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>

                {/* Right Panel - Selected Conversion Details */}
                <div className="flex-1 flex flex-col">
                  {selectedGroup ? (
                    <>
                      {/* Conversion Header */}
                      <div className="p-6 border-b border-gray-200/50 dark:border-dark-border">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center space-x-4">
                            {getStatusIcon(selectedGroup.status)}
                            <div>
                              <h3 className="text-lg font-semibold text-gray-800 dark:text-dark-text">
                                #{getSortedGroups().findIndex(g => g.id === selectedGroup.id) + 1} {selectedGroup.name}
                              </h3>
                              <p className="text-gray-600 dark:text-dark-muted">
                                Source: {selectedGroup.individual_file?.name} • Created {new Date(selectedGroup.created_at).toLocaleDateString()}
                              </p>
                            </div>
                          </div>
                          <div className="flex items-center space-x-3">
                            <span className={`inline-flex items-center px-3 py-1 rounded-full text-sm font-medium ${getStatusColor(selectedGroup.status)}`}>
                              {selectedGroup.status}
                            </span>
                            <button
                              onClick={() => handleDeleteGroup(selectedGroup.id)}
                              className="p-2 text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg transition-colors"
                              title="Delete Conversion"
                            >
                              <Trash2 className="h-4 w-4" />
                            </button>
                          </div>
                        </div>

                        {/* Progress Bar for Processing */}
                        {selectedGroup.status === 'processing' && (
                          <div className="mt-4">
                            <div className="flex items-center justify-between text-sm text-gray-600 dark:text-dark-muted mb-2">
                              <span>Processing outputs...</span>
                              <span>{selectedGroup.progress}%</span>
                            </div>
                            <div className="w-full bg-gray-200 dark:bg-dark-hover rounded-full h-2">
                              <div
                                className="bg-gradient-to-r from-blue-500 to-indigo-600 h-2 rounded-full transition-all duration-300"
                                style={{ width: `${selectedGroup.progress}%` }}
                              ></div>
                            </div>
                            <div className="text-sm text-gray-600 dark:text-dark-muted mt-1">
                              {selectedGroup.processed_outputs} / {selectedGroup.total_outputs} outputs completed
                            </div>
                          </div>
                        )}

                        {/* Error Message */}
                        {selectedGroup.error_message && (
                          <div className="mt-4 p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg">
                            <div className="flex items-center space-x-2">
                              <AlertCircle className="h-4 w-4 text-red-500 flex-shrink-0" />
                              <p className="text-red-600 dark:text-red-400 text-sm">{selectedGroup.error_message}</p>
                            </div>
                          </div>
                        )}
                      </div>

                      {/* Source File Information */}
                      {selectedGroup.individual_file && (
                        <div className="px-6 py-4 bg-gray-50 dark:bg-gray-800/50 border-b border-gray-200/50 dark:border-dark-border">
                          <h4 className="text-sm font-semibold text-gray-800 dark:text-dark-text mb-3">Source File Information</h4>
                          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                            <div className="space-y-1">
                              <p className="text-xs text-gray-500 dark:text-dark-muted">File Name</p>
                              <p className="text-sm font-medium text-gray-900 dark:text-dark-text truncate">
                                {selectedGroup.individual_file.name}
                              </p>
                            </div>
                            <div className="space-y-1">
                              <p className="text-xs text-gray-500 dark:text-dark-muted">Original Filename</p>
                              <p className="text-sm text-gray-700 dark:text-gray-300 truncate">
                                {selectedGroup.individual_file.filename}
                              </p>
                            </div>
                            <div className="space-y-1">
                              <p className="text-xs text-gray-500 dark:text-dark-muted">File Size</p>
                              <p className="text-sm text-gray-700 dark:text-gray-300">
                                {selectedGroup.individual_file.file_size > 1024 * 1024
                                  ? `${(selectedGroup.individual_file.file_size / (1024 * 1024)).toFixed(2)} MB`
                                  : `${(selectedGroup.individual_file.file_size / 1024).toFixed(1)} KB`
                                }
                              </p>
                            </div>
                            <div className="space-y-1">
                              <p className="text-xs text-gray-500 dark:text-dark-muted">Upload Status</p>
                              <div className="flex items-center space-x-2">
                                <span className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${
                                  selectedGroup.individual_file.is_uploaded
                                    ? 'bg-green-100 text-green-800 dark:bg-green-900/20 dark:text-green-400'
                                    : 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/20 dark:text-yellow-400'
                                }`}>
                                  {selectedGroup.individual_file.is_uploaded ? 'Uploaded' : 'Processing'}
                                </span>
                                {!selectedGroup.individual_file.is_uploaded && (
                                  <span className="text-xs text-gray-500">
                                    {selectedGroup.individual_file.upload_progress || 0}%
                                  </span>
                                )}
                              </div>
                            </div>
                            <div className="space-y-1">
                              <p className="text-xs text-gray-500 dark:text-dark-muted">Upload Date</p>
                              <p className="text-sm text-gray-700 dark:text-gray-300">
                                {new Date(selectedGroup.individual_file.created_at).toLocaleDateString()} {new Date(selectedGroup.individual_file.created_at).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}
                              </p>
                            </div>
                            <div className="space-y-1">
                              <p className="text-xs text-gray-500 dark:text-dark-muted">Processing Progress</p>
                              <div className="flex items-center space-x-2">
                                <div className="flex-1">
                                  <div className="w-full bg-gray-200 dark:bg-dark-border rounded-full h-1.5">
                                    <div
                                      className={`h-1.5 rounded-full transition-all duration-300 ${
                                        selectedGroup.status === 'completed'
                                          ? 'bg-green-500'
                                          : selectedGroup.status === 'processing'
                                            ? 'bg-blue-500'
                                            : selectedGroup.status === 'error'
                                              ? 'bg-red-500'
                                              : 'bg-gray-400'
                                      }`}
                                      style={{ width: `${selectedGroup.status === 'completed' ? 100 : selectedGroup.progress || 0}%` }}
                                    ></div>
                                  </div>
                                </div>
                                <span className="text-xs text-gray-600 dark:text-dark-muted min-w-0">
                                  {selectedGroup.status === 'completed' ? '100%' : `${selectedGroup.progress || 0}%`}
                                </span>
                              </div>
                            </div>
                          </div>
                        </div>
                      )}

                      {/* Result Files */}
                      <div className="flex-1 overflow-y-auto p-6">
                        {selectedGroup.results && selectedGroup.results.length > 0 ? (
                          <>
                            <div className="flex items-center justify-between mb-4">
                              <h4 className="text-md font-semibold text-gray-800 dark:text-dark-text">
                                Output Files ({selectedGroup.results.length})
                              </h4>
                              <div className="flex items-center space-x-3">
                                <span className="text-sm text-gray-600 dark:text-dark-muted">
                                  Total: {selectedGroup.results.reduce((sum, result) => sum + result.total_records, 0).toLocaleString()} records
                                </span>
                                <button
                                  onClick={() => handleDownloadAllResults(selectedGroup.id, selectedGroup.results)}
                                  disabled={selectedGroup.results.some(result => downloadingFiles.has(result.id))}
                                  className={`flex items-center space-x-2 px-3 py-2 rounded-lg transition-all duration-200 text-sm font-medium ${
                                    selectedGroup.results.some(result => downloadingFiles.has(result.id))
                                      ? 'bg-gray-100 text-gray-400 dark:bg-gray-800 dark:text-gray-500 cursor-not-allowed'
                                      : 'bg-blue-100 text-blue-700 dark:bg-blue-900/20 dark:text-blue-400 hover:bg-blue-200 dark:hover:bg-blue-900/40'
                                  }`}
                                >
                                  <Download className="h-4 w-4" />
                                  <span>Download All</span>
                                </button>
                              </div>
                            </div>

                            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                              {selectedGroup.results.map((result) => (
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
                                        <div className="flex items-center space-x-2">
                                          <p className="text-xs text-gray-600 dark:text-dark-muted">
                                            {result.file_size > 1024 * 1024
                                              ? `${(result.file_size / (1024 * 1024)).toFixed(1)} MB`
                                              : `${(result.file_size / 1024).toFixed(1)} KB`
                                            }
                                          </p>
                                          {result.file_size > 3 * 1024 * 1024 && (
                                            <span className="inline-flex items-center px-1.5 py-0.5 rounded text-xs font-medium bg-amber-100 text-amber-800 dark:bg-amber-900/20 dark:text-amber-400" title="Large file - may take time to download">
                                              Large
                                            </span>
                                          )}
                                        </div>
                                        <p className="text-xs text-gray-500 dark:text-dark-muted truncate">
                                          {result.filename}
                                        </p>
                                      </div>
                                    </div>
                                  </div>

                                  <div className="flex items-center space-x-2 mt-3">
                                    <button
                                      onClick={() => handleDownloadResult(selectedGroup.id, result.id, result.filename, result.file_size)}
                                      disabled={downloadingFiles.has(result.id)}
                                      className={`flex-1 flex items-center justify-center space-x-2 px-3 py-2 rounded-lg transition-all duration-200 text-sm font-medium ${
                                        downloadingFiles.has(result.id)
                                          ? 'bg-gray-100 text-gray-400 dark:bg-gray-800 dark:text-gray-500 cursor-not-allowed'
                                          : 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/20 dark:text-emerald-400 hover:bg-emerald-200 dark:hover:bg-emerald-900/40'
                                      }`}
                                    >
                                      {downloadingFiles.has(result.id) ? (
                                        <>
                                          <div className="animate-spin rounded-full h-3 w-3 border-b-2 border-gray-400"></div>
                                          <span>Downloading...</span>
                                        </>
                                      ) : (
                                        <>
                                          <Download className="h-3 w-3" />
                                          <span>Download</span>
                                        </>
                                      )}
                                    </button>
                                    <button
                                      onClick={() => handleDeleteResult(result.id)}
                                      disabled={downloadingFiles.has(result.id)}
                                      className={`p-2 rounded-lg transition-colors ${
                                        downloadingFiles.has(result.id)
                                          ? 'text-gray-400 cursor-not-allowed'
                                          : 'text-red-600 hover:bg-red-100 dark:hover:bg-red-900/20'
                                      }`}
                                      title="Delete File"
                                    >
                                      <Trash2 className="h-3 w-3" />
                                    </button>
                                  </div>
                                </div>
                              ))}
                            </div>
                          </>
                        ) : selectedGroup.status === 'completed' ? (
                          <div className="text-center py-12 text-gray-500 dark:text-dark-muted">
                            <FileText className="h-12 w-12 mx-auto mb-3 opacity-50" />
                            <h4 className="text-lg font-medium mb-2">No Output Files</h4>
                            <p className="text-sm">This conversion completed but generated no output files</p>
                          </div>
                        ) : selectedGroup.status === 'pending' ? (
                          <div className="text-center py-12 text-gray-500 dark:text-dark-muted">
                            <Clock className="h-12 w-12 mx-auto mb-3 opacity-50" />
                            <h4 className="text-lg font-medium mb-2">Processing Pending</h4>
                            <p className="text-sm">This conversion is waiting to start processing...</p>
                          </div>
                        ) : selectedGroup.status === 'processing' ? (
                          <div className="text-center py-12 text-gray-500 dark:text-dark-muted">
                            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500 mx-auto mb-3"></div>
                            <h4 className="text-lg font-medium mb-2">Processing...</h4>
                            <p className="text-sm">Files will appear here as they are generated</p>
                          </div>
                        ) : (
                          <div className="text-center py-12 text-gray-500 dark:text-dark-muted">
                            <AlertCircle className="h-12 w-12 mx-auto mb-3 opacity-50" />
                            <h4 className="text-lg font-medium mb-2">Conversion Failed</h4>
                            <p className="text-sm">Check the error message above for details</p>
                          </div>
                        )}
                      </div>
                    </>
                  ) : (
                    <div className="flex-1 flex items-center justify-center text-gray-500 dark:text-dark-muted">
                      <div className="text-center">
                        <Target className="h-16 w-16 mx-auto mb-4 opacity-50" />
                        <h4 className="text-lg font-medium mb-2">Select a Group</h4>
                        <p className="text-sm">Choose a conversion from the list to view its results</p>
                      </div>
                    </div>
                  )}
                </div>
              </div>
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

      {/* Custom Confirmation Dialog */}
      {confirmDialog.open && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50">
          <div className="bg-white dark:bg-dark-card rounded-2xl shadow-2xl border border-gray-200/50 dark:border-dark-border max-w-md w-full mx-4 overflow-hidden">
            <div className="p-6">
              <div className="flex items-start space-x-4">
                <div className={`flex-shrink-0 p-2 rounded-full ${
                  confirmDialog.type === 'danger'
                    ? 'bg-red-100 dark:bg-red-900/20'
                    : confirmDialog.type === 'warning'
                    ? 'bg-amber-100 dark:bg-amber-900/20'
                    : 'bg-blue-100 dark:bg-blue-900/20'
                }`}>
                  {confirmDialog.type === 'danger' ? (
                    <AlertCircle className="h-6 w-6 text-red-600 dark:text-red-400" />
                  ) : confirmDialog.type === 'warning' ? (
                    <AlertCircle className="h-6 w-6 text-amber-600 dark:text-amber-400" />
                  ) : (
                    <AlertCircle className="h-6 w-6 text-blue-600 dark:text-blue-400" />
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <h3 className="text-lg font-semibold text-gray-900 dark:text-dark-text mb-3">
                    {confirmDialog.title}
                  </h3>
                  <div className="text-gray-600 dark:text-dark-muted">
                    {confirmDialog.message}
                  </div>
                </div>
              </div>
            </div>

            <div className="bg-gray-50 dark:bg-dark-hover px-6 py-4 flex items-center justify-end space-x-3">
              <button
                onClick={confirmDialog.onCancel}
                className="px-4 py-2 text-gray-600 dark:text-dark-muted hover:text-gray-800 dark:hover:text-dark-text border border-gray-300 dark:border-dark-border rounded-lg hover:bg-gray-100 dark:hover:bg-dark-card transition-colors"
              >
                {confirmDialog.cancelText}
              </button>
              <button
                onClick={confirmDialog.onConfirm}
                className={`px-4 py-2 rounded-lg font-medium transition-colors ${
                  confirmDialog.type === 'danger'
                    ? 'bg-red-600 hover:bg-red-700 text-white'
                    : confirmDialog.type === 'warning'
                    ? 'bg-amber-600 hover:bg-amber-700 text-white'
                    : 'bg-blue-600 hover:bg-blue-700 text-white'
                }`}
              >
                {confirmDialog.confirmText}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

export default ConversionManager