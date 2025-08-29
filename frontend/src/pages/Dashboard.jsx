import { useState, useEffect } from 'react'
import { useForm } from 'react-hook-form'
import api from '../utils/api'
import toast from 'react-hot-toast'
import { Upload, Play, FileText, Database, Clock, CheckCircle, XCircle, AlertCircle } from 'lucide-react'
import { useAuth } from '../contexts/AuthContext'
import { getFilenameWithoutExtension } from '../utils/util'

const Dashboard = () => {
  const { user } = useAuth()
  const [templates, setTemplates] = useState([])
  const [excelData, setExcelData] = useState([])
  const [recentJobs, setRecentJobs] = useState([])
  const [loading, setLoading] = useState(true)
  const [submitting, setSubmitting] = useState(false)
  const [jobUploadProgress, setJobUploadProgress] = useState(0)

  const { register, handleSubmit, reset, formState: { errors } } = useForm()

  useEffect(() => {
    fetchData()
    const interval = setInterval(fetchJobs, 5000) // Poll jobs every 5 seconds
    return () => clearInterval(interval)
  }, [])

  const fetchData = async () => {
    try {
      const [templatesRes, excelRes, jobsRes] = await Promise.all([
        api.get('/templates/'),
        api.get('/excel-data/'),
        api.get('/jobs/?limit=3')
      ])
      
      setTemplates(templatesRes.data)
      setExcelData(excelRes.data)
      setRecentJobs(jobsRes.data)
    } catch (error) {
      toast.error('Failed to fetch data')
    } finally {
      setLoading(false)
    }
  }

  const fetchJobs = async () => {
    try {
      const response = await api.get('/jobs/?limit=3')
      setRecentJobs(response.data)
    } catch (error) {
      console.error('Failed to fetch jobs:', error)
    }
  }

  const handleJobSubmit = async (data) => {
    setSubmitting(true)
    setJobUploadProgress(0)
    const formData = new FormData()
    formData.append('txt_file', data.txt_file[0])

    try {
      await api.post(`/jobs/?template_id=${data.template_id}&excel_data_id=${data.excel_data_id}`, formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
        onUploadProgress: (progressEvent) => {
          const progress = Math.round((progressEvent.loaded * 100) / progressEvent.total)
          setJobUploadProgress(progress)
        }
      })
      toast.success('Job submitted successfully! Processing will begin shortly.')
      reset()
      fetchJobs()
    } catch (error) {
      const errorMessage = error.response?.data?.detail
      if (Array.isArray(errorMessage)) {
        toast.error(errorMessage.map(err => err.msg).join(', '))
      } else {
        toast.error(errorMessage || 'Failed to submit job')
      }
    } finally {
      setSubmitting(false)
      setJobUploadProgress(0)
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

  const downloadFile = async (jobId, type) => {
    try {
      const response = await api.get(`/jobs/${jobId}/download-${type}`, {
        responseType: 'blob'
      })
      
      // Find the job to get the TXT filename
      const job = recentJobs.find(j => j.id === jobId)
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
    } catch (error) {
      toast.error(`Failed to download ${type.toUpperCase()} file`)
    }
  }

  if (loading) {
    return (
      <div className="flex justify-center items-center min-h-96">
        <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-emerald-500 dark:border-emerald-400"></div>
      </div>
    )
  }

  return (
    <div className="space-y-8 p-6 bg-gradient-to-br from-gray-50 via-emerald-50/30 to-teal-50/30 dark:from-dark-bg dark:via-dark-bg dark:to-dark-bg min-h-screen">
      {/* Welcome Section */}
      <div className="relative overflow-hidden bg-gradient-to-r from-emerald-600 via-teal-600 to-emerald-700 dark:from-emerald-700 dark:via-teal-700 dark:to-emerald-800 rounded-2xl shadow-2xl text-white">
        <div className="absolute inset-0 bg-black/10"></div>
        <div className="absolute inset-0">
          <div className="absolute top-4 right-4 w-32 h-32 bg-white/10 rounded-full blur-2xl"></div>
          <div className="absolute bottom-4 left-4 w-24 h-24 bg-teal-400/20 rounded-full blur-xl"></div>
        </div>
        <div className="relative px-8 py-10">
          <div className="flex items-start justify-between">
            <div className="flex-1">
              <div className="flex items-center mb-4">
                <div className="p-3 bg-white/20 backdrop-blur-sm rounded-xl mr-4">
                  <Upload className="h-6 w-6" />
                </div>
                <div>
                  <h1 className="text-3xl font-bold">GABO Dashboard</h1>
                  <p className="text-emerald-100 text-sm">Genetics Analysis and Biosystems Optimization</p>
                </div>
              </div>
              <p className="text-lg text-emerald-100 max-w-2xl">
                Transform your PowerPoint presentations with intelligent color mapping based on genetic data analysis. 
                Upload TXT files and watch as our system automatically applies precise color schemes.
              </p>
            </div>
            <div className="hidden md:flex items-center space-x-6 text-center">
              <div className="bg-white/10 backdrop-blur-sm rounded-xl p-4">
                <div className="text-2xl font-bold">{templates.length}</div>
                <div className="text-sm text-emerald-200">Templates</div>
              </div>
              <div className="bg-white/10 backdrop-blur-sm rounded-xl p-4">
                <div className="text-2xl font-bold">{recentJobs.length}</div>
                <div className="text-sm text-emerald-200">Recent Jobs</div>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Job Submission Form - Only for Admin and Superadmin */}
        {(user?.role === 'admin' || user?.role === 'superadmin') && (
        <div className="bg-white/80 dark:bg-dark-card backdrop-blur-sm shadow-xl rounded-2xl border border-white/20 dark:border-dark-border">
          <div className="px-8 py-6 border-b border-gray-100 dark:border-dark-border">
            <h2 className="text-2xl font-bold text-gray-900 dark:text-dark-text flex items-center">
              <div className="p-2 bg-gradient-to-br from-emerald-500 to-teal-600 rounded-xl mr-3">
                <Play className="h-6 w-6 text-white" />
              </div>
              Launch Processing Job
            </h2>
            <p className="text-gray-600 dark:text-dark-muted mt-2">Configure and execute your presentation analysis</p>
          </div>
          <div className="p-8">
            <form onSubmit={handleSubmit(handleJobSubmit)} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-dark-text mb-2">
                  Select Template
                </label>
                <select
                  {...register('template_id', { required: 'Please select a template' })}
                  className="w-full border border-gray-300 dark:border-dark-border rounded-md px-3 py-2 bg-white dark:bg-dark-bg text-gray-900 dark:text-dark-text focus:outline-none focus:ring-emerald-500 focus:border-emerald-500 dark:focus:ring-emerald-400 dark:focus:border-emerald-400"
                >
                  <option value="">Choose a template...</option>
                  {templates.map((template) => (
                    <option key={template.id} value={template.id}>
                      {template.name} (v{template.version})
                    </option>
                  ))}
                </select>
                {errors.template_id && (
                  <p className="mt-1 text-sm text-red-600">{errors.template_id.message}</p>
                )}
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-dark-text mb-2">
                  Select Excel Data
                </label>
                <select
                  {...register('excel_data_id', { required: 'Please select Excel data' })}
                  className="w-full border border-gray-300 dark:border-dark-border rounded-md px-3 py-2 bg-white dark:bg-dark-bg text-gray-900 dark:text-dark-text focus:outline-none focus:ring-emerald-500 focus:border-emerald-500 dark:focus:ring-emerald-400 dark:focus:border-emerald-400"
                >
                  <option value="">Choose Excel data...</option>
                  {excelData.map((data) => (
                    <option key={data.id} value={data.id}>
                      {data.name} (v{data.version})
                    </option>
                  ))}
                </select>
                {errors.excel_data_id && (
                  <p className="mt-1 text-sm text-red-600">{errors.excel_data_id.message}</p>
                )}
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-dark-text mb-2">
                  Upload TXT File
                </label>
                <input
                  {...register('txt_file', { 
                    required: 'Please upload a TXT file',
                    validate: {
                      fileType: (files) => {
                        if (files?.[0]?.name && !files[0].name.toLowerCase().endsWith('.txt')) {
                          return 'Only .txt files are allowed'
                        }
                        return true
                      }
                    }
                  })}
                  type="file"
                  accept=".txt"
                  className="w-full border border-gray-300 dark:border-dark-border rounded-md px-3 py-2 bg-white dark:bg-dark-bg text-gray-900 dark:text-dark-text focus:outline-none focus:ring-emerald-500 focus:border-emerald-500 dark:focus:ring-emerald-400 dark:focus:border-emerald-400"
                />
                {errors.txt_file && (
                  <p className="mt-1 text-sm text-red-600">{errors.txt_file.message}</p>
                )}
                <p className="mt-1 text-sm text-gray-500 dark:text-dark-muted">
                  Upload your TXT file containing RSID mappings
                </p>
              </div>

              {submitting && (
                <div className="space-y-2">
                  <div className="flex justify-between items-center">
                    <span className="text-sm font-medium text-gray-700 dark:text-dark-text">Uploading TXT file...</span>
                    <span className="text-sm text-gray-500 dark:text-dark-muted">{jobUploadProgress}%</span>
                  </div>
                  <div className="w-full bg-gray-200 dark:bg-dark-border rounded-full h-2">
                    <div 
                      className="bg-emerald-600 dark:bg-emerald-400 h-2 rounded-full transition-all duration-300"
                      style={{ width: `${jobUploadProgress}%` }}
                    ></div>
                  </div>
                </div>
              )}

              <button
                type="submit"
                disabled={submitting}
                className="w-full relative bg-gradient-to-r from-emerald-600 via-teal-600 to-emerald-700 dark:from-emerald-700 dark:via-teal-700 dark:to-emerald-800 text-white py-4 px-6 rounded-xl font-semibold shadow-lg hover:shadow-xl transform hover:scale-[1.02] transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed disabled:transform-none group"
              >
                <span className="flex items-center justify-center">
                  {submitting ? (
                    <>
                      <div className="animate-spin rounded-full h-5 w-5 border-2 border-white border-t-transparent mr-3"></div>
                      Processing...
                    </>
                  ) : (
                    <>
                      <Upload className="h-5 w-5 mr-3 group-hover:translate-y-[-2px] transition-transform" />
                      Launch Analysis
                    </>
                  )}
                </span>
              </button>
            </form>
          </div>
        </div>
        )}
        
        {/* Access Denied Message for Regular Users */}
        {user?.role === 'user' && (
        <div className="bg-white/80 dark:bg-dark-card backdrop-blur-sm shadow-xl rounded-2xl border border-white/20 dark:border-dark-border">
          <div className="px-8 py-6 border-b border-gray-100 dark:border-dark-border">
            <h2 className="text-2xl font-bold text-gray-900 dark:text-dark-text flex items-center">
              <div className="p-2 bg-gradient-to-br from-gray-400 to-gray-600 rounded-xl mr-3">
                <AlertCircle className="h-6 w-6 text-white" />
              </div>
              Access Restricted
            </h2>
          </div>
          <div className="p-8 text-center">
            <div className="p-4 bg-gradient-to-br from-gray-100 to-gray-200 dark:from-dark-hover dark:to-dark-border rounded-2xl inline-block mb-4">
              <AlertCircle className="h-12 w-12 text-gray-400 dark:text-dark-muted" />
            </div>
            <h3 className="text-lg font-semibold text-gray-900 dark:text-dark-text mb-2">View Mode</h3>
            <p className="text-gray-600 dark:text-dark-muted">
              You can view and download all completed analysis results. Contact an administrator to create new processing jobs with your data.
            </p>
            <div className="mt-4 p-3 bg-emerald-50 dark:bg-emerald-900/20 border border-emerald-200 dark:border-emerald-800 rounded-lg">
              <p className="text-sm text-emerald-700 dark:text-emerald-400">
                <strong>What you can do:</strong><br/>
                • View all completed jobs and results<br/>
                • Download PPTX files<br/>
                • Access the job history and status
              </p>
            </div>
          </div>
        </div>
        )}

        {/* Recent Jobs */}
        <div className="bg-white/80 dark:bg-dark-card backdrop-blur-sm shadow-xl rounded-2xl border border-white/20 dark:border-dark-border">
          <div className="px-8 py-6 border-b border-gray-100 dark:border-dark-border">
            <h2 className="text-2xl font-bold text-gray-900 dark:text-dark-text flex items-center">
              <div className="p-2 bg-gradient-to-br from-emerald-500 to-teal-600 rounded-xl mr-3">
                <Clock className="h-6 w-6 text-white" />
              </div>
              Processing Status
            </h2>
            <p className="text-gray-600 dark:text-dark-muted mt-2">Monitor your active and completed jobs</p>
          </div>
          <div className="divide-y divide-gray-200 dark:divide-dark-border">
            {recentJobs.length > 0 ? (
              recentJobs.map((job) => (
                <div key={job.id} className="p-6 hover:bg-gray-50 dark:hover:bg-dark-hover transition-colors duration-200">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center space-x-3">
                      {getStatusIcon(job.status)}
                      <div>
                        <p className="text-sm font-medium text-gray-900 dark:text-dark-text">
                          Job #{job.id} - {getFilenameWithoutExtension(job.txt_filename)}
                        </p>
                        <p className="text-sm text-gray-500 dark:text-dark-muted">
                          {new Date(job.created_at).toLocaleString()}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center space-x-2">
                      <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${
                        job.status === 'done' ? 'bg-green-100 text-green-800 dark:bg-green-900/20 dark:text-green-400' :
                        job.status === 'processing' ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/20 dark:text-emerald-400' :
                        job.status === 'error' ? 'bg-red-100 text-red-800 dark:bg-red-900/20 dark:text-red-400' :
                        'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/20 dark:text-yellow-400'
                      }`}>
                        {job.status}
                      </span>
                      {job.status === 'processing' && (
                        <span className="text-sm text-gray-500 dark:text-dark-muted">{job.progress}%</span>
                      )}
                    </div>
                  </div>
                  
                  {job.status === 'processing' && (
                    <div className="mt-3">
                      <div className="bg-gray-200 dark:bg-dark-border rounded-full h-2">
                        <div 
                          className="bg-emerald-600 dark:bg-emerald-400 h-2 rounded-full transition-all duration-500"
                          style={{ width: `${job.progress}%` }}
                        ></div>
                      </div>
                    </div>
                  )}

                  {job.status === 'done' && (
                    <div className="mt-4 flex space-x-3">
                      <button
                        onClick={() => downloadFile(job.id, 'pptx')}
                        className="inline-flex items-center px-4 py-2 bg-gradient-to-r from-emerald-500 to-teal-600 dark:from-emerald-600 dark:to-teal-700 text-white text-sm font-medium rounded-xl shadow-md hover:shadow-lg transform hover:scale-105 transition-all duration-200"
                      >
                        <FileText className="h-4 w-4 mr-2" />
                        Download PPTX
                      </button>
                      {/*<button
                        onClick={() => downloadFile(job.id, 'pdf')}
                        className="inline-flex items-center px-4 py-2 bg-gradient-to-r from-red-500 to-pink-600 text-white text-sm font-medium rounded-xl shadow-md hover:shadow-lg transform hover:scale-105 transition-all duration-200"
                      >
                        <FileText className="h-4 w-4 mr-2" />
                        Download PDF
                      </button>*/}
                    </div>
                  )}

                  {job.status === 'error' && job.error_message && (
                    <div className="mt-3">
                      <p className="text-sm text-red-600 dark:text-red-400">{job.error_message}</p>
                    </div>
                  )}
                </div>
              ))
            ) : (
              <div className="p-12 text-center">
                <div className="p-4 bg-gradient-to-br from-gray-100 to-gray-200 dark:from-dark-hover dark:to-dark-border rounded-2xl inline-block mb-4">
                  <AlertCircle className="h-12 w-12 text-gray-400 dark:text-dark-muted" />
                </div>
                <h3 className="text-lg font-semibold text-gray-900 dark:text-dark-text mb-2">No Jobs Yet</h3>
                <p className="text-gray-500 dark:text-dark-muted">Submit your first processing job to get started with genetic analysis visualization!</p>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Available Resources */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="bg-white/80 dark:bg-dark-card backdrop-blur-sm shadow-xl rounded-2xl border border-white/20 dark:border-dark-border">
          <div className="px-8 py-6 border-b border-gray-100 dark:border-dark-border">
            <h3 className="text-xl font-bold text-gray-900 dark:text-dark-text flex items-center">
              <div className="p-2 bg-gradient-to-br from-emerald-500 to-teal-600 rounded-xl mr-3">
                <FileText className="h-5 w-5 text-white" />
              </div>
              PowerPoint Templates
            </h3>
            <p className="text-gray-600 dark:text-dark-muted text-sm mt-1">Available presentation templates for processing</p>
          </div>
          <div className="p-6">
            <div className="space-y-4">
              {templates.map((template) => (
                <div key={template.id} className="group p-4 bg-gradient-to-r from-emerald-50 to-teal-50 dark:from-dark-hover dark:to-dark-hover border border-emerald-100 dark:border-dark-border rounded-xl hover:shadow-md dark:hover:bg-dark-hover transition-all duration-200">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="font-semibold text-gray-900 dark:text-dark-text group-hover:text-emerald-700 dark:group-hover:text-emerald-400">{template.name}</p>
                      <p className="text-sm text-gray-600 dark:text-dark-muted">Version {template.version}</p>
                    </div>
                    <div className="p-2 bg-white dark:bg-dark-card rounded-lg shadow-sm">
                      <FileText className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        <div className="bg-white/80 dark:bg-dark-card backdrop-blur-sm shadow-xl rounded-2xl border border-white/20 dark:border-dark-border">
          <div className="px-8 py-6 border-b border-gray-100 dark:border-dark-border">
            <h3 className="text-xl font-bold text-gray-900 dark:text-dark-text flex items-center">
              <div className="p-2 bg-gradient-to-br from-emerald-500 to-teal-600 rounded-xl mr-3">
                <Database className="h-5 w-5 text-white" />
              </div>
              Excel Datasets
            </h3>
            <p className="text-gray-600 dark:text-dark-muted text-sm mt-1">Genetic data sources for analysis mapping</p>
          </div>
          <div className="p-6">
            <div className="space-y-4">
              {excelData.map((data) => (
                <div key={data.id} className="group p-4 bg-gradient-to-r from-emerald-50 to-teal-50 dark:from-dark-hover dark:to-dark-hover border border-emerald-100 dark:border-dark-border rounded-xl hover:shadow-md dark:hover:bg-dark-hover transition-all duration-200">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="font-semibold text-gray-900 dark:text-dark-text group-hover:text-emerald-700 dark:group-hover:text-emerald-400">{data.name}</p>
                      <p className="text-sm text-gray-600 dark:text-dark-muted">Version {data.version}</p>
                    </div>
                    <div className="p-2 bg-white dark:bg-dark-card rounded-lg shadow-sm">
                      <Database className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

export default Dashboard