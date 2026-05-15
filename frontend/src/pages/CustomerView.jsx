import React, { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import api from '../api';
import { ShoppingCart, Plus, Minus, Trash2 } from 'lucide-react';

const CustomerView = () => {
  const { tableId } = useParams();
  const [menu, setMenu] = useState([]);
  const [categories, setCategories] = useState([]);
  const [selectedCategory, setSelectedCategory] = useState('');
  const [cart, setCart] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchMenu();
  }, []);

  const fetchMenu = async () => {
    try {
      const res = await api.get('/api/menu/');
      setMenu(res.data);
      const uniqueCategories = [...new Set(res.data.map(item => item.category))];
      setCategories(uniqueCategories);
      if (uniqueCategories.length > 0) {
        setSelectedCategory(uniqueCategories[0]);
      }
      setLoading(false);
    } catch (err) {
      console.error(err);
      setLoading(false);
    }
  };

  const addToCart = (item) => {
    setCart(prev => {
      const existing = prev.find(i => i.id === item.id);
      if (existing) {
        return prev.map(i => i.id === item.id ? { ...i, quantity: i.quantity + 1 } : i);
      }
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

  const placeOrder = async () => {
    if (cart.length === 0) return;
    try {
      await api.post('/api/orders', {
        table_id: tableId,
        items: cart.map(i => ({ menu_item_id: i.id, quantity: i.quantity })),
        customer_name: 'Guest'
      });
      alert('Order placed successfully!');
      setCart([]);
    } catch (err) {
      console.error(err);
      alert('Failed to place order');
    }
  };

  if (loading) return <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100vh', background: '#f8f9fa' }}>Loading Menu...</div>;

  return (
    <div style={{ background: '#f8f9fa', minHeight: '100vh', padding: '16px', fontFamily: 'sans-serif' }}>
      
      {/* Horizontal Categories */}
      <div style={{ 
        display: 'flex', 
        gap: '12px', 
        overflowX: 'auto', 
        paddingBottom: '16px', 
        whiteSpace: 'nowrap',
        scrollbarWidth: 'none',
        msOverflowStyle: 'none'
      }} className="hide-scrollbar">
        {categories.map(cat => (
          <button
            key={cat}
            onClick={() => setSelectedCategory(cat)}
            style={{
              padding: '10px 20px',
              borderRadius: '8px',
              border: '1px solid #ddd',
              background: selectedCategory === cat ? '#10b981' : '#fff',
              color: selectedCategory === cat ? '#fff' : '#333',
              fontWeight: '500',
              cursor: 'pointer',
              fontSize: '14px',
              transition: 'all 0.2s'
            }}
          >
            {cat}
          </button>
        ))}
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: '20px', maxWidth: '1200px', margin: '0 auto' }}>
        
        {/* Items List */}
        <div style={{ 
          background: '#fff', 
          borderRadius: '12px', 
          border: '1px solid #eee', 
          padding: '20px',
          boxShadow: '0 2px 8px rgba(0,0,0,0.02)'
        }}>
          <h2 style={{ margin: '0 0 20px 0', fontSize: '18px', color: '#333' }}>{selectedCategory}</h2>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
            {menu.filter(item => item.category === selectedCategory && item.is_active).map(item => (
              <div key={item.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', paddingBottom: '16px', borderBottom: '1px solid #f0f0f0' }}>
                <span style={{ fontSize: '15px', color: '#444', fontWeight: '500' }}>{item.name}</span>
                <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
                  <span style={{ color: '#10b981', fontWeight: '600' }}>₹{Number(item.price).toFixed(0)}</span>
                  <button 
                    onClick={() => addToCart(item)}
                    style={{
                      background: '#fff',
                      border: '1px solid #10b981',
                      color: '#10b981',
                      padding: '4px 12px',
                      borderRadius: '6px',
                      cursor: 'pointer',
                      fontSize: '13px',
                      fontWeight: '600'
                    }}
                  >
                    Add
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Cart Summary (Simple) */}
        {cart.length > 0 && (
          <div style={{ 
            background: '#fff', 
            borderRadius: '12px', 
            border: '1px solid #eee', 
            padding: '20px',
            position: 'sticky',
            bottom: '20px',
            boxShadow: '0 -4px 12px rgba(0,0,0,0.05)'
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
              <span style={{ fontWeight: '600' }}>{cart.length} Items in Cart</span>
              <span style={{ fontWeight: 'bold', color: '#10b981', fontSize: '18px' }}>
                ₹{cart.reduce((acc, i) => acc + (i.price * i.quantity), 0).toFixed(0)}
              </span>
            </div>
            <button 
              onClick={placeOrder}
              style={{
                width: '100%',
                padding: '14px',
                background: '#10b981',
                color: '#fff',
                border: 'none',
                borderRadius: '8px',
                fontWeight: 'bold',
                fontSize: '16px',
                cursor: 'pointer'
              }}
            >
              Place Order
            </button>
          </div>
        )}
      </div>

      <style>{`
        .hide-scrollbar::-webkit-scrollbar { display: none; }
        .hide-scrollbar { -ms-overflow-style: none; scrollbar-width: none; }
      `}</style>
    </div>
  );
};

export default CustomerView;
