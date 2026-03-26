import { createSlice, createAsyncThunk, PayloadAction } from "@reduxjs/toolkit"
import type { UserRole } from "@prisma/client"

export interface AuthUser {
  id: string
  email: string
  name: string | null
  role: UserRole
  subscriptionStatus: string | null
}

interface AuthState {
  user: AuthUser | null
  loading: boolean
  error: string | null
}

const initialState: AuthState = {
  user: null,
  loading: false,
  error: null,
}

export const fetchCurrentUser = createAsyncThunk(
  "auth/fetchCurrentUser",
  async () => {
    const res = await fetch("/api/auth/account")
    if (!res.ok) throw new Error("Failed to fetch user")
    const json = await res.json()
    return json.user as AuthUser
  }
)

const authSlice = createSlice({
  name: "auth",
  initialState,
  reducers: {
    setUser(state, action: PayloadAction<AuthUser>) {
      state.user = action.payload
      state.error = null
    },
    clearUser(state) {
      state.user = null
      state.error = null
    },
  },
  extraReducers: (builder) => {
    builder
      .addCase(fetchCurrentUser.pending, (state) => {
        state.loading = true
        state.error = null
      })
      .addCase(fetchCurrentUser.fulfilled, (state, action) => {
        state.loading = false
        state.user = action.payload
      })
      .addCase(fetchCurrentUser.rejected, (state, action) => {
        state.loading = false
        state.error = action.error.message ?? "Failed to fetch user"
      })
  },
})

export const { setUser, clearUser } = authSlice.actions
export default authSlice.reducer
