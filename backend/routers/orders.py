from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from typing import List
import models, schemas, database, utils
from routers.auth import get_current_user
from sockets import sio
from datetime import datetime, timedelta

router = APIRouter(prefix="/api/orders", tags=["orders"])

@router.post("/", response_model=schemas.Order)
async def create_order(order_data: schemas.OrderCreate, db: Session = Depends(database.get_db)):
    db_session = db.query(models.Session).filter(models.Session.id == order_data.session_id).first()
    if not db_session or db_session.status != "Active":
        raise HTTPException(status_code=400, detail="Invalid or closed session")

    # Calculate total and verify prices
    total = 0
    db_items = []
    for item in order_data.items:
        menu_item = db.query(models.MenuItem).filter(models.MenuItem.id == item.menu_item_id).first()
        if not menu_item:
            raise HTTPException(status_code=404, detail=f"Menu item {item.menu_item_id} not found")
        item_price = menu_item.price
        total += item_price * item.quantity
        
        db_items.append(models.OrderItem(
            menu_item_id=item.menu_item_id,
            quantity=item.quantity,
            price_at_time=item_price,
            special_instructions=item.special_instructions
        ))

    # Reuse OTP if this session already has one
    existing_order = db.query(models.Order).filter(models.Order.session_id == db_session.id).first()
    if existing_order and existing_order.otp:
        otp = existing_order.otp
    else:
        otp = utils.generate_otp()
        
    otp_expires = datetime.utcnow() + timedelta(hours=24)

    new_order = models.Order(
        session_id=order_data.session_id,
        otp=otp,
        otp_expires_at=otp_expires,
        total_amount=total,
        status="Pending"
    )
    db.add(new_order)
    db.commit()
    db.refresh(new_order)

    for db_item in db_items:
        db_item.order_id = new_order.id
        db.add(db_item)
    db.commit()
    
    table = db.query(models.Table).filter(models.Table.id == db_session.table_id).first()

    # Notify waiters and owners
    alert_data = {
        'table_number': table.table_number,
        'customer_name': db_session.customer_name,
        'otp': otp,
        'order_id': new_order.id
    }
    await sio.emit('new_otp', alert_data, room='waiter')
    await sio.emit('new_otp', alert_data, room='owner')

    return new_order

@router.post("/{order_id}/verify-otp")
async def verify_otp(order_id: int, otp: str, db: Session = Depends(database.get_db)):
    order = db.query(models.Order).filter(models.Order.id == order_id).first()
    if not order:
        raise HTTPException(status_code=404, detail="Order not found")
    
    if order.status != "Pending":
        raise HTTPException(status_code=400, detail="Order is already confirmed")



    if str(order.otp).strip() != str(otp).strip():
        raise HTTPException(status_code=400, detail="Invalid OTP")

    order.status = "Confirmed"
    db.commit()

    db_session = db.query(models.Session).filter(models.Session.id == order.session_id).first()
    table = db.query(models.Table).filter(models.Table.id == db_session.table_id).first()

    await sio.emit('order_confirmed', {
        'order_id': order.id,
        'table_number': table.table_number,
        'total': order.total_amount
    }, room='waiter')
    
    await sio.emit('order_status_update', {
        'order_id': order.id,
        'status': 'Confirmed'
    }, room=f'table_{table.id}')

    return {"message": "Order confirmed successfully"}

@router.post("/{order_id}/send-to-kitchen")
async def send_to_kitchen(order_id: int, db: Session = Depends(database.get_db), current_user: models.User = Depends(get_current_user)):
    if current_user.role not in ["waiter", "owner"]:
        raise HTTPException(status_code=403, detail="Not authorized")
        
    order = db.query(models.Order).filter(models.Order.id == order_id).first()
    if not order:
        raise HTTPException(status_code=404, detail="Order not found")

    order.status = "Sent to Kitchen"
    db.commit()

    # Kitchen needs detailed items.
    items = []
    for item in order.items:
        items.append({
            "name": item.menu_item.name,
            "quantity": item.quantity,
            "special_instructions": item.special_instructions
        })

    db_session = db.query(models.Session).filter(models.Session.id == order.session_id).first()
    table = db.query(models.Table).filter(models.Table.id == db_session.table_id).first()
    
    kitchen_data = {
        "order_id": order.id,
        "table_number": table.table_number,
        "items": items,
        "remarks": order.remarks,
        "status": order.status,
        "time": str(order.created_at)
    }

    await sio.emit('order_sent_to_kitchen', kitchen_data, room='kitchen')
    
    update_data = {
        'order_id': order.id,
        'status': 'Sent to Kitchen',
        'table_number': table.table_number,
        'session_id': db_session.id
    }
    
    # Notify customer, waiter, and owner
    await sio.emit('order_status_update', update_data, room=f'table_{table.id}')
    await sio.emit('order_status_update', update_data, room='waiter')
    await sio.emit('order_status_update', update_data, room='owner')

    return {"message": "Sent to kitchen"}

