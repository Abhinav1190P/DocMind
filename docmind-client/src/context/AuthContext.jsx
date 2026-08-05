import { createContext, useContext, useState, useCallback } from "react";
import * as api from "../api/docmind.js";

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(() => {
    const stored = localStorage.getItem("docmind_user");
    return stored ? JSON.parse(stored) : null;
  });

  const doLogin = useCallback(async (credentials) => {
    const data = await api.login(credentials);
    localStorage.setItem("docmind_token", data.token);
    localStorage.setItem("docmind_user", JSON.stringify(data.user));
    setUser(data.user);
    return data.user;
  }, []);

  const doSignup = useCallback(async (details) => {
    const data = await api.signup(details);
    localStorage.setItem("docmind_token", data.token);
    localStorage.setItem("docmind_user", JSON.stringify(data.user));
    setUser(data.user);
    return data.user;
  }, []);

  const doLogout = useCallback(() => {
    localStorage.removeItem("docmind_token");
    localStorage.removeItem("docmind_user");
    setUser(null);
  }, []);

  return (
    <AuthContext.Provider value={{ user, login: doLogin, signup: doSignup, logout: doLogout }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}
