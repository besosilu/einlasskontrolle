import { createContext, useContext, useState, useCallback, type ReactNode } from 'react';

interface AuthState {
  token: string | null;
  email: string | null;
  firstName: string | null;
  lastName: string | null;
  role: string | null;
  mustChangePassword: boolean;
}

interface AuthContextValue extends AuthState {
  login: (token: string, email: string, firstName: string, lastName: string, role: string, mustChangePassword: boolean) => void;
  logout: () => void;
  isAuthenticated: boolean;
  isAdmin: boolean;
}

const AuthContext = createContext<AuthContextValue | null>(null);

const KEYS = {
  token: 'einlass_token',
  email: 'einlass_email',
  firstName: 'einlass_firstName',
  lastName: 'einlass_lastName',
  role: 'einlass_role',
  mustChangePassword: 'einlass_mustChangePw',
};

export function AuthProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<AuthState>(() => ({
    token: localStorage.getItem(KEYS.token),
    email: localStorage.getItem(KEYS.email),
    firstName: localStorage.getItem(KEYS.firstName),
    lastName: localStorage.getItem(KEYS.lastName),
    role: localStorage.getItem(KEYS.role),
    mustChangePassword: localStorage.getItem(KEYS.mustChangePassword) === 'true',
  }));

  const login = useCallback(
    (token: string, email: string, firstName: string, lastName: string, role: string, mustChangePassword: boolean) => {
      localStorage.setItem(KEYS.token, token);
      localStorage.setItem(KEYS.email, email);
      localStorage.setItem(KEYS.firstName, firstName);
      localStorage.setItem(KEYS.lastName, lastName);
      localStorage.setItem(KEYS.role, role);
      localStorage.setItem(KEYS.mustChangePassword, String(mustChangePassword));
      setState({ token, email, firstName, lastName, role, mustChangePassword });
    },
    []
  );

  const logout = useCallback(() => {
    Object.values(KEYS).forEach((k) => localStorage.removeItem(k));
    setState({ token: null, email: null, firstName: null, lastName: null, role: null, mustChangePassword: false });
  }, []);

  return (
    <AuthContext.Provider
      value={{
        ...state,
        login,
        logout,
        isAuthenticated: !!state.token,
        isAdmin: state.role === 'admin',
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}
