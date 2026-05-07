from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from typing import List
import models, schemas, database
from routers.auth import get_current_user
from sockets import sio

router = APIRouter(prefix="/api/menu", tags=["menu"])

@router.get("/", response_model=List[schemas.MenuItem])
def get_menu(db: Session = Depends(database.get_db)):
    return db.query(models.MenuItem).filter(models.MenuItem.is_active == True).all()

@router.get("/all", response_model=List[schemas.MenuItem])
def get_all_menu_items(db: Session = Depends(database.get_db), current_user: models.User = Depends(get_current_user)):
    if current_user.role not in ["owner", "waiter"]:
        raise HTTPException(status_code=403, detail="Not enough permissions")
    return db.query(models.MenuItem).all()

@router.post("/", response_model=schemas.MenuItem)
async def create_menu_item(item: schemas.MenuItemCreate, db: Session = Depends(database.get_db), current_user: models.User = Depends(get_current_user)):
    if current_user.role != "owner":
        raise HTTPException(status_code=403, detail="Only owner can create menu items")
    db_item = models.MenuItem(**item.dict())
    db.add(db_item)
    db.commit()
    db.refresh(db_item)
    await sio.emit('menu_updated', {'action': 'create', 'item_id': db_item.id})
    return db_item

@router.put("/{item_id}", response_model=schemas.MenuItem)
async def update_menu_item(item_id: int, item: schemas.MenuItemCreate, db: Session = Depends(database.get_db), current_user: models.User = Depends(get_current_user)):
    if current_user.role != "owner":
        raise HTTPException(status_code=403, detail="Only owner can update menu items")
    db_item = db.query(models.MenuItem).filter(models.MenuItem.id == item_id).first()
    if not db_item:
        raise HTTPException(status_code=404, detail="Item not found")
    
    for key, value in item.dict().items():
        setattr(db_item, key, value)
        
    db.commit()
    db.refresh(db_item)
    await sio.emit('menu_updated', {'action': 'update', 'item_id': db_item.id})
    return db_item

@router.delete("/{item_id}")
async def delete_menu_item(item_id: int, db: Session = Depends(database.get_db), current_user: models.User = Depends(get_current_user)):
    if current_user.role != "owner":
        raise HTTPException(status_code=403, detail="Only owner can delete menu items")
    
    db_item = db.query(models.MenuItem).filter(models.MenuItem.id == item_id).first()
    if not db_item:
        raise HTTPException(status_code=404, detail="Item not found")
        
    try:
        db.delete(db_item)
        db.commit()
        await sio.emit('menu_updated', {'action': 'delete', 'item_id': item_id})
        return {"message": "Item deleted permanently"}
    except Exception as e:
        db.rollback()
        # Fallback to soft delete if constraints block hard delete
        db_item.is_active = False
        db.commit()
        await sio.emit('menu_updated', {'action': 'soft-delete', 'item_id': item_id})
        return {"message": "Item soft-deleted due to existing order history"}
