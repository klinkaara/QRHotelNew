import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { useSocket } from '../context/SocketContext';
import { useAuth } from '../context/AuthContext';
import { Bell, Check, Utensils, Receipt, ArrowLeft, Plus, Minus, Trash2, LogOut } from 'lucide-react';
import { API_BASE_URL } from '../api';

const WaiterView = () => {
  const socket = useSocket();
  const { logout } = useAuth();
  const [tables, setTables] = useState([]);
  
  // groupedAlerts shape: 
  // { [table_number]: { blinkKey: number, session_id: number, needsCheckout: boolean, checkoutData: any, messages: Array<{id, type, text}> } }
  const [groupedAlerts, setGroupedAlerts] = useState({}); 
  
  const [selectedTable, setSelectedTable] = useState(() => {
    const saved = localStorage.getItem('waiter_selected_table');
    return saved ? JSON.parse(saved) : null;
  });
  const [tableOrders, setTableOrders] = useState([]);
  const [processingOrders, setProcessingOrders] = useState(new Set());

  const selectedTableRef = React.useRef(selectedTable);
  useEffect(() => {
    selectedTableRef.current = selectedTable;
  }, [selectedTable]);

  useEffect(() => {
    fetchTables();

    if (socket) {
      socket.on('table_status_changed', () => fetchTables());
      
      socket.on('new_otp', (data) => {
        addGroupedAlert(data.table_number, data.session_id, {
          id: Date.now(), type: 'OTP', text: `Customer placed an order. OTP: ${data.otp}`
        });
      });
      
      socket.on('checkout_requested', (data) => {
        addGroupedAlert(data.table_number, data.session_id, {
          id: Date.now(), type: 'CHECKOUT', text: `Checkout requested. Total: $${data.total.toFixed(2)}`
        }, { total: data.total, session_id: data.session_id });
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
    }

    return () => {
      if (socket) {
        socket.off('table_status_changed');
        socket.off('new_otp');
        socket.off('checkout_requested');
        socket.off('order_status_update');
        socket.off('order_details_updated');
      }
    };
  }, [socket]);

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
      
      // If we receive a sessionId, ensure it's saved.
      const currentSessionId = sessionId || existing.session_id;
      
      const isCheckout = checkoutData !== null;
      
      return {
        ...prev,
        [tableNum]: {
          ...existing,
          session_id: currentSessionId,
          blinkKey: Date.now(), // Trigger CSS animation by changing key
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
      const res = await axios.get(`${API_BASE_URL}/api/sessions/tables`);
      setTables(res.data);
      
      // Check if we need to sync the selected table from updated data
      const saved = localStorage.getItem('waiter_selected_table');
      const savedTableId = saved ? JSON.parse(saved)?.id : null;
      
      if (savedTableId) {
        const updatedSelected = res.data.find(t => t.id === savedTableId);
        if (updatedSelected) {
           if (updatedSelected.status === 'Available') {
              setSelectedTable(null);
              localStorage.removeItem('waiter_selected_table');
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

  const fetchTableOrders = async (sessionId) => {
    try {
      const res = await axios.get(`${API_BASE_URL}/api/sessions/${sessionId}/orders`);
      setTableOrders(res.data);
    } catch (err) {
      console.error(err);
    }
  };

  const handleTableClick = (table) => {
    setSelectedTable(table);
    localStorage.setItem('waiter_selected_table', JSON.stringify(table));
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
        await axios.post(`${API_BASE_URL}/api/sessions/${alertData.checkoutData.session_id}/close`);
        dismissTableAlerts(tableNum);
        setSelectedTable(null);
        localStorage.removeItem('waiter_selected_table');
        fetchTables();
      } catch (err) {
        console.error(err);
      }
    }
  };

  const handleForceCloseTable = async (tableNum, sessionId) => {
    if(window.confirm(`Customer paid, close the table ${tableNum}?`)) {
      try {
        await axios.post(`${API_BASE_URL}/api/sessions/${sessionId}/close`);
        dismissTableAlerts(tableNum);
        setSelectedTable(null);
        localStorage.removeItem('waiter_selected_table');
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
      await axios.post(`${API_BASE_URL}/api/orders/${orderId}/send-to-kitchen`);
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
      await axios.put(`${API_BASE_URL}/api/orders/items/${itemId}?quantity=${newQuantity}`);
      if (selectedTable && selectedTable.current_session_id) {
        fetchTableOrders(selectedTable.current_session_id);
      }
    } catch (err) {
      console.error(err);
    }
  };

  const updateOrderRemarks = async (orderId, newRemarks) => {
    try {
      await axios.put(`${API_BASE_URL}/api/orders/${orderId}/remarks?remarks=${encodeURIComponent(newRemarks)}`);
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

  return (
    <div className="app-container animate-slide-up">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px', flexWrap: 'wrap', gap: '12px' }}>
        <h1 style={{ margin: 0 }}>Waiter Dashboard</h1>
        <button 
          onClick={logout}
          className="modern-button danger" 
          style={{ width: 'auto', display: 'flex', alignItems: 'center', gap: '8px', padding: '10px 20px' }}
        >
          <LogOut size={20} />
          Logout
        </button>
      </div>

      <div className="responsive-grid">
        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          <h3>Alerts</h3>
          {Object.keys(groupedAlerts).length === 0 ? <p style={{ color: '#94a3b8' }}>No active alerts</p> : null}
          
          {Object.entries(groupedAlerts).map(([tableNum, alertData]) => {
            // Determine primary highlight color based on needsCheckout
            const borderStyle = alertData.needsCheckout ? '4px solid var(--danger-color)' : '4px solid var(--warning-color)';
            
            return (
              <div 
                key={alertData.blinkKey} // Changing key triggers the animation
                className={`glass-panel alert-blink`} 
                style={{ borderLeft: borderStyle, marginBottom: '16px' }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '12px', borderBottom: '1px solid rgba(255,255,255,0.05)', paddingBottom: '8px' }}>
                  <Bell size={20} color={alertData.needsCheckout ? 'var(--danger-color)' : 'var(--warning-color)'} />
                  <strong style={{ fontSize: '18px' }}>Table {tableNum}</strong>
                </div>
                
                <ul style={{ listStyle: 'none', padding: 0, margin: '0 0 16px 0' }}>
                  {alertData.messages.map((msg, idx) => (
                    <li key={msg.id || idx} style={{ fontSize: '14px', marginBottom: '8px', display: 'flex', gap: '8px', alignItems: 'flex-start' }}>
                      <span style={{ marginTop: '2px' }}>•</span>
                      <span>{msg.text}</span>
                    </li>
                  ))}
                </ul>
                
                <div style={{ display: 'flex', gap: '8px' }}>
                  {alertData.needsCheckout && (
                    <button className="modern-button danger" style={{ padding: '8px', fontSize: '12px' }} onClick={() => handleCheckout(tableNum)}>Close Table</button>
                  )}
                  <button className="modern-button" style={{ padding: '8px', fontSize: '12px', background: 'transparent', border: '1px solid var(--glass-border)' }} onClick={() => dismissTableAlerts(tableNum)}>Dismiss</button>
                </div>
              </div>
            );
          })}
        </div>

        <div>
          {!selectedTable ? (
            <>
              <h3>Tables Status</h3>
              <div className="grid-cards" style={{ marginTop: '16px' }}>
                {tables.map(table => (
                  <div 
                    key={table.id} 
                    className={`glass-panel table-card ${groupedAlerts[table.table_number] ? 'table-blink' : ''}`} 
                    onClick={() => handleTableClick(table)}
                    onMouseEnter={(e) => e.currentTarget.style.border = '2px solid var(--primary-color)'}
                    onMouseLeave={(e) => e.currentTarget.style.border = '2px solid transparent'}
                  >
                    <h2 style={{ marginBottom: '8px' }}>{table.table_number}</h2>
                    <span className={`status-badge status-${table.status.replace(' ', '')}`}>{table.status}</span>
                  </div>
                ))}
              </div>
            </>
          ) : (
            <div className="glass-panel animate-slide-up" style={{ minHeight: '600px' }}>
               <div style={{ display: 'flex', alignItems: 'center', gap: '16px', marginBottom: '24px', borderBottom: '1px solid var(--glass-border)', paddingBottom: '16px' }}>
                 <button className="modern-button" style={{ width: 'auto', padding: '8px' }} onClick={() => {
                   setSelectedTable(null);
                   localStorage.removeItem('waiter_selected_table');
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
                                    <span style={{ color: 'var(--accent-color)', fontWeight: 'bold' }}>${(item.price * item.quantity).toFixed(2)}</span>
                                    
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
    </div>
  );
};

export default WaiterView;
