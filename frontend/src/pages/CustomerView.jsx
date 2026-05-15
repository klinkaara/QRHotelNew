import React, { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import api from '../api';
import { ShoppingCart, Plus, Minus, Trash2, User, Phone, LogIn, Receipt, Clock, CheckCircle } from 'lucide-react';

const CustomerView = () => {
  const { tableId } = useParams();
  const [menu, setMenu] = useState([]);
  const [categories, setCategories] = useState([]);
  const [selectedCategory, setSelectedCategory] = useState('');
  const [cart, setCart] = useState([]);
  const [loading, setLoading] = useState(true);
  
  // Persistence & State
  const [isLoggedIn, setIsLoggedIn] = useState(() => {
    return localStorage.getItem(`table_${tableId}_logged_in`) === 'true';
  });
  const [myOrders, setMyOrders] = useState([]);
  const [tableStatus, setTableStatus] = useState('Available');
  const [customerName, setCustomerName] = useState(localStorage.getItem(`table_${tableId}_customer_name`) || '');
  const [customerPhone, setCustomerPhone] = useState(localStorage.getItem(`table_${tableId}_customer_phone`) || '');
  const [authError, setAuthError] = useState('');

  useEffect(() => {
    if (isLoggedIn) {
      fetchMenu();
      fetchTableData();
      // Poll for updates every 10 seconds
      const interval = setInterval(fetchTableData, 10000);
      return () => clearInterval(interval);
    } else {
      setLoading(false);
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
      console.error(err);
    }
  };

  const fetchTableData = async () => {
    try {
      // Get table status
      const tableRes = await api.get(`/api/tables/${tableId}`);
      setTableStatus(tableRes.data.status);
      
      // Get orders for this table
      const ordersRes = await api.get(`/api/orders?table_id=${tableId}`);
      // Filter only non-completed orders if needed, but usually we show all for the session
      setMyOrders(ordersRes.data);
      setLoading(false);
    } catch (err) {
      console.error(err);
      setLoading(false);
    }
  };

  const handleLogin = (e) => {
    e.preventDefault();
    if (!customerName.trim() || !customerPhone.trim()) {
      setAuthError('Please enter both name and phone number.');
      return;
    }
    setIsLoggedIn(true);
    localStorage.setItem(`table_${tableId}_logged_in`, 'true');
    localStorage.setItem(`table_${tableId}_customer_name`, customerName);
    localStorage.setItem(`table_${tableId}_customer_phone`, customerPhone);
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
    if (!window.confirm('Are you sure you want to request the bill?')) return;
    try {
      await api.put(`/api/tables/${tableId}/status`, { status: 'Payment' });
      alert('Bill requested! Our staff will be with you shortly.');
      fetchTableData();
    } catch (err) {
      console.error(err);
      alert('Failed to request bill');
    }
  };

  if (loading) return <div className="loading" style={{ color: 'white', textAlign: 'center', marginTop: '100px' }}>Syncing with Table...</div>;

  if (!isLoggedIn) {
    return (
      <div className="app-container" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '90vh' }}>
        <div className="glass-panel animate-slide-up" style={{ width: '100%', maxWidth: '400px', textAlign: 'center', padding: '48px 32px' }}>
          <div style={{ background: 'var(--accent-color)', width: '72px', height: '72px', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 24px auto' }}>
            <LogIn color="white" size={32} />
          </div>
          <h2 style={{ marginBottom: '8px' }}>Table #{tableId}</h2>
          <p style={{ color: '#94a3b8', marginBottom: '32px' }}>Enter details to start your dining experience</p>
          <form onSubmit={handleLogin} style={{ textAlign: 'left' }}>
            <input type="text" placeholder="Full Name" value={customerName} onChange={(e) => setCustomerName(e.target.value)} className="modern-input" required />
            <input type="tel" placeholder="Phone Number" value={customerPhone} onChange={(e) => setCustomerPhone(e.target.value)} className="modern-input" required />
            {authError && <p style={{ color: 'var(--danger-color)', marginBottom: '16px' }}>{authError}</p>}
            <button type="submit" className="modern-button success">Enter Menu</button>
          </form>
        </div>
      </div>
    );
  }

  return (
    <div className="app-container">
      <header style={{ marginBottom: '32px', display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
        <div>
          <h1 style={{ fontSize: '28px', fontWeight: '800' }}>Table {tableId}</h1>
          <div style={{ display: 'flex', gap: '8px', marginTop: '8px' }}>
            <span className={`status-badge status-${tableStatus.replace(/\s/g, '')}`}>{tableStatus}</span>
            <span style={{ color: '#94a3b8', fontSize: '14px' }}>• {customerName}</span>
          </div>
        </div>
        <button onClick={requestBill} className="modern-button warning" style={{ width: 'auto', padding: '10px 20px', display: 'flex', alignItems: 'center', gap: '8px' }}>
          <Receipt size={18} /> Request Bill
        </button>
      </header>

      <div className="customer-layout">
        <div>
          {/* Active Orders Section */}
          {myOrders.length > 0 && (
            <div className="glass-panel" style={{ marginBottom: '24px', borderColor: 'var(--accent-color)' }}>
              <h3 style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '16px', fontSize: '16px' }}>
                <Clock size={18} color="var(--accent-color)" /> Your Current Orders
              </h3>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                {myOrders.map(order => (
                  <div key={order.id} style={{ display: 'flex', justifyContent: 'space-between', fontSize: '14px', opacity: 0.9 }}>
                    <span>{order.quantity}x {order.menu_item_name}</span>
                    <span style={{ color: order.status === 'Ready' ? 'var(--accent-color)' : '#94a3b8' }}>{order.status}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Categories */}
          <div style={{ position: 'sticky', top: '0', zIndex: '100', background: 'var(--bg-color)', paddingBottom: '16px' }}>
            <div className="category-scroll hide-scrollbar" style={{ display: 'flex', gap: '12px', overflowX: 'auto', padding: '8px 0' }}>
              {categories.map(cat => (
                <button key={cat} onClick={() => setSelectedCategory(cat)} style={{
                  padding: '8px 16px', borderRadius: '12px', border: '1px solid var(--glass-border)',
                  background: selectedCategory === cat ? 'var(--accent-color)' : 'rgba(255,255,255,0.05)',
                  color: 'white', whiteSpace: 'nowrap', fontWeight: 'bold'
                }}>
                  {cat}
                </button>
              ))}
            </div>
          </div>

          {/* Menu */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
            {menu.filter(i => i.category === selectedCategory).map(item => (
              <div key={item.id} className="glass-panel" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '12px 16px' }}>
                <div>
                  <h4 style={{ margin: 0 }}>{item.name}</h4>
                  <p style={{ color: 'var(--accent-color)', fontWeight: 'bold', marginTop: '4px' }}>₹{item.price}</p>
                </div>
                <button onClick={() => addToCart(item)} className="modern-button success" style={{ width: 'auto', padding: '6px 16px' }}>Add</button>
              </div>
            ))}
          </div>
        </div>

        {/* Cart */}
        <div className="glass-panel" style={{ height: 'fit-content', position: 'sticky', top: '100px' }}>
          <h3 style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '20px' }}>
            <ShoppingCart /> New Order
          </h3>
          {cart.length === 0 ? <p style={{ color: '#94a3b8' }}>Select items to order</p> : (
            <>
              {cart.map((item, idx) => (
                <div key={idx} style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '12px', paddingBottom: '12px', borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontWeight: 'bold', fontSize: '14px' }}>{item.name}</div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginTop: '8px' }}>
                      <button onClick={() => updateQuantity(idx, -1)} style={{ background: 'none', border: 'none', color: '#94a3b8', cursor: 'pointer' }}><Minus size={14}/></button>
                      <span>{item.quantity}</span>
                      <button onClick={() => updateQuantity(idx, 1)} style={{ background: 'none', border: 'none', color: '#94a3b8', cursor: 'pointer' }}><Plus size={14}/></button>
                    </div>
                  </div>
                  <div style={{ textAlign: 'right' }}>
                    <div style={{ fontWeight: 'bold' }}>₹{item.price * item.quantity}</div>
                    <button onClick={() => removeFromCart(idx)} style={{ background: 'none', border: 'none', color: 'var(--danger-color)', cursor: 'pointer', marginTop: '8px' }}><Trash2 size={16}/></button>
                  </div>
                </div>
              ))}
              <div style={{ display: 'flex', justifyContent: 'space-between', fontWeight: 'bold', fontSize: '18px', margin: '20px 0' }}>
                <span>Total</span>
                <span style={{ color: 'var(--accent-color)' }}>₹{cart.reduce((acc, i) => acc + (i.price * i.quantity), 0)}</span>
              </div>
              <button onClick={placeOrder} className="modern-button success">Confirm Order</button>
            </>
          )}
        </div>
      </div>
    </div>
  );
};

export default CustomerView;
