import React, { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import { useSocket } from '../context/SocketContext';
import { useCart } from '../context/CartContext';
import { ShoppingCart, ChefHat, CheckCircle, Clock, Trash2, Plus, Minus } from 'lucide-react';
import api, { API_BASE_URL } from '../api';

const CustomerView = () => {
  const { id } = useParams();
  const socket = useSocket();
  const { cart, addToCart, getCartTotal, clearCart, updateQuantity, removeFromCart } = useCart();
  
  const [tableStatus, setTableStatus] = useState('Available');
  const [orderState, setOrderState] = useState(() => sessionStorage.getItem('customer_order_state') || 'MENU'); // MENU, OTP, TRACKING, THANKS
  const [currentOrderId, setCurrentOrderId] = useState(null);
  const [activeTab, setActiveTab] = useState('menu');
  const [selectedCategory, setSelectedCategory] = useState('');
  const [otpInput, setOtpInput] = useState('');
  const [sessionOtp, setSessionOtp] = useState(() => sessionStorage.getItem('customer_session_otp') || '');
  const [otpError, setOtpError] = useState('');
  const [liveOrders, setLiveOrders] = useState([]);

  const [session, setSession] = useState(() => {
    const saved = sessionStorage.getItem('customer_session');
    return saved ? JSON.parse(saved) : null;
  });

  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [menu, setMenu] = useState([]);

  useEffect(() => {
    // Join table room
    if (socket) {
      socket.emit('join_table_room', { table_id: id });
      
      socket.on('table_status_changed', (data) => {
        if (data.table_id == id) setTableStatus(data.status);
      });

      socket.on('session_closed', () => {
        setSession(null);
        setTableStatus('Available');
        setOrderState('MENU');
        setLiveOrders([]);
        clearCart();
        setSessionOtp('');
        setName('');
        setPhone('');
        setOtpInput('');
        setOtpError('');
        sessionStorage.clear();
      });

      socket.on('order_status_update', async (data) => {
        if (session && session.id) {
          try {
            const res = await api.get(`/api/sessions/${session.id}/orders`);
            setLiveOrders(res.data);
          } catch(err) { console.error(err); }
        } else {
          // fallback if session is not in closure
          setLiveOrders(prev => {
            const exists = prev.find(o => o.id === data.order_id);
            if (exists) {
              return prev.map(o => o.id === data.order_id ? { ...o, status: data.status } : o);
            }
            return [...prev, { id: data.order_id, status: data.status }];
          });
        }
        if (orderState === 'OTP' && data.status === 'Confirmed') {
            setOrderState('TRACKING');
        }
      });
      
      socket.on('menu_updated', () => {
        api.get(`/api/menu/`)
          .then(res => setMenu(res.data))
          .catch(console.error);
      });
    }
    
    // Fetch initial table status & menu
    api.get(`/api/sessions/table/${id}`)
      .then(res => setTableStatus(res.data.status))
      .catch(console.error);
      
    api.get(`/api/menu/`)
      .then(res => {
        setMenu(res.data);
        if (res.data.length > 0 && !selectedCategory) {
          setSelectedCategory(res.data[0].category);
        }
      })
      .catch(console.error);
    return () => {
      if (socket) {
        socket.off('table_status_changed');
        socket.off('session_closed');
        socket.off('order_status_update');
        socket.off('menu_updated');
      }
    };
  }, [id, socket, session]);

  useEffect(() => {
    if (session) sessionStorage.setItem('customer_session', JSON.stringify(session));
    else sessionStorage.removeItem('customer_session');
  }, [session]);

  useEffect(() => {
    sessionStorage.setItem('customer_order_state', orderState);
  }, [orderState]);

  useEffect(() => {
    sessionStorage.setItem('customer_session_otp', sessionOtp);
  }, [sessionOtp]);

  const startSession = async (e) => {
    e.preventDefault();
    try {
      const res = await api.post(`/api/sessions/start`, {
        table_id: parseInt(id),
        customer_name: name,
        customer_phone: phone
      });
      setSession(res.data);
    } catch (err) {
      const detail = err.response?.data?.detail;
      alert(typeof detail === 'string' ? detail : JSON.stringify(detail) || 'Error starting session');
    }
  };

  const placeOrder = async () => {
    if (cart.length === 0) return;
    try {
      const res = await api.post(`/api/orders/`, {
        session_id: session.id,
        items: cart
      });
      setCurrentOrderId(res.data.id);
      
      if (sessionOtp) {
        // Auto-verify subsequent orders
        try {
          await api.post(`/api/orders/${res.data.id}/verify-otp?otp=${sessionOtp}`);
          setOrderState('TRACKING');
          clearCart();
          const ordersRes = await api.get(`/api/sessions/${session.id}/orders`);
          setLiveOrders(ordersRes.data);
        } catch(err) {
          setOrderState('OTP');
        }
      } else {
        setOrderState('OTP');
      }
    } catch (err) {
      alert('Error placing order');
    }
  };

  const verifyOtp = async () => {
    try {
      await api.post(`/api/orders/${currentOrderId}/verify-otp?otp=${otpInput}`);
      setSessionOtp(otpInput); // Remember OTP for future orders
      setOrderState('TRACKING');
      clearCart();
      setOtpError('');
      // Fetch orders immediately
      const res = await api.get(`/api/sessions/${session.id}/orders`);
      setLiveOrders(res.data);
    } catch (err) {
      setOtpError('Invalid OTP. Please ask your waiter.');
    }
  };

  const requestCheckout = async () => {
    if(window.confirm('Are you sure you want to request the bill?')) {
      try {
        await api.post(`/api/sessions/${session.id}/checkout`);
        setOrderState('THANKS');
      } catch (err) {
        alert('Error requesting checkout');
      }
    }
  };

  if (!session && tableStatus !== 'Available') {
    return (
      <div className="modal-overlay">
        <div className="glass-panel" style={{ textAlign: 'center' }}>
          <h2>Table is Occupied</h2>
          <p>Please wait until the table is cleared.</p>
        </div>
      </div>
    );
  }

  if (!session) {
    return (
      <div className="app-container" style={{ maxWidth: '500px', paddingTop: '10vh' }}>
        <div className="glass-panel animate-slide-up">
          <div style={{ textAlign: 'center', marginBottom: '24px' }}>
            <ChefHat size={48} color="var(--primary-color)" />
            <h1 style={{ marginTop: '16px' }}>Welcome to Table {id}</h1>
          </div>
          <form onSubmit={startSession}>
            <input className="modern-input" placeholder="Your Name" value={name} onChange={e => setName(e.target.value)} required />
            <input className="modern-input" placeholder="Your Phone Number" value={phone} onChange={e => setPhone(e.target.value)} required />
            <button className="modern-button" type="submit">Start Order</button>
          </form>
        </div>
      </div>
    );
  }

  if (orderState === 'THANKS') {
    return (
      <div className="app-container" style={{ maxWidth: '500px', paddingTop: '10vh' }}>
        <div className="glass-panel animate-slide-up" style={{ textAlign: 'center', padding: '48px' }}>
          <CheckCircle size={80} color="var(--accent-color)" style={{ marginBottom: '24px' }} />
          <h1 style={{ marginBottom: '16px' }}>Thank You!</h1>
          <p style={{ fontSize: '18px', color: '#cbd5e1', lineHeight: '1.6' }}>
            Your bill request has been sent to the waiter. 
            Please visit the counter for payment.
          </p>
          <div style={{ marginTop: '32px', padding: '16px', background: 'rgba(255,255,255,0.05)', borderRadius: '12px' }}>
            <p style={{ fontSize: '14px', color: '#94a3b8' }}>Table {id} will be ready for the next guest once payment is confirmed.</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="app-container animate-slide-up">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px', background: 'var(--glass-bg)', padding: '16px', borderRadius: '12px', flexWrap: 'wrap', gap: '12px' }}>
        <h2 style={{ margin: 0 }}>Hi, {session.customer_name}</h2>
        {liveOrders.length > 0 && <button className="modern-button success" style={{ width: 'auto' }} onClick={requestCheckout}>Request Bill</button>}
      </div>

      {orderState === 'OTP' && (
        <div className="modal-overlay">
          <div className="glass-panel" style={{ textAlign: 'center' }}>
            <h2>Confirm Your Order</h2>
            <p style={{ margin: '16px 0', color: 'var(--warning-color)' }}>Please ask your waiter for the OTP to confirm this order.</p>
            {otpError && <p style={{ color: 'var(--danger-color)' }}>{otpError}</p>}
            <input 
              className="modern-input" 
              placeholder="Enter 4-digit OTP" 
              value={otpInput} 
              onChange={e => setOtpInput(e.target.value)} 
              maxLength={4} 
              style={{ textAlign: 'center', fontSize: '24px', letterSpacing: '4px' }}
            />
            <button className="modern-button" onClick={verifyOtp}>Verify</button>
          </div>
        </div>
      )}

      {liveOrders.length > 0 && (
         <div className="glass-panel" style={{ marginBottom: '24px' }}>
           <h3 style={{ borderBottom: '1px solid var(--glass-border)', paddingBottom: '12px', marginBottom: '16px' }}>Your Orders</h3>
           {liveOrders.map(o => (
             <div key={o.id} style={{ marginBottom: '16px', paddingBottom: '16px', borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
               <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
                 <span style={{ fontWeight: 'bold', fontSize: '18px' }}>Order #{o.id}</span>
                 <span className={`status-badge status-${o.status.replace(' ', '')}`}>{o.status}</span>
               </div>
               
               {o.items && o.items.length > 0 && (
                 <ul style={{ listStyle: 'none', padding: 0, margin: '0 0 12px 0', fontSize: '14px', color: '#cbd5e1' }}>
                   {o.items.map((item, idx) => (
                     <li key={idx} style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '4px' }}>
                       <span>{item.quantity}x {item.name}</span>
                       <span>₹{(item.price * item.quantity).toFixed(2)}</span>
                     </li>
                   ))}
                 </ul>
               )}
               <div style={{ textAlign: 'right', fontWeight: 'bold', color: 'var(--accent-color)' }}>
                 Total: ₹{(o.total_amount || 0).toFixed(2)}
               </div>
             </div>
           ))}
           <div style={{ marginTop: '16px', paddingTop: '16px', borderTop: '1px dashed rgba(255,255,255,0.2)', textAlign: 'right', fontSize: '24px', fontWeight: 'bold', color: 'white' }}>
             Grand Total: ₹{liveOrders.reduce((sum, o) => sum + (o.total_amount || 0), 0).toFixed(2)}
           </div>
         </div>
      )}

      <div className="customer-layout">
        <div>
          <div style={{ 
            display: 'flex', 
            gap: '12px', 
            overflowX: 'auto', 
            padding: '12px 4px', 
            marginBottom: '16px',
            position: 'sticky',
            top: '0',
            zIndex: '100',
            background: 'var(--bg-color)',
            scrollbarWidth: 'none',
            msOverflowStyle: 'none',
            WebkitOverflowScrolling: 'touch',
            width: '100%',
            maxWidth: '100%'
          }} className="hide-scrollbar">
            {[...new Set(menu.map(i => i.category))].map(cat => (
              <button
                key={cat}
                onClick={() => setSelectedCategory(cat)}
                style={{
                  padding: '8px 18px',
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

          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
            {[...new Set(menu.map(i => i.category))].filter(cat => selectedCategory === cat).map(cat => {
              const items = menu.filter(i => i.category === cat && i.is_active);
              if (items.length === 0) return null;
              return (
                <div key={cat}>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                    {items.map(item => (
                      <div key={item.id} className="glass-panel" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '14px', borderRadius: '12px' }}>
                        <div style={{ flex: 1 }}>
                          <h4 style={{ fontSize: '16px', marginBottom: '4px' }}>{item.name}</h4>
                          <p style={{ color: '#94a3b8', fontSize: '13px', margin: '2px 0' }}>{item.description}</p>
                          <p style={{ fontWeight: 'bold', color: 'var(--accent-color)', fontSize: '15px', marginTop: '6px' }}>₹{item.price.toFixed(2)}</p>
                        </div>
                        <button 
                          className="modern-button" 
                          style={{ width: 'auto', padding: '6px 16px', fontSize: '13px', marginLeft: '12px' }} 
                          onClick={() => addToCart(item)}
                        >
                          Add
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
        </div>

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
                      <button style={{ background: 'none', border: 'none', color: '#cbd5e1', cursor: 'pointer', display: 'flex', alignItems: 'center' }} onClick={() => updateQuantity(idx, -1)}>
                        <Minus size={14} />
                      </button>
                      <span style={{ fontSize: '14px', width: '20px', textAlign: 'center' }}>{item.quantity}</span>
                      <button style={{ background: 'none', border: 'none', color: '#cbd5e1', cursor: 'pointer', display: 'flex', alignItems: 'center' }} onClick={() => updateQuantity(idx, 1)}>
                        <Plus size={14} />
                      </button>
                    </div>
                    <button style={{ background: 'none', border: 'none', color: 'var(--danger-color)', cursor: 'pointer', display: 'flex', alignItems: 'center' }} onClick={() => removeFromCart(idx)}>
                      <Trash2 size={16} />
                    </button>
                  </div>
                </div>
              ))}
              <hr style={{ border: 'none', borderTop: '1px solid var(--glass-border)', margin: '16px 0' }} />
              <div style={{ display: 'flex', justifyContent: 'space-between', fontWeight: 'bold', marginBottom: '16px' }}>
                <span>Total:</span>
                <span>₹{getCartTotal().toFixed(2)}</span>
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
