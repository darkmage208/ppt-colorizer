import { useState, useEffect } from 'react'
import { useForm } from 'react-hook-form'
import api from '../utils/api'
import toast from 'react-hot-toast'
import { Upload, Play, FileText, Database, Clock, CheckCircle, XCircle, AlertCircle } from 'lucide-react'

const Dashboard = () => {
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
        api.get('/jobs/?limit=4')
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
      const response = await api.get('/jobs/?limit=4')
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
      
      const url = window.URL.createObjectURL(new Blob([response.data]))
      const link = document.createElement('a')
      link.href = url
      link.setAttribute('download', `output_${jobId}.${type}`)
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
        <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-blue-500"></div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Welcome Section */}
      <div className="bg-gradient-to-r from-blue-600 to-blue-800 rounded-lg shadow-lg text-white">
        <div className="px-6 py-8">
          <h1 className="text-3xl font-bold mb-2">Welcome to PPT Colorizer</h1>
          <p className="text-blue-100">
            Upload your TXT file and let our system automatically apply colors to your PowerPoint presentations based on Excel data.
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Job Submission Form */}
        <div className="bg-white shadow rounded-lg">
          <div className="px-6 py-4 border-b border-gray-200">
            <h2 className="text-xl font-semibold text-gray-900 flex items-center">
              <Play className="h-6 w-6 mr-2 text-blue-600" />
              Run New Job
            </h2>
          </div>
          <div className="p-6">
            <form onSubmit={handleSubmit(handleJobSubmit)} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Select Template
                </label>
                <select
                  {...register('template_id', { required: 'Please select a template' })}
                  className="w-full border border-gray-300 rounded-md px-3 py-2 focus:outline-none focus:ring-blue-500 focus:border-blue-500"
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
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Select Excel Data
                </label>
                <select
                  {...register('excel_data_id', { required: 'Please select Excel data' })}
                  className="w-full border border-gray-300 rounded-md px-3 py-2 focus:outline-none focus:ring-blue-500 focus:border-blue-500"
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
                <label className="block text-sm font-medium text-gray-700 mb-2">
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
                  className="w-full border border-gray-300 rounded-md px-3 py-2 focus:outline-none focus:ring-blue-500 focus:border-blue-500"
                />
                {errors.txt_file && (
                  <p className="mt-1 text-sm text-red-600">{errors.txt_file.message}</p>
                )}
                <p className="mt-1 text-sm text-gray-500">
                  Upload your TXT file containing RSID mappings
                </p>
              </div>

              {submitting && (
                <div className="space-y-2">
                  <div className="flex justify-between items-center">
                    <span className="text-sm font-medium text-gray-700">Uploading TXT file...</span>
                    <span className="text-sm text-gray-500">{jobUploadProgress}%</span>
                  </div>
                  <div className="w-full bg-gray-200 rounded-full h-2">
                    <div 
                      className="bg-blue-600 h-2 rounded-full transition-all duration-300"
                      style={{ width: `${jobUploadProgress}%` }}
                    ></div>
                  </div>
                </div>
              )}

              <button
                type="submit"
                disabled={submitting}
                className="w-full flex items-center justify-center px-4 py-2 border border-transparent text-sm font-medium rounded-md text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <Upload className="h-4 w-4 mr-2" />
                {submitting ? 'Submitting...' : 'Run Automation'}
              </button>
            </form>
          </div>
        </div>

        {/* Recent Jobs */}
        <div className="bg-white shadow rounded-lg">
          <div className="px-6 py-4 border-b border-gray-200">
            <h2 className="text-xl font-semibold text-gray-900">Recent Jobs</h2>
          </div>
          <div className="divide-y divide-gray-200">
            {recentJobs.length > 0 ? (
              recentJobs.map((job) => (
                <div key={job.id} className="p-6">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center space-x-3">
                      {getStatusIcon(job.status)}
                      <div>
                        <p className="text-sm font-medium text-gray-900">
                          Job #{job.id}
                        </p>
                        <p className="text-sm text-gray-500">
                          {new Date(job.created_at).toLocaleString()}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center space-x-2">
                      <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${
                        job.status === 'done' ? 'bg-green-100 text-green-800' :
                        job.status === 'processing' ? 'bg-blue-100 text-blue-800' :
                        job.status === 'error' ? 'bg-red-100 text-red-800' :
                        'bg-yellow-100 text-yellow-800'
                      }`}>
                        {job.status}
                      </span>
                      {job.status === 'processing' && (
                        <span className="text-sm text-gray-500">{job.progress}%</span>
                      )}
                    </div>
                  </div>
                  
                  {job.status === 'processing' && (
                    <div className="mt-3">
                      <div className="bg-gray-200 rounded-full h-2">
                        <div 
                          className="bg-blue-600 h-2 rounded-full transition-all duration-500"
                          style={{ width: `${job.progress}%` }}
                        ></div>
                      </div>
                    </div>
                  )}

                  {job.status === 'done' && (
                    <div className="mt-3 flex space-x-2">
                      <button
                        onClick={() => downloadFile(job.id, 'pptx')}
                        className="inline-flex items-center px-3 py-1 border border-gray-300 shadow-sm text-xs font-medium rounded text-gray-700 bg-white hover:bg-gray-50"
                      >
                        <FileText className="h-3 w-3 mr-1" />
                        PPTX
                      </button>
                      {/*<button
                        onClick={() => downloadFile(job.id, 'pdf')}
                        className="inline-flex items-center px-3 py-1 border border-gray-300 shadow-sm text-xs font-medium rounded text-gray-700 bg-white hover:bg-gray-50"
                      >
                        <FileText className="h-3 w-3 mr-1" />
                        PDF
                      </button>*/}
                    </div>
                  )}

                  {job.status === 'error' && job.error_message && (
                    <div className="mt-3">
                      <p className="text-sm text-red-600">{job.error_message}</p>
                    </div>
                  )}
                </div>
              ))
            ) : (
              <div className="p-6 text-center text-gray-500">
                No jobs yet. Submit your first job to get started!
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Available Resources */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="bg-white shadow rounded-lg">
          <div className="px-6 py-4 border-b border-gray-200">
            <h3 className="text-lg font-medium text-gray-900 flex items-center">
              <FileText className="h-5 w-5 mr-2 text-blue-600" />
              Available Templates
            </h3>
          </div>
          <div className="p-6">
            <div className="space-y-3">
              {templates.map((template) => (
                <div key={template.id} className="flex items-center justify-between p-3 bg-gray-50 rounded">
                  <div>
                    <p className="font-medium text-gray-900">{template.name}</p>
                    <p className="text-sm text-gray-500">Version {template.version}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        <div className="bg-white shadow rounded-lg">
          <div className="px-6 py-4 border-b border-gray-200">
            <h3 className="text-lg font-medium text-gray-900 flex items-center">
              <Database className="h-5 w-5 mr-2 text-green-600" />
              Available Excel Data
            </h3>
          </div>
          <div className="p-6">
            <div className="space-y-3">
              {excelData.map((data) => (
                <div key={data.id} className="flex items-center justify-between p-3 bg-gray-50 rounded">
                  <div>
                    <p className="font-medium text-gray-900">{data.name}</p>
                    <p className="text-sm text-gray-500">Version {data.version}</p>
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