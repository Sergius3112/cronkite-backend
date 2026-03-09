// AuthContext is no longer used — nav and auth are handled per-page and by route.
// Kept as an empty export to avoid breaking any stale imports.
export function AuthProvider({ children }) { return children }
export const useAuth = () => ({})
