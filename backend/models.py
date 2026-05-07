from sqlalchemy import Boolean, Column, Integer, String, Float, ForeignKey, DateTime
from sqlalchemy.orm import relationship
import datetime
from database import Base

class User(Base):
    __tablename__ = "users"

    id = Column(Integer, primary_key=True, index=True)
    username = Column(String, unique=True, index=True)
    password_hash = Column(String)
    role = Column(String) # "owner", "waiter", "kitchen"
    pin = Column(String, nullable=True) # Kitchen pin
    is_active = Column(Boolean, default=True)

class Table(Base):
    __tablename__ = "tables"

    id = Column(Integer, primary_key=True, index=True)
    table_number = Column(Integer, unique=True, index=True)
    status = Column(String, default="Available") # Available, Occupied, Awaiting Payment
    current_session_id = Column(Integer, ForeignKey("sessions.id"), nullable=True)

    session = relationship("Session", foreign_keys=[current_session_id])

class Session(Base):
    __tablename__ = "sessions"

    id = Column(Integer, primary_key=True, index=True)
    table_id = Column(Integer, ForeignKey("tables.id"))
    customer_name = Column(String)
    customer_phone = Column(String)
    start_time = Column(DateTime, default=datetime.datetime.utcnow)
    end_time = Column(DateTime, nullable=True)
    status = Column(String, default="Active") # Active, Closed
    
    table = relationship("Table", foreign_keys=[table_id])
    orders = relationship("Order", back_populates="session")

class MenuItem(Base):
    __tablename__ = "menu_items"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String, index=True)
    description = Column(String)
    price = Column(Float)
    category = Column(String)
    image_url = Column(String, nullable=True)
    is_active = Column(Boolean, default=True)

class Order(Base):
    __tablename__ = "orders"

    id = Column(Integer, primary_key=True, index=True)
    session_id = Column(Integer, ForeignKey("sessions.id"))
    status = Column(String, default="Pending") # Pending, Confirmed, Preparing, Ready
    otp = Column(String, nullable=True)
    otp_expires_at = Column(DateTime, nullable=True)
    total_amount = Column(Float, default=0.0)
    remarks = Column(String, nullable=True)
    created_at = Column(DateTime, default=datetime.datetime.utcnow)
    
    session = relationship("Session", back_populates="orders")
    items = relationship("OrderItem", back_populates="order")

class OrderItem(Base):
    __tablename__ = "order_items"

    id = Column(Integer, primary_key=True, index=True)
    order_id = Column(Integer, ForeignKey("orders.id"))
    menu_item_id = Column(Integer, ForeignKey("menu_items.id"))
    quantity = Column(Integer, default=1)
    price_at_time = Column(Float) # Store the price at time of order
    special_instructions = Column(String, nullable=True)

    order = relationship("Order", back_populates="items")
    menu_item = relationship("MenuItem")

class Note(Base):
    __tablename__ = "notes"

    id = Column(Integer, primary_key=True, index=True)
    content = Column(String)
    created_at = Column(DateTime, default=datetime.datetime.utcnow)
