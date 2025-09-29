"""Consolidated RSID conversion schema

Revision ID: 003_consolidated_rsid_conversion_schema
Revises: 981f23bc5494
Create Date: 2024-09-28 00:00:00.000000

"""
from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision = '006'
down_revision = '005'
branch_labels = None
depends_on = None


def upgrade() -> None:
    # Create conversionjobstatus enum type first
    conversionjobstatus_enum = sa.Enum('pending', 'processing', 'completed', 'error', name='conversionjobstatus')
    conversionjobstatus_enum.create(op.get_bind())

    # Create conversion_files table (independent file management)
    op.create_table('conversion_files',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('name', sa.String(), nullable=False),
        sa.Column('filename', sa.String(), nullable=False),
        sa.Column('file_path', sa.String(), nullable=False),
        sa.Column('file_size', sa.Integer(), nullable=True),
        sa.Column('is_active', sa.Boolean(), nullable=True, default=True),
        sa.Column('uploaded_by', sa.Integer(), nullable=False),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=True),
        sa.Column('updated_at', sa.DateTime(timezone=True), nullable=True),
        sa.ForeignKeyConstraint(['uploaded_by'], ['users.id'], ),
        sa.PrimaryKeyConstraint('id')
    )
    op.create_index(op.f('ix_conversion_files_id'), 'conversion_files', ['id'], unique=False)
    op.create_index(op.f('ix_conversion_files_name'), 'conversion_files', ['name'], unique=False)

    # Create individual_files table (independent file management)
    op.create_table('individual_files',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('name', sa.String(), nullable=False),
        sa.Column('filename', sa.String(), nullable=False),
        sa.Column('file_path', sa.String(), nullable=False),
        sa.Column('file_size', sa.Integer(), nullable=True),
        sa.Column('is_active', sa.Boolean(), nullable=True, default=True),
        sa.Column('uploaded_by', sa.Integer(), nullable=False),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=True),
        sa.Column('updated_at', sa.DateTime(timezone=True), nullable=True),
        sa.ForeignKeyConstraint(['uploaded_by'], ['users.id'], ),
        sa.PrimaryKeyConstraint('id')
    )
    op.create_index(op.f('ix_individual_files_id'), 'individual_files', ['id'], unique=False)
    op.create_index(op.f('ix_individual_files_name'), 'individual_files', ['name'], unique=False)

    # Create conversion_jobs table (orchestrates conversion process)
    op.create_table('conversion_jobs',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('name', sa.String(), nullable=False),
        sa.Column('conversion_file_id', sa.Integer(), nullable=False),
        sa.Column('status', conversionjobstatus_enum, nullable=True, default='pending'),
        sa.Column('error_message', sa.Text(), nullable=True),
        sa.Column('progress', sa.Integer(), nullable=True, default=0),
        sa.Column('total_files', sa.Integer(), nullable=True, default=0),
        sa.Column('processed_files', sa.Integer(), nullable=True, default=0),
        sa.Column('created_by', sa.Integer(), nullable=False),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=True),
        sa.Column('updated_at', sa.DateTime(timezone=True), nullable=True),
        sa.ForeignKeyConstraint(['conversion_file_id'], ['conversion_files.id'], ),
        sa.ForeignKeyConstraint(['created_by'], ['users.id'], ),
        sa.PrimaryKeyConstraint('id')
    )
    op.create_index(op.f('ix_conversion_jobs_id'), 'conversion_jobs', ['id'], unique=False)
    op.create_index(op.f('ix_conversion_jobs_name'), 'conversion_jobs', ['name'], unique=False)

    # Create conversion_job_files table (many-to-many: job <-> individual files)
    op.create_table('conversion_job_files',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('job_id', sa.Integer(), nullable=False),
        sa.Column('individual_file_id', sa.Integer(), nullable=False),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=True),
        sa.ForeignKeyConstraint(['job_id'], ['conversion_jobs.id'], ondelete='CASCADE'),
        sa.ForeignKeyConstraint(['individual_file_id'], ['individual_files.id'], ondelete='CASCADE'),
        sa.PrimaryKeyConstraint('id'),
        sa.UniqueConstraint('job_id', 'individual_file_id', name='unique_job_individual_file')
    )
    op.create_index(op.f('ix_conversion_job_files_id'), 'conversion_job_files', ['id'], unique=False)

    # Create result_groups table (groups contain result files: individual_file_name + date)
    op.create_table('result_groups',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('name', sa.String(), nullable=False),  # individual_file_name + date
        sa.Column('job_id', sa.Integer(), nullable=False),
        sa.Column('individual_file_id', sa.Integer(), nullable=False),
        sa.Column('is_active', sa.Boolean(), nullable=True, default=True),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=True),
        sa.ForeignKeyConstraint(['job_id'], ['conversion_jobs.id'], ondelete='CASCADE'),
        sa.ForeignKeyConstraint(['individual_file_id'], ['individual_files.id'], ),
        sa.PrimaryKeyConstraint('id')
    )
    op.create_index(op.f('ix_result_groups_id'), 'result_groups', ['id'], unique=False)
    op.create_index(op.f('ix_result_groups_name'), 'result_groups', ['name'], unique=False)

    # Create result_files table (individual result files within groups)
    op.create_table('result_files',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('name', sa.String(), nullable=False),  # column name or description
        sa.Column('filename', sa.String(), nullable=False),
        sa.Column('file_path', sa.String(), nullable=False),
        sa.Column('file_size', sa.Integer(), nullable=True),
        sa.Column('group_id', sa.Integer(), nullable=False),
        sa.Column('is_active', sa.Boolean(), nullable=True, default=True),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=True),
        sa.ForeignKeyConstraint(['group_id'], ['result_groups.id'], ondelete='CASCADE'),
        sa.PrimaryKeyConstraint('id')
    )
    op.create_index(op.f('ix_result_files_id'), 'result_files', ['id'], unique=False)
    op.create_index(op.f('ix_result_files_name'), 'result_files', ['name'], unique=False)


def downgrade() -> None:
    # Drop tables in reverse dependency order to respect foreign key constraints
    op.drop_index(op.f('ix_result_files_name'), table_name='result_files')
    op.drop_index(op.f('ix_result_files_id'), table_name='result_files')
    op.drop_table('result_files')

    op.drop_index(op.f('ix_result_groups_name'), table_name='result_groups')
    op.drop_index(op.f('ix_result_groups_id'), table_name='result_groups')
    op.drop_table('result_groups')

    op.drop_index(op.f('ix_conversion_job_files_id'), table_name='conversion_job_files')
    op.drop_table('conversion_job_files')

    op.drop_index(op.f('ix_conversion_jobs_name'), table_name='conversion_jobs')
    op.drop_index(op.f('ix_conversion_jobs_id'), table_name='conversion_jobs')
    op.drop_table('conversion_jobs')

    op.drop_index(op.f('ix_individual_files_name'), table_name='individual_files')
    op.drop_index(op.f('ix_individual_files_id'), table_name='individual_files')
    op.drop_table('individual_files')

    op.drop_index(op.f('ix_conversion_files_name'), table_name='conversion_files')
    op.drop_index(op.f('ix_conversion_files_id'), table_name='conversion_files')
    op.drop_table('conversion_files')

    # Drop enum type
    conversionjobstatus_enum = sa.Enum(name='conversionjobstatus')
    conversionjobstatus_enum.drop(op.get_bind())