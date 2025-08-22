import { useState, useEffect } from 'react'
import api from '../utils/api'
import toast from 'react-hot-toast'
import { Clock, CheckCircle, XCircle, AlertCircle, FileText, Download, Calendar } from 'lucide-react'

const Jobs = () => {
  const [jobs, setJobs] = useState([])
  const [loading, setLoading] = useState(true)
  const [filter, setFilter] = useState('all')

  useEffect(() => {
    fetchJobs()
    const interval = setInterval(fetchJobs, 5000) // Poll every 5 seconds
    return () => clearInterval(interval)
  }, [])

  const fetchJobs = async () => {
    try {
      const response = await api.get('/jobs/?limit=100')
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
        return `${baseClasses} bg-yellow-100 text-yellow-800`
      case 'processing':
        return `${baseClasses} bg-blue-100 text-blue-800`
      case 'done':
        return `${baseClasses} bg-green-100 text-green-800`
      case 'error':
        return `${baseClasses} bg-red-100 text-red-800`
      default:
        return `${baseClasses} bg-gray-100 text-gray-800`
    }
  }

  const downloadFile = async (jobId, type) => {
    try {
      const response = await api.get(`/jobs/${jobId}/download-${type}`, {
        responseType: 'blob'
      })
      
      const url = window.URL.createObjectURL(new Blob([response.data]))
      const link = document.createElement('a')
      link.href = url
      link.setAttribute('download', `output_${jobId}.${type}`)
      document.body.appendChild(link)
      link.click()
      link.remove()
      window.URL.revokeObjectURL(url)
      toast.success(`${type.toUpperCase()} downloaded successfully`)
    } catch (error) {
      toast.error(`Failed to download ${type.toUpperCase()} file`)
    }
  }

  const filteredJobs = jobs.filter(job => {
    if (filter === 'all') return true
    return job.status === filter
  })

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
          <div className="flex justify-between items-center">
            <div>
              <h1 className="text-2xl font-bold text-gray-900">Job History</h1>
              <p className="text-gray-600">Track all your processing jobs and download results</p>
            </div>
            <div className="flex items-center space-x-4">
              <label className="text-sm font-medium text-gray-700">Filter by status:</label>
              <select
                value={filter}
                onChange={(e) => setFilter(e.target.value)}
                className="border border-gray-300 rounded-md px-3 py-1 text-sm"
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

        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Job ID
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Template
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Excel Data
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  TXT File
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Status
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Created
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {filteredJobs.length > 0 ? (
                filteredJobs.map((job) => (
                  <tr key={job.id} className="hover:bg-gray-50">
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="flex items-center">
                        {getStatusIcon(job.status)}
                        <span className="ml-2 text-sm font-medium text-gray-900">
                          #{job.id}
                        </span>
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                      {job.template?.name || 'N/A'}
                      {job.template?.version && (
                        <span className="text-gray-500 ml-1">
                          (v{job.template.version})
                        </span>
                      )}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                      {job.excel_data?.name || 'N/A'}
                      {job.excel_data?.version && (
                        <span className="text-gray-500 ml-1">
                          (v{job.excel_data.version})
                        </span>
                      )}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      {job.txt_filename}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="flex items-center space-x-2">
                        <span className={getStatusBadge(job.status)}>
                          {job.status}
                        </span>
                        {job.status === 'processing' && (
                          <span className="text-sm text-gray-500">
                            {job.progress}%
                          </span>
                        )}
                      </div>
                      {job.status === 'processing' && (
                        <div className="mt-2 w-full bg-gray-200 rounded-full h-1.5">
                          <div 
                            className="bg-blue-600 h-1.5 rounded-full transition-all duration-500"
                            style={{ width: `${job.progress}%` }}
                          ></div>
                        </div>
                      )}
                      {job.status === 'error' && job.error_message && (
                        <div className="mt-1 text-xs text-red-600 max-w-xs truncate" title={job.error_message}>
                          {job.error_message}
                        </div>
                      )}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      <div className="flex items-center">
                        <Calendar className="h-4 w-4 mr-1" />
                        {new Date(job.created_at).toLocaleDateString()}
                        <br />
                        <span className="text-xs">
                          {new Date(job.created_at).toLocaleTimeString()}
                        </span>
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                      {job.status === 'done' ? (
                        <div className="flex space-x-2">
                          <button
                            onClick={() => downloadFile(job.id, 'pptx')}
                            className="inline-flex items-center px-2 py-1 border border-gray-300 shadow-sm text-xs font-medium rounded text-gray-700 bg-white hover:bg-gray-50"
                            title="Download PowerPoint"
                          >
                            <FileText className="h-3 w-3 mr-1" />
                            PPTX
                          </button>
                          <button
                            onClick={() => downloadFile(job.id, 'pdf')}
                            className="inline-flex items-center px-2 py-1 border border-gray-300 shadow-sm text-xs font-medium rounded text-gray-700 bg-white hover:bg-gray-50"
                            title="Download PDF"
                          >
                            <Download className="h-3 w-3 mr-1" />
                            PDF
                          </button>
                        </div>
                      ) : job.status === 'processing' ? (
                        <span className="text-blue-600">Processing...</span>
                      ) : job.status === 'queued' ? (
                        <span className="text-yellow-600">In Queue</span>
                      ) : (
                        <span className="text-red-600">Failed</span>
                      )}
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={7} className="px-6 py-8 text-center">
                    <div className="flex flex-col items-center justify-center space-y-3">
                      <FileText className="h-12 w-12 text-gray-400" />
                      <div className="text-sm text-gray-500">
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
    </div>
  )
}

export default Jobs