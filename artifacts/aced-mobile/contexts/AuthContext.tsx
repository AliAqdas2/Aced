import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';

const AUTH_USER_KEY = '@aced/user';

export interface AuthUser {
  id: string;
  email: string;
  role: string;
  emailVerified: boolean;
}

interface AuthContextType {
  user: AuthUser | null;
  isLoading: boolean;
  setUser: (user: AuthUser | null) => void;
  clearUser: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType>({
  user: null,
  isLoading: true,
  setUser: () => {},
  clearUser: async () => {},
});

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUserState] = useState<AuthUser | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    (async () => {
      try {
        const stored = await AsyncStorage.getItem(AUTH_USER_KEY);
        if (stored) {
          setUserState(JSON.parse(stored));
        }
      } catch {
        // ignore
      } finally {
        setIsLoading(false);
      }
    })();
  }, []);

  const setUser = useCallback((u: AuthUser | null) => {
    setUserState(u);
    if (u) {
      AsyncStorage.setItem(AUTH_USER_KEY, JSON.stringify(u)).catch(() => {});
    } else {
      AsyncStorage.removeItem(AUTH_USER_KEY).catch(() => {});
    }
  }, []);

  const clearUser = useCallback(async () => {
    setUserState(null);
    await AsyncStorage.removeItem(AUTH_USER_KEY);
  }, []);

  return (
    <AuthContext.Provider value={{ user, isLoading, setUser, clearUser }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  return useContext(AuthContext);
}
