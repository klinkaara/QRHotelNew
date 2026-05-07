from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from pydantic import BaseModel
import models, database
from routers.auth import get_current_user
from sockets import sio

router = APIRouter(prefix="/api/notes", tags=["notes"])

class NoteCreate(BaseModel):
    content: str

@router.get("/")
def get_notes(db: Session = Depends(database.get_db), current_user: models.User = Depends(get_current_user)):
    if current_user.role != "owner":
        raise HTTPException(status_code=403, detail="Only owner can view notes")
    return db.query(models.Note).order_by(models.Note.created_at.desc()).all()

@router.post("/")
async def create_note(note: NoteCreate, db: Session = Depends(database.get_db), current_user: models.User = Depends(get_current_user)):
    if current_user.role != "owner":
        raise HTTPException(status_code=403, detail="Only owner can create notes")
    db_note = models.Note(content=note.content)
    db.add(db_note)
    db.commit()
    db.refresh(db_note)
    await sio.emit('notes_updated', {'action': 'create'}, room='owner')
    return db_note

@router.delete("/{note_id}")
async def delete_note(note_id: int, db: Session = Depends(database.get_db), current_user: models.User = Depends(get_current_user)):
    if current_user.role != "owner":
        raise HTTPException(status_code=403, detail="Only owner can delete notes")
    db_note = db.query(models.Note).filter(models.Note.id == note_id).first()
    if not db_note:
        raise HTTPException(status_code=404, detail="Note not found")
    db.delete(db_note)
    db.commit()
    await sio.emit('notes_updated', {'action': 'delete', 'note_id': note_id}, room='owner')
    return {"message": "Note deleted"}
