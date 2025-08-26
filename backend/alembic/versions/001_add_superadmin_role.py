"""Add SUPERADMIN role to UserRole enum

Revision ID: 001_add_superadmin_role
Revises: 
Create Date: 2024-12-22 10:00:00.000000

"""
from alembic import op
import sqlalchemy as sa

# revision identifiers, used by Alembic.
revision = '001_add_superadmin_role'
down_revision = None
branch_labels = None
depends_on = None

def upgrade():
    # Add SUPERADMIN to the existing enum (uppercase for consistency)
    op.execute("ALTER TYPE userrole ADD VALUE IF NOT EXISTS 'SUPERADMIN'")

def downgrade():
    # Note: PostgreSQL doesn't support removing enum values easily
    # This would require recreating the enum which could be complex
    # For now, we'll leave this empty as removing enum values is not straightforward
    pass