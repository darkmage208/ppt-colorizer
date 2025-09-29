import os
import csv
from typing import Dict, List, Optional, TextIO
from datetime import datetime
import re


class RsidProcessor:
    """
    RsID conversion processor that processes conversion files and individual files
    to generate output files based on RsID mapping.
    Handles large files using streaming processing to minimize memory usage.
    """

    def __init__(self):
        self.BUFFER_SIZE = 8192  # 8KB buffer for file reading
        self.PROGRESS_UPDATE_INTERVAL = 100  # Update progress every 100 rows

    def _parse_conversion_file(self, file_path: str) -> Dict[str, str]:
        """
        Parse the conversion file and create a mapping from Name to RsID.
        Returns a dictionary where key=Name and value=RsID.
        Skips entries where RsID is '.' (empty).
        """
        name_to_rsid = {}

        with open(file_path, 'r', encoding='utf-8') as file:
            # Read header line
            header = file.readline().strip()
            if not header.startswith('Name'):
                raise ValueError("Invalid conversion file format. Expected header: Name\tRsID")

            # Process data lines
            for line_num, line in enumerate(file, start=2):
                line = line.strip()
                if not line:
                    continue

                parts = line.split('\t')
                if len(parts) != 2:
                    continue

                name, rsid = parts[0].strip(), parts[1].strip()

                # Skip entries with empty RsID (marked as '.')
                if rsid != '.' and rsid:
                    name_to_rsid[name] = rsid

        return name_to_rsid

    def _parse_individual_file_header(self, file_path: str) -> List[str]:
        """
        Parse the header of an individual file to get column names.
        Returns list of column names, excluding the first 3 columns (SNP Name, Chr, Position).
        """
        with open(file_path, 'r', encoding='utf-8') as file:
            header = file.readline().strip()
            columns = header.split('\t')

            # Validate header format
            if len(columns) < 4 or columns[0] != 'SNP Name' or columns[1] != 'Chr' or columns[2] != 'Position':
                raise ValueError("Invalid individual file format. Expected header: SNP Name\tChr\tPosition\t[OUTPUT1]\t[OUTPUT2]...")

            # Return output columns (skip first 3: SNP Name, Chr, Position)
            return columns[3:]

    def _split_rsids(self, rsid_str: str) -> List[str]:
        """
        Split comma-separated RsIDs into individual RsIDs.
        Example: "rs143920251,rs58904273,rs74330144" -> ["rs143920251", "rs58904273", "rs74330144"]
        """
        if not rsid_str or rsid_str == '.':
            return []

        # Split by comma and clean each RsID
        rsids = [rsid.strip() for rsid in rsid_str.split(',')]
        return [rsid for rsid in rsids if rsid and rsid != '.']

    def _process_individual_file(
        self,
        individual_file_path: str,
        conversion_mapping: Dict[str, str],
        output_columns: List[str],
        output_dir: str,
        individual_name: str,
        job_id: int = None,
        db_session = None,
        current_file_index: int = 0,
        total_files: int = 1
    ) -> List[Dict[str, str]]:
        """
        Process a single individual file and generate output files for each output column.
        Returns list of output file information.
        """
        output_files_info = []

        # Create output directory
        os.makedirs(output_dir, exist_ok=True)

        # Create output file writers for each output column
        output_writers = {}
        output_file_handles = {}

        try:
            for output_col in output_columns:
                # Generate output filename using individualfilename+date+time format
                datetime_stamp = datetime.now().strftime('%Y%m%d%H%M%S')
                output_filename = f"{individual_name}_{output_col}_{datetime_stamp}.txt"
                output_file_path = os.path.join(output_dir, output_filename)

                # Open output file and create CSV writer
                output_file_handles[output_col] = open(output_file_path, 'w', encoding='utf-8', newline='')
                output_writers[output_col] = csv.writer(output_file_handles[output_col], delimiter='\t')

                # Write header
                output_writers[output_col].writerow(['RSID', 'CHROMOSOME', 'POSITION', 'RESULT'])

                # Store file info
                output_files_info.append({
                    'name': output_col,
                    'filename': output_filename,
                    'file_path': output_file_path
                })

            # Process individual file
            processed_rows = 0
            total_rows = self._count_file_lines(individual_file_path) - 1  # Exclude header

            with open(individual_file_path, 'r', encoding='utf-8') as file:
                # Skip header
                header = file.readline()
                columns = header.strip().split('\t')

                # Process each data row
                for line in file:
                    line = line.strip()
                    if not line:
                        continue

                    parts = line.split('\t')
                    if len(parts) < len(columns):
                        continue

                    # Extract basic information
                    snp_name = parts[0].strip()
                    name = parts[0].strip()  # SNP Name is the same column
                    chromosome = parts[1].strip()
                    position = parts[2].strip()

                    # Look up RsID in conversion mapping
                    rsid_str = conversion_mapping.get(name)
                    if not rsid_str:
                        continue

                    # Split RsIDs if multiple
                    rsids = self._split_rsids(rsid_str)
                    if not rsids:
                        continue

                    # Process each output column
                    for i, output_col in enumerate(output_columns):
                        col_index = 3 + i  # Skip first 3 columns (SNP Name, Chr, Position)
                        if col_index >= len(parts):
                            continue

                        result = parts[col_index].strip()

                        # Skip if result is '--'
                        if result == '--':
                            continue

                        # Write row for each RsID
                        for rsid in rsids:
                            output_writers[output_col].writerow([rsid, chromosome, position, result])

                    processed_rows += 1

                    # Update progress
                    if processed_rows % self.PROGRESS_UPDATE_INTERVAL == 0:
                        file_progress = (processed_rows / total_rows) * 100 if total_rows > 0 else 100
                        self._update_job_progress(job_id, current_file_index, total_files, file_progress, db_session)

            # Final progress update for this file
            file_progress = 100  # File is complete
            self._update_job_progress(job_id, current_file_index, total_files, file_progress, db_session)

        finally:
            # Flush and close all output files
            for handle in output_file_handles.values():
                handle.flush()
                handle.close()

        # Update file sizes
        for file_info in output_files_info:
            if os.path.exists(file_info['file_path']):
                file_info['file_size'] = os.path.getsize(file_info['file_path'])
            else:
                file_info['file_size'] = 0

        return output_files_info

    def _count_file_lines(self, file_path: str) -> int:
        """Count total lines in a file for progress tracking."""
        count = 0
        with open(file_path, 'r', encoding='utf-8') as file:
            for line in file:
                count += 1
        return count

    def _update_job_progress(self, job_id: int, current_file_index: int, total_files: int, file_progress: float, db_session):
        """Update job progress in database based on overall job progress."""
        if db_session and job_id:
            from .models import ConversionJob
            job = db_session.query(ConversionJob).filter(ConversionJob.id == job_id).first()
            if job:
                # Calculate overall progress: completed files + current file progress
                completed_files_progress = (current_file_index / total_files) * 100
                current_file_contribution = (file_progress / total_files)
                overall_progress = completed_files_progress + current_file_contribution

                job.progress = int(min(100, max(0, overall_progress)))
                db_session.commit()

    def process_job(
        self,
        job_id: int,
        conversion_file_path: str,
        individual_files: List[Dict[str, str]],  # List of {id, file_path, name}
        output_base_dir: str,
        db_session = None
    ) -> bool:
        """
        Process an entire conversion job.

        Args:
            job_id: Job ID for progress tracking
            conversion_file_path: Path to conversion file (Name -> RsID mapping)
            individual_files: List of individual file information
            output_base_dir: Base directory for output files
            db_session: Database session for progress updates

        Returns:
            True if processing successful, False otherwise
        """
        try:
            # Update job status
            if db_session and job_id:
                from .models import ConversionJob, ConversionJobStatus
                job = db_session.query(ConversionJob).filter(ConversionJob.id == job_id).first()
                if job:
                    job.status = ConversionJobStatus.PROCESSING
                    db_session.commit()

            # Parse conversion file
            conversion_mapping = self._parse_conversion_file(conversion_file_path)

            if not conversion_mapping:
                raise ValueError("No valid RsID mappings found in conversion file")

            # Process each individual file
            all_result_groups = []
            total_individual_files = len(individual_files)

            for file_index, individual_file in enumerate(individual_files):
                file_id = individual_file['id']
                file_path = individual_file['file_path']
                file_name = individual_file['name']

                # Parse individual file header to get output columns
                output_columns = self._parse_individual_file_header(file_path)

                if not output_columns:
                    continue

                # Create output directory for this group using individualfilename+date+time format
                current_datetime = datetime.now().strftime("%Y%m%d%H%M%S")
                group_name = f"{file_name}_{current_datetime}"
                individual_output_dir = os.path.join(output_base_dir, group_name)

                # Process individual file
                result_files_info = self._process_individual_file(
                    file_path,
                    conversion_mapping,
                    output_columns,
                    individual_output_dir,
                    file_name,
                    job_id,
                    db_session,
                    file_index,
                    total_individual_files
                )

                all_result_groups.append({
                    'individual_file_id': file_id,
                    'individual_name': file_name,
                    'result_files': result_files_info
                })

            # Update job status to completed
            if db_session and job_id:
                job = db_session.query(ConversionJob).filter(ConversionJob.id == job_id).first()
                if job:
                    job.status = ConversionJobStatus.COMPLETED
                    job.progress = 100
                    db_session.commit()

            return True, all_result_groups

        except Exception as e:
            # Update job status to error
            if db_session and job_id:
                from .models import ConversionJob, ConversionJobStatus
                job = db_session.query(ConversionJob).filter(ConversionJob.id == job_id).first()
                if job:
                    job.status = ConversionJobStatus.ERROR
                    job.error_message = str(e)
                    db_session.commit()

            print(f"Error during RsID conversion: {str(e)}")
            return False, []

    def validate_conversion_file(self, file_path: str) -> Dict[str, any]:
        """
        Validate conversion file format and return statistics.

        Returns:
            Dictionary with validation results and file statistics
        """
        result = {
            'valid': False,
            'error': None,
            'total_lines': 0,
            'valid_mappings': 0,
            'empty_rsids': 0,
            'file_size': 0
        }

        try:
            if os.path.exists(file_path):
                result['file_size'] = os.path.getsize(file_path)

            with open(file_path, 'r', encoding='utf-8') as file:
                # Check header
                header = file.readline().strip()
                result['total_lines'] += 1

                if not header.startswith('Name\tRsID'):
                    result['error'] = "Invalid header format. Expected: Name\\tRsID"
                    return result

                # Process data lines
                for line in file:
                    result['total_lines'] += 1
                    line = line.strip()

                    if not line:
                        continue

                    parts = line.split('\t')
                    if len(parts) != 2:
                        continue

                    name, rsid = parts[0].strip(), parts[1].strip()

                    if rsid == '.' or not rsid:
                        result['empty_rsids'] += 1
                    else:
                        result['valid_mappings'] += 1

            result['valid'] = result['valid_mappings'] > 0
            if result['valid_mappings'] == 0:
                result['error'] = "No valid RsID mappings found"

        except Exception as e:
            result['error'] = str(e)

        return result

    def validate_individual_file(self, file_path: str) -> Dict[str, any]:
        """
        Validate individual file format and return statistics.

        Returns:
            Dictionary with validation results and file statistics
        """
        result = {
            'valid': False,
            'error': None,
            'total_lines': 0,
            'output_columns': [],
            'file_size': 0
        }

        try:
            if os.path.exists(file_path):
                result['file_size'] = os.path.getsize(file_path)

            with open(file_path, 'r', encoding='utf-8') as file:
                # Check header
                header = file.readline().strip()
                result['total_lines'] += 1

                if not header:
                    result['error'] = "Empty file"
                    return result

                columns = header.split('\t')

                if len(columns) < 4:  # SNP Name, Chr, Position + at least 1 output column
                    result['error'] = "Invalid header format. Expected: SNP Name\\tChr\\tPosition\\t[OUTPUT1]..."
                    return result

                if columns[0] != 'SNP Name' or columns[1] != 'Chr' or columns[2] != 'Position':
                    result['error'] = "Invalid header format. Expected: SNP Name\\tChr\\tPosition\\t[OUTPUT1]..."
                    return result

                # Extract output columns
                result['output_columns'] = columns[3:]

                # Count data lines
                for line in file:
                    line = line.strip()
                    if line:
                        result['total_lines'] += 1

            result['valid'] = len(result['output_columns']) > 0 and result['total_lines'] > 1
            if not result['valid'] and not result['error']:
                result['error'] = "No valid data found in file"

        except Exception as e:
            result['error'] = str(e)

        return result