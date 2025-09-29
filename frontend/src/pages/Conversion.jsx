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
  const [jobName, setJobName] = useState('')
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
      // Get all jobs and extract result groups
      const response = await api.get('/conversion-jobs')
      const allGroups = []
      response.data.forEach(job => {
        if (job.result_groups) {
          job.result_groups.forEach(group => {
            allGroups.push({ ...group, job })
          })
        }
      })
      setResultGroups(allGroups)
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

    const name = prompt('Enter a name for this conversion mapping file:', file.name.replace('.txt', ''))
    if (!name) return

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

    const name = prompt('Enter a name for this individual data file:', file.name.replace('.txt', ''))
    if (!name) return

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
    if (!jobName.trim()) {
      toast.error('Please enter a job name')
      return
    }

    setSubmittingJob(true)
    try {
      const jobData = {
        name: jobName.trim(),
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
      setJobName('')

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
    setSelectedGroup(group)
    setGroupFiles(group.result_files || [])
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
        <h1 className="text-3xl font-bold text-gray-900 dark:text-gray-100">RSID Conversion</h1>
        <p className="mt-2 text-sm text-gray-600 dark:text-gray-400">
          Upload files, create conversion jobs, and download results (SuperAdmin only)
        </p>
      </div>

      {/* Tab Navigation */}
      <div className="border-b border-gray-200 dark:border-gray-700 mb-6">
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
            <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 p-6">
              <h3 className="text-lg font-medium text-gray-900 dark:text-gray-100 mb-4">Upload Conversion Mapping</h3>
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
                    <div className="flex justify-between text-sm text-gray-700 dark:text-gray-300 mb-1">
                      <span>Uploading...</span>
                      <span>{uploadProgress}%</span>
                    </div>
                    <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-2">
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
            <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 p-6">
              <h3 className="text-lg font-medium text-gray-900 dark:text-gray-100 mb-4">Upload Individual Data</h3>
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
                    <div className="flex justify-between text-sm text-gray-700 dark:text-gray-300 mb-1">
                      <span>Uploading...</span>
                      <span>{uploadProgress}%</span>
                    </div>
                    <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-2">
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
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Conversion Files */}
            <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700">
              <div className="px-6 py-4 border-b border-gray-200 dark:border-gray-700">
                <h3 className="text-lg font-medium text-gray-900 dark:text-gray-100">Conversion Mapping Files</h3>
              </div>
              <div className="divide-y divide-gray-200 dark:divide-gray-700">
                {conversionFiles.length === 0 ? (
                  <div className="p-6 text-center text-gray-500 dark:text-gray-400">
                    No conversion files uploaded yet
                  </div>
                ) : (
                  conversionFiles.map((file) => (
                    <div key={file.id} className="p-4 hover:bg-gray-50 dark:hover:bg-gray-700">
                      <div className="flex items-center justify-between">
                        <div className="flex-1">
                          <p className="text-sm font-medium text-gray-900 dark:text-gray-100">{file.name}</p>
                          <p className="text-xs text-gray-500 dark:text-gray-400">
                            {formatFileSize(file.file_size)} • {formatDate(file.created_at)}
                          </p>
                        </div>
                        <button
                          onClick={() => handleDeleteConversionFile(file.id)}
                          className="ml-4 p-1 text-red-600 hover:text-red-800 dark:text-red-400 dark:hover:text-red-300"
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>

            {/* Individual Files */}
            <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700">
              <div className="px-6 py-4 border-b border-gray-200 dark:border-gray-700">
                <h3 className="text-lg font-medium text-gray-900 dark:text-gray-100">Individual Data Files</h3>
              </div>
              <div className="divide-y divide-gray-200 dark:divide-gray-700">
                {individualFiles.length === 0 ? (
                  <div className="p-6 text-center text-gray-500 dark:text-gray-400">
                    No individual files uploaded yet
                  </div>
                ) : (
                  individualFiles.map((file) => (
                    <div key={file.id} className="p-4 hover:bg-gray-50 dark:hover:bg-gray-700">
                      <div className="flex items-center justify-between">
                        <div className="flex-1">
                          <p className="text-sm font-medium text-gray-900 dark:text-gray-100">{file.name}</p>
                          <p className="text-xs text-gray-500 dark:text-gray-400">
                            {formatFileSize(file.file_size)} • {formatDate(file.created_at)}
                          </p>
                        </div>
                        <button
                          onClick={() => handleDeleteIndividualFile(file.id)}
                          className="ml-4 p-1 text-red-600 hover:text-red-800 dark:text-red-400 dark:hover:text-red-300"
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {activeTab === 'conversion' && (
        <div className="space-y-6">
          {/* Create New Job */}
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 p-6">
            <h3 className="text-lg font-medium text-gray-900 dark:text-gray-100 mb-6">Create Conversion Job</h3>

            <div className="space-y-6">
              {/* Job Name */}
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Job Name
                </label>
                <input
                  type="text"
                  value={jobName}
                  onChange={(e) => setJobName(e.target.value)}
                  placeholder="Enter a name for this conversion job"
                  className="block w-full px-3 py-2 border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 rounded-md shadow-sm focus:outline-none focus:ring-emerald-500 focus:border-emerald-500 placeholder-gray-400 dark:placeholder-gray-500"
                />
              </div>

              {/* File Selection */}
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {/* Conversion File Selection */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    Select Conversion Mapping File (Required)
                  </label>
                  <div className="space-y-2">
                    {conversionFiles.length === 0 ? (
                      <p className="text-sm text-gray-500 dark:text-gray-400">No conversion files available. Please upload one first.</p>
                    ) : (
                      conversionFiles.map((file) => (
                        <label key={file.id} className="flex items-center space-x-3 p-3 border border-gray-200 dark:border-gray-600 rounded-md hover:bg-gray-50 dark:hover:bg-gray-700 cursor-pointer">
                          <input
                            type="radio"
                            name="conversionFile"
                            value={file.id}
                            checked={selectedConversionFile === file.id}
                            onChange={(e) => setSelectedConversionFile(parseInt(e.target.value))}
                            className="text-emerald-600 focus:ring-emerald-500"
                          />
                          <div className="flex-1">
                            <p className="text-sm font-medium text-gray-900 dark:text-gray-100">{file.name}</p>
                            <p className="text-xs text-gray-500 dark:text-gray-400">{formatFileSize(file.file_size)}</p>
                          </div>
                        </label>
                      ))
                    )}
                  </div>
                </div>

                {/* Individual Files Selection */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    Select Individual Data Files (Required)
                  </label>
                  <div className="space-y-2">
                    {individualFiles.length === 0 ? (
                      <p className="text-sm text-gray-500 dark:text-gray-400">No individual files available. Please upload some first.</p>
                    ) : (
                      individualFiles.map((file) => (
                        <label key={file.id} className="flex items-center space-x-3 p-3 border border-gray-200 dark:border-gray-600 rounded-md hover:bg-gray-50 dark:hover:bg-gray-700 cursor-pointer">
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
                            className="text-emerald-600 focus:ring-emerald-500"
                          />
                          <div className="flex-1">
                            <p className="text-sm font-medium text-gray-900 dark:text-gray-100">{file.name}</p>
                            <p className="text-xs text-gray-500 dark:text-gray-400">{formatFileSize(file.file_size)}</p>
                          </div>
                        </label>
                      ))
                    )}
                  </div>
                </div>
              </div>

              {/* Submit Button */}
              <div>
                <button
                  onClick={handleSubmitConversion}
                  disabled={submittingJob || !selectedConversionFile || selectedIndividualFiles.length === 0 || !jobName.trim()}
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
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700">
            <div className="px-6 py-4 border-b border-gray-200 dark:border-gray-700">
              <h3 className="text-lg font-medium text-gray-900 dark:text-gray-100">Conversion Jobs</h3>
            </div>
            <div className="divide-y divide-gray-200 dark:divide-gray-700">
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
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700">
            <div className="px-6 py-4 border-b border-gray-200 dark:border-gray-700">
              <h3 className="text-lg font-medium text-gray-900 dark:text-gray-100">Result Groups</h3>
            </div>
            <div className="divide-y divide-gray-200 dark:divide-gray-700 max-h-96 overflow-y-auto">
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
                          {group.result_files?.length || 0} files • From job: {group.job?.name}
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
                        >
                          <Download className="h-4 w-4" />
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
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700">
            <div className="px-6 py-4 border-b border-gray-200 dark:border-gray-700">
              <h3 className="text-lg font-medium text-gray-900 dark:text-gray-100">
                {selectedGroup ? `Files in ${selectedGroup.name}` : 'Select a Group'}
              </h3>
            </div>
            <div className="divide-y divide-gray-200 dark:divide-gray-700 max-h-96 overflow-y-auto">
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
                      <button
                        onClick={() => handleDownloadFile(file.id)}
                        className="ml-4 p-1 text-emerald-600 hover:text-emerald-800 dark:text-emerald-400 dark:hover:text-emerald-300"
                      >
                        <Download className="h-4 w-4" />
                      </button>
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