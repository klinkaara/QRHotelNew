import React, { useState, useEffect } from 'react';
import { useSocket } from '../context/SocketContext';
import { useAuth } from '../context/AuthContext';
import { Edit2, Plus, Trash2, Bell, Check, Receipt, ArrowLeft, Minus, LogOut } from 'lucide-react';
import api, { API_BASE_URL } from '../api';

const OwnerView = () => {
  const socket = useSocket();
  const { logout } = useAuth();
  const [tables, setTables] = useState([]);
  const [menu, setMenu] = useState([]);
  const [activeTab, setActiveTab] = useState(() => {
    const saved = localStorage.getItem('owner_active_tab');
    const validTabs = ['dashboard', 'menu', 'daily-orders', 'analytics', 'notes'];
    return (saved && validTabs.includes(saved)) ? saved : 'dashboard';
  }); // dashboard, menu, daily-orders, analytics, notes
  
  // Waiter-like State
  const [groupedAlerts, setGroupedAlerts] = useState({}); 
  const [selectedTable, setSelectedTable] = useState(() => {
    try {
      const saved = localStorage.getItem('owner_selected_table');
      return saved ? JSON.parse(saved) : null;
    } catch (e) {
      console.error("Error parsing selected table from localStorage", e);
      return null;
    }
  });
  const [tableOrders, setTableOrders] = useState([]);
  const [processingOrders, setProcessingOrders] = useState(new Set());

  const selectedTableRef = React.useRef(selectedTable);
  useEffect(() => {
    selectedTableRef.current = selectedTable;
  }, [selectedTable]);

  // Menu form state
  const [editingItem, setEditingItem] = useState(null);
  const [formData, setFormData] = useState({ name: '', description: '', price: '', category: '', is_active: true });

  // Analytics State
  const [dashboardSummary, setDashboardSummary] = useState(null);
  const [historicalData, setHistoricalData] = useState([]);
  const [dailyOrders, setDailyOrders] = useState([]);
  const [selectedDate, setSelectedDate] = useState(new Date().toISOString().split('T')[0]);

  // Notes State
  const [notes, setNotes] = useState([]);
  const [newNote, setNewNote] = useState('');

  useEffect(() => {
    fetchTables();
    fetchMenu();

    if (socket) {
      socket.on('table_status_changed', () => fetchTables());
      
      socket.on('new_otp', (data) => {
        addGroupedAlert(data.table_number, data.session_id, {
          id: Date.now(), type: 'OTP', text: `Customer placed an order. OTP: ${data.otp}`
        });
        fetchTables();
      });
      
      socket.on('checkout_requested', (data) => {
        addGroupedAlert(data.table_number, data.session_id, {
          id: Date.now(), type: 'CHECKOUT', text: `Checkout requested. Total: $${(data.total || 0).toFixed(2)}`
        }, { total: data.total, session_id: data.session_id });
        fetchTables();
      });
      
      socket.on('order_status_update', (data) => {
         const currentSelected = selectedTableRef.current;
         if (currentSelected && (data.table_number === currentSelected.table_number || data.session_id === currentSelected.current_session_id)) {
            fetchTableOrders(currentSelected.current_session_id);
         }
         fetchTables();
         
         if (data.status === 'Preparing' || data.status === 'Ready') {
            addGroupedAlert(data.table_number, null, {
               id: Date.now(), type: 'INFO', text: `Order #${data.order_id} is ${data.status}!`
            });
         }
      });

      socket.on('order_details_updated', (data) => {
        const currentSelected = selectedTableRef.current;
        if (currentSelected && (data.session_id === currentSelected.current_session_id)) {
           fetchTableOrders(currentSelected.current_session_id);
        }
      });

      socket.on('menu_updated', () => fetchMenu());
      socket.on('notes_updated', () => fetchNotes());
    }

    return () => {
      if (socket) {
        socket.off('table_status_changed');
        socket.off('new_otp');
        socket.off('checkout_requested');
        socket.off('order_status_update');
        socket.off('order_details_updated');
        socket.off('menu_updated');
        socket.off('notes_updated');
      }
    };
  }, [socket]);

  useEffect(() => {
    localStorage.setItem('owner_active_tab', activeTab);
    if (activeTab === 'analytics') {
      fetchAnalytics();
    } else if (activeTab === 'daily-orders') {
      fetchDailyOrders();
    } else if (activeTab === 'notes') {
      fetchNotes();
    }
  }, [activeTab, selectedDate]);

  const fetchAnalytics = async () => {
    try {
      const summaryRes = await api.get('/api/analytics/dashboard');
      setDashboardSummary(summaryRes.data);
      const historicalRes = await api.get('/api/analytics/historical');
      setHistoricalData(historicalRes.data);
    } catch (err) {
      console.error(err);
    }
  };

  const fetchDailyOrders = async () => {
    try {
      const res = await api.get(`/api/analytics/daily-orders?date_str=${selectedDate}`);
      setDailyOrders(res.data);
    } catch (err) {
      console.error(err);
    }
  };

  const fetchNotes = async () => {
    try {
      const res = await api.get('/api/notes');
      setNotes(res.data);
    } catch (err) {
      console.error(err);
    }
  };

  const handleAddNote = async (e) => {
    e.preventDefault();
    if (!newNote.trim()) return;
    try {
      await api.post('/api/notes', { content: newNote });
      setNewNote('');
      fetchNotes();
    } catch (err) {
      console.error(err);
    }
  };

  const handleDeleteNote = async (id) => {
    if(window.confirm('Delete this note?')) {
      try {
        await api.delete(`/api/notes/${id}`);
        fetchNotes();
      } catch (err) {
        console.error(err);
      }
    }
  };

  // Dedicated effect for selectedTable updates via socket
  useEffect(() => {
     if (!socket || !selectedTable) return;
     const handleOrderStatusUpdate = (data) => {
        if (selectedTable.table_number === data.table_number && selectedTable.current_session_id) {
           fetchTableOrders(selectedTable.current_session_id);
        }
     };
     const handleOrderDetailsUpdate = (data) => {
        if (selectedTable.id === data.table_id && selectedTable.current_session_id === data.session_id) {
           fetchTableOrders(data.session_id);
        }
     };
     const handleNewOtpUpdate = (data) => {
        if (selectedTable.table_number === data.table_number) {
           fetchTableOrders(selectedTable.current_session_id);
        }
     };
     socket.on('order_status_update', handleOrderStatusUpdate);
     socket.on('order_details_updated', handleOrderDetailsUpdate);
     socket.on('new_otp', handleNewOtpUpdate);
     return () => {
        socket.off('order_status_update', handleOrderStatusUpdate);
        socket.off('order_details_updated', handleOrderDetailsUpdate);
        socket.off('new_otp', handleNewOtpUpdate);
     }
  }, [socket, selectedTable]);

  const addGroupedAlert = (tableNum, sessionId, messageObj, checkoutData = null) => {
    setGroupedAlerts(prev => {
      const existing = prev[tableNum] || { session_id: sessionId, messages: [], needsCheckout: false, checkoutData: null };
      const currentSessionId = sessionId || existing.session_id;
      const isCheckout = checkoutData !== null;
      
      return {
        ...prev,
        [tableNum]: {
          ...existing,
          session_id: currentSessionId,
          blinkKey: Date.now(),
          messages: [...existing.messages, messageObj],
          needsCheckout: existing.needsCheckout || isCheckout,
          checkoutData: checkoutData || existing.checkoutData
        }
      };
    });
  };

  const dismissTableAlerts = (tableNum) => {
    setGroupedAlerts(prev => {
      const copy = { ...prev };
      delete copy[tableNum];
      return copy;
    });
  };

  const fetchTables = async () => {
    try {
      const res = await api.get(`/api/sessions/tables`);
      setTables(res.data);
      
      let savedTableId = null;
      try {
        const saved = localStorage.getItem('owner_selected_table');
        savedTableId = saved ? JSON.parse(saved)?.id : null;
      } catch (e) {
        console.error("Error parsing saved table ID", e);
      }
      
      if (savedTableId) {
        const updatedSelected = res.data.find(t => t.id === savedTableId);
        if (updatedSelected) {
           if (updatedSelected.status === 'Available') {
              setSelectedTable(null);
              localStorage.removeItem('owner_selected_table');
              setTableOrders([]);
           } else {
              setSelectedTable(updatedSelected);
              if (updatedSelected.current_session_id) {
                fetchTableOrders(updatedSelected.current_session_id);
              }
           }
        }
      }
    } catch (err) {
      console.error(err);
    }
  };

  const fetchMenu = async () => {
    try {
      const res = await api.get('/api/menu/all');
      setMenu(res.data);
    } catch (err) {
      console.error(err);
    }
  };

  const fetchTableOrders = async (sessionId) => {
    try {
      const res = await api.get(`/api/sessions/${sessionId}/orders`);
      setTableOrders(res.data);
    } catch (err) {
      console.error(err);
    }
  };

  const handleTableClick = (table) => {
    setSelectedTable(table);
    localStorage.setItem('owner_selected_table', JSON.stringify(table));
    if (table.current_session_id) {
      fetchTableOrders(table.current_session_id);
    } else {
      setTableOrders([]);
    }
  };

  const handleCheckout = async (tableNum) => {
    const alertData = groupedAlerts[tableNum];
    if(!alertData || !alertData.checkoutData) return;
    
    if(window.confirm(`Mark Table ${tableNum} as closed and paid?`)) {
      try {
        await api.post(`/api/sessions/${alertData.checkoutData.session_id}/close`);
        dismissTableAlerts(tableNum);
        setSelectedTable(null);
        localStorage.removeItem('owner_selected_table');
        fetchTables();
      } catch (err) {
        console.error(err);
      }
    }
  };

  const handleForceCloseTable = async (tableNum, sessionId) => {
    if(window.confirm(`Customer paid, close the table ${tableNum}?`)) {
      try {
        await api.post(`/api/sessions/${sessionId}/close`);
        dismissTableAlerts(tableNum);
        setSelectedTable(null);
        localStorage.removeItem('owner_selected_table');
        fetchTables();
      } catch (err) {
        console.error(err);
      }
    }
  };

  const handleSendToKitchen = async (orderId) => {
    if (processingOrders.has(orderId)) return;
    setProcessingOrders(prev => new Set(prev).add(orderId));
    try {
      await api.post(`/api/orders/${orderId}/send-to-kitchen`);
      if (selectedTable && selectedTable.current_session_id) {
        fetchTableOrders(selectedTable.current_session_id);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setProcessingOrders(prev => {
        const next = new Set(prev);
        next.delete(orderId);
        return next;
      });
    }
  };

  const updateOrderItem = async (itemId, newQuantity) => {
    try {
      await api.put(`/api/orders/items/${itemId}?quantity=${newQuantity}`);
      if (selectedTable && selectedTable.current_session_id) {
        fetchTableOrders(selectedTable.current_session_id);
      }
    } catch (err) {
      console.error(err);
    }
  };

  const updateOrderRemarks = async (orderId, newRemarks) => {
    try {
      await api.put(`/api/orders/${orderId}/remarks?remarks=${encodeURIComponent(newRemarks)}`);
      if (selectedTable && selectedTable.current_session_id) {
        fetchTableOrders(selectedTable.current_session_id);
      }
    } catch (err) {
      console.error(err);
    }
  };

  const getSessionOtp = () => {
     if (tableOrders.length > 0 && tableOrders[0].otp) return tableOrders[0].otp;
     return 'N/A';
  };

  const getOrderStyle = (status) => {
    if (status === 'Ready') {
      return { background: 'rgba(16, 185, 129, 0.15)', border: '1px solid var(--accent-color)' };
    }
    if (status === 'Preparing') {
      return { background: 'rgba(245, 158, 11, 0.15)', border: '1px solid var(--warning-color)' };
    }
    return { background: 'rgba(0,0,0,0.2)', border: '1px solid rgba(255,255,255,0.05)' };
  };

  const handleMenuSubmit = async (e) => {
    e.preventDefault();
    try {
      if (editingItem) {
        await api.put(`/api/menu/${editingItem.id}`, formData);
      } else {
        await api.post(`/api/menu/`, formData);
      }
      fetchMenu();
      setEditingItem(null);
      setFormData({ name: '', description: '', price: '', category: '', is_active: true });
    } catch (err) {
      alert('Error saving menu item');
    }
  };

  const editItem = (item) => {
    setEditingItem(item);
    setFormData({
      name: item.name,
      description: item.description || '',
      price: item.price,
      category: item.category,
      is_active: item.is_active
    });
  };

  const handleDeleteMenu = async (id) => {
    if(window.confirm('Are you sure you want to delete this menu item?')) {
      try {
        await api.delete(`/api/menu/${id}`);
        fetchMenu();
      } catch (err) {
        alert('Error deleting menu item');
      }
    }
  };

  return (
    <div className="app-container animate-slide-up">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px', flexWrap: 'wrap', gap: '12px' }}>
        <h1 style={{ margin: 0 }}>Owner Dashboard</h1>
        <div style={{ display: 'flex', gap: '12px', alignItems: 'center', flexWrap: 'wrap' }}>
          <button className={`modern-button ${activeTab === 'dashboard' ? 'success' : ''}`} style={{ width: 'auto' }} onClick={() => setActiveTab('dashboard')}>Overview</button>
          <button className={`modern-button ${activeTab === 'menu' ? 'success' : ''}`} style={{ width: 'auto' }} onClick={() => setActiveTab('menu')}>Menu</button>
          <button className={`modern-button ${activeTab === 'daily-orders' ? 'success' : ''}`} style={{ width: 'auto' }} onClick={() => setActiveTab('daily-orders')}>Daily Orders</button>
          <button className={`modern-button ${activeTab === 'analytics' ? 'success' : ''}`} style={{ width: 'auto' }} onClick={() => setActiveTab('analytics')}>Analytics</button>
          <button className={`modern-button ${activeTab === 'notes' ? 'success' : ''}`} style={{ width: 'auto' }} onClick={() => setActiveTab('notes')}>Notes</button>
          <button onClick={logout} className="modern-button danger" style={{ width: 'auto', display: 'flex', alignItems: 'center', gap: '8px' }}>
            <LogOut size={18} />
            Logout
          </button>
        </div>
      </div>

      {activeTab === 'dashboard' && (
        <div style={{ marginTop: '24px' }}>
            {!selectedTable ? (
              <>
                <div style={{ display: 'flex', gap: '24px', marginBottom: '24px' }}>
                  <div className="glass-panel" style={{ flex: 1, textAlign: 'center' }}>
                    <h3 style={{ color: '#94a3b8' }}>Total Tables</h3>
                    <p style={{ fontSize: '32px', fontWeight: 'bold' }}>20</p>
                  </div>
                  <div className="glass-panel" style={{ flex: 1, textAlign: 'center' }}>
                    <h3 style={{ color: '#94a3b8' }}>Active Tables</h3>
                    <p style={{ fontSize: '32px', fontWeight: 'bold', color: 'var(--primary-color)' }}>
                      {tables.filter(t => t.status !== 'Available').length}
                    </p>
                  </div>
                </div>

                <h3>Live Table Status</h3>
                <div className="grid-cards" style={{ marginTop: '16px' }}>
                  {tables.map(table => (
                    <div key={table.id} style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                      <div 
                        className={`glass-panel table-card ${groupedAlerts[table.table_number] ? 'table-blink' : ''}`} 
                        onClick={() => handleTableClick(table)}
                        style={{ 
                          border: table.status === 'Occupied' ? '4px solid var(--accent-color)' : '2px solid transparent',
                          transition: 'all 0.3s ease',
                          marginBottom: 0,
                          flex: 1
                        }}
                        onMouseEnter={(e) => e.currentTarget.style.borderColor = 'var(--primary-color)'}
                        onMouseLeave={(e) => e.currentTarget.style.borderColor = table.status === 'Occupied' ? 'var(--accent-color)' : 'transparent'}
                      >
                        <h2 style={{ marginBottom: '4px' }}>{table.table_number}</h2>
                        <span className={`status-badge status-${table.status.replace(' ', '')}`} style={{ marginBottom: '4px' }}>{table.status}</span>
                      </div>

                      {/* Integrated Alerts & OTP Below Card */}
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                        {table.current_otp && (
                          <div style={{ fontSize: '14px', fontWeight: 'bold', color: 'var(--warning-color)', background: 'rgba(245, 158, 11, 0.1)', padding: '4px 8px', borderRadius: '4px', textAlign: 'center', border: '1px solid rgba(245, 158, 11, 0.2)' }}>
                            OTP: {table.current_otp}
                          </div>
                        )}
                        
                        {groupedAlerts[table.table_number] && (
                          <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                            {groupedAlerts[table.table_number].messages.map((msg, idx) => (
                              <div key={idx} style={{ 
                                fontSize: '11px', 
                                padding: '6px 8px', 
                                borderRadius: '4px', 
                                background: msg.type === 'CHECKOUT' ? 'rgba(239, 68, 68, 0.15)' : 'rgba(245, 158, 11, 0.15)',
                                color: msg.type === 'CHECKOUT' ? 'var(--danger-color)' : 'var(--warning-color)',
                                borderLeft: `3px solid ${msg.type === 'CHECKOUT' ? 'var(--danger-color)' : 'var(--warning-color)'}`,
                                display: 'flex',
                                alignItems: 'center',
                                gap: '6px'
                              }}>
                                <Bell size={10} />
                                <span>{msg.text}</span>
                              </div>
                            ))}
                            <div style={{ display: 'flex', gap: '4px' }}>
                              {groupedAlerts[table.table_number].needsCheckout && (
                                <button 
                                  className="modern-button danger" 
                                  style={{ padding: '6px', fontSize: '10px', flex: 1 }}
                                  onClick={(e) => { e.stopPropagation(); handleCheckout(table.table_number); }}
                                >
                                  Close & Paid
                                </button>
                              )}
                              <button 
                                className="modern-button" 
                                style={{ padding: '6px', fontSize: '10px', background: 'rgba(255,255,255,0.05)', border: '1px solid var(--glass-border)', flex: 1 }}
                                onClick={(e) => { e.stopPropagation(); dismissTableAlerts(table.table_number); }}
                              >
                                Clear
                              </button>
                            </div>
                          </div>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </>
            ) : (
              <div className="glass-panel animate-slide-up" style={{ minHeight: '600px' }}>
                 <div style={{ display: 'flex', alignItems: 'center', gap: '16px', marginBottom: '24px', borderBottom: '1px solid var(--glass-border)', paddingBottom: '16px' }}>
                   <button className="modern-button" style={{ width: 'auto', padding: '8px' }} onClick={() => {
                     setSelectedTable(null);
                     localStorage.removeItem('owner_selected_table');
                   }}>
                     <ArrowLeft size={20} />
                   </button>
                   <h2 style={{ margin: 0 }}>Table {selectedTable.table_number} Details</h2>
                   <span className={`status-badge status-${selectedTable.status.replace(' ', '')}`} style={{ marginLeft: 'auto' }}>
                      {selectedTable.status}
                   </span>
                 </div>

                 {!selectedTable.current_session_id ? (
                   <p style={{ textAlign: 'center', color: '#94a3b8', marginTop: '48px' }}>This table is currently available. No active session.</p>
                 ) : (
                   <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
                     
                     <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: 'rgba(255,255,255,0.05)', padding: '16px', borderRadius: '12px' }}>
                        <div>
                           <strong style={{ fontSize: '18px' }}>Session OTP: </strong>
                           <span style={{ fontSize: '24px', letterSpacing: '2px', color: 'var(--warning-color)', fontWeight: 'bold', marginLeft: '12px' }}>{getSessionOtp()}</span>
                        </div>
                     </div>
                     
                     <h3 style={{ borderBottom: '1px solid var(--glass-border)', paddingBottom: '12px' }}>Customer Orders</h3>
                     {tableOrders.length === 0 ? <p style={{ color: '#94a3b8' }}>No orders yet.</p> : null}
                     
                     {tableOrders.map(order => (
                       <div key={order.id} style={{ marginBottom: '24px', padding: '20px', borderRadius: '12px', ...getOrderStyle(order.status), transition: 'all 0.3s ease' }}>
                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
                             <span style={{ fontWeight: 'bold', fontSize: '20px' }}>Order #{order.id}</span>
                             <span className={`status-badge status-${order.status.replace(' ', '')}`}>{order.status}</span>
                          </div>
                          
                          <ul style={{ listStyle: 'none', padding: 0, margin: 0 }}>
                            {order.items.map(item => (
                              <li key={item.id} style={{ display: 'flex', flexDirection: 'column', padding: '16px 0', borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
                                 <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                                    <span style={{ fontSize: '16px', fontWeight: 'bold' }}>{item.name}</span>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
                                      <span style={{ color: 'var(--accent-color)', fontWeight: 'bold' }}>${((item.price || 0) * (item.quantity || 0)).toFixed(2)}</span>
                                      
                                      {(order.status === 'Confirmed' || order.status === 'Pending') && (
                                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', background: 'rgba(255,255,255,0.05)', padding: '6px 8px', borderRadius: '8px' }}>
                                          <button style={{ background: 'none', border: 'none', color: '#cbd5e1', cursor: 'pointer' }} onClick={() => updateOrderItem(item.id, item.quantity - 1)}>
                                            <Minus size={16} />
                                          </button>
                                          <span style={{ fontSize: '16px', width: '24px', textAlign: 'center', fontWeight: 'bold' }}>{item.quantity}</span>
                                          <button style={{ background: 'none', border: 'none', color: '#cbd5e1', cursor: 'pointer' }} onClick={() => updateOrderItem(item.id, item.quantity + 1)}>
                                            <Plus size={16} />
                                          </button>
                                          <button style={{ background: 'none', border: 'none', color: 'var(--danger-color)', cursor: 'pointer', marginLeft: '12px' }} onClick={() => updateOrderItem(item.id, 0)}>
                                            <Trash2 size={18} />
                                          </button>
                                        </div>
                                      )}
                                    </div>
                                 </div>
                              </li>
                            ))}
                          </ul>

                          <div style={{ marginTop: '16px', paddingTop: '16px', borderTop: '1px dashed rgba(255,255,255,0.1)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                            <div style={{ flexGrow: 1, marginRight: '24px' }}>
                              {order.status === 'Confirmed' || order.status === 'Pending' ? (
                                <input 
                                  type="text" 
                                  className="modern-input"
                                  placeholder="Order remarks (e.g. Table 5 needs extra napkins)"
                                  defaultValue={order.remarks || ''}
                                  onBlur={(e) => updateOrderRemarks(order.id, e.target.value)}
                                  style={{ width: '100%', padding: '12px', margin: 0, fontSize: '14px' }}
                                />
                              ) : order.remarks ? (
                                <div style={{ fontSize: '14px', color: '#94a3b8', fontStyle: 'italic', padding: '12px', background: 'rgba(255,255,255,0.05)', borderRadius: '8px' }}>
                                   <strong>Remarks:</strong> {order.remarks}
                                </div>
                              ) : (
                                <div style={{ fontSize: '14px', color: '#94a3b8' }}>No remarks</div>
                              )}
                            </div>

                            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: '12px' }}>
                               <div style={{ fontSize: '18px', fontWeight: 'bold', color: 'white' }}>
                                 Total: ${(order.total_amount || 0).toFixed(2)}
                               </div>
                               {order.status === 'Confirmed' && (
                               <button 
                                 className={`modern-button ${processingOrders.has(order.id) ? '' : 'success'}`} 
                                 style={{ 
                                   width: 'auto', 
                                   padding: '12px 24px', 
                                   fontSize: '16px', 
                                   fontWeight: 'bold',
                                   background: processingOrders.has(order.id) ? 'var(--secondary-color)' : '',
                                   cursor: processingOrders.has(order.id) ? 'not-allowed' : 'pointer'
                                 }} 
                                 onClick={() => handleSendToKitchen(order.id)}
                                 disabled={processingOrders.has(order.id)}
                               >
                                 {processingOrders.has(order.id) ? 'Sending...' : 'Send to Kitchen'}
                               </button>
                               )}
                            </div>
                          </div>

                       </div>
                     ))}

                     <div style={{ marginTop: '8px', padding: '20px', background: 'rgba(16, 185, 129, 0.1)', border: '2px solid var(--accent-color)', borderRadius: '12px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', color: 'white' }}>
                       <button className="modern-button danger" style={{ width: 'auto', padding: '12px 24px' }} onClick={() => handleForceCloseTable(selectedTable.table_number, selectedTable.current_session_id)}>
                         Close Table
                       </button>
                       <span style={{ fontSize: '28px', fontWeight: 'bold' }}>
                         Total Bill: ${tableOrders.reduce((sum, o) => sum + (o.total_amount || 0), 0).toFixed(2)}
                       </span>
                     </div>
                   </div>
                 )}
              </div>
            )}
          </div>
        </div>
      )}

      {activeTab === 'menu' && (
        <div className="responsive-grid">
          <div className="glass-panel" style={{ height: 'fit-content' }}>
            <h3 style={{ marginBottom: '16px' }}>{editingItem ? 'Edit Item' : 'Add New Item'}</h3>
            <form onSubmit={handleMenuSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              <input className="modern-input" style={{ marginBottom: 0 }} placeholder="Item Name" value={formData.name} onChange={e => setFormData({...formData, name: e.target.value})} required />
              <input className="modern-input" style={{ marginBottom: 0 }} placeholder="Description" value={formData.description} onChange={e => setFormData({...formData, description: e.target.value})} />
              <input type="number" step="0.01" className="modern-input" style={{ marginBottom: 0 }} placeholder="Price ($)" value={formData.price} onChange={e => setFormData({...formData, price: e.target.value})} required />
              <input className="modern-input" style={{ marginBottom: 0 }} placeholder="Category" value={formData.category} onChange={e => setFormData({...formData, category: e.target.value})} required />
              <label style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <input type="checkbox" checked={formData.is_active} onChange={e => setFormData({...formData, is_active: e.target.checked})} />
                Active on Menu
              </label>
              <button type="submit" className="modern-button success" style={{ marginTop: '8px' }}>{editingItem ? 'Update Item' : 'Add Item'}</button>
              {editingItem && <button type="button" className="modern-button" style={{ background: 'transparent', border: '1px solid var(--glass-border)' }} onClick={() => { setEditingItem(null); setFormData({name: '', description: '', price: '', category: '', is_active: true}); }}>Cancel</button>}
            </form>
          </div>

          <div className="glass-panel">
            <h3 style={{ marginBottom: '16px' }}>Current Menu</h3>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr style={{ borderBottom: '1px solid var(--glass-border)', textAlign: 'left' }}>
                  <th style={{ padding: '12px' }}>Name</th>
                  <th style={{ padding: '12px' }}>Category</th>
                  <th style={{ padding: '12px' }}>Price</th>
                  <th style={{ padding: '12px' }}>Status</th>
                  <th style={{ padding: '12px' }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {menu.map(item => (
                  <tr key={item.id} style={{ borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
                    <td style={{ padding: '12px' }}>{item.name}</td>
                    <td style={{ padding: '12px' }}>{item.category}</td>
                    <td style={{ padding: '12px' }}>${(item.price || 0).toFixed(2)}</td>
                    <td style={{ padding: '12px' }}>
                      <span className={`status-badge status-${item.is_active ? 'Available' : 'Awaiting'}`}>{item.is_active ? 'Active' : 'Hidden'}</span>
                    </td>
                    <td style={{ padding: '12px', display: 'flex', gap: '16px' }}>
                      <button style={{ background: 'none', border: 'none', color: 'var(--primary-color)', cursor: 'pointer' }} onClick={() => editItem(item)}>
                        <Edit2 size={18} />
                      </button>
                      <button style={{ background: 'none', border: 'none', color: 'var(--danger-color)', cursor: 'pointer' }} onClick={() => handleDeleteMenu(item.id)}>
                        <Trash2 size={18} />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {activeTab === 'analytics' && (
        <div className="animate-slide-up" style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
          {dashboardSummary ? (
            <div style={{ display: 'flex', gap: '24px' }}>
              <div className="glass-panel" style={{ flex: 1, textAlign: 'center' }}>
                <h3 style={{ color: '#94a3b8' }}>Today's Revenue</h3>
                <p style={{ fontSize: '36px', fontWeight: 'bold', color: 'var(--accent-color)' }}>${(dashboardSummary.today_revenue || 0).toFixed(2)}</p>
              </div>
              <div className="glass-panel" style={{ flex: 1, textAlign: 'center' }}>
                <h3 style={{ color: '#94a3b8' }}>Today's Orders</h3>
                <p style={{ fontSize: '36px', fontWeight: 'bold' }}>{dashboardSummary.today_orders}</p>
              </div>
              <div className="glass-panel" style={{ flex: 1, textAlign: 'center' }}>
                <h3 style={{ color: '#94a3b8' }}>Active Tables</h3>
                <p style={{ fontSize: '36px', fontWeight: 'bold' }}>{dashboardSummary.active_tables}</p>
              </div>
              <div className="glass-panel" style={{ flex: 1, textAlign: 'center' }}>
                <h3 style={{ color: '#94a3b8' }}>Active Menu Items</h3>
                <p style={{ fontSize: '36px', fontWeight: 'bold' }}>{dashboardSummary.active_menu_items}</p>
              </div>
            </div>
          ) : <p>Loading summary...</p>}

          <div className="glass-panel">
            <h3 style={{ marginBottom: '24px' }}>Historical Revenue (Last 6 Months)</h3>
            {historicalData.length > 0 ? (
              <div style={{ display: 'flex', alignItems: 'flex-end', gap: '16px', height: '300px', padding: '20px', background: 'rgba(0,0,0,0.2)', borderRadius: '12px' }}>
                {historicalData.map(data => {
                  const maxRevenue = Math.max(...historicalData.map(d => d.revenue));
                  const heightPercentage = maxRevenue > 0 ? (data.revenue / maxRevenue) * 100 : 0;
                  return (
                    <div key={data.sort_key} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'flex-end', height: '100%' }}>
                      <span style={{ fontSize: '14px', marginBottom: '8px', color: 'white', fontWeight: 'bold' }}>${(data.revenue || 0).toFixed(0)}</span>
                      <div style={{ width: '100%', maxWidth: '60px', height: `${heightPercentage}%`, background: 'var(--primary-color)', borderRadius: '8px 8px 0 0', transition: 'height 0.5s ease-out' }}></div>
                      <span style={{ marginTop: '12px', fontSize: '14px', color: '#94a3b8', whiteSpace: 'nowrap' }}>{data.label}</span>
                    </div>
                  );
                })}
              </div>
            ) : <p>No historical data available.</p>}
          </div>
        </div>
      )}

      {activeTab === 'daily-orders' && (
        <div className="animate-slide-up glass-panel">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' }}>
            <h3 style={{ margin: 0 }}>Orders by Date</h3>
            <input 
              type="date" 
              className="modern-input" 
              style={{ width: 'auto', margin: 0 }} 
              value={selectedDate}
              onChange={(e) => setSelectedDate(e.target.value)}
            />
          </div>
          {dailyOrders.length === 0 ? <p style={{ color: '#94a3b8' }}>No active or completed sessions found for this date.</p> : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              {dailyOrders.map(session => (
                <div key={session.id} style={{ padding: '16px', borderRadius: '12px', background: 'rgba(255,255,255,0.05)', border: '1px solid var(--glass-border)' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <div>
                      <strong style={{ fontSize: '18px' }}>Table {session.table_number}</strong>
                      <div style={{ marginTop: '8px', fontSize: '16px', color: '#cbd5e1' }}>
                        Customer: <span style={{ color: 'white' }}>{session.customer_name !== 'N/A' ? session.customer_name : 'Guest'}</span> 
                        {session.customer_phone !== 'N/A' && ` (${session.customer_phone})`}
                      </div>
                      <div style={{ marginTop: '4px', fontSize: '14px', color: '#94a3b8' }}>
                        Time: {new Date(session.created_at).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}
                      </div>
                    </div>
                    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: '8px' }}>
                      <span className={`status-badge status-${session.status.replace(' ', '')}`}>
                        {session.status === 'Closed' ? 'Payment Done' : session.status}
                      </span>
                      <strong style={{ fontSize: '24px', color: 'var(--accent-color)' }}>${(session.total_amount || 0).toFixed(2)}</strong>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {activeTab === 'notes' && (
        <div className="animate-slide-up" style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
          <div className="glass-panel">
            <h3 style={{ marginBottom: '16px' }}>Add a New Note</h3>
            <form onSubmit={handleAddNote} style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              <textarea 
                className="modern-input" 
                rows="3" 
                placeholder="Write your note or reminder here..." 
                value={newNote} 
                onChange={(e) => setNewNote(e.target.value)}
                style={{ resize: 'vertical' }}
                required
              />
              <button type="submit" className="modern-button success" style={{ width: 'auto', alignSelf: 'flex-start' }}>Save Note</button>
            </form>
          </div>

          <h3 style={{ marginTop: '16px' }}>Saved Notes</h3>
          {notes.length === 0 ? <p style={{ color: '#94a3b8' }}>No notes found.</p> : (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: '20px' }}>
              {notes.map(note => (
                <div key={note.id} style={{ padding: '20px', borderRadius: '12px', background: 'rgba(245, 158, 11, 0.1)', border: '1px solid var(--warning-color)', position: 'relative' }}>
                  <button 
                    style={{ position: 'absolute', top: '12px', right: '12px', background: 'none', border: 'none', color: 'var(--danger-color)', cursor: 'pointer' }} 
                    onClick={() => handleDeleteNote(note.id)}
                    title="Delete Note"
                  >
                    <Trash2 size={18} />
                  </button>
                  <p style={{ margin: '0 0 16px 0', fontSize: '16px', lineHeight: '1.5', whiteSpace: 'pre-wrap', color: 'white', paddingRight: '24px' }}>
                    {note.content}
                  </p>
                  <div style={{ fontSize: '12px', color: 'var(--warning-color)', opacity: 0.8, borderTop: '1px solid rgba(245,158,11,0.2)', paddingTop: '12px' }}>
                    {new Date(note.created_at).toLocaleString()}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default OwnerView;
