#!/usr/bin/env python3
"""
Update user processing counts based on completed jobs

This script analyzes the job history and updates each user's processing_count
field to reflect the actual number of successfully completed jobs.

Usage:
    # From VPS, copy to container and run:
    docker compose -f docker-compose.prod.yml cp update_processing_counts.py backend:/app/
    docker compose -f docker-compose.prod.yml exec backend python /app/update_processing_counts.py

    # Or run directly in container:
    docker compose -f docker-compose.prod.yml exec backend python -c "exec(open('/app/update_processing_counts.py').read())"
"""

import sys
import os

# Add the app directory to Python path
sys.path.append('/app')

try:
    from app.database import SessionLocal
    from app.models import User, Job, JobStatus
    from sqlalchemy import func
except ImportError as e:
    print(f"Error importing modules: {e}")
    print("Make sure this script is run from within the backend container")
    sys.exit(1)


def analyze_current_state():
    """Analyze current processing counts and job history"""
    db = SessionLocal()

    try:
        print("=" * 50)
        print("CURRENT STATE ANALYSIS")
        print("=" * 50)

        # Current user processing counts
        users = db.query(User).all()
        print(f"\n📊 Current Processing Counts:")
        for user in users:
            print(f"   {user.username} (ID: {user.id}): {user.processing_count}")

        # Job statistics by status
        print(f"\n📈 Job Statistics by Status:")
        status_counts = db.query(
            Job.status,
            func.count(Job.id).label('count')
        ).group_by(Job.status).all()

        total_jobs = 0
        for status, count in status_counts:
            print(f"   {status.value}: {count} jobs")
            total_jobs += count

        print(f"   TOTAL: {total_jobs} jobs")

        # Completed jobs per user
        print(f"\n✅ Completed Jobs Per User:")
        job_counts = db.query(
            Job.user_id,
            User.username,
            func.count(Job.id).label('completed_jobs')
        ).join(User).filter(
            Job.status == JobStatus.DONE
        ).group_by(Job.user_id, User.username).all()

        if not job_counts:
            print("   No completed jobs found")
            return {}

        completed_counts = {}
        for user_id, username, count in job_counts:
            print(f"   {username} (ID: {user_id}): {count} completed jobs")
            completed_counts[user_id] = count

        return completed_counts

    finally:
        db.close()


def update_processing_counts(dry_run=False):
    """Update user processing counts based on completed jobs"""
    db = SessionLocal()

    try:
        print("\n" + "=" * 50)
        if dry_run:
            print("DRY RUN - PROPOSED CHANGES")
        else:
            print("UPDATING PROCESSING COUNTS")
        print("=" * 50)

        # Get actual completed job counts per user
        job_counts = db.query(
            Job.user_id,
            func.count(Job.id).label('completed_jobs')
        ).filter(
            Job.status == JobStatus.DONE
        ).group_by(Job.user_id).all()

        completed_counts = {user_id: count for user_id, count in job_counts}

        # Update all users
        users = db.query(User).all()
        updates = 0
        changes = []

        for user in users:
            actual_count = completed_counts.get(user.id, 0)
            old_count = user.processing_count or 0

            if old_count != actual_count:
                change_info = {
                    'username': user.username,
                    'user_id': user.id,
                    'old_count': old_count,
                    'new_count': actual_count,
                    'difference': actual_count - old_count
                }
                changes.append(change_info)

                if not dry_run:
                    user.processing_count = actual_count

                updates += 1

                status = "📝 WOULD UPDATE" if dry_run else "✅ UPDATED"
                print(f"   {status} {user.username}: {old_count} → {actual_count} ({actual_count - old_count:+d})")
            else:
                print(f"   ✓ {user.username}: {actual_count} (no change needed)")

        if not dry_run and updates > 0:
            db.commit()
            print(f"\n🎉 Successfully updated {updates} users!")
        elif dry_run:
            print(f"\n📋 Would update {updates} users")
        else:
            print(f"\n✓ All processing counts are already accurate")

        return changes

    except Exception as e:
        print(f"\n❌ Error during update: {e}")
        if not dry_run:
            db.rollback()
        raise
    finally:
        db.close()


def verify_updates():
    """Verify that updates were applied correctly"""
    db = SessionLocal()

    try:
        print("\n" + "=" * 50)
        print("VERIFICATION - FINAL STATE")
        print("=" * 50)

        users = db.query(User).all()
        print(f"\n✅ Final Processing Counts:")

        total_processed = 0
        for user in users:
            count = user.processing_count or 0
            print(f"   {user.username}: {count} files processed")
            total_processed += count

        print(f"\n📊 Total files processed across all users: {total_processed}")

        # Cross-check with actual completed jobs
        total_completed_jobs = db.query(func.count(Job.id)).filter(
            Job.status == JobStatus.DONE
        ).scalar()

        print(f"📊 Total completed jobs in database: {total_completed_jobs}")

        if total_processed == total_completed_jobs:
            print("✅ Counts match perfectly!")
        else:
            print(f"⚠️  Mismatch detected: {total_processed} vs {total_completed_jobs}")

    finally:
        db.close()


def show_recent_activity():
    """Show recent job activity"""
    db = SessionLocal()

    try:
        print(f"\n📅 Recent Activity (Last 10 Jobs):")

        recent_jobs = db.query(Job).join(User).order_by(
            Job.created_at.desc()
        ).limit(10).all()

        if not recent_jobs:
            print("   No jobs found")
            return

        for job in recent_jobs:
            date_str = job.created_at.strftime("%Y-%m-%d %H:%M")
            print(f"   {date_str} - {job.user.username} - {job.status.value}")

    finally:
        db.close()


def main():
    """Main execution function"""
    print("🔄 PROCESSING COUNT UPDATE TOOL")
    print("This tool will update user processing counts based on job history\n")

    try:
        # Step 1: Analyze current state
        completed_counts = analyze_current_state()

        # Step 2: Show recent activity
        show_recent_activity()

        # Step 3: Dry run to show proposed changes
        changes = update_processing_counts(dry_run=True)

        if not changes:
            print("\n✅ All processing counts are already accurate. No updates needed.")
            return

        # Step 4: Ask for confirmation (or proceed automatically)
        print(f"\n🤔 Proceed with updating {len(changes)} users? (y/N): ", end="")

        # For automated execution, uncomment the next line:
        # response = "y"

        # For interactive execution:
        try:
            response = input().strip().lower()
        except (EOFError, KeyboardInterrupt):
            response = "n"

        if response in ['y', 'yes']:
            # Step 5: Perform actual update
            update_processing_counts(dry_run=False)

            # Step 6: Verify results
            verify_updates()

            print(f"\n🎉 Processing count update completed successfully!")
            print(f"💡 You can now check the admin panel to see updated counts.")
        else:
            print(f"\n❌ Update cancelled by user")

    except Exception as e:
        print(f"\n💥 Fatal error: {e}")
        import traceback
        traceback.print_exc()
        sys.exit(1)


if __name__ == '__main__':
    main()