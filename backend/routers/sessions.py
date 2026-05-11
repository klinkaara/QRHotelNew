from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from typing import List
import models, schemas, database
from routers.auth import get_current_user
from sockets import sio
from datetime import datetime

router = APIRouter(prefix="/api/sessions", tags=["sessions"])

from sqlalchemy.orm import joinedload

@router.get("/tables", response_model=List[schemas.Table])
def get_tables(db: Session = Depends(database.get_db)):
    return db.query(models.Table).options(
        joinedload(models.Table.session).joinedload(models.Session.orders)
    ).all()

@router.get("/table/{table_id}", response_model=schemas.Table)
def get_table(table_id: int, db: Session = Depends(database.get_db)):
    table = db.query(models.Table).filter(models.Table.id == table_id).first()
    if not table:
        raise HTTPException(status_code=404, detail="Table not found")
    return table

@router.post("/start", response_model=schemas.Session)
async def start_session(session_data: schemas.SessionCreate, db: Session = Depends(database.get_db)):
    table = db.query(models.Table).filter(models.Table.id == session_data.table_id).first()
    if not table:
        raise HTTPException(status_code=404, detail="Table not found")
    if table.status != "Available":
        raise HTTPException(status_code=400, detail="Table is busy")

    new_session = models.Session(**session_data.dict())
    db.add(new_session)
    db.commit()
    db.refresh(new_session)

    table.status = "Occupied"
    table.current_session_id = new_session.id
    db.commit()
    
    await sio.emit('table_status_changed', {'table_id': table.id, 'status': table.status})
    return new_session

@router.post("/{session_id}/checkout")
async def request_checkout(session_id: int, db: Session = Depends(database.get_db)):
    db_session = db.query(models.Session).filter(models.Session.id == session_id).first()
    if not db_session:
        raise HTTPException(status_code=404, detail="Session not found")
        
    table = db.query(models.Table).filter(models.Table.id == db_session.table_id).first()
    table.status = "Awaiting Payment"
    db.commit()

    # Calculate total
    total = sum(order.total_amount for order in db_session.orders if order.status != "Pending")

    await sio.emit('table_status_changed', {'table_id': table.id, 'status': table.status})
    await sio.emit('checkout_requested', {
        'table_number': table.table_number,
        'customer_name': db_session.customer_name,
        'total': total,
        'session_id': session_id
    }, room='waiter')
    await sio.emit('checkout_requested', {
        'table_number': table.table_number,
        'customer_name': db_session.customer_name,
        'total': total,
        'session_id': session_id
    }, room='owner')

    return {"message": "Checkout requested", "total": total}

@router.post("/{session_id}/close")
async def close_session(session_id: int, db: Session = Depends(database.get_db), current_user: models.User = Depends(get_current_user)):
    if current_user.role not in ["waiter", "owner"]:
        raise HTTPException(status_code=403, detail="Not authorized")
        
    db_session = db.query(models.Session).filter(models.Session.id == session_id).first()
    if not db_session:
        raise HTTPException(status_code=404, detail="Session not found")

    db_session.status = "Closed"
    db_session.end_time = datetime.utcnow()
    
    table = db.query(models.Table).filter(models.Table.id == db_session.table_id).first()
    table.status = "Available"
    table.current_session_id = None
    db.commit()

    await sio.emit('table_status_changed', {'table_id': table.id, 'status': table.status})
    await sio.emit('session_closed', {'table_id': table.id}, room=f'table_{table.id}')
    return {"message": "Table closed and session ended"}

@router.get("/{session_id}/orders")
def get_session_orders(session_id: int, db: Session = Depends(database.get_db)):
    db_session = db.query(models.Session).filter(models.Session.id == session_id).first()
    if not db_session:
        raise HTTPException(status_code=404, detail="Session not found")
        
    result = []
    # Only return orders that are confirmed or beyond (not pending)
    valid_orders = [o for o in db_session.orders if o.status != "Pending"]
    for o in valid_orders:
        items = []
        for i in o.items:
            if i.menu_item:
                items.append({
                    "id": i.id,
                    "name": i.menu_item.name,
                    "quantity": i.quantity,
                    "price": i.price_at_time,
                    "instructions": i.special_instructions
                })
        result.append({
            "id": o.id,
            "status": o.status,
            "otp": o.otp,
            "total_amount": o.total_amount,
            "remarks": o.remarks,
            "items": items,
            "created_at": o.created_at
        })
    return result
