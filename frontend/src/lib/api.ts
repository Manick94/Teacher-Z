import axios from 'axios'
import type { Dataset, GenerateResponse, ImageItem, User } from '../types/a2ui'

const BASE_URL = (import.meta as any).env?.VITE_API_URL || '/api/v1'

export const api = axios.create({
  baseURL: BASE_URL,
  headers: { 'Content-Type': 'application/json' },
})

// ── Auth token injection ──────────────────────────────────────────────────────

api.interceptors.request.use((config) => {
  const token = localStorage.getItem('access_token')
  if (token) config.headers.Authorization = `Bearer ${token}`
  return config
})

// ── Auto-refresh on 401 ───────────────────────────────────────────────────────

let _refreshing = false

api.interceptors.response.use(
  (res) => res,
  async (err) => {
    const original = err.config
    if (err.response?.status === 401 && !original._retry && !_refreshing) {
      original._retry = true
      _refreshing = true
      try {
        const refresh = localStorage.getItem('refresh_token')
        if (refresh) {
          const { data } = await axios.post(`${BASE_URL}/auth/refresh`, {
            refresh_token: refresh,
          })
          localStorage.setItem('access_token', data.access_token)
          localStorage.setItem('refresh_token', data.refresh_token)
          original.headers.Authorization = `Bearer ${data.access_token}`
          return api(original)
        }
      } catch {
        localStorage.removeItem('access_token')
        localStorage.removeItem('refresh_token')
        window.location.href = '/login'
      } finally {
        _refreshing = false
      }
    }
    return Promise.reject(err)
  }
)

// ── Image URL with auth token ─────────────────────────────────────────────────
// Images are served through the authenticated API. We embed the token as a
// query param for use in <img src=...> tags which can't set headers.
// The FastAPI backend reads ?token= as a fallback when Authorization header
// is absent.
export function imageUrl(datasetName: string, filename: string): string {
  const token = localStorage.getItem('access_token') || ''
  return `${BASE_URL}/datasets/${datasetName}/images/${encodeURIComponent(filename)}?token=${token}`
}

// ── Auth ──────────────────────────────────────────────────────────────────────

export const authApi = {
  register: (email: string, password: string, fullName?: string) =>
    api.post<User>('/auth/register', { email, password, full_name: fullName }),

  login: (email: string, password: string) =>
    api.post<{ access_token: string; refresh_token: string; expires_in: number }>(
      '/auth/login',
      { email, password }
    ),

  me: () => api.get<User>('/auth/me'),
}

// ── Datasets ──────────────────────────────────────────────────────────────────

export const datasetsApi = {
  list: () => api.get<Dataset[]>('/datasets'),

  create: (data: {
    name: string
    display_name?: string
    description?: string
    subject?: string
    grade_level?: string
    is_public?: boolean
  }) => api.post<Dataset>('/datasets', data),

  get: (name: string) =>
    api.get<Dataset & { images: ImageItem[] }>(`/datasets/${name}`),

  images: (name: string) => api.get<ImageItem[]>(`/datasets/${name}/images`),
}

// ── Generation ────────────────────────────────────────────────────────────────

export const generateApi = {
  generate: (params: {
    dataset_name: string
    image_filename: string
    lesson_type: string
    subject?: string
    grade_level?: string
    regenerate?: boolean
  }) => api.post<GenerateResponse>('/generate', params),

  lessons: (limit = 50, offset = 0) =>
    api.get('/generate/lessons', { params: { limit, offset } }),
}
