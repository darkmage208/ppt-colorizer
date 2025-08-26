#!/usr/bin/env python3

import os
import sys
import argparse
from sqlalchemy.orm import sessionmaker
from sqlalchemy import create_engine, text
from app.models import User, UserRole
from app.auth import get_password_hash
from app.config import settings

def create_admin_user(email=None, password=None, username=None, role='admin'):
    """
    Create an admin or superadmin user with provided credentials or environment variables
    """
    # Get credentials from environment variables or parameters
    admin_email = email or os.getenv('ADMIN_EMAIL', 'admin@example.com')
    admin_password = password or os.getenv('ADMIN_PASSWORD', 'admin123')
    admin_username = username or os.getenv('ADMIN_USERNAME', admin_email.split('@')[0])
    # Map role string to actual database enum values (all uppercase)
    role_mapping = {
        'superadmin': 'SUPERADMIN',
        'admin': 'ADMIN', 
        'user': 'USER'
    }
    user_role_str = role_mapping.get(role.lower(), 'USER')
    
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
            
            # Get current role value from database directly
            current_role_result = db.execute(text("SELECT role FROM users WHERE id = :id"), {"id": existing_user.id})
            current_role = current_role_result.fetchone()[0]
            
            if current_role == user_role_str:
                print(f"This user is already a {role}.")
            else:
                # Upgrade existing user to specified role
                db.execute(text("UPDATE users SET role = :role WHERE id = :id"), 
                          {"role": user_role_str, "id": existing_user.id})
                db.commit()
                print(f"User '{admin_email}' upgraded from '{current_role}' to '{role}' role.")
            return
        
        # Create user with specified role using raw SQL for enum handling
        result = db.execute(text("""
            INSERT INTO users (username, email, hashed_password, role, is_active, created_at)
            VALUES (:username, :email, :password, :role, :active, NOW())
            RETURNING id
        """), {
            "username": admin_username,
            "email": admin_email, 
            "password": get_password_hash(admin_password),
            "role": user_role_str,
            "active": True
        })
        
        user_id = result.fetchone()[0]
        db.commit()
        
        print("=" * 50)
        print(f"{role.capitalize()} user created successfully!")
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
    parser.add_argument('--role', type=str, choices=['user', 'admin', 'superadmin'], default='admin', help='User role (user, admin, or superadmin)')
    
    args = parser.parse_args()
    
    create_admin_user(
        email=args.email,
        password=args.password,
        username=args.username,
        role=args.role
    )

if __name__ == "__main__":
    main()