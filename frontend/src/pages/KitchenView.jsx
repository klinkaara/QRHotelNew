import React, { useState, useEffect } from 'react';
import { useSocket } from '../context/SocketContext';
import { useAuth } from '../context/AuthContext';
import { ChefHat, LogOut } from 'lucide-react';
import api, { API_BASE_URL } from '../api';

const KitchenView = () => {
  const socket = useSocket();
  const { logout } = useAuth();
  const [orders, setOrders] = useState([]);

  useEffect(() => {
    fetchOrders();

    if (socket) {
      socket.on('order_sent_to_kitchen', (data) => {
        setOrders(prev => [...prev, { ...data, status: data.status || 'Sent to Kitchen' }]);
      });
      
      socket.on('order_details_updated', () => fetchOrders());
      socket.on('order_status_update', () => fetchOrders());
    }

    return () => {
      if (socket) {
        socket.off('order_sent_to_kitchen');
        socket.off('order_details_updated');
        socket.off('order_status_update');
      }
    };
  }, [socket]);

  const fetchOrders = async () => {
    try {
      const res = await api.get(`/api/orders/all`);
      // Filter for orders that are Sent to kitchen or Preparing
      const activeOrders = res.data.filter(o => o.status === 'Sent to Kitchen' || o.status === 'Preparing');
      setOrders(activeOrders.map(o => ({
        order_id: o.id,
        table_number: o.table_number,
        items: o.items,
        status: o.status,
        time: o.created_at
      })));
    } catch (err) {
      console.error(err);
    }
  };

  const updateStatus = async (orderId, newStatus) => {
    try {
      await api.post(`/api/orders/${orderId}/status?status=${newStatus}`);
      if (newStatus === 'Ready') {
        setOrders(prev => prev.filter(o => o.order_id !== orderId));
      } else {
        setOrders(prev => prev.map(o => o.order_id === orderId ? { ...o, status: newStatus } : o));
      }
    } catch (err) {
      console.error(err);
    }
  };

  return (
    <div className="app-container animate-slide-up">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '32px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
          <ChefHat size={48} color="var(--primary-color)" />
          <h1 style={{ margin: 0 }}>Kitchen Display</h1>
        </div>
        <button 
          onClick={logout}
          className="modern-button danger" 
          style={{ width: 'auto', display: 'flex', alignItems: 'center', gap: '8px', padding: '10px 20px' }}
        >
          <LogOut size={20} />
          Logout
        </button>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: '24px' }}>
        {orders.length === 0 ? <p style={{ fontSize: '24px', color: '#64748b', textAlign: 'center', gridColumn: '1/-1', marginTop: '48px' }}>No active orders.</p> : null}
        
        {orders.map((order, idx) => (
          <div key={idx} className="glass-panel" style={{ 
            border: `2px solid ${order.status === 'Preparing' ? 'var(--warning-color)' : 'var(--glass-border)'}`,
            padding: '24px' 
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid var(--glass-border)', paddingBottom: '16px', marginBottom: '16px' }}>
              <h2 style={{ fontSize: '32px', margin: 0 }}>Table {order.table_number}</h2>
              <span style={{ fontSize: '18px', color: '#94a3b8' }}>#{order.order_id}</span>
            </div>
            
            {order.remarks && (
              <div style={{ background: 'rgba(245, 158, 11, 0.1)', borderLeft: '4px solid var(--warning-color)', padding: '12px', marginBottom: '16px', borderRadius: '8px', fontStyle: 'italic' }}>
                <strong>Remarks:</strong> {order.remarks}
              </div>
            )}

            <ul style={{ listStyle: 'none', padding: 0, margin: '0 0 24px 0', fontSize: '22px' }}>
              {order.items.map((item, i) => (
                <li key={i} style={{ marginBottom: '12px', borderBottom: '1px solid rgba(255,255,255,0.03)', paddingBottom: '8px' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontWeight: 'bold' }}>
                    <span>{item.quantity}x {item.name || item.menu_item?.name}</span>
                  </div>
                  {item.special_instructions && (
                    <div style={{ fontSize: '16px', color: 'var(--danger-color)', marginTop: '4px' }}>
                      Note: {item.special_instructions}
                    </div>
                  )}
                </li>
              ))}
            </ul>

            <div style={{ display: 'flex', gap: '16px' }}>
              {order.status !== 'Preparing' && (
                <button 
                  className="modern-button"
                  style={{ flex: 1, backgroundColor: 'var(--warning-color)', color: '#000' }}
                  onClick={() => updateStatus(order.order_id, 'Preparing')}
                >
                  Start Preparing
                </button>
              )}
              <button 
                className="modern-button success"
                style={{ flex: 1 }}
                onClick={() => updateStatus(order.order_id, 'Ready')}
              >
                Mark Ready
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

export default KitchenView;
