import React, { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import api from '../api';
import { ShoppingCart, Plus, Minus, Trash2, ShieldCheck, X } from 'lucide-react';

const CustomerView = () => {
  const { tableId } = useParams();
  const [menu, setMenu] = useState([]);
  const [categories, setCategories] = useState([]);
  const [selectedCategory, setSelectedCategory] = useState('');
  const [cart, setCart] = useState([]);
  const [loading, setLoading] = useState(true);
  
  // Order Verification State
  const [showOtpModal, setShowOtpModal] = useState(false);
  const [otpInput, setOtpInput] = useState('');
  const [authError, setAuthError] = useState('');

  useEffect(() => {
    fetchMenu();
  }, []);

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

  const handlePlaceOrderClick = () => {
    if (cart.length === 0) return;
    setShowOtpModal(true);
  };

  const confirmAndPlaceOrder = async (e) => {
    e.preventDefault();
    if (otpInput === '1234') {
      try {
        await api.post('/api/orders', {
          table_id: tableId,
          items: cart.map(i => ({ menu_item_id: i.id, quantity: i.quantity })),
          customer_name: 'Guest'
        });
        alert('Order placed successfully! The kitchen is preparing your food.');
        setCart([]);
        setShowOtpModal(false);
        setOtpInput('');
        setAuthError('');
      } catch (err) {
        console.error(err);
        alert('Failed to place order');
      }
    } else {
      setAuthError('Invalid code. Please ask your waiter for the correct code.');
    }
  };

  if (loading) return <div className="loading">Loading...</div>;

  return (
    <div className="app-container">
      <header style={{ marginBottom: '24px' }}>
        <h1 style={{ fontSize: '24px', margin: 0 }}>Restaurant Menu</h1>
        <p style={{ color: '#94a3b8', margin: '4px 0' }}>Table #{tableId}</p>
      </header>

      <div className="customer-layout">
        <div>
          {/* Categories Bar */}
          <div style={{ position: 'relative', width: '100%', marginBottom: '16px' }}>
            <div style={{ 
              display: 'flex', 
              gap: '12px', 
              overflowX: 'auto', 
              padding: '12px 4px 16px 4px', 
              position: 'sticky',
              top: '0',
              zIndex: '100',
              background: 'var(--bg-color)',
              WebkitOverflowScrolling: 'touch',
              width: '100%',
              maxWidth: '100%'
            }} className="category-scroll">
              {categories.map(cat => (
                <button
                  key={cat}
                  onClick={() => setSelectedCategory(cat)}
                  style={{
                    padding: '8px 16px',
                    borderRadius: '20px',
                    border: '1px solid var(--glass-border)',
                    background: selectedCategory === cat ? 'var(--primary-color)' : 'rgba(255,255,255,0.05)',
                    color: 'white',
                    whiteSpace: 'nowrap',
                    cursor: 'pointer',
                    fontWeight: selectedCategory === cat ? 'bold' : 'normal',
                    transition: 'all 0.3s ease',
                    fontSize: '13px',
                    boxShadow: selectedCategory === cat ? '0 4px 12px rgba(59, 130, 246, 0.3)' : 'none'
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
              <div key={item.id} className="glass-panel" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '10px 14px', borderRadius: '10px' }}>
                <div style={{ flex: 1 }}>
                  <h4 style={{ margin: 0, fontSize: '15px' }}>{item.name}</h4>
                  <p style={{ margin: '2px 0 0 0', color: 'var(--success-color)', fontWeight: 'bold', fontSize: '14px' }}>₹{Number(item.price).toFixed(2)}</p>
                </div>
                <button 
                  className="modern-button primary" 
                  style={{ padding: '6px 16px', fontSize: '13px', height: 'fit-content' }}
                  onClick={() => addToCart(item)}
                >
                  Add
                </button>
              </div>
            ))}
          </div>
        </div>

        {/* Cart */}
        <div className="glass-panel" style={{ height: 'fit-content', position: 'sticky', top: '100px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '16px' }}>
            <ShoppingCart />
            <h3>Your Cart</h3>
          </div>
          {cart.length === 0 ? <p style={{ color: '#94a3b8' }}>Cart is empty</p> : (
            <>
              {cart.map((item, idx) => (
                <div key={idx} style={{ display: 'flex', flexDirection: 'column', marginBottom: '12px', paddingBottom: '12px', borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '14px', marginBottom: '8px' }}>
                    <span style={{ fontWeight: 'bold' }}>{item.name}</span>
                    <span>₹{(item.price * item.quantity).toFixed(2)}</span>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', background: 'rgba(255,255,255,0.05)', padding: '4px 8px', borderRadius: '8px' }}>
                      <button style={{ background: 'none', border: 'none', color: '#cbd5e1', cursor: 'pointer' }} onClick={() => updateQuantity(idx, -1)}>
                        <Minus size={14} />
                      </button>
                      <span style={{ fontSize: '14px' }}>{item.quantity}</span>
                      <button style={{ background: 'none', border: 'none', color: '#cbd5e1', cursor: 'pointer' }} onClick={() => updateQuantity(idx, 1)}>
                        <Plus size={14} />
                      </button>
                    </div>
                    <button style={{ background: 'none', border: 'none', color: 'var(--danger-color)', cursor: 'pointer' }} onClick={() => removeFromCart(idx)}>
                      <Trash2 size={16} />
                    </button>
                  </div>
                </div>
              ))}
              <div style={{ display: 'flex', justifyContent: 'space-between', fontWeight: 'bold', margin: '16px 0' }}>
                <span>Total:</span>
                <span>₹{cart.reduce((acc, i) => acc + (i.price * i.quantity), 0).toFixed(2)}</span>
              </div>
              <button className="modern-button success" onClick={handlePlaceOrderClick}>Place Order</button>
            </>
          )}
        </div>
      </div>

      {/* Verification Modal */}
      {showOtpModal && (
        <div style={{
          position: 'fixed',
          top: 0, left: 0, right: 0, bottom: 0,
          background: 'rgba(0,0,0,0.85)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 1000,
          padding: '20px'
        }}>
          <div className="glass-panel" style={{ width: '100%', maxWidth: '400px', position: 'relative', padding: '32px' }}>
            <button 
              onClick={() => setShowOtpModal(false)}
              style={{ position: 'absolute', top: '16px', right: '16px', background: 'none', border: 'none', color: '#94a3b8', cursor: 'pointer' }}
            >
              <X size={20} />
            </button>
            
            <div style={{ textAlign: 'center' }}>
              <div style={{ background: 'var(--success-color)', width: '56px', height: '56px', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 20px auto' }}>
                <ShieldCheck color="white" size={28} />
              </div>
              <h3 style={{ marginBottom: '8px' }}>Finalize Your Order</h3>
              <p style={{ color: '#94a3b8', fontSize: '14px', marginBottom: '24px' }}>Please ask your waiter for the table code to confirm your order.</p>
              
              <form onSubmit={confirmAndPlaceOrder}>
                <input 
                  type="text" 
                  placeholder="Enter Code" 
                  autoFocus
                  value={otpInput}
                  onChange={(e) => setOtpInput(e.target.value)}
                  className="modern-input"
                  style={{ textAlign: 'center', fontSize: '20px', letterSpacing: '4px', marginBottom: '16px' }}
                />
                {authError && <p style={{ color: 'var(--danger-color)', fontSize: '13px', marginBottom: '16px' }}>{authError}</p>}
                <button type="submit" className="modern-button success" style={{ width: '100%' }}>
                  Confirm Order
                </button>
              </form>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default CustomerView;
