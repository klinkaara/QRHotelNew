import React, { createContext, useState, useContext, useEffect } from 'react';
import axios from 'axios';
import api from '../api';

const AuthContext = createContext();

export const useAuth = () => useContext(AuthContext);

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [token, setToken] = useState(localStorage.getItem('token') || null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (token) {
      axios.defaults.headers.common['Authorization'] = `Bearer ${token}`;
      fetchUser();
    } else {
      setLoading(false);
    }
  }, [token]);

  const fetchUser = async () => {
    try {
      const res = await api.get('/api/auth/me');
      setUser(res.data);
    } catch (err) {
      console.error(err);
      logout();
    } finally {
      setLoading(false);
    }
  };

  const login = async (username, password) => {
    const formData = new FormData();
    formData.append('username', username);
    formData.append('password', password);
    
    const res = await api.post('/api/auth/login', formData);
    setToken(res.data.access_token);
    localStorage.setItem('token', res.data.access_token);
    
    axios.defaults.headers.common['Authorization'] = `Bearer ${res.data.access_token}`;
    const userRes = await api.get('/api/auth/me');
    setUser(userRes.data);
    return userRes.data;
  };

  const logout = () => {
    setUser(null);
    setToken(null);
    localStorage.removeItem('token');
    localStorage.removeItem('waiter_selected_table');
    localStorage.removeItem('owner_active_tab');
    localStorage.removeItem('owner_selected_table');
    delete axios.defaults.headers.common['Authorization'];
    window.location.href = '/login';
  };

  return (
    <AuthContext.Provider value={{ user, token, login, logout, loading }}>
      {!loading && children}
    </AuthContext.Provider>
  );
};
