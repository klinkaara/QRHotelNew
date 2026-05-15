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
          <div style={{ background: 'var(--accent-color)', width: '72px', height: '72px', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 24px auto' }}>
            <LogIn color="white" size={32} />
          </div>
          <h2 style={{ marginBottom: '12px', fontSize: '24px', fontWeight: '800' }}>Welcome!</h2>
          <p style={{ color: '#94a3b8', marginBottom: '40px', fontSize: '15px' }}>Please enter your details to view the menu for Table #{tableId}</p>
          
          <form onSubmit={handleLogin} style={{ textAlign: 'left' }}>
            <input type="text" placeholder="Full Name" value={customerName} onChange={(e) => setCustomerName(e.target.value)} className="modern-input" required />
            <input type="tel" placeholder="Phone Number" value={customerPhone} onChange={(e) => setCustomerPhone(e.target.value)} className="modern-input" required />
            {authError && <p style={{ color: 'var(--danger-color)', fontSize: '14px', marginBottom: '20px', textAlign: 'center' }}>{authError}</p>}
            <button type="submit" className="modern-button success">Enter Restaurant</button>
          </form>
        </div>
      </div>
    );
  }

  return (
    <div className="app-container">
      <header style={{ marginBottom: '32px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div>
          <h1 style={{ fontSize: '24px', fontWeight: '800', margin: 0 }}>Menu</h1>
          <p style={{ color: '#94a3b8', fontSize: '14px', marginTop: '4px' }}>Table #{tableId}</p>
        </div>
        <button 
          onClick={() => {
            localStorage.removeItem(`table_${tableId}_logged_in`);
            setIsLoggedIn(false);
          }}
          style={{ background: 'none', border: '1px solid var(--glass-border)', color: '#94a3b8', padding: '8px 16px', borderRadius: '10px', fontSize: '13px', cursor: 'pointer' }}
        >
          Exit
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
          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
            {menu.filter(i => i.category === selectedCategory).map(item => (
              <div key={item.id} className="glass-panel" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '12px 16px', borderRadius: '12px' }}>
                <div>
                  <h4 style={{ margin: 0, fontSize: '16px' }}>{item.name}</h4>
                  <p style={{ color: 'var(--accent-color)', fontWeight: 'bold', marginTop: '4px' }}>₹{Number(item.price).toFixed(2)}</p>
                </div>
                <button onClick={() => addToCart(item)} className="modern-button success" style={{ width: 'auto', padding: '8px 20px' }}>Add</button>
              </div>
            ))}
          </div>
        </div>

        {/* Cart Panel */}
        <div className="glass-panel" style={{ height: 'fit-content', position: 'sticky', top: '100px', padding: '24px' }}>
          <h3 style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '20px' }}><ShoppingCart /> Selection</h3>
          {cart.length === 0 ? <p style={{ color: '#94a3b8' }}>Cart is empty</p> : (
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
                    <div style={{ fontWeight: 'bold' }}>₹{(item.price * item.quantity).toFixed(2)}</div>
                    <button onClick={() => removeFromCart(idx)} style={{ background: 'none', border: 'none', color: 'var(--danger-color)', cursor: 'pointer' }}><Trash2 size={16}/></button>
                  </div>
                </div>
              ))}
              <div style={{ display: 'flex', justifyContent: 'space-between', fontWeight: 'bold', fontSize: '18px', margin: '20px 0' }}>
                <span>Total</span>
                <span style={{ color: 'var(--accent-color)' }}>₹{cart.reduce((acc, i) => acc + (i.price * i.quantity), 0).toFixed(2)}</span>
              </div>
              <button className="modern-button success" onClick={placeOrder}>Place Order</button>
            </>
          )}
        </div>
      </div>
    </div>
  );
};

export default CustomerView;
