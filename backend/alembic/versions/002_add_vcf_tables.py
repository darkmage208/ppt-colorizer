"""Add VCF file and conversion tables

Revision ID: 002_add_vcf_tables
Revises: f577832ba658
Create Date: 2025-09-15 00:00:00.000000

"""
from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision = '002_add_vcf_tables'
down_revision = 'f577832ba658'
branch_labels = None
depends_on = None


def upgrade() -> None:
    # Create vcf_files table
    op.create_table('vcf_files',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('name', sa.String(), nullable=True),
        sa.Column('filename', sa.String(), nullable=True),
        sa.Column('file_path', sa.String(), nullable=True),
        sa.Column('file_size', sa.Integer(), nullable=True),
        sa.Column('is_active', sa.Boolean(), nullable=True),
        sa.Column('uploaded_by', sa.Integer(), nullable=True),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=True),
        sa.ForeignKeyConstraint(['uploaded_by'], ['users.id'], ),
        sa.PrimaryKeyConstraint('id')
    )
    op.create_index(op.f('ix_vcf_files_id'), 'vcf_files', ['id'], unique=False)
    op.create_index(op.f('ix_vcf_files_name'), 'vcf_files', ['name'], unique=False)

    # Create vcf_conversions table
    op.create_table('vcf_conversions',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('vcf_file_id', sa.Integer(), nullable=True),
        sa.Column('user_id', sa.Integer(), nullable=True),
        sa.Column('txt_filename', sa.String(), nullable=True),
        sa.Column('txt_file_path', sa.String(), nullable=True),
        sa.Column('status', sa.Enum('PENDING', 'PROCESSING', 'COMPLETED', 'ERROR', name='conversionstatus'), nullable=True),
        sa.Column('error_message', sa.Text(), nullable=True),
        sa.Column('progress', sa.Integer(), nullable=True),
        sa.Column('total_variants', sa.Integer(), nullable=True),
        sa.Column('processed_variants', sa.Integer(), nullable=True),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=True),
        sa.Column('updated_at', sa.DateTime(timezone=True), nullable=True),
        sa.ForeignKeyConstraint(['user_id'], ['users.id'], ),
        sa.ForeignKeyConstraint(['vcf_file_id'], ['vcf_files.id'], ),
        sa.PrimaryKeyConstraint('id')
    )
    op.create_index(op.f('ix_vcf_conversions_id'), 'vcf_conversions', ['id'], unique=False)


def downgrade() -> None:
    op.drop_index(op.f('ix_vcf_conversions_id'), table_name='vcf_conversions')
    op.drop_table('vcf_conversions')
    op.drop_index(op.f('ix_vcf_files_name'), table_name='vcf_files')
    op.drop_index(op.f('ix_vcf_files_id'), table_name='vcf_files')
    op.drop_table('vcf_files')