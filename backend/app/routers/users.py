from typing import List
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from .. import schemas, models, auth
from ..database import get_db

router = APIRouter(prefix="/users", tags=["users"])

@router.get("/", response_model=List[schemas.User])
def get_users(
    skip: int = 0,
    limit: int = 100,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(auth.require_admin)
):
    users = db.query(models.User).offset(skip).limit(limit).all()
    return users

@router.get("/{user_id}", response_model=schemas.User)
def get_user(
    user_id: int,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(auth.require_admin)
):
    user = db.query(models.User).filter(models.User.id == user_id).first()
    if user is None:
        raise HTTPException(status_code=404, detail="User not found")
    return user

@router.put("/{user_id}", response_model=schemas.User)
def update_user(
    user_id: int,
    user_update: schemas.UserUpdate,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(auth.require_admin)
):
    user = db.query(models.User).filter(models.User.id == user_id).first()
    if user is None:
        raise HTTPException(status_code=404, detail="User not found")
    
    update_data = user_update.dict(exclude_unset=True)
    for field, value in update_data.items():
        setattr(user, field, value)
    
    db.commit()
    db.refresh(user)
    return user

@router.delete("/{user_id}")
def delete_user(
    user_id: int,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(auth.require_admin)
):
    user = db.query(models.User).filter(models.User.id == user_id).first()
    if user is None:
        raise HTTPException(status_code=404, detail="User not found")
    
    user.is_active = False
    db.commit()
    return {"message": "User deactivated successfully"}