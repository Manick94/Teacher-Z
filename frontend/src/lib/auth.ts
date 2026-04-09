import { createContext, useContext } from 'react'
import type { User } from '../types/a2ui'

export interface AuthState {
  user: User | null
  token: string | null
  login: (email: string, password: string) => Promise<void>
  logout: () => void
  isLoading: boolean
}

export const AuthContext = createContext<AuthState>({
  user: null,
  token: null,
  login: async () => {},
  logout: () => {},
  isLoading: true,
})

export function useAuth() {
  return useContext(AuthContext)
}
