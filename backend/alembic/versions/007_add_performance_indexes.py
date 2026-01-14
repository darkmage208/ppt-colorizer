"""Add performance indexes for job queries

Revision ID: 007_add_performance_indexes
Revises: 006
Create Date: 2025-01-14 00:00:00.000000

"""
from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision = '007'
down_revision = '006'
branch_labels = None
depends_on = None


def upgrade() -> None:
    # Add indexes for jobs table - critical for performance with large datasets
    op.create_index('ix_jobs_user_id', 'jobs', ['user_id'], unique=False)
    op.create_index('ix_jobs_status', 'jobs', ['status'], unique=False)
    op.create_index('ix_jobs_created_at', 'jobs', ['created_at'], unique=False)
    op.create_index('ix_jobs_template_id', 'jobs', ['template_id'], unique=False)
    op.create_index('ix_jobs_excel_data_id', 'jobs', ['excel_data_id'], unique=False)

    # Composite index for common query patterns (user filtering + sorting)
    op.create_index('ix_jobs_user_created', 'jobs', ['user_id', 'created_at'], unique=False)
    op.create_index('ix_jobs_status_created', 'jobs', ['status', 'created_at'], unique=False)

    # Add indexes for job_permissions table
    op.create_index('ix_job_permissions_user_id', 'job_permissions', ['user_id'], unique=False)
    op.create_index('ix_job_permissions_job_id', 'job_permissions', ['job_id'], unique=False)

    # Add indexes for templates table
    op.create_index('ix_templates_is_active', 'templates', ['is_active'], unique=False)
    op.create_index('ix_templates_uploaded_by', 'templates', ['uploaded_by'], unique=False)

    # Add indexes for excel_data table
    op.create_index('ix_excel_data_is_active', 'excel_data', ['is_active'], unique=False)
    op.create_index('ix_excel_data_uploaded_by', 'excel_data', ['uploaded_by'], unique=False)

    # Add indexes for vcf_files table
    op.create_index('ix_vcf_files_is_active', 'vcf_files', ['is_active'], unique=False)
    op.create_index('ix_vcf_files_uploaded_by', 'vcf_files', ['uploaded_by'], unique=False)

    # Add indexes for vcf_conversions table
    op.create_index('ix_vcf_conversions_user_id', 'vcf_conversions', ['user_id'], unique=False)
    op.create_index('ix_vcf_conversions_status', 'vcf_conversions', ['status'], unique=False)


def downgrade() -> None:
    # Drop indexes in reverse order
    op.drop_index('ix_vcf_conversions_status', table_name='vcf_conversions')
    op.drop_index('ix_vcf_conversions_user_id', table_name='vcf_conversions')

    op.drop_index('ix_vcf_files_uploaded_by', table_name='vcf_files')
    op.drop_index('ix_vcf_files_is_active', table_name='vcf_files')

    op.drop_index('ix_excel_data_uploaded_by', table_name='excel_data')
    op.drop_index('ix_excel_data_is_active', table_name='excel_data')

    op.drop_index('ix_templates_uploaded_by', table_name='templates')
    op.drop_index('ix_templates_is_active', table_name='templates')

    op.drop_index('ix_job_permissions_job_id', table_name='job_permissions')
    op.drop_index('ix_job_permissions_user_id', table_name='job_permissions')

    op.drop_index('ix_jobs_status_created', table_name='jobs')
    op.drop_index('ix_jobs_user_created', table_name='jobs')
    op.drop_index('ix_jobs_excel_data_id', table_name='jobs')
    op.drop_index('ix_jobs_template_id', table_name='jobs')
    op.drop_index('ix_jobs_created_at', table_name='jobs')
    op.drop_index('ix_jobs_status', table_name='jobs')
    op.drop_index('ix_jobs_user_id', table_name='jobs')
