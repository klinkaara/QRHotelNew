import React, { createContext, useState, useContext } from 'react';

const CartContext = createContext();

export const useCart = () => useContext(CartContext);

export const CartProvider = ({ children }) => {
  const [cart, setCart] = useState([]);

  const addToCart = (item, quantity = 1, specialInstructions = '') => {
    setCart(prev => {
      const existingItem = prev.find(i => i.menu_item_id === item.id && i.specialInstructions === specialInstructions);
      if (existingItem) {
        return prev.map(i => 
          i === existingItem 
            ? { ...i, quantity: i.quantity + quantity }
            : i
        );
      }
      return [...prev, { 
        menu_item_id: item.id, 
        name: item.name, 
        price: item.price, 
        quantity, 
        specialInstructions 
      }];
    });
  };

  const removeFromCart = (index) => {
    setCart(prev => prev.filter((_, i) => i !== index));
  };

  const updateQuantity = (index, delta) => {
    setCart(prev => prev.map((item, i) => {
      if (i === index) {
        const newQuantity = item.quantity + delta;
        return { ...item, quantity: newQuantity > 0 ? newQuantity : 1 };
      }
      return item;
    }));
  };

  const clearCart = () => {
    setCart([]);
  };

  const getCartTotal = () => {
    return cart.reduce((total, item) => total + (item.price * item.quantity), 0);
  };

  return (
    <CartContext.Provider value={{ cart, addToCart, removeFromCart, updateQuantity, clearCart, getCartTotal }}>
      {children}
    </CartContext.Provider>
  );
};
