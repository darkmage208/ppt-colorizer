import { useState, useEffect } from 'react'
import api from '../utils/api'
import toast from 'react-hot-toast'
import { Clock, CheckCircle, XCircle, AlertCircle, FileText, Download, Calendar, Trash2, ArrowUpDown, ArrowUp, ArrowDown } from 'lucide-react'
import ConfirmDialog from '../components/ConfirmDialog'

const Jobs = () => {
  const [jobs, setJobs] = useState([])
  const [loading, setLoading] = useState(true)
  const [filter, setFilter] = useState('all')
  const [sortBy, setSortBy] = useState('created_at')
  const [sortOrder, setSortOrder] = useState('desc')
  const [deletingJob, setDeletingJob] = useState(null)
  const [confirmDialog, setConfirmDialog] = useState({ isOpen: false, jobId: null, jobInfo: null })

  useEffect(() => {
    fetchJobs()
    const interval = setInterval(fetchJobs, 5000) // Poll every 5 seconds
    return () => clearInterval(interval)
  }, [sortBy, sortOrder])

  const fetchJobs = async () => {
    try {
      const response = await api.get(`/jobs/?limit=100&sort_by=${sortBy}&order=${sortOrder}`)
      setJobs(response.data)
    } catch (error) {
      toast.error('Failed to fetch jobs')
    } finally {
      setLoading(false)
    }
  }

  const getStatusIcon = (status) => {
    switch (status) {
      case 'queued':
        return <Clock className="h-5 w-5 text-yellow-500" />
      case 'processing':
        return <AlertCircle className="h-5 w-5 text-blue-500" />
      case 'done':
        return <CheckCircle className="h-5 w-5 text-green-500" />
      case 'error':
        return <XCircle className="h-5 w-5 text-red-500" />
      default:
        return <Clock className="h-5 w-5 text-gray-500" />
    }
  }

  const getStatusBadge = (status) => {
    const baseClasses = "inline-flex px-2 py-1 text-xs font-semibold rounded-full"
    switch (status) {
      case 'queued':
        return `${baseClasses} bg-yellow-100 text-yellow-800 dark:bg-yellow-900/20 dark:text-yellow-400`
      case 'processing':
        return `${baseClasses} bg-emerald-100 text-emerald-800 dark:bg-emerald-900/20 dark:text-emerald-400`
      case 'done':
        return `${baseClasses} bg-green-100 text-green-800 dark:bg-green-900/20 dark:text-green-400`
      case 'error':
        return `${baseClasses} bg-red-100 text-red-800 dark:bg-red-900/20 dark:text-red-400`
      default:
        return `${baseClasses} bg-gray-100 text-gray-800 dark:bg-gray-900/20 dark:text-gray-400`
    }
  }

  const downloadFile = async (jobId, type) => {
    try {
      const response = await api.get(`/jobs/${jobId}/download-${type}`, {
        responseType: 'blob'
      })
      
      // Find the job to get the TXT filename
      const job = jobs.find(j => j.id === jobId)
      let filename = `output_${jobId}.${type}`
      
      if (job && job.txt_filename) {
        // Extract base name from TXT filename and use it for the download
        const baseName = job.txt_filename.replace(/\.(txt|csv)$/i, '')
        filename = `${baseName}.${type}`
      }
      
      const url = window.URL.createObjectURL(new Blob([response.data]))
      const link = document.createElement('a')
      link.href = url
      link.setAttribute('download', filename)
      document.body.appendChild(link)
      link.click()
      link.remove()
      window.URL.revokeObjectURL(url)
      toast.success(`${type.toUpperCase()} downloaded successfully`)
    } catch (error) {
      toast.error(`Failed to download ${type.toUpperCase()} file`)
    }
  }

  const openDeleteConfirm = (job) => {
    setConfirmDialog({
      isOpen: true,
      jobId: job.id,
      jobInfo: job
    })
  }

  const closeDeleteConfirm = () => {
    setConfirmDialog({ isOpen: false, jobId: null, jobInfo: null })
  }

  const deleteJob = async () => {
    const jobId = confirmDialog.jobId
    setDeletingJob(jobId)
    try {
      await api.delete(`/jobs/${jobId}`)
      toast.success('Job deleted successfully')
      await fetchJobs()
    } catch (error) {
      toast.error('Failed to delete job')
    } finally {
      setDeletingJob(null)
    }
  }

  const handleSort = (field) => {
    if (sortBy === field) {
      setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc')
    } else {
      setSortBy(field)
      setSortOrder('desc')
    }
  }

  const getSortIcon = (field) => {
    if (sortBy !== field) {
      return <ArrowUpDown className="h-3 w-3 text-gray-400 dark:text-dark-muted" />
    }
    return sortOrder === 'asc' 
      ? <ArrowUp className="h-3 w-3 text-emerald-600 dark:text-emerald-400" />
      : <ArrowDown className="h-3 w-3 text-emerald-600 dark:text-emerald-400" />
  }

  const filteredJobs = jobs.filter(job => {
    if (filter === 'all') return true
    return job.status === filter
  })

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
          <div className="flex flex-col lg:flex-row lg:justify-between lg:items-center space-y-4 lg:space-y-0">
            <div>
              <h1 className="text-2xl lg:text-3xl font-bold text-gray-900 dark:text-dark-text">Job History</h1>
              <p className="text-gray-600 dark:text-dark-muted mt-1">Track all your processing jobs and download results</p>
            </div>
            <div className="flex flex-col sm:flex-row items-start sm:items-center space-y-3 sm:space-y-0 sm:space-x-4">
              <div className="flex items-center space-x-2">
                <label className="text-sm font-medium text-gray-700 dark:text-dark-text">Sort by:</label>
                <select
                  value={sortBy}
                  onChange={(e) => setSortBy(e.target.value)}
                  className="border border-gray-200 dark:border-dark-border rounded-xl px-4 py-2 text-sm bg-white/50 dark:bg-dark-bg text-gray-900 dark:text-dark-text backdrop-blur-sm focus:ring-2 focus:ring-emerald-500 focus:border-transparent dark:focus:ring-emerald-400 transition-all duration-200"
                >
                  <option value="created_at">Date Created</option>
                  <option value="id">Job ID</option>
                  <option value="status">Status</option>
                  <option value="updated_at">Last Updated</option>
                </select>
                <button
                  onClick={() => setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc')}
                  className="p-2 border border-gray-200 dark:border-dark-border rounded-xl hover:bg-emerald-50 dark:hover:bg-dark-hover hover:border-emerald-300 dark:hover:border-emerald-400 transition-all duration-200 group"
                  title={`Sort ${sortOrder === 'asc' ? 'Descending' : 'Ascending'}`}
                >
                  {sortOrder === 'asc' ? <ArrowUp className="h-4 w-4 text-gray-600 dark:text-dark-muted group-hover:text-emerald-600 dark:group-hover:text-emerald-400" /> : <ArrowDown className="h-4 w-4 text-gray-600 dark:text-dark-muted group-hover:text-emerald-600 dark:group-hover:text-emerald-400" />}
                </button>
              </div>
              <div className="flex items-center space-x-2">
                <label className="text-sm font-medium text-gray-700 dark:text-dark-text">Filter:</label>
                <select
                  value={filter}
                  onChange={(e) => setFilter(e.target.value)}
                  className="border border-gray-200 dark:border-dark-border rounded-xl px-4 py-2 text-sm bg-white/50 dark:bg-dark-bg text-gray-900 dark:text-dark-text backdrop-blur-sm focus:ring-2 focus:ring-emerald-500 focus:border-transparent dark:focus:ring-emerald-400 transition-all duration-200"
                >
                  <option value="all">All Jobs</option>
                  <option value="queued">Queued</option>
                  <option value="processing">Processing</option>
                  <option value="done">Completed</option>
                  <option value="error">Failed</option>
                </select>
              </div>
            </div>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-100 dark:divide-dark-border">
            <thead className="bg-gradient-to-r from-gray-50 to-gray-100/50 dark:from-dark-hover dark:to-dark-border">
              <tr>
                <th 
                  className="px-6 py-4 text-left text-xs font-semibold text-gray-700 dark:text-dark-text uppercase tracking-wider cursor-pointer hover:bg-gray-100/50 dark:hover:bg-dark-hover transition-colors duration-200 rounded-l-xl"
                  onClick={() => handleSort('id')}
                >
                  <div className="flex items-center space-x-1">
                    <span>Job ID</span>
                    {getSortIcon('id')}
                  </div>
                </th>
                <th className="px-6 py-4 text-left text-xs font-semibold text-gray-700 dark:text-dark-text uppercase tracking-wider">
                  Template
                </th>
                <th className="px-6 py-4 text-left text-xs font-semibold text-gray-700 dark:text-dark-text uppercase tracking-wider">
                  Excel Data
                </th>
                <th className="px-6 py-4 text-left text-xs font-semibold text-gray-700 dark:text-dark-text uppercase tracking-wider">
                  TXT File
                </th>
                <th 
                  className="px-6 py-4 text-left text-xs font-semibold text-gray-700 dark:text-dark-text uppercase tracking-wider cursor-pointer hover:bg-gray-100/50 dark:hover:bg-dark-hover transition-colors duration-200"
                  onClick={() => handleSort('status')}
                >
                  <div className="flex items-center space-x-1">
                    <span>Status</span>
                    {getSortIcon('status')}
                  </div>
                </th>
                <th 
                  className="px-6 py-4 text-left text-xs font-semibold text-gray-700 dark:text-dark-text uppercase tracking-wider cursor-pointer hover:bg-gray-100/50 dark:hover:bg-dark-hover transition-colors duration-200"
                  onClick={() => handleSort('created_at')}
                >
                  <div className="flex items-center space-x-1">
                    <span>Created</span>
                    {getSortIcon('created_at')}
                  </div>
                </th>
                <th className="px-6 py-4 text-left text-xs font-semibold text-gray-700 dark:text-dark-text uppercase tracking-wider rounded-r-xl">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody className="bg-white/50 dark:bg-dark-card/50 divide-y divide-gray-100 dark:divide-dark-border">
              {filteredJobs.length > 0 ? (
                filteredJobs.map((job) => (
                  <tr key={job.id} className="hover:bg-emerald-50/50 dark:hover:bg-dark-hover transition-colors duration-200">
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="flex items-center">
                        {getStatusIcon(job.status)}
                        <span className="ml-2 text-sm font-medium text-gray-900 dark:text-dark-text">
                          #{job.id}
                        </span>
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 dark:text-dark-text">
                      {job.template?.name || 'N/A'}
                      {job.template?.version && (
                        <span className="text-gray-500 dark:text-dark-muted ml-1">
                          (v{job.template.version})
                        </span>
                      )}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 dark:text-dark-text">
                      {job.excel_data?.name || 'N/A'}
                      {job.excel_data?.version && (
                        <span className="text-gray-500 dark:text-dark-muted ml-1">
                          (v{job.excel_data.version})
                        </span>
                      )}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-dark-muted">
                      {job.txt_filename}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="flex items-center space-x-2">
                        <span className={getStatusBadge(job.status)}>
                          {job.status}
                        </span>
                        {job.status === 'processing' && (
                          <span className="text-sm text-gray-500 dark:text-dark-muted">
                            {job.progress}%
                          </span>
                        )}
                      </div>
                      {job.status === 'processing' && (
                        <div className="mt-2 w-full bg-gray-200 dark:bg-dark-border rounded-full h-1.5">
                          <div 
                            className="bg-emerald-600 dark:bg-emerald-400 h-1.5 rounded-full transition-all duration-500"
                            style={{ width: `${job.progress}%` }}
                          ></div>
                        </div>
                      )}
                      {job.status === 'error' && job.error_message && (
                        <div className="mt-1 text-xs text-red-600 dark:text-red-400 max-w-xs truncate" title={job.error_message}>
                          {job.error_message}
                        </div>
                      )}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-dark-muted">
                      <div className="flex items-center">
                        <Calendar className="h-4 w-4 mr-1 text-gray-500 dark:text-dark-muted" />
                        {new Date(job.created_at).toLocaleDateString()}
                        <br />
                        <span className="text-xs">
                          {new Date(job.created_at).toLocaleTimeString()}
                        </span>
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                      <div className="flex items-center space-x-2">
                        {job.status === 'done' ? (
                          <>
                            <button
                              onClick={() => downloadFile(job.id, 'pptx')}
                              className="inline-flex items-center px-3 py-2 border border-gray-200 dark:border-dark-border shadow-sm text-xs font-medium rounded-xl text-gray-700 dark:text-dark-text bg-white dark:bg-dark-card hover:bg-emerald-50 dark:hover:bg-dark-hover hover:border-emerald-300 dark:hover:border-emerald-400 hover:text-emerald-700 dark:hover:text-emerald-400 transition-all duration-200 group"
                              title="Download PowerPoint"
                            >
                              <FileText className="h-3 w-3 mr-1 group-hover:scale-110 transition-transform" />
                              PPTX
                            </button>
                            {/*<button
                              onClick={() => downloadFile(job.id, 'pdf')}
                              className="inline-flex items-center px-3 py-2 border border-gray-200 shadow-sm text-xs font-medium rounded-xl text-gray-700 bg-white hover:bg-blue-50 hover:border-blue-300 hover:text-blue-700 transition-all duration-200 group"
                              title="Download PDF"
                            >
                              <Download className="h-3 w-3 mr-1 group-hover:scale-110 transition-transform" />
                              PDF
                            </button>*/}
                          </>
                        ) : job.status === 'processing' ? (
                          <span className="text-emerald-600 dark:text-emerald-400 font-medium text-sm">Processing...</span>
                        ) : job.status === 'queued' ? (
                          <span className="text-yellow-600 dark:text-yellow-400 font-medium text-sm">In Queue</span>
                        ) : (
                          <span className="text-red-600 dark:text-red-400 font-medium text-sm">Failed</span>
                        )}
                        <button
                          onClick={() => openDeleteConfirm(job)}
                          disabled={deletingJob === job.id}
                          className="inline-flex items-center px-3 py-2 border border-red-200 dark:border-red-800 shadow-sm text-xs font-medium rounded-xl text-red-700 dark:text-red-400 bg-white dark:bg-dark-card hover:bg-red-50 dark:hover:bg-red-900/10 hover:border-red-300 dark:hover:border-red-600 disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-200 group"
                          title="Delete Job"
                        >
                          {deletingJob === job.id ? (
                            <div className="animate-spin rounded-full h-3 w-3 border-2 border-red-300 border-t-red-600"></div>
                          ) : (
                            <Trash2 className="h-3 w-3 group-hover:scale-110 transition-transform" />
                          )}
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={7} className="px-6 py-8 text-center">
                    <div className="flex flex-col items-center justify-center space-y-3">
                      <FileText className="h-12 w-12 text-gray-400 dark:text-dark-muted" />
                      <div className="text-sm text-gray-500 dark:text-dark-muted">
                        {filter === 'all' 
                          ? 'No jobs found. Submit your first job from the dashboard!'
                          : `No ${filter} jobs found.`
                        }
                      </div>
                    </div>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Professional Confirm Dialog */}
      <ConfirmDialog
        isOpen={confirmDialog.isOpen}
        onClose={closeDeleteConfirm}
        onConfirm={deleteJob}
        title="Delete Job"
        message={
          confirmDialog.jobInfo ? (
            <div className="space-y-2">
              <p>Are you sure you want to delete this job? This action cannot be undone.</p>
              <div className="bg-gray-50 dark:bg-dark-hover rounded-lg p-3 mt-3">
                <div className="text-sm text-gray-700 dark:text-dark-text">
                  <p><span className="font-medium">Job ID:</span> #{confirmDialog.jobInfo.id}</p>
                  {confirmDialog.jobInfo.template?.name && (
                    <p><span className="font-medium">Template:</span> {confirmDialog.jobInfo.template.name}</p>
                  )}
                  <p><span className="font-medium">Status:</span> {confirmDialog.jobInfo.status}</p>
                  <p><span className="font-medium">Created:</span> {new Date(confirmDialog.jobInfo.created_at).toLocaleString()}</p>
                </div>
              </div>
            </div>
          ) : 'Are you sure you want to delete this job?'
        }
        confirmText="Delete Job"
        cancelText="Cancel"
        type="danger"
      />
    </div>
  )
}

export default Jobs