import React, { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import api from '../api';
import { ShoppingCart, Plus, Minus, Trash2, User, Phone, LogIn, Receipt, Clock, CheckCircle } from 'lucide-react';

const CustomerView = () => {
  const { tableId } = useParams();
  
  // Menu & Cart State
  const [menu, setMenu] = useState([]);
  const [categories, setCategories] = useState([]);
  const [selectedCategory, setSelectedCategory] = useState('');
  const [cart, setCart] = useState([]);
  const [loading, setLoading] = useState(true);
  
  // AUTH STATE - Force login screen by default
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [customerName, setCustomerName] = useState('');
  const [customerPhone, setCustomerPhone] = useState('');
  const [authError, setAuthError] = useState('');

  // Orders & Table State
  const [myOrders, setMyOrders] = useState([]);
  const [tableStatus, setTableStatus] = useState('Available');

  // Initial check for existing session on THIS specific table
  useEffect(() => {
    const savedLogin = localStorage.getItem(`table_session_${tableId}`);
    if (savedLogin === 'true') {
      const savedName = localStorage.getItem(`table_name_${tableId}`);
      const savedPhone = localStorage.getItem(`table_phone_${tableId}`);
      if (savedName && savedPhone) {
        setCustomerName(savedName);
        setCustomerPhone(savedPhone);
        setIsLoggedIn(true);
      } else {
        setLoading(false);
      }
    } else {
      setLoading(false);
    }
  }, [tableId]);

  // Fetch data only if logged in
  useEffect(() => {
    if (isLoggedIn) {
      fetchMenu();
      fetchTableData();
      const interval = setInterval(fetchTableData, 10000);
      return () => clearInterval(interval);
    }
  }, [isLoggedIn]);

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
      const tableRes = await api.get(`/api/tables/${tableId}`);
      if (tableRes.data.status === 'Available') {
        // Table was reset/closed by owner
        handleLogout();
        return;
      }
      setTableStatus(tableRes.data.status);
      const ordersRes = await api.get(`/api/orders?table_id=${tableId}`);
      setMyOrders(ordersRes.data);
      setLoading(false);
    } catch (err) {
      console.error("Table data fetch failed", err);
      setLoading(false);
    }
  };

  const handleLogin = (e) => {
    e.preventDefault();
    if (!customerName.trim() || !customerPhone.trim()) {
      setAuthError('Please enter your Name and Phone Number.');
      return;
    }
    if (customerPhone.length < 10) {
      setAuthError('Please enter a valid phone number.');
      return;
    }
    
    // Save session for this table
    localStorage.setItem(`table_session_${tableId}`, 'true');
    localStorage.setItem(`table_name_${tableId}`, customerName);
    localStorage.setItem(`table_phone_${tableId}`, customerPhone);
    setIsLoggedIn(true);
    setAuthError('');
  };

  const handleLogout = () => {
    localStorage.removeItem(`table_session_${tableId}`);
    localStorage.removeItem(`table_name_${tableId}`);
    localStorage.removeItem(`table_phone_${tableId}`);
    setIsLoggedIn(false);
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
    if (cart.length === 0) return;
    try {
      await api.post('/api/orders', {
        table_id: tableId,
        items: cart.map(i => ({ menu_item_id: i.id, quantity: i.quantity })),
        customer_name: customerName
      });
      alert('Order placed successfully!');
      setCart([]);
      fetchTableData();
    } catch (err) {
      console.error(err);
      alert('Failed to place order');
    }
  };

  const requestBill = async () => {
    if (!window.confirm('Request the bill for Table #' + tableId + '?')) return;
    try {
      await api.put(`/api/tables/${tableId}/status`, { status: 'Payment' });
      alert('Bill requested! Staff will be with you shortly.');
      fetchTableData();
    } catch (err) {
      console.error(err);
    }
  };

  if (loading && !isLoggedIn) return <div className="loading" style={{ color: 'white', textAlign: 'center', marginTop: '100px' }}>Loading...</div>;

  // IF NOT LOGGED IN - ALWAYS SHOW THIS SCREEN
  if (!isLoggedIn) {
    return (
      <div className="app-container" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '90vh' }}>
        <div className="glass-panel animate-slide-up" style={{ width: '100%', maxWidth: '400px', textAlign: 'center', padding: '48px 32px' }}>
          <div style={{ background: 'var(--accent-color)', width: '72px', height: '72px', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 24px auto' }}>
            <LogIn color="white" size={32} />
          </div>
          <h2 style={{ marginBottom: '12px', fontSize: '24px', fontWeight: '800' }}>Table #{tableId}</h2>
          <p style={{ color: '#94a3b8', marginBottom: '32px' }}>Enter your details to view the menu</p>
          
          <form onSubmit={handleLogin} style={{ textAlign: 'left' }}>
            <div style={{ marginBottom: '20px' }}>
              <label style={{ color: '#94a3b8', fontSize: '13px', display: 'block', marginBottom: '8px' }}>Name</label>
              <input 
                type="text" 
                placeholder="Full Name" 
                value={customerName}
                onChange={(e) => setCustomerName(e.target.value)}
                className="modern-input"
                required
              />
            </div>
            <div style={{ marginBottom: '32px' }}>
              <label style={{ color: '#94a3b8', fontSize: '13px', display: 'block', marginBottom: '8px' }}>Phone Number</label>
              <input 
                type="tel" 
                placeholder="Phone Number" 
                value={customerPhone}
                onChange={(e) => setCustomerPhone(e.target.value)}
                className="modern-input"
                required
              />
            </div>
            {authError && <p style={{ color: 'var(--danger-color)', marginBottom: '16px', textAlign: 'center' }}>{authError}</p>}
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
          <p style={{ color: '#94a3b8', fontSize: '18px', marginTop: '4px' }}>Table #{tableId} • Hello, {customerName}</p>
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

          {/* My Orders Section */}
          {myOrders.length > 0 && (
            <div className="glass-panel" style={{ borderColor: 'rgba(16, 185, 129, 0.3)', background: 'rgba(16, 185, 129, 0.05)' }}>
              <h3 style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '20px', fontSize: '16px', color: 'var(--accent-color)' }}>
                <Clock size={18} /> Your Orders at this Table
              </h3>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                {myOrders.map(order => (
                  <div key={order.id} style={{ display: 'flex', justifyContent: 'space-between', fontSize: '14px' }}>
                    <span>{order.quantity}x {order.menu_item_name}</span>
                    <span style={{ 
                      padding: '2px 8px', borderRadius: '12px', background: 'rgba(255,255,255,0.1)', fontSize: '11px' 
                    }}>{order.status}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Cart */}
        <div className="glass-panel" style={{ height: 'fit-content', position: 'sticky', top: '100px' }}>
          <h3 style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '20px' }}><ShoppingCart /> Your Order</h3>
          {cart.length === 0 ? <p style={{ color: '#94a3b8' }}>Select items to order</p> : (
            <>
              {cart.map((item, idx) => (
                <div key={idx} style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '16px', paddingBottom: '16px', borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
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
                    <button onClick={() => removeFromCart(idx)} style={{ background: 'none', border: 'none', color: 'var(--danger-color)', cursor: 'pointer', marginTop: '8px' }}><Trash2 size={16}/></button>
                  </div>
                </div>
              ))}
              <div style={{ display: 'flex', justifyContent: 'space-between', fontWeight: 'bold', fontSize: '20px', margin: '24px 0' }}>
                <span>Total</span>
                <span style={{ color: 'var(--accent-color)' }}>₹{cart.reduce((acc, i) => acc + (i.price * i.quantity), 0).toFixed(2)}</span>
              </div>
              <button className="modern-button success" onClick={placeOrder}>Confirm Order</button>
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
