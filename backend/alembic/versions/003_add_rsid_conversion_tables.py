"""Add RsID conversion tables

Revision ID: 003_add_rsid_conversion_tables
Revises: 981f23bc5494
Create Date: 2024-09-27 00:00:00.000000

"""
from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision = '003_add_rsid_conversion_tables'
down_revision = '981f23bc5494'
branch_labels = None
depends_on = None


def upgrade() -> None:
    # Create rsid_conversion_files table
    op.create_table('rsid_conversion_files',
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
    op.create_index(op.f('ix_rsid_conversion_files_id'), 'rsid_conversion_files', ['id'], unique=False)
    op.create_index(op.f('ix_rsid_conversion_files_name'), 'rsid_conversion_files', ['name'], unique=False)

    # Create rsid_projects table
    op.create_table('rsid_projects',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('name', sa.String(), nullable=True),
        sa.Column('conversion_file_id', sa.Integer(), nullable=True),
        sa.Column('status', sa.Enum('PENDING', 'PROCESSING', 'COMPLETED', 'ERROR', name='rsidprojectstatus'), nullable=True),
        sa.Column('error_message', sa.Text(), nullable=True),
        sa.Column('progress', sa.Integer(), nullable=True),
        sa.Column('created_by', sa.Integer(), nullable=True),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=True),
        sa.Column('updated_at', sa.DateTime(timezone=True), nullable=True),
        sa.ForeignKeyConstraint(['conversion_file_id'], ['rsid_conversion_files.id'], ),
        sa.ForeignKeyConstraint(['created_by'], ['users.id'], ),
        sa.PrimaryKeyConstraint('id')
    )
    op.create_index(op.f('ix_rsid_projects_id'), 'rsid_projects', ['id'], unique=False)
    op.create_index(op.f('ix_rsid_projects_name'), 'rsid_projects', ['name'], unique=False)

    # Create rsid_individual_files table
    op.create_table('rsid_individual_files',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('name', sa.String(), nullable=True),
        sa.Column('filename', sa.String(), nullable=True),
        sa.Column('file_path', sa.String(), nullable=True),
        sa.Column('file_size', sa.Integer(), nullable=True),
        sa.Column('project_id', sa.Integer(), nullable=True),
        sa.Column('is_active', sa.Boolean(), nullable=True),
        sa.Column('uploaded_by', sa.Integer(), nullable=True),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=True),
        sa.ForeignKeyConstraint(['project_id'], ['rsid_projects.id'], ),
        sa.ForeignKeyConstraint(['uploaded_by'], ['users.id'], ),
        sa.PrimaryKeyConstraint('id')
    )
    op.create_index(op.f('ix_rsid_individual_files_id'), 'rsid_individual_files', ['id'], unique=False)
    op.create_index(op.f('ix_rsid_individual_files_name'), 'rsid_individual_files', ['name'], unique=False)

    # Create rsid_output_groups table
    op.create_table('rsid_output_groups',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('name', sa.String(), nullable=True),
        sa.Column('project_id', sa.Integer(), nullable=True),
        sa.Column('is_active', sa.Boolean(), nullable=True),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=True),
        sa.ForeignKeyConstraint(['project_id'], ['rsid_projects.id'], ),
        sa.PrimaryKeyConstraint('id')
    )
    op.create_index(op.f('ix_rsid_output_groups_id'), 'rsid_output_groups', ['id'], unique=False)
    op.create_index(op.f('ix_rsid_output_groups_name'), 'rsid_output_groups', ['name'], unique=False)

    # Create rsid_output_files table
    op.create_table('rsid_output_files',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('name', sa.String(), nullable=True),
        sa.Column('filename', sa.String(), nullable=True),
        sa.Column('file_path', sa.String(), nullable=True),
        sa.Column('file_size', sa.Integer(), nullable=True),
        sa.Column('group_id', sa.Integer(), nullable=True),
        sa.Column('is_active', sa.Boolean(), nullable=True),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=True),
        sa.ForeignKeyConstraint(['group_id'], ['rsid_output_groups.id'], ),
        sa.PrimaryKeyConstraint('id')
    )
    op.create_index(op.f('ix_rsid_output_files_id'), 'rsid_output_files', ['id'], unique=False)
    op.create_index(op.f('ix_rsid_output_files_name'), 'rsid_output_files', ['name'], unique=False)


def downgrade() -> None:
    op.drop_index(op.f('ix_rsid_output_files_name'), table_name='rsid_output_files')
    op.drop_index(op.f('ix_rsid_output_files_id'), table_name='rsid_output_files')
    op.drop_table('rsid_output_files')
    op.drop_index(op.f('ix_rsid_output_groups_name'), table_name='rsid_output_groups')
    op.drop_index(op.f('ix_rsid_output_groups_id'), table_name='rsid_output_groups')
    op.drop_table('rsid_output_groups')
    op.drop_index(op.f('ix_rsid_individual_files_name'), table_name='rsid_individual_files')
    op.drop_index(op.f('ix_rsid_individual_files_id'), table_name='rsid_individual_files')
    op.drop_table('rsid_individual_files')
    op.drop_index(op.f('ix_rsid_projects_name'), table_name='rsid_projects')
    op.drop_index(op.f('ix_rsid_projects_id'), table_name='rsid_projects')
    op.drop_table('rsid_projects')
    op.drop_index(op.f('ix_rsid_conversion_files_name'), table_name='rsid_conversion_files')
    op.drop_index(op.f('ix_rsid_conversion_files_id'), table_name='rsid_conversion_files')
    op.drop_table('rsid_conversion_files')