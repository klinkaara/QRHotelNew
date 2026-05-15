import React, { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import api from '../api';
import { ShoppingCart, Plus, Minus, Trash2, User, Phone, LogIn } from 'lucide-react';

const CustomerView = () => {
  const { tableId } = useParams();
  const [menu, setMenu] = useState([]);
  const [categories, setCategories] = useState([]);
  const [selectedCategory, setSelectedCategory] = useState('');
  const [cart, setCart] = useState([]);
  const [loading, setLoading] = useState(true);
  
  // Auth State
  const [isLoggedIn, setIsLoggedIn] = useState(() => {
    return localStorage.getItem(`table_${tableId}_logged_in`) === 'true';
  });
  const [customerName, setCustomerName] = useState('');
  const [customerPhone, setCustomerPhone] = useState('');
  const [authError, setAuthError] = useState('');

  useEffect(() => {
    if (isLoggedIn) {
      fetchMenu();
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
    if (customerPhone.length < 10) {
      setAuthError('Please enter a valid 10-digit phone number.');
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
    const name = localStorage.getItem(`table_${tableId}_customer_name`) || 'Guest';
    try {
      await api.post('/api/orders', {
        table_id: tableId,
        items: cart.map(i => ({ menu_item_id: i.id, quantity: i.quantity })),
        customer_name: name
      });
      alert('Order placed successfully! The kitchen is preparing your food.');
      setCart([]);
    } catch (err) {
      console.error(err);
      alert('Failed to place order');
    }
  };

  if (loading) return <div className="loading" style={{ color: 'white', textAlign: 'center', marginTop: '100px' }}>Loading...</div>;

  // If not logged in, show login screen
  if (!isLoggedIn) {
    return (
      <div className="app-container" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '90vh' }}>
        <div className="glass-panel animate-slide-up" style={{ width: '100%', maxWidth: '400px', textAlign: 'center', padding: '48px 32px' }}>
          <div style={{ background: 'var(--accent-color)', width: '72px', height: '72px', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 24px auto', boxShadow: '0 8px 24px rgba(16, 185, 129, 0.3)' }}>
            <LogIn color="white" size={32} />
          </div>
          <h2 style={{ marginBottom: '12px', fontSize: '24px', fontWeight: '800' }}>Welcome!</h2>
          <p style={{ color: '#94a3b8', marginBottom: '40px', fontSize: '15px' }}>Please enter your details to view the menu for Table #{tableId}</p>
          
          <form onSubmit={handleLogin} style={{ textAlign: 'left' }}>
            <div style={{ marginBottom: '20px' }}>
              <label style={{ display: 'flex', alignItems: 'center', gap: '8px', color: '#94a3b8', fontSize: '13px', marginBottom: '8px', marginLeft: '4px' }}>
                <User size={14} /> Full Name
              </label>
              <input 
                type="text" 
                placeholder="Enter your name" 
                value={customerName}
                onChange={(e) => setCustomerName(e.target.value)}
                className="modern-input"
                style={{ marginBottom: 0 }}
                required
              />
            </div>
            
            <div style={{ marginBottom: '32px' }}>
              <label style={{ display: 'flex', alignItems: 'center', gap: '8px', color: '#94a3b8', fontSize: '13px', marginBottom: '8px', marginLeft: '4px' }}>
                <Phone size={14} /> Phone Number
              </label>
              <input 
                type="tel" 
                placeholder="Enter your phone number" 
                value={customerPhone}
                onChange={(e) => setCustomerPhone(e.target.value)}
                className="modern-input"
                style={{ marginBottom: 0 }}
                required
              />
            </div>

            {authError && <p style={{ color: 'var(--danger-color)', fontSize: '14px', marginBottom: '20px', textAlign: 'center', fontWeight: '500' }}>{authError}</p>}
            
            <button type="submit" className="modern-button success" style={{ padding: '16px', fontSize: '16px' }}>
              Enter Restaurant
            </button>
          </form>
          <p style={{ marginTop: '32px', fontSize: '12px', color: '#64748b' }}>By entering, you agree to our terms of service.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="app-container">
      <header style={{ marginBottom: '32px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div>
          <h1 style={{ fontSize: '24px', fontWeight: '800', margin: 0 }}>Menu</h1>
          <p style={{ color: '#94a3b8', fontSize: '14px', marginTop: '4px' }}>Table #{tableId} • Hello, {localStorage.getItem(`table_${tableId}_customer_name`)}</p>
        </div>
        <button 
          onClick={() => {
            localStorage.removeItem(`table_${tableId}_logged_in`);
            setIsLoggedIn(false);
          }}
          style={{ background: 'none', border: '1px solid var(--glass-border)', color: '#94a3b8', padding: '8px 16px', borderRadius: '10px', fontSize: '13px', cursor: 'pointer', fontWeight: '600' }}
        >
          Exit
        </button>
      </header>

      <div className="customer-layout">
        <div style={{ minWidth: 0 }}>
          {/* Categories Bar */}
          <div style={{ position: 'sticky', top: '0', zIndex: '100', background: 'var(--bg-color)', paddingBottom: '16px' }}>
            <div style={{ 
              display: 'flex', 
              gap: '12px', 
              overflowX: 'auto', 
              padding: '8px 4px 12px 4px', 
              WebkitOverflowScrolling: 'touch'
            }} className="category-scroll hide-scrollbar">
              {categories.map(cat => (
                <button
                  key={cat}
                  onClick={() => setSelectedCategory(cat)}
                  style={{
                    padding: '10px 20px',
                    borderRadius: '12px',
                    border: '1px solid var(--glass-border)',
                    background: selectedCategory === cat ? 'var(--accent-color)' : 'rgba(255,255,255,0.05)',
                    color: 'white',
                    whiteSpace: 'nowrap',
                    cursor: 'pointer',
                    fontWeight: 'bold',
                    transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
                    fontSize: '14px',
                    boxShadow: selectedCategory === cat ? '0 4px 15px rgba(16, 185, 129, 0.4)' : 'none'
                  }}
                >
                  {cat || 'Other'}
                </button>
              ))}
            </div>
          </div>

          {/* Menu Items */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
            {menu.filter(i => i.category === selectedCategory).map(item => (
              <div key={item.id} className="glass-panel" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '12px 16px', borderRadius: '12px' }}>
                <div style={{ flex: 1 }}>
                  <h4 style={{ margin: 0, fontSize: '16px', fontWeight: '600' }}>{item.name}</h4>
                  <p style={{ margin: '4px 0 0 0', color: 'var(--accent-color)', fontWeight: 'bold', fontSize: '15px' }}>₹{Number(item.price).toFixed(2)}</p>
                </div>
                <button 
                  className="modern-button success" 
                  style={{ width: 'auto', padding: '8px 20px', fontSize: '14px', height: 'fit-content' }}
                  onClick={() => addToCart(item)}
                >
                  Add
                </button>
              </div>
            ))}
          </div>
        </div>

        {/* Cart Panel */}
        <div className="glass-panel" style={{ height: 'fit-content', position: 'sticky', top: '100px', padding: '24px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '20px' }}>
            <div style={{ background: 'var(--accent-color)', padding: '8px', borderRadius: '10px' }}>
              <ShoppingCart size={20} color="white" />
            </div>
            <h3 style={{ margin: 0, fontSize: '18px' }}>Your Selection</h3>
          </div>
          
          {cart.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '20px 0', color: '#64748b' }}>
              <p>Your cart is empty</p>
              <p style={{ fontSize: '12px', marginTop: '4px' }}>Add items to start ordering</p>
            </div>
          ) : (
            <>
              <div style={{ maxHeight: '400px', overflowY: 'auto', marginBottom: '20px' }}>
                {cart.map((item, idx) => (
                  <div key={idx} style={{ marginBottom: '16px', paddingBottom: '16px', borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px' }}>
                      <span style={{ fontWeight: '600', fontSize: '14px' }}>{item.name}</span>
                      <span style={{ fontWeight: 'bold' }}>₹{(item.price * item.quantity).toFixed(2)}</span>
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '10px', background: 'rgba(255,255,255,0.05)', padding: '6px 12px', borderRadius: '10px' }}>
                        <button style={{ background: 'none', border: 'none', color: '#94a3b8', cursor: 'pointer' }} onClick={() => updateQuantity(idx, -1)}>
                          <Minus size={16} />
                        </button>
                        <span style={{ minWidth: '20px', textAlign: 'center', fontWeight: 'bold' }}>{item.quantity}</span>
                        <button style={{ background: 'none', border: 'none', color: '#94a3b8', cursor: 'pointer' }} onClick={() => updateQuantity(idx, 1)}>
                          <Plus size={16} />
                        </button>
                      </div>
                      <button style={{ background: 'none', border: 'none', color: 'var(--danger-color)', cursor: 'pointer', opacity: 0.7 }} onClick={() => removeFromCart(idx)}>
                        <Trash2 size={18} />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '18px', fontWeight: 'bold', marginBottom: '24px', padding: '0 4px' }}>
                <span>Total</span>
                <span style={{ color: 'var(--accent-color)' }}>₹{cart.reduce((acc, i) => acc + (i.price * i.quantity), 0).toFixed(2)}</span>
              </div>
              <button className="modern-button success" onClick={placeOrder} style={{ padding: '16px', fontSize: '16px' }}>
                Place Order
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
};

export default CustomerView;
