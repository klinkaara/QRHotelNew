from pydantic import BaseModel
from typing import List, Optional
from datetime import datetime

class UserBase(BaseModel):
    username: str
    role: str
    is_active: bool = True

class UserCreate(UserBase):
    password: str
    pin: Optional[str] = None

class User(UserBase):
    id: int
    class Config:
        orm_mode = True

class Token(BaseModel):
    access_token: str
    token_type: str

class TokenData(BaseModel):
    username: Optional[str] = None

class MenuItemBase(BaseModel):
    name: str
    description: Optional[str] = None
    price: float
    category: str
    image_url: Optional[str] = None
    is_active: bool = True

class MenuItemCreate(MenuItemBase):
    pass

class MenuItem(MenuItemBase):
    id: int
    class Config:
        orm_mode = True

class SessionBase(BaseModel):
    table_id: int
    customer_name: str
    customer_phone: str

class SessionCreate(SessionBase):
    pass

class Session(SessionBase):
    id: int
    start_time: datetime
    end_time: Optional[datetime] = None
    status: str
    class Config:
        orm_mode = True

class TableBase(BaseModel):
    table_number: int
    status: str

class Table(TableBase):
    id: int
    current_session_id: Optional[int] = None
    session: Optional[Session] = None
    current_otp: Optional[str] = None
    class Config:
        orm_mode = True

class OrderItemBase(BaseModel):
    menu_item_id: int
    quantity: int
    special_instructions: Optional[str] = None

class OrderItemCreate(OrderItemBase):
    pass

class OrderItem(OrderItemBase):
    id: int
    order_id: int
    price_at_time: float
    menu_item: Optional[MenuItem] = None
    class Config:
        orm_mode = True

class OrderBase(BaseModel):
    session_id: int
    
class OrderCreate(OrderBase):
    items: List[OrderItemCreate]

class Order(OrderBase):
    id: int
    status: str
    otp: Optional[str] = None
    otp_expires_at: Optional[datetime] = None
    total_amount: float
    created_at: datetime
    items: List[OrderItem] = []
    class Config:
        orm_mode = True
