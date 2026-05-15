import React from 'react'
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom'
import { SpeedInsights } from '@vercel/speed-insights/react'
import { AuthProvider, useAuth } from './context/AuthContext'
import { SocketProvider } from './context/SocketContext'
import { CartProvider } from './context/CartContext'

// Pages
import Login from './pages/Login'
import CustomerView from './pages/CustomerView'
import WaiterView from './pages/WaiterView'
import OwnerView from './pages/OwnerView'
import KitchenView from './pages/KitchenView'

const ProtectedRoute = ({ children, allowedRoles }) => {
  const { user, token } = useAuth();
  
  if (!token) return <Navigate to="/login" replace />;
  if (allowedRoles && !allowedRoles.includes(user?.role)) return <Navigate to="/login" replace />;
  
  return children;
};

function App() {
  return (
    <AuthProvider>
      <SocketProvider>
        <CartProvider>
          <Router>
            <Routes>
              {/* Public/Customer Route */}
              <Route path="/table/:id" element={<CustomerView />} />
              <Route path="/login" element={<Login />} />
              
              {/* Protected Routes */}
              <Route path="/waiter" element={
                <ProtectedRoute allowedRoles={['waiter', 'owner']}>
                  <WaiterView />
                </ProtectedRoute>
              } />
              
              <Route path="/owner" element={
                <ProtectedRoute allowedRoles={['owner']}>
                  <OwnerView />
                </ProtectedRoute>
              } />
              
              <Route path="/kitchen" element={
                <ProtectedRoute allowedRoles={['kitchen', 'owner']}>
                  <KitchenView />
                </ProtectedRoute>
              } />

              <Route path="/" element={<Navigate to="/login" replace />} />
            </Routes>
            <SpeedInsights />
          </Router>
        </CartProvider>
      </SocketProvider>
    </AuthProvider>
  )
}

export default App
