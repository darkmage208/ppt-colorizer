#!/usr/bin/env python3

import os
import sys
import argparse
from sqlalchemy.orm import sessionmaker
from sqlalchemy import create_engine
from app.models import User, UserRole
from app.auth import get_password_hash
from app.config import settings

def create_admin_user(email=None, password=None, username=None):
    """
    Create an admin user with provided credentials or environment variables
    """
    # Get credentials from environment variables or parameters
    admin_email = email or os.getenv('ADMIN_EMAIL', 'admin@example.com')
    admin_password = password or os.getenv('ADMIN_PASSWORD', 'admin123')
    admin_username = username or os.getenv('ADMIN_USERNAME', admin_email.split('@')[0])
    
    engine = create_engine(settings.database_url)
    SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
    db = SessionLocal()
    
    try:
        # Check if admin user already exists by email
        existing_user = db.query(User).filter(
            (User.email == admin_email) | (User.username == admin_username)
        ).first()
        
        if existing_user:
            print(f"User with email '{admin_email}' or username '{admin_username}' already exists!")
            if existing_user.role == UserRole.ADMIN:
                print("This user is already an admin.")
            else:
                # Upgrade existing user to admin
                existing_user.role = UserRole.ADMIN
                db.commit()
                print(f"User '{admin_email}' upgraded to admin role.")
            return
        
        # Create admin user
        admin_user = User(
            username=admin_username,
            email=admin_email,
            hashed_password=get_password_hash(admin_password),
            role=UserRole.ADMIN,
            is_active=True
        )
        
        db.add(admin_user)
        db.commit()
        db.refresh(admin_user)
        
        print("=" * 50)
        print("Admin user created successfully!")
        print("=" * 50)
        print(f"Email: {admin_email}")
        print(f"Username: {admin_username}")
        print(f"Password: {admin_password}")
        print("\n⚠️  Please change the password after first login!")
        print("=" * 50)
        
    except Exception as e:
        print(f"Error creating admin user: {e}")
        db.rollback()
        sys.exit(1)
    finally:
        db.close()

def main():
    parser = argparse.ArgumentParser(description='Create admin user for GABO - Genetics Analysis and Biosystems Optimization')
    parser.add_argument('--email', type=str, help='Admin email address')
    parser.add_argument('--password', type=str, help='Admin password')
    parser.add_argument('--username', type=str, help='Admin username (optional, defaults to email prefix)')
    
    args = parser.parse_args()
    
    create_admin_user(
        email=args.email,
        password=args.password,
        username=args.username
    )

if __name__ == "__main__":
    main()