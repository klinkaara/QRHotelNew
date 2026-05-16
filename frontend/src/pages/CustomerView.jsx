import React, { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import api from '../api';
import { ShoppingCart, Plus, Minus, Trash2, User, Phone, LogIn, Receipt, Clock, CheckCircle } from 'lucide-react';

const CustomerView = () => {
  const { id: tableId } = useParams();
  
  // Menu & Cart State
  const [menu, setMenu] = useState([]);
  const [categories, setCategories] = useState([]);
  const [selectedCategory, setSelectedCategory] = useState('');
  const [cart, setCart] = useState([]);
  const [loading, setLoading] = useState(true);
  
  // AUTH & SESSION STATE
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [sessionId, setSessionId] = useState(localStorage.getItem(`table_session_id_${tableId}`) || null);
  const [customerName, setCustomerName] = useState(localStorage.getItem(`table_name_${tableId}`) || '');
  const [customerPhone, setCustomerPhone] = useState(localStorage.getItem(`table_phone_${tableId}`) || '');
  const [authError, setAuthError] = useState('');

  // Orders & Table State
  const [myOrders, setMyOrders] = useState([]);
  const [tableStatus, setTableStatus] = useState('Available');

  // Initial Check - Verify session with backend
  useEffect(() => {
    const verifySession = async () => {
      if (!sessionId) {
        setLoading(false);
        return;
      }
      
      try {
        const tableRes = await api.get(`/api/sessions/table/${tableId}`);
        // If table is Available or has a different session, clear local session
        if (tableRes.data.status === 'Available' || !tableRes.data.current_session_id || tableRes.data.current_session_id !== parseInt(sessionId)) {
          handleLogout();
        } else {
          setIsLoggedIn(true);
        }
      } catch (err) {
        console.error("Session verification failed", err);
        handleLogout();
      } finally {
        setLoading(false);
      }
    };
    
    verifySession();
  }, [tableId]);

  // Fetch data only if logged in
  useEffect(() => {
    if (isLoggedIn && sessionId) {
      fetchMenu();
      fetchTableData();
      const interval = setInterval(fetchTableData, 10000);
      return () => clearInterval(interval);
    }
  }, [isLoggedIn, sessionId]);

  const fetchMenu = async () => {
    try {
      const res = await api.get('/api/menu/');
      const activeItems = res.data.filter(i => i.is_active);
      setMenu(activeItems);
      const uniqueCats = [...new Set(activeItems.map(i => i.category))];
      setCategories(uniqueCats);
      if (uniqueCats.length > 0) setSelectedCategory(uniqueCats[0]);
    } catch (err) {
      console.error("Menu fetch failed", err);
    }
  };

  const fetchTableData = async () => {
    try {
      const tableRes = await api.get(`/api/sessions/table/${tableId}`);
      
      // Verification: If table is Available or has a different session, logout
      if (tableRes.data.status === 'Available' || !tableRes.data.current_session_id || tableRes.data.current_session_id !== parseInt(sessionId)) {
        handleLogout();
        return;
      }
      
      setTableStatus(tableRes.data.status);
      
      // Fetch orders for this specific session
      const ordersRes = await api.get(`/api/sessions/${sessionId}/orders`);
      setMyOrders(ordersRes.data);
      setLoading(false);
    } catch (err) {
      console.error("Session data fetch failed", err);
      // Don't logout on temporary network error, but if it's a 404/403, we should
      if (err.response?.status === 404 || err.response?.status === 400) {
        handleLogout();
      }
      setLoading(false);
    }
  };

  const handleLogin = async (e) => {
    e.preventDefault();
    if (!customerName.trim() || !customerPhone.trim()) {
      setAuthError('Name and Phone are required.');
      return;
    }
    
    try {
      // 1. Start the Session on the server
      const res = await api.post('/api/sessions/start', {
        table_id: parseInt(tableId),
        customer_name: customerName,
        customer_phone: customerPhone
      });
      
      const newSessionId = res.data.id;
      
      // 2. Save session locally
      localStorage.setItem(`table_session_id_${tableId}`, newSessionId);
      localStorage.setItem(`table_name_${tableId}`, customerName);
      localStorage.setItem(`table_phone_${tableId}`, customerPhone);
      
      setSessionId(newSessionId);
      setIsLoggedIn(true);
      setAuthError('');
    } catch (err) {
      console.error("Login/Session start failed", err);
      const detail = err.response?.data?.detail;
      const errorMessage = typeof detail === 'string' ? detail : 'Table is busy or connection failed.';
      setAuthError(errorMessage);
    }
  };

  const handleLogout = () => {
    localStorage.removeItem(`table_session_id_${tableId}`);
    localStorage.removeItem(`table_name_${tableId}`);
    localStorage.removeItem(`table_phone_${tableId}`);
    setIsLoggedIn(false);
    setSessionId(null);
    setCustomerName('');
    setCustomerPhone('');
    setCart([]);
  };

  const addToCart = (item) => {
    setCart(prev => {
      const existing = prev.find(i => i.id === item.id);
      if (existing) return prev.map(i => i.id === item.id ? { ...i, quantity: i.quantity + 1 } : i);
      return [...prev, { ...item, quantity: 1 }];
    });
  };

  const updateQuantity = (idx, delta) => {
    setCart(prev => {
      const updated = [...prev];
      const newQty = updated[idx].quantity + delta;
      if (newQty <= 0) {
        updated.splice(idx, 1);
      } else {
        updated[idx].quantity = newQty;
      }
      return updated;
    });
  };

  const removeFromCart = (idx) => {
    setCart(prev => prev.filter((_, i) => i !== idx));
  };

  const placeOrder = async () => {
    if (cart.length === 0 || !sessionId) return;
    try {
      await api.post('/api/orders/', {
        session_id: parseInt(sessionId),
        items: cart.map(i => ({ 
          menu_item_id: i.id, 
          quantity: i.quantity,
          special_instructions: "" 
        }))
      });
      alert('Order placed successfully!');
      setCart([]);
      fetchTableData();
    } catch (err) {
      console.error("Order placement failed", err);
      const detail = err.response?.data?.detail;
      const errorMessage = typeof detail === 'string' ? detail : 'Failed to place order. Please try again.';
      alert(errorMessage);
    }
  };

  const requestBill = async () => {
    if (!window.confirm('Request the bill for Table #' + tableId + '?') || !sessionId) return;
    try {
      await api.post(`/api/sessions/${sessionId}/checkout`);
      alert('Bill requested! Staff will be with you shortly.');
      fetchTableData();
    } catch (err) {
      console.error("Bill request failed", err);
      alert('Failed to request bill');
    }
  };

  if (loading && !isLoggedIn) return <div className="loading" style={{ color: 'white', textAlign: 'center', marginTop: '100px' }}>Loading...</div>;

  if (!isLoggedIn) {
    return (
      <div className="app-container" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '90vh' }}>
        <div className="glass-panel animate-slide-up" style={{ width: '100%', maxWidth: '400px', textAlign: 'center', padding: '48px 32px' }}>
          <div style={{ background: 'var(--accent-color)', width: '72px', height: '72px', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 24px auto' }}>
            <LogIn color="white" size={32} />
          </div>
          <h2 style={{ marginBottom: '12px', fontSize: '24px', fontWeight: '800' }}>Table #{tableId}</h2>
          <p style={{ color: '#94a3b8', marginBottom: '32px' }}>Scan to Order • Quick & Easy</p>
          
          <form onSubmit={handleLogin} style={{ textAlign: 'left' }}>
            <div style={{ marginBottom: '20px' }}>
              <label style={{ color: '#94a3b8', fontSize: '13px', display: 'block', marginBottom: '8px' }}>Name</label>
              <input type="text" placeholder="Full Name" value={customerName} onChange={(e) => setCustomerName(e.target.value)} className="modern-input" required />
            </div>
            <div style={{ marginBottom: '32px' }}>
              <label style={{ color: '#94a3b8', fontSize: '13px', display: 'block', marginBottom: '8px' }}>Phone Number</label>
              <input type="tel" placeholder="Phone Number" value={customerPhone} onChange={(e) => setCustomerPhone(e.target.value)} className="modern-input" required />
            </div>
            {authError && <p style={{ color: 'var(--danger-color)', marginBottom: '16px', textAlign: 'center', fontSize: '14px' }}>{authError}</p>}
            <button type="submit" className="modern-button success">View Menu</button>
          </form>
        </div>
      </div>
    );
  }

  return (
    <div className="app-container">
      <header style={{ marginBottom: '40px', display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
        <div>
          <h1 style={{ fontSize: '32px', fontWeight: '900', margin: 0 }}>Welcome!</h1>
          <p style={{ color: '#94a3b8', fontSize: '18px', marginTop: '4px' }}>Table #{tableId} • {customerName}</p>
        </div>
        <button onClick={requestBill} className="modern-button warning" style={{ width: 'auto', padding: '10px 20px', display: 'flex', alignItems: 'center', gap: '8px' }}>
          <Receipt size={18} /> Request Bill
        </button>
      </header>

      <div className="customer-layout">
        <div style={{ minWidth: 0 }}>
          {/* Categories Bar */}
          <div style={{ position: 'sticky', top: '0', zIndex: '100', background: 'var(--bg-color)', paddingBottom: '16px' }}>
            <div className="category-scroll hide-scrollbar" style={{ display: 'flex', gap: '12px', overflowX: 'auto', padding: '8px 0' }}>
              {categories.map(cat => (
                <button key={cat} onClick={() => setSelectedCategory(cat)} style={{
                  padding: '10px 20px', borderRadius: '12px', border: '1px solid var(--glass-border)',
                  background: selectedCategory === cat ? 'var(--accent-color)' : 'rgba(255,255,255,0.05)',
                  color: 'white', whiteSpace: 'nowrap', fontWeight: 'bold'
                }}>
                  {cat}
                </button>
              ))}
            </div>
          </div>

          {/* Menu Items */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', marginBottom: '40px' }}>
            {menu.filter(i => i.category === selectedCategory).map(item => (
              <div key={item.id} className="glass-panel" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '12px 16px' }}>
                <div>
                  <h4 style={{ margin: 0 }}>{item.name}</h4>
                  <p style={{ color: 'var(--accent-color)', fontWeight: 'bold', marginTop: '4px' }}>₹{Number(item.price).toFixed(2)}</p>
                </div>
                <button onClick={() => addToCart(item)} className="modern-button success" style={{ width: 'auto', padding: '8px 20px' }}>Add</button>
              </div>
            ))}
          </div>

          {/* My Orders */}
          {myOrders.length > 0 && (
            <div className="glass-panel" style={{ borderColor: 'rgba(16, 185, 129, 0.3)', background: 'rgba(16, 185, 129, 0.05)' }}>
              <h3 style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '20px', fontSize: '16px', color: 'var(--accent-color)' }}>
                <Clock size={18} /> Order History
              </h3>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                {myOrders.map(order => (
                  <div key={order.id} style={{ paddingBottom: '8px', borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '13px', color: '#94a3b8' }}>
                      <span>Order #{order.id}</span>
                      <span>{order.status}</span>
                    </div>
                    {order.items?.map((item, i) => (
                      <div key={i} style={{ display: 'flex', justifyContent: 'space-between', fontSize: '14px', marginTop: '4px' }}>
                        <span>{item.quantity}x {item.name}</span>
                        <span>₹{(item.price * item.quantity).toFixed(2)}</span>
                      </div>
                    ))}
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Cart */}
        <div className="glass-panel" style={{ height: 'fit-content', position: 'sticky', top: '100px' }}>
          <h3 style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '20px' }}><ShoppingCart /> Cart</h3>
          {cart.length === 0 ? <p style={{ color: '#94a3b8' }}>Empty</p> : (
            <>
              {cart.map((item, idx) => (
                <div key={idx} style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '16px' }}>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontWeight: 'bold', fontSize: '14px' }}>{item.name}</div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginTop: '10px' }}>
                      <button onClick={() => updateQuantity(idx, -1)} style={{ background: 'none', border: 'none', color: '#94a3b8', cursor: 'pointer' }}><Minus size={14}/></button>
                      <span>{item.quantity}</span>
                      <button onClick={() => updateQuantity(idx, 1)} style={{ background: 'none', border: 'none', color: '#94a3b8', cursor: 'pointer' }}><Plus size={14}/></button>
                    </div>
                  </div>
                  <div style={{ textAlign: 'right' }}>
                    <div style={{ fontWeight: 'bold' }}>₹{(item.price * item.quantity).toFixed(2)}</div>
                  </div>
                </div>
              ))}
              <div style={{ display: 'flex', justifyContent: 'space-between', fontWeight: 'bold', fontSize: '20px', margin: '24px 0' }}>
                <span>Total</span>
                <span style={{ color: 'var(--accent-color)' }}>₹{cart.reduce((acc, i) => acc + (i.price * i.quantity), 0).toFixed(2)}</span>
              </div>
              <button className="modern-button success" onClick={placeOrder}>Place Order</button>
            </>
          )}
        </div>
      </div>
      <style>{`
        .hide-scrollbar::-webkit-scrollbar { display: none; }
        .hide-scrollbar { -ms-overflow-style: none; scrollbar-width: none; }
      `}</style>
    </div>
  );
};

export default CustomerView;