@router.post("/{order_id}/status")
async def update_order_status(order_id: int, status: str, db: Session = Depends(database.get_db), current_user: models.User = Depends(get_current_user)):
    if current_user.role not in ["kitchen", "owner"]:
        raise HTTPException(status_code=403, detail="Not authorized")
        
    valid_statuses = ["Preparing", "Ready"]
    if status not in valid_statuses:
        raise HTTPException(status_code=400, detail="Invalid status")

    order = db.query(models.Order).filter(models.Order.id == order_id).first()
    if not order:
        raise HTTPException(status_code=404, detail="Order not found")

    order.status = status
    db.commit()

    db_session = db.query(models.Session).filter(models.Session.id == order.session_id).first()
    table = db.query(models.Table).filter(models.Table.id == db_session.table_id).first()

    update_data = {
        'order_id': order.id,
        'status': status,
        'table_number': table.table_number
    }

    await sio.emit('order_status_update', update_data, room='waiter')
    await sio.emit('order_status_update', update_data, room='owner')
    await sio.emit('order_status_update', update_data, room=f'table_{table.id}')

    return {"message": f"Order status updated to {status}"}

@router.get("/all")
def get_all_orders(db: Session = Depends(database.get_db), current_user: models.User = Depends(get_current_user)):
    if current_user.role not in ["waiter", "owner", "kitchen"]:
        raise HTTPException(status_code=403, detail="Not authorized")
    # For simplicity, returning all non-closed orders
    orders = db.query(models.Order).all()
    # Serialize manually or rely on response_model (but it has nested relationships)
    result = []
    for o in orders:
        items = [{"id": i.id, "name": i.menu_item.name, "quantity": i.quantity, "special_instructions": i.special_instructions} for i in o.items if i.menu_item]
        db_s = db.query(models.Session).filter(models.Session.id == o.session_id).first()
        t = db.query(models.Table).filter(models.Table.id == db_s.table_id).first() if db_s else None
        
        result.append({
            "id": o.id,
            "table_number": t.table_number if t else "?",
            "status": o.status,
            "total_amount": o.total_amount,
            "items": items,
            "created_at": o.created_at
        })
    return result

@router.put("/items/{item_id}")
async def update_order_item(item_id: int, quantity: int, instructions: str = None, db: Session = Depends(database.get_db), current_user: models.User = Depends(get_current_user)):
    if current_user.role not in ["waiter", "owner"]:
        raise HTTPException(status_code=403, detail="Not authorized")
        
    item = db.query(models.OrderItem).filter(models.OrderItem.id == item_id).first()
    if not item:
        raise HTTPException(status_code=404, detail="Item not found")

    order = db.query(models.Order).filter(models.Order.id == item.order_id).first()
    if not order:
        raise HTTPException(status_code=404, detail="Order not found")

    if quantity <= 0:
        db.delete(item)
    else:
        item.quantity = quantity
        if instructions is not None:
            item.special_instructions = instructions

    db.commit()

    # Recalculate total
    new_total = 0
    for i in order.items:
        new_total += i.price_at_time * i.quantity
    
    order.total_amount = new_total
    db.commit()

    db_session = db.query(models.Session).filter(models.Session.id == order.session_id).first()
    table = db.query(models.Table).filter(models.Table.id == db_session.table_id).first()

    # Emit socket event
    await sio.emit('order_status_update', {
        'order_id': order.id,
        'status': order.status
    }, room=f'table_{table.id}')
    
    await sio.emit('order_details_updated', {'table_id': table.id, 'session_id': order.session_id}, room='waiter')
    await sio.emit('order_details_updated', {'table_id': table.id, 'session_id': order.session_id}, room='owner')
    
    # We can also notify the waiter/owner to refresh their views
    await sio.emit('table_status_changed', {'table_id': table.id, 'status': table.status})

    return {"message": "Item updated successfully", "new_total": new_total}

@router.put("/{order_id}/remarks")
async def update_order_remarks(order_id: int, remarks: str, db: Session = Depends(database.get_db), current_user: models.User = Depends(get_current_user)):
    if current_user.role not in ["waiter", "owner"]:
        raise HTTPException(status_code=403, detail="Not authorized")
        
    order = db.query(models.Order).filter(models.Order.id == order_id).first()
    if not order:
        raise HTTPException(status_code=404, detail="Order not found")

    order.remarks = remarks
    db.commit()

    db_session = db.query(models.Session).filter(models.Session.id == order.session_id).first()
    table = db.query(models.Table).filter(models.Table.id == db_session.table_id).first()

    await sio.emit('order_status_update', {
        'order_id': order.id,
        'status': order.status
    }, room=f'table_{table.id}')

    await sio.emit('order_details_updated', {'table_id': table.id, 'session_id': order.session_id}, room='waiter')
    await sio.emit('order_details_updated', {'table_id': table.id, 'session_id': order.session_id}, room='owner')

    return {"message": "Remarks updated successfully"}
