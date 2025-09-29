import { useState, useEffect, useRef } from 'react'
import { useAuth } from '../contexts/AuthContext'
import { toast } from 'react-hot-toast'
import api from '../utils/api'
import ConfirmDialog from '../components/ConfirmDialog'
import {
  Upload,
  Download,
  Trash2,
  Play,
  CheckCircle,
  AlertCircle,
  Clock,
  Settings,
  FileText,
  FolderOpen,
  Package,
  ArrowRight,
  RefreshCw
} from 'lucide-react'

const Conversion = () => {
  const { user } = useAuth()
  const [activeTab, setActiveTab] = useState('files')
  const [loading, setLoading] = useState(false)

  // File Management state
  const [conversionFiles, setConversionFiles] = useState([])
  const [individualFiles, setIndividualFiles] = useState([])
  const [uploadingConversion, setUploadingConversion] = useState(false)
  const [uploadingIndividual, setUploadingIndividual] = useState(false)
  const [uploadProgress, setUploadProgress] = useState(0)

  // Conversion state
  const [conversionJobs, setConversionJobs] = useState([])
  const [selectedConversionFile, setSelectedConversionFile] = useState(null)
  const [selectedIndividualFiles, setSelectedIndividualFiles] = useState([])
  const [submittingJob, setSubmittingJob] = useState(false)

  // Results state
  const [resultGroups, setResultGroups] = useState([])
  const [selectedGroup, setSelectedGroup] = useState(null)
  const [groupFiles, setGroupFiles] = useState([])

  // File upload refs
  const conversionFileRef = useRef(null)
  const individualFileRef = useRef(null)

  // Progress polling refs
  const progressUpdateInterval = useRef(null)
  const activeJobsRef = useRef([])

  // Confirmation dialog state
  const [confirmDialog, setConfirmDialog] = useState({
    isOpen: false,
    type: 'danger',
    title: '',
    message: '',
    onConfirm: null,
    confirmText: 'Delete',
    cancelText: 'Cancel'
  })

  // Check if user is superadmin
  if (user?.role !== 'superadmin') {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <AlertCircle className="mx-auto h-12 w-12 text-red-400" />
          <h1 className="mt-2 text-xl font-bold text-gray-900 dark:text-gray-100">Access Denied</h1>
          <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
            RSID Conversion is only available to SuperAdmins.
          </p>
        </div>
      </div>
    )
  }

  // Helper function to show confirmation dialog
  const showConfirmDialog = (title, message, onConfirm, type = 'danger', confirmText = 'Delete') => {
    setConfirmDialog({
      isOpen: true,
      type,
      title,
      message,
      onConfirm,
      confirmText,
      cancelText: 'Cancel'
    })
  }

  const closeConfirmDialog = () => {
    setConfirmDialog(prev => ({ ...prev, isOpen: false }))
  }

  // Delete functions for Results tab
  const handleDeleteGroup = async (groupId, groupName) => {
    showConfirmDialog(
      'Delete Result Group',
      `Are you sure you want to delete the result group "${groupName}"? This action cannot be undone and will delete all files in this group.`,
      async () => {
        try {
          await api.delete(`/result-groups/${groupId}`)
          toast.success('Result group deleted successfully')

          // Update local state immediately to reflect deletion
          setResultGroups(prevGroups => prevGroups.filter(group => group.id !== groupId))

          // Clear selection if this group was selected
          if (selectedGroup?.id === groupId) {
            setSelectedGroup(null)
            setGroupFiles([])
          }

          // Refresh result groups to ensure consistency
          await fetchResultGroups()
          closeConfirmDialog()
        } catch (error) {
          console.error('Error deleting result group:', error)
          // More specific error handling
          if (error.response?.status === 404) {
            toast.error('Group not found - it may have already been deleted')
            // Update state even if delete failed due to group not existing
            setResultGroups(prevGroups => prevGroups.filter(group => group.id !== groupId))
            if (selectedGroup?.id === groupId) {
              setSelectedGroup(null)
              setGroupFiles([])
            }
            await fetchResultGroups()
          } else {
            toast.error(error.response?.data?.detail || 'Failed to delete result group')
          }
          closeConfirmDialog()
        }
      }
    )
  }

  const handleDeleteFile = async (fileId, fileName) => {
    showConfirmDialog(
      'Delete Result File',
      `Are you sure you want to delete the file "${fileName}"? This action cannot be undone.`,
      async () => {
        try {
          await api.delete(`/result-files/${fileId}`)
          toast.success('Result file deleted successfully')

          // Update local state immediately to reflect deletion
          setGroupFiles(prevFiles => prevFiles.filter(file => file.id !== fileId))

          // Refresh result groups to ensure consistency
          await fetchResultGroups()

          // If a group is selected, refresh its file list
          if (selectedGroup) {
            try {
              // Fetch fresh group data to get updated file list
              const response = await api.get(`/result-groups/${selectedGroup.id}`)
              const updatedGroup = response.data
              setSelectedGroup(updatedGroup)
              // Filter active files only
              const activeFiles = (updatedGroup.result_files || []).filter(file => file.is_active !== false)
              setGroupFiles(activeFiles)
            } catch (groupError) {
              // If group no longer exists, clear selection
              console.warn('Group may have been deleted:', groupError)
              setSelectedGroup(null)
              setGroupFiles([])
            }
          }

          closeConfirmDialog()
        } catch (error) {
          console.error('Error deleting result file:', error)
          // More specific error handling
          if (error.response?.status === 404) {
            toast.error('File not found - it may have already been deleted')
            // Refresh state even if delete failed due to file not existing
            setGroupFiles(prevFiles => prevFiles.filter(file => file.id !== fileId))
            await fetchResultGroups()
          } else {
            toast.error(error.response?.data?.detail || 'Failed to delete result file')
          }
          closeConfirmDialog()
        }
      }
    )
  }

  // Fetch functions
  const fetchConversionFiles = async () => {
    try {
      setLoading(true)
      const response = await api.get('/conversion-files')
      setConversionFiles(response.data)
    } catch (error) {
      console.error('Error fetching conversion files:', error)
      toast.error('Failed to load conversion files')
    } finally {
      setLoading(false)
    }
  }

  const fetchIndividualFiles = async () => {
    try {
      setLoading(true)
      const response = await api.get('/individual-files')
      setIndividualFiles(response.data)
    } catch (error) {
      console.error('Error fetching individual files:', error)
      toast.error('Failed to load individual files')
    } finally {
      setLoading(false)
    }
  }

  const fetchConversionJobs = async () => {
    try {
      setLoading(true)
      const response = await api.get('/conversion-jobs')
      setConversionJobs(response.data)
    } catch (error) {
      console.error('Error fetching conversion jobs:', error)
      toast.error('Failed to load conversion jobs')
    } finally {
      setLoading(false)
    }
  }

  const fetchResultGroups = async () => {
    try {
      setLoading(true)
      // Use the dedicated result-groups endpoint
      const response = await api.get('/result-groups')
      setResultGroups(response.data)
    } catch (error) {
      console.error('Error fetching result groups:', error)
      toast.error('Failed to load result groups')
    } finally {
      setLoading(false)
    }
  }

  // Load data based on active tab
  useEffect(() => {
    switch (activeTab) {
      case 'files':
        fetchConversionFiles()
        fetchIndividualFiles()
        break
      case 'conversion':
        fetchConversionFiles()
        fetchIndividualFiles()
        fetchConversionJobs()
        break
      case 'results':
        fetchResultGroups()
        break
      default:
        break
    }
  }, [activeTab])

  // Real-time progress polling for conversion jobs
  useEffect(() => {
    if (activeTab === 'conversion') {
      // Update the ref with current active jobs
      activeJobsRef.current = conversionJobs.filter(job =>
        job.status?.toLowerCase() === 'pending' || job.status?.toLowerCase() === 'processing'
      ).map(job => job.id)

      // Start interval if there are active jobs and no interval is running
      if (activeJobsRef.current.length > 0 && !progressUpdateInterval.current) {
        progressUpdateInterval.current = setInterval(async () => {
          // Get current active job IDs
          const activeIds = activeJobsRef.current

          if (activeIds.length === 0) {
            // No more active jobs, clear interval
            clearInterval(progressUpdateInterval.current)
            progressUpdateInterval.current = null
            return
          }

          // Update each active job
          const updatePromises = activeIds.map(async (jobId) => {
            try {
              const response = await api.get(`/conversion-jobs/${jobId}`)
              return response.data
            } catch (error) {
              console.error(`Error updating job ${jobId}:`, error)
              return null
            }
          })

          const updatedJobs = await Promise.all(updatePromises)

          // Update state with new data
          setConversionJobs(prevJobs => {
            return prevJobs.map(job => {
              const updatedJob = updatedJobs.find(uj => uj && uj.id === job.id)
              return updatedJob || job
            })
          })

          // Update activeJobsRef for next iteration
          const stillActiveIds = updatedJobs
            .filter(uj => uj && (uj.status?.toLowerCase() === 'pending' || uj.status?.toLowerCase() === 'processing'))
            .map(uj => uj.id)

          activeJobsRef.current = stillActiveIds

        }, 1500) // Update every 1.5 seconds
      }

      // Clear interval if no active jobs
      if (activeJobsRef.current.length === 0 && progressUpdateInterval.current) {
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
  }, [activeTab, conversionJobs])

  // File upload handlers
  const handleConversionFileUpload = async (event) => {
    const file = event.target.files[0]
    if (!file) return

    if (!file.name.toLowerCase().endsWith('.txt')) {
      toast.error('Please select a TXT file')
      return
    }

    // Use filename without extension as the name
    const name = file.name.replace('.txt', '')

    const formData = new FormData()
    formData.append('file', file)
    formData.append('name', name)

    setUploadingConversion(true)
    setUploadProgress(0)

    try {
      await api.post('/conversion-files/upload', formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
        onUploadProgress: (progressEvent) => {
          const percentCompleted = Math.round((progressEvent.loaded * 100) / progressEvent.total)
          setUploadProgress(percentCompleted)
        }
      })
      toast.success('Conversion file uploaded successfully!')
      fetchConversionFiles()
      if (conversionFileRef.current) conversionFileRef.current.value = ''
    } catch (error) {
      console.error('Upload error:', error)
      toast.error(error.response?.data?.detail || 'Failed to upload file')
    } finally {
      setUploadingConversion(false)
      setUploadProgress(0)
    }
  }

  const handleIndividualFileUpload = async (event) => {
    const file = event.target.files[0]
    if (!file) return

    if (!file.name.toLowerCase().endsWith('.txt')) {
      toast.error('Please select a TXT file')
      return
    }

    // Use filename without extension as the name
    const name = file.name.replace('.txt', '')

    const formData = new FormData()
    formData.append('file', file)
    formData.append('name', name)

    setUploadingIndividual(true)
    setUploadProgress(0)

    try {
      await api.post('/individual-files/upload', formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
        onUploadProgress: (progressEvent) => {
          const percentCompleted = Math.round((progressEvent.loaded * 100) / progressEvent.total)
          setUploadProgress(percentCompleted)
        }
      })
      toast.success('Individual file uploaded successfully!')
      fetchIndividualFiles()
      if (individualFileRef.current) individualFileRef.current.value = ''
    } catch (error) {
      console.error('Upload error:', error)
      toast.error(error.response?.data?.detail || 'Failed to upload file')
    } finally {
      setUploadingIndividual(false)
      setUploadProgress(0)
    }
  }

  // Delete handlers
  const handleDeleteConversionFile = (fileId) => {
    const file = conversionFiles.find(f => f.id === fileId)
    const fileName = file?.name || 'this file'

    showConfirmDialog(
      'Delete Conversion File',
      `Are you sure you want to delete "${fileName}"? This action cannot be undone.`,
      async () => {
        try {
          await api.delete(`/conversion-files/${fileId}`)
          toast.success('Conversion file deleted successfully!')
          fetchConversionFiles()
        } catch (error) {
          console.error('Delete error:', error)
          toast.error('Failed to delete file')
        }
      }
    )
  }

  const handleDeleteIndividualFile = (fileId) => {
    const file = individualFiles.find(f => f.id === fileId)
    const fileName = file?.name || 'this file'

    showConfirmDialog(
      'Delete Individual File',
      `Are you sure you want to delete "${fileName}"? This action cannot be undone.`,
      async () => {
        try {
          await api.delete(`/individual-files/${fileId}`)
          toast.success('Individual file deleted successfully!')
          fetchIndividualFiles()
        } catch (error) {
          console.error('Delete error:', error)
          toast.error('Failed to delete file')
        }
      }
    )
  }

  // Conversion job handlers
  const handleSubmitConversion = async () => {
    if (!selectedConversionFile) {
      toast.error('Please select a conversion mapping file')
      return
    }
    if (selectedIndividualFiles.length === 0) {
      toast.error('Please select at least one individual data file')
      return
    }
    // Auto-generate job name with current date and time
    const now = new Date()
    const dateTimeString = now.toISOString().replace(/[-:]/g, '').replace('T', '_').split('.')[0]
    const autoJobName = `Conversion_${dateTimeString}`

    setSubmittingJob(true)
    try {
      const jobData = {
        name: autoJobName,
        conversion_file_id: selectedConversionFile,
        individual_file_ids: selectedIndividualFiles
      }

      const response = await api.post('/conversion-jobs', jobData)
      toast.success('Conversion job created successfully!')

      // Process the job immediately
      await api.post(`/conversion-jobs/${response.data.id}/process`)
      toast.success('Job processing started!')

      // Reset form
      setSelectedConversionFile(null)
      setSelectedIndividualFiles([])

      // Refresh data and start monitoring the new job
      await fetchConversionJobs()
    } catch (error) {
      console.error('Job submission error:', error)
      toast.error(error.response?.data?.detail || 'Failed to create conversion job')
    } finally {
      setSubmittingJob(false)
    }
  }

  // Results handlers
  const handleSelectGroup = async (group) => {
    try {
      setSelectedGroup(group)

      // If the group object already has result_files, filter active ones
      if (group.result_files && Array.isArray(group.result_files)) {
        const activeFiles = group.result_files.filter(file => file.is_active !== false)
        setGroupFiles(activeFiles)
      } else {
        // If not, fetch fresh group data to get current file list
        const response = await api.get(`/result-groups/${group.id}`)
        const freshGroup = response.data
        setSelectedGroup(freshGroup)
        const activeFiles = (freshGroup.result_files || []).filter(file => file.is_active !== false)
        setGroupFiles(activeFiles)
      }
    } catch (error) {
      console.error('Error selecting group:', error)
      // If there's an error fetching group details, clear selection
      setSelectedGroup(null)
      setGroupFiles([])
      toast.error('Failed to load group details')
    }
  }

  const handleDownloadGroup = async (groupId) => {
    try {
      toast.loading('Preparing download...')
      const response = await api.get(`/result-groups/${groupId}/download`, {
        responseType: 'blob'
      })

      const blob = response.data
      const url = window.URL.createObjectURL(blob)
      const a = document.createElement('a')
      const group = resultGroups.find(g => g.id === groupId)

      // Generate filename using individual filename + date + time format
      const now = new Date()
      const dateTime = now.toISOString().replace(/[:.]/g, '-').slice(0, -5) // Format: YYYY-MM-DDTHH-MM-SS
      const baseGroupName = group?.name?.replace(/_\d{8}$/, '') || 'result_group' // Remove existing date suffix if present
      const filename = `${baseGroupName}_${dateTime}.zip`

      a.style.display = 'none'
      a.href = url
      a.download = filename
      document.body.appendChild(a)
      a.click()
      document.body.removeChild(a)
      window.URL.revokeObjectURL(url)

      toast.dismiss()
      toast.success('Group downloaded successfully!')
    } catch (error) {
      console.error('Download error:', error)
      toast.dismiss()
      toast.error('Failed to download group')
    }
  }

  const handleDownloadFile = async (fileId) => {
    try {
      toast.loading('Preparing download...')
      const response = await api.get(`/result-files/${fileId}/download`, {
        responseType: 'blob'
      })

      const blob = response.data
      const url = window.URL.createObjectURL(blob)
      const a = document.createElement('a')
      const file = groupFiles.find(f => f.id === fileId)

      // Generate filename using individual filename + date + time format
      const now = new Date()
      const dateTime = now.toISOString().replace(/[:.]/g, '-').slice(0, -5) // Format: YYYY-MM-DDTHH-MM-SS
      const baseName = file?.name || `result_file_${fileId}`
      const filename = `${baseName}_${dateTime}.txt`

      a.style.display = 'none'
      a.href = url
      a.download = filename
      document.body.appendChild(a)
      a.click()
      document.body.removeChild(a)
      window.URL.revokeObjectURL(url)

      toast.dismiss()
      toast.success('File downloaded successfully!')
    } catch (error) {
      console.error('Download error:', error)
      toast.dismiss()
      toast.error('Failed to download file')
    }
  }

  // Utility functions
  const formatFileSize = (bytes) => {
    if (bytes === 0) return '0 Bytes'
    const k = 1024
    const sizes = ['Bytes', 'KB', 'MB', 'GB']
    const i = Math.floor(Math.log(bytes) / Math.log(k))
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i]
  }

  const getJobProgress = (job) => {
    // Ensure progress is a valid number between 0 and 100
    const progress = job.progress || 0
    return Math.max(0, Math.min(100, progress))
  }

  const formatDate = (dateString) => {
    return new Date(dateString).toLocaleString()
  }

  const getStatusIcon = (status) => {
    switch (status?.toLowerCase()) {
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
        <h1 className="text-3xl font-bold text-gray-900 dark:text-dark-text">RSID Conversion</h1>
        <p className="mt-2 text-sm text-gray-600 dark:text-dark-muted">
          Upload files, create conversion jobs, and download results (SuperAdmin only)
        </p>
      </div>

      {/* Tab Navigation */}
      <div className="border-b border-gray-200 dark:border-dark-border mb-6">
        <nav className="-mb-px flex space-x-8">
          <button
            onClick={() => setActiveTab('files')}
            className={`py-2 px-1 border-b-2 font-medium text-sm ${
              activeTab === 'files'
                ? 'border-emerald-500 text-emerald-600 dark:text-emerald-400'
                : 'border-transparent text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300 hover:border-gray-300 dark:hover:border-gray-600'
            }`}
          >
            <FileText className="inline h-4 w-4 mr-2" />
            File Management
          </button>
          <button
            onClick={() => setActiveTab('conversion')}
            className={`py-2 px-1 border-b-2 font-medium text-sm ${
              activeTab === 'conversion'
                ? 'border-emerald-500 text-emerald-600 dark:text-emerald-400'
                : 'border-transparent text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300 hover:border-gray-300 dark:hover:border-gray-600'
            }`}
          >
            <Settings className="inline h-4 w-4 mr-2" />
            Conversion
          </button>
          <button
            onClick={() => setActiveTab('results')}
            className={`py-2 px-1 border-b-2 font-medium text-sm ${
              activeTab === 'results'
                ? 'border-emerald-500 text-emerald-600 dark:text-emerald-400'
                : 'border-transparent text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300 hover:border-gray-300 dark:hover:border-gray-600'
            }`}
          >
            <Package className="inline h-4 w-4 mr-2" />
            Results
          </button>
        </nav>
      </div>

      {/* Tab Content */}
      {activeTab === 'files' && (
        <div className="space-y-6">
          {/* Upload Section */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Conversion Files Upload */}
            <div className="bg-white/80 dark:bg-dark-card backdrop-blur-sm shadow-xl rounded-2xl border border-white/20 dark:border-dark-border p-6">
              <h3 className="text-lg font-medium text-gray-900 dark:text-dark-text mb-4">Upload Conversion Mapping</h3>
              <div className="space-y-4">
                <input
                  ref={conversionFileRef}
                  type="file"
                  accept=".txt"
                  onChange={handleConversionFileUpload}
                  className="block w-full text-sm text-gray-500 dark:text-gray-400 file:mr-4 file:py-2 file:px-4 file:rounded-md file:border-0 file:text-sm file:font-medium file:bg-emerald-50 dark:file:bg-emerald-900 file:text-emerald-700 dark:file:text-emerald-300 hover:file:bg-emerald-100 dark:hover:file:bg-emerald-800"
                />
                {uploadingConversion && (
                  <div className="mt-4">
                    <div className="flex justify-between text-sm text-gray-700 dark:text-dark-text mb-1">
                      <span>Uploading...</span>
                      <span>{uploadProgress}%</span>
                    </div>
                    <div className="w-full bg-gray-200 dark:bg-dark-border rounded-full h-2">
                      <div
                        className="bg-emerald-600 dark:bg-emerald-500 h-2 rounded-full transition-all duration-300"
                        style={{ width: `${uploadProgress}%` }}
                      ></div>
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* Individual Files Upload */}
            <div className="bg-white/80 dark:bg-dark-card backdrop-blur-sm shadow-xl rounded-2xl border border-white/20 dark:border-dark-border p-6">
              <h3 className="text-lg font-medium text-gray-900 dark:text-dark-text mb-4">Upload Individual Data</h3>
              <div className="space-y-4">
                <input
                  ref={individualFileRef}
                  type="file"
                  accept=".txt"
                  onChange={handleIndividualFileUpload}
                  className="block w-full text-sm text-gray-500 dark:text-gray-400 file:mr-4 file:py-2 file:px-4 file:rounded-md file:border-0 file:text-sm file:font-medium file:bg-emerald-50 dark:file:bg-emerald-900 file:text-emerald-700 dark:file:text-emerald-300 hover:file:bg-emerald-100 dark:hover:file:bg-emerald-800"
                />
                {uploadingIndividual && (
                  <div className="mt-4">
                    <div className="flex justify-between text-sm text-gray-700 dark:text-dark-text mb-1">
                      <span>Uploading...</span>
                      <span>{uploadProgress}%</span>
                    </div>
                    <div className="w-full bg-gray-200 dark:bg-dark-border rounded-full h-2">
                      <div
                        className="bg-emerald-600 dark:bg-emerald-500 h-2 rounded-full transition-all duration-300"
                        style={{ width: `${uploadProgress}%` }}
                      ></div>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Files Display */}
          <div className="grid grid-cols-1 xl:grid-cols-2 gap-4 lg:gap-6">
            {/* Conversion Files */}
            <div className="bg-white/80 dark:bg-dark-card backdrop-blur-sm shadow-xl rounded-2xl border border-white/20 dark:border-dark-border">
              <div className="px-6 py-4 border-b border-gray-200 dark:border-dark-border">
                <h3 className="text-lg font-medium text-gray-900 dark:text-dark-text">Conversion Mapping Files</h3>
              </div>
              <div className="p-6">
                {conversionFiles.length === 0 ? (
                  <div className="text-center text-gray-500 dark:text-dark-muted">
                    <FileText className="h-12 w-12 mx-auto mb-4 text-gray-300 dark:text-dark-muted" />
                    <p className="text-lg font-medium mb-2">No conversion files uploaded yet</p>
                    <p className="text-sm">Upload your first conversion mapping file to get started</p>
                  </div>
                ) : (
                  <div className="grid grid-cols-1 gap-4">
                    {conversionFiles.map((file) => (
                      <div key={file.id} className="bg-white/90 dark:bg-dark-card/90 backdrop-blur-sm rounded-xl border border-gray-200/50 dark:border-dark-border/50 p-5 hover:shadow-lg hover:bg-white dark:hover:bg-dark-card transition-all duration-300 group">
                        <div className="flex items-start justify-between">
                          <div className="flex items-start space-x-4 flex-1 min-w-0">
                            <div className="p-3 bg-emerald-100 dark:bg-emerald-900/50 rounded-xl shadow-sm group-hover:shadow-md transition-shadow duration-300">
                              <FileText className="h-6 w-6 text-emerald-600 dark:text-emerald-400" />
                            </div>
                            <div className="flex-1 min-w-0">
                              <div className="flex items-start justify-between mb-2">
                                <div className="flex-1 min-w-0 pr-4">
                                  <h4 className="text-base font-semibold text-gray-900 dark:text-dark-text truncate" title={file.name}>
                                    {file.name}
                                  </h4>
                                  <p className="text-sm text-gray-600 dark:text-dark-muted mt-1">
                                    Conversion Mapping File
                                  </p>
                                </div>
                                <button
                                  onClick={() => handleDeleteConversionFile(file.id)}
                                  className="p-2 text-red-500 hover:text-red-700 dark:text-red-400 dark:hover:text-red-300 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg transition-all duration-200 opacity-0 group-hover:opacity-100"
                                  title="Delete file"
                                >
                                  <Trash2 className="h-4 w-4" />
                                </button>
                              </div>
                              <div className="grid grid-cols-2 gap-4 text-xs">
                                <div className="flex justify-between">
                                  <span className="text-gray-500 dark:text-dark-muted">Size:</span>
                                  <span className="text-gray-700 dark:text-dark-text font-medium">{formatFileSize(file.file_size)}</span>
                                </div>
                                <div className="flex justify-between">
                                  <span className="text-gray-500 dark:text-dark-muted">Uploaded:</span>
                                  <span className="text-gray-700 dark:text-dark-text font-medium">{formatDate(file.created_at)}</span>
                                </div>
                              </div>
                            </div>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>

            {/* Individual Files */}
            <div className="bg-white/80 dark:bg-dark-card backdrop-blur-sm shadow-xl rounded-2xl border border-white/20 dark:border-dark-border">
              <div className="px-6 py-4 border-b border-gray-200 dark:border-dark-border">
                <h3 className="text-lg font-medium text-gray-900 dark:text-dark-text">Individual Data Files</h3>
              </div>
              <div className="p-6">
                {individualFiles.length === 0 ? (
                  <div className="text-center text-gray-500 dark:text-dark-muted">
                    <FileText className="h-12 w-12 mx-auto mb-4 text-gray-300 dark:text-dark-muted" />
                    <p className="text-lg font-medium mb-2">No individual files uploaded yet</p>
                    <p className="text-sm">Upload individual data files for conversion</p>
                  </div>
                ) : (
                  <div className="grid grid-cols-1 gap-4">
                    {individualFiles.map((file) => (
                      <div key={file.id} className="bg-white/90 dark:bg-dark-card/90 backdrop-blur-sm rounded-xl border border-gray-200/50 dark:border-dark-border/50 p-5 hover:shadow-lg hover:bg-white dark:hover:bg-dark-card transition-all duration-300 group">
                        <div className="flex items-start justify-between">
                          <div className="flex items-start space-x-4 flex-1 min-w-0">
                            <div className="p-3 bg-emerald-100 dark:bg-emerald-900/50 rounded-xl shadow-sm group-hover:shadow-md transition-shadow duration-300">
                              <FileText className="h-6 w-6 text-emerald-600 dark:text-emerald-400" />
                            </div>
                            <div className="flex-1 min-w-0">
                              <div className="flex items-start justify-between mb-2">
                                <div className="flex-1 min-w-0 pr-4">
                                  <h4 className="text-base font-semibold text-gray-900 dark:text-dark-text truncate" title={file.name}>
                                    {file.name}
                                  </h4>
                                  <p className="text-sm text-gray-600 dark:text-dark-muted mt-1">
                                    Individual Data File
                                  </p>
                                </div>
                                <button
                                  onClick={() => handleDeleteIndividualFile(file.id)}
                                  className="p-2 text-red-500 hover:text-red-700 dark:text-red-400 dark:hover:text-red-300 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg transition-all duration-200 opacity-0 group-hover:opacity-100"
                                  title="Delete file"
                                >
                                  <Trash2 className="h-4 w-4" />
                                </button>
                              </div>
                              <div className="grid grid-cols-2 gap-4 text-xs">
                                <div className="flex justify-between">
                                  <span className="text-gray-500 dark:text-dark-muted">Size:</span>
                                  <span className="text-gray-700 dark:text-dark-text font-medium">{formatFileSize(file.file_size)}</span>
                                </div>
                                <div className="flex justify-between">
                                  <span className="text-gray-500 dark:text-dark-muted">Uploaded:</span>
                                  <span className="text-gray-700 dark:text-dark-text font-medium">{formatDate(file.created_at)}</span>
                                </div>
                              </div>
                            </div>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {activeTab === 'conversion' && (
        <div className="space-y-6">
          {/* Create New Job */}
          <div className="bg-white/80 dark:bg-dark-card backdrop-blur-sm shadow-xl rounded-2xl border border-white/20 dark:border-dark-border p-6">
            <h3 className="text-lg font-medium text-gray-900 dark:text-dark-text mb-6">Create Conversion Job</h3>

            <div className="space-y-6">

              {/* File Selection - Vertical Layout */}
              <div className="space-y-8">
                {/* Conversion File Selection */}
                <div className="bg-white/60 dark:bg-dark-card/60 backdrop-blur-sm rounded-xl border border-gray-200/50 dark:border-dark-border/50 p-6">
                  <div className="flex items-center space-x-3 mb-4">
                    <div className="p-2 bg-emerald-100 dark:bg-emerald-900/50 rounded-lg">
                      <FileText className="h-5 w-5 text-emerald-600 dark:text-emerald-400" />
                    </div>
                    <div>
                      <h4 className="text-base font-semibold text-gray-900 dark:text-dark-text">
                        Select Conversion Mapping File
                      </h4>
                      <p className="text-sm text-gray-600 dark:text-dark-muted">Choose the mapping file for conversion (Required)</p>
                    </div>
                  </div>
                  <div className="space-y-3">
                    {conversionFiles.length === 0 ? (
                      <div className="text-center py-8 text-gray-500 dark:text-dark-muted">
                        <FileText className="h-8 w-8 mx-auto mb-2 text-gray-400 dark:text-gray-600" />
                        <p className="text-sm">No conversion files available</p>
                        <p className="text-xs mt-1">Upload one in the File Management tab</p>
                      </div>
                    ) : (
                      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
                        {conversionFiles.map((file) => (
                          <label key={file.id} className={`relative cursor-pointer rounded-xl border-2 p-5 transition-all duration-300 group ${
                            selectedConversionFile === file.id
                              ? 'border-emerald-500 bg-emerald-50/80 dark:bg-emerald-900/30 shadow-lg shadow-emerald-500/20'
                              : 'border-gray-200/60 dark:border-dark-border/60 hover:border-emerald-300 dark:hover:border-emerald-700 hover:bg-white/80 dark:hover:bg-dark-card/50 hover:shadow-md'
                          }`}>
                            <input
                              type="radio"
                              name="conversionFile"
                              value={file.id}
                              checked={selectedConversionFile === file.id}
                              onChange={(e) => setSelectedConversionFile(parseInt(e.target.value))}
                              className="sr-only"
                            />
                            <div className="flex items-center space-x-4">
                              <div className={`p-3 rounded-xl transition-all duration-300 ${
                                selectedConversionFile === file.id
                                  ? 'bg-emerald-100 dark:bg-emerald-800/50 shadow-md'
                                  : 'bg-gray-100 dark:bg-gray-700/50 group-hover:bg-gray-200 dark:group-hover:bg-gray-600/50'
                              }`}>
                                <FileText className={`h-6 w-6 transition-colors duration-300 ${
                                  selectedConversionFile === file.id
                                    ? 'text-emerald-600 dark:text-emerald-400'
                                    : 'text-gray-600 dark:text-gray-400 group-hover:text-emerald-600 dark:group-hover:text-emerald-400'
                                }`} />
                              </div>
                              <div className="flex-1 min-w-0">
                                <h4 className="text-base font-semibold text-gray-900 dark:text-dark-text truncate" title={file.name}>
                                  {file.name}
                                </h4>
                                <p className="text-sm text-gray-600 dark:text-dark-muted mt-1">
                                  {formatFileSize(file.file_size)} • Conversion mapping
                                </p>
                              </div>
                              {selectedConversionFile === file.id && (
                                <div className="text-emerald-600 dark:text-emerald-400">
                                  <CheckCircle className="h-6 w-6" />
                                </div>
                              )}
                            </div>
                          </label>
                        ))}
                      </div>
                    )}
                  </div>
                </div>

                {/* Individual Files Selection */}
                <div className="bg-white/60 dark:bg-dark-card/60 backdrop-blur-sm rounded-xl border border-gray-200/50 dark:border-dark-border/50 p-6">
                  <h3 className="text-lg font-semibold text-gray-900 dark:text-dark-text mb-4 flex items-center">
                    <FileText className="h-5 w-5 mr-2 text-emerald-600 dark:text-emerald-400" />
                    Select Individual Data Files
                    <span className="ml-2 text-sm font-normal text-red-500">*</span>
                  </h3>

                  {individualFiles.length === 0 ? (
                    <div className="text-center py-12 text-gray-500 dark:text-gray-400">
                      <div className="bg-gray-100 dark:bg-gray-700/50 rounded-full w-16 h-16 flex items-center justify-center mx-auto mb-4">
                        <FileText className="h-8 w-8 text-gray-400 dark:text-gray-600" />
                      </div>
                      <p className="text-base font-medium">No individual files available</p>
                      <p className="text-sm mt-1 text-gray-400">Upload some files in the File Management tab</p>
                    </div>
                  ) : (
                    <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4 max-h-80 overflow-y-auto scrollbar-modern">
                      {individualFiles.map((file) => (
                        <label key={file.id} className={`relative cursor-pointer rounded-xl border-2 p-5 transition-all duration-300 group ${
                          selectedIndividualFiles.includes(file.id)
                            ? 'border-emerald-500 bg-emerald-50/80 dark:bg-emerald-900/30 shadow-lg shadow-emerald-500/20'
                            : 'border-gray-200/60 dark:border-dark-border/60 hover:border-emerald-300 dark:hover:border-emerald-700 hover:bg-white/80 dark:hover:bg-dark-card/50 hover:shadow-md'
                        }`}>
                          <input
                            type="checkbox"
                            value={file.id}
                            checked={selectedIndividualFiles.includes(file.id)}
                            onChange={(e) => {
                              const fileId = parseInt(e.target.value)
                              if (e.target.checked) {
                                setSelectedIndividualFiles(prev => [...prev, fileId])
                              } else {
                                setSelectedIndividualFiles(prev => prev.filter(id => id !== fileId))
                              }
                            }}
                            className="sr-only"
                          />
                          <div className="flex items-center space-x-4">
                            <div className={`p-3 rounded-xl transition-all duration-300 ${
                              selectedIndividualFiles.includes(file.id)
                                ? 'bg-emerald-100 dark:bg-emerald-800/50 shadow-md'
                                : 'bg-gray-100 dark:bg-gray-700/50 group-hover:bg-gray-200 dark:group-hover:bg-gray-600/50'
                            }`}>
                              <FileText className={`h-6 w-6 transition-colors duration-300 ${
                                selectedIndividualFiles.includes(file.id)
                                  ? 'text-emerald-600 dark:text-emerald-400'
                                  : 'text-gray-600 dark:text-gray-400 group-hover:text-emerald-600 dark:group-hover:text-emerald-400'
                              }`} />
                            </div>
                            <div className="flex-1 min-w-0">
                              <h4 className="text-base font-semibold text-gray-900 dark:text-dark-text truncate" title={file.name}>
                                {file.name}
                              </h4>
                              <p className="text-sm text-gray-600 dark:text-dark-muted mt-1">
                                {formatFileSize(file.file_size)} • Individual data
                              </p>
                            </div>
                            {selectedIndividualFiles.includes(file.id) && (
                              <div className="text-emerald-600 dark:text-emerald-400">
                                <CheckCircle className="h-6 w-6" />
                              </div>
                            )}
                          </div>
                        </label>
                      ))}
                    </div>
                  )}
                </div>
              </div>

              {/* Submit Button */}
              <div>
                <button
                  onClick={handleSubmitConversion}
                  disabled={submittingJob || !selectedConversionFile || selectedIndividualFiles.length === 0}
                  className="inline-flex items-center px-6 py-3 bg-gradient-to-r from-emerald-600 to-teal-600 text-white text-sm font-medium rounded-md hover:from-emerald-700 hover:to-teal-700 focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {submittingJob ? (
                    <>
                      <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                      Creating Job...
                    </>
                  ) : (
                    <>
                      <Play className="h-4 w-4 mr-2" />
                      Start Conversion
                    </>
                  )}
                </button>
              </div>
            </div>
          </div>

          {/* Existing Jobs */}
          <div className="bg-white/80 dark:bg-dark-card backdrop-blur-sm shadow-xl rounded-2xl border border-white/20 dark:border-dark-border">
            <div className="px-6 py-4 border-b border-gray-200 dark:border-dark-border">
              <h3 className="text-lg font-medium text-gray-900 dark:text-dark-text">Conversion Jobs</h3>
            </div>
            <div className="divide-y divide-gray-200 dark:divide-gray-700 max-h-[28rem] overflow-y-auto scrollbar-modern">
              {conversionJobs.length === 0 ? (
                <div className="p-6 text-center text-gray-500 dark:text-gray-400">
                  No conversion jobs yet. Create your first job above.
                </div>
              ) : (
                conversionJobs.map((job) => (
                  <div key={job.id} className="p-6">
                    <div className="flex items-center justify-between mb-3">
                      <div>
                        <h4 className="text-sm font-medium text-gray-900 dark:text-gray-100">{job.name}</h4>
                        <p className="text-xs text-gray-500 dark:text-gray-400">
                          Created {formatDate(job.created_at)}
                        </p>
                      </div>
                      <div className="flex items-center space-x-2">
                        {getStatusIcon(job.status)}
                        <span className="text-sm text-gray-900 dark:text-gray-100 capitalize">
                          {job.status}
                        </span>
                      </div>
                    </div>

                    {(job.status === 'processing' || job.status === 'pending') && (
                      <div className="mb-3">
                        <div className="flex justify-between text-xs text-gray-600 dark:text-gray-400 mb-1">
                          <span>Progress</span>
                          <span>{getJobProgress(job)}%</span>
                        </div>
                        <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-2">
                          <div
                            className="bg-emerald-600 dark:bg-emerald-500 h-2 rounded-full transition-all duration-500"
                            style={{ width: `${getJobProgress(job)}%` }}
                          ></div>
                        </div>
                        <div className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                          {job.processed_files || 0}/{job.total_files || 0} files processed
                        </div>
                      </div>
                    )}

                    {job.status === 'completed' && job.result_groups?.length > 0 && (
                      <div className="text-sm text-green-600 dark:text-green-400">
                        ✓ Generated {job.result_groups.length} result group(s)
                      </div>
                    )}

                    {job.status === 'error' && job.error_message && (
                      <div className="text-sm text-red-600 dark:text-red-400">
                        Error: {job.error_message}
                      </div>
                    )}
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      )}

      {activeTab === 'results' && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Result Groups */}
          <div className="bg-white/80 dark:bg-dark-card backdrop-blur-sm shadow-xl rounded-2xl border border-white/20 dark:border-dark-border">
            <div className="px-6 py-4 border-b border-gray-200 dark:border-dark-border">
              <h3 className="text-lg font-medium text-gray-900 dark:text-dark-text">Result Groups</h3>
            </div>
            <div className="divide-y divide-gray-200 dark:divide-gray-700 h-[32rem] overflow-y-auto scrollbar-modern">
              {resultGroups.length === 0 ? (
                <div className="p-6 text-center text-gray-500 dark:text-gray-400">
                  No result groups available yet
                </div>
              ) : (
                resultGroups.map((group) => (
                  <div
                    key={group.id}
                    className={`p-4 cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-700 ${
                      selectedGroup?.id === group.id ? 'bg-emerald-50 dark:bg-emerald-900/20' : ''
                    }`}
                    onClick={() => handleSelectGroup(group)}
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex-1">
                        <p className="text-sm font-medium text-gray-900 dark:text-gray-100">{group.name}</p>
                        <p className="text-xs text-gray-500 dark:text-gray-400">
                          {(group.result_files || []).filter(file => file.is_active !== false).length} files • From job: {group.job?.name}
                        </p>
                        <p className="text-xs text-gray-400 dark:text-gray-500">
                          {formatDate(group.created_at)}
                        </p>
                      </div>
                      <div className="flex items-center space-x-2">
                        <button
                          onClick={(e) => {
                            e.stopPropagation()
                            handleDownloadGroup(group.id)
                          }}
                          className="p-1 text-emerald-600 hover:text-emerald-800 dark:text-emerald-400 dark:hover:text-emerald-300"
                          title="Download group"
                        >
                          <Download className="h-4 w-4" />
                        </button>
                        <button
                          onClick={(e) => {
                            e.stopPropagation()
                            handleDeleteGroup(group.id, group.name)
                          }}
                          className="p-1 text-red-600 hover:text-red-800 dark:text-red-400 dark:hover:text-red-300"
                          title="Delete group"
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                        <ArrowRight className="h-4 w-4 text-gray-400" />
                      </div>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>

          {/* Group Files */}
          <div className="bg-white/80 dark:bg-dark-card backdrop-blur-sm shadow-xl rounded-2xl border border-white/20 dark:border-dark-border">
            <div className="px-6 py-4 border-b border-gray-200 dark:border-dark-border">
              <h3 className="text-lg font-medium text-gray-900 dark:text-dark-text">
                {selectedGroup ? `Files in ${selectedGroup.name}` : 'Select a Group'}
              </h3>
            </div>
            <div className="divide-y divide-gray-200 dark:divide-gray-700 h-[32rem] overflow-y-auto scrollbar-modern">
              {!selectedGroup ? (
                <div className="p-6 text-center text-gray-500 dark:text-gray-400">
                  <FolderOpen className="h-8 w-8 mx-auto mb-2" />
                  Select a result group to view its files
                </div>
              ) : groupFiles.length === 0 ? (
                <div className="p-6 text-center text-gray-500 dark:text-gray-400">
                  No files in this group
                </div>
              ) : (
                groupFiles.map((file) => (
                  <div key={file.id} className="p-4 hover:bg-gray-50 dark:hover:bg-gray-700">
                    <div className="flex items-center justify-between">
                      <div className="flex-1">
                        <p className="text-sm font-medium text-gray-900 dark:text-gray-100">{file.name}</p>
                        <p className="text-xs text-gray-500 dark:text-gray-400">
                          {formatFileSize(file.file_size)} • {file.filename}
                        </p>
                      </div>
                      <div className="flex items-center space-x-2">
                        <button
                          onClick={() => handleDownloadFile(file.id)}
                          className="p-1 text-emerald-600 hover:text-emerald-800 dark:text-emerald-400 dark:hover:text-emerald-300"
                          title="Download file"
                        >
                          <Download className="h-4 w-4" />
                        </button>
                        <button
                          onClick={() => handleDeleteFile(file.id, file.name)}
                          className="p-1 text-red-600 hover:text-red-800 dark:text-red-400 dark:hover:text-red-300"
                          title="Delete file"
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </div>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      )}

      {/* Confirmation Dialog */}
      <ConfirmDialog
        isOpen={confirmDialog.isOpen}
        onClose={closeConfirmDialog}
        onConfirm={confirmDialog.onConfirm}
        title={confirmDialog.title}
        message={confirmDialog.message}
        confirmText={confirmDialog.confirmText}
        cancelText={confirmDialog.cancelText}
        type={confirmDialog.type}
      />
    </div>
  )
}

export default Conversion