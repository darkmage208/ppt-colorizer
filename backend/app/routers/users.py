from typing import List
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from .. import schemas, models, auth
from ..auth import get_password_hash
from ..database import get_db

router = APIRouter(prefix="/users", tags=["users"])

@router.get("/", response_model=List[schemas.User])
def get_users(
    skip: int = 0,
    limit: int = 100,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(auth.get_current_active_user)
):
    if not auth.check_user_management_permission(current_user):
        raise HTTPException(status_code=403, detail="Not authorized to view users")
    users = db.query(models.User).offset(skip).limit(limit).all()
    return users

@router.get("/{user_id}", response_model=schemas.User)
def get_user(
    user_id: int,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(auth.get_current_active_user)
):
    if not auth.check_user_management_permission(current_user):
        raise HTTPException(status_code=403, detail="Not authorized to view user details")
    user = db.query(models.User).filter(models.User.id == user_id).first()
    if user is None:
        raise HTTPException(status_code=404, detail="User not found")
    return user

@router.put("/{user_id}", response_model=schemas.User)
def update_user(
    user_id: int,
    user_update: schemas.UserUpdate,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(auth.get_current_active_user)
):
    if not auth.check_user_management_permission(current_user):
        raise HTTPException(status_code=403, detail="Not authorized to update users")
    
    target_user = db.query(models.User).filter(models.User.id == user_id).first()
    if target_user and target_user.role == models.UserRole.SUPERADMIN and current_user.role != models.UserRole.SUPERADMIN:
        raise HTTPException(status_code=403, detail="Only superadmins can modify superadmin accounts")
    user = db.query(models.User).filter(models.User.id == user_id).first()
    if user is None:
        raise HTTPException(status_code=404, detail="User not found")
    
    update_data = user_update.dict(exclude_unset=True)
    for field, value in update_data.items():
        setattr(user, field, value)
    
    db.commit()
    db.refresh(user)
    return user

@router.post("/", response_model=schemas.User)
def create_user(
    user_create: schemas.UserCreate,
    role: models.UserRole = models.UserRole.USER,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(auth.get_current_active_user)
):
    if not auth.check_user_management_permission(current_user):
        raise HTTPException(status_code=403, detail="Not authorized to create users")
    
    if role == models.UserRole.SUPERADMIN and current_user.role != models.UserRole.SUPERADMIN:
        raise HTTPException(status_code=403, detail="Only superadmins can create superadmin accounts")
    
    if role == models.UserRole.ADMIN and current_user.role != models.UserRole.SUPERADMIN:
        raise HTTPException(status_code=403, detail="Only superadmins can create admin accounts")
    
    if db.query(models.User).filter(models.User.email == user_create.email).first():
        raise HTTPException(status_code=400, detail="Email already registered")
    
    if db.query(models.User).filter(models.User.username == user_create.username).first():
        raise HTTPException(status_code=400, detail="Username already taken")
    
    hashed_password = get_password_hash(user_create.password)
    
    db_user = models.User(
        username=user_create.username,
        email=user_create.email,
        hashed_password=hashed_password,
        role=role
    )
    db.add(db_user)
    db.commit()
    db.refresh(db_user)
    return db_user

@router.delete("/{user_id}")
def delete_user(
    user_id: int,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(auth.require_superadmin)
):
    user = db.query(models.User).filter(models.User.id == user_id).first()
    if user is None:
        raise HTTPException(status_code=404, detail="User not found")
    
    user.is_active = False
    db.commit()
    return {"message": "User deactivated successfully"}