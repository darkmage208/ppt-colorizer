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
        Returns list of column names, excluding the first 3 columns (SNP, Chr, Position).
        """
        with open(file_path, 'r', encoding='utf-8') as file:
            header = file.readline().strip()
            columns = header.split('\t')

            # Validate header format
            if len(columns) < 4 or columns[0] != 'SNP' or columns[1] != 'Name' or columns[2] != 'Chr' or columns[3] != 'Position':
                raise ValueError("Invalid individual file format. Expected header: SNP\tName\tChr\tPosition\t[OUTPUT1]\t[OUTPUT2]...")

            # Return output columns (skip first 4: SNP, Name, Chr, Position)
            return columns[4:]

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
        project_id: int = None,
        db_session = None
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
                # Generate output filename
                timestamp = datetime.now().strftime('%Y%m%d_%H%M%S')
                output_filename = f"{individual_name}_{output_col}_{timestamp}.txt"
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
                    name = parts[1].strip()
                    chromosome = parts[2].strip()
                    position = parts[3].strip()

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
                        col_index = 4 + i  # Skip first 4 columns
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
                        self._update_project_progress(project_id, processed_rows, total_rows, db_session)

            # Final progress update
            self._update_project_progress(project_id, processed_rows, total_rows, db_session)

        finally:
            # Close all output files
            for handle in output_file_handles.values():
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

    def _update_project_progress(self, project_id: int, processed: int, total: int, db_session):
        """Update project progress in database."""
        if db_session and project_id:
            from .models import RsidProject
            project = db_session.query(RsidProject).filter(RsidProject.id == project_id).first()
            if project:
                project.progress = int((processed / total) * 100) if total > 0 else 0
                db_session.commit()

    def process_project(
        self,
        project_id: int,
        conversion_file_path: str,
        individual_files: List[Dict[str, str]],  # List of {file_path, name}
        output_base_dir: str,
        db_session = None
    ) -> bool:
        """
        Process an entire RsID conversion project.

        Args:
            project_id: Project ID for progress tracking
            conversion_file_path: Path to conversion file (Name -> RsID mapping)
            individual_files: List of individual file information
            output_base_dir: Base directory for output files
            db_session: Database session for progress updates

        Returns:
            True if processing successful, False otherwise
        """
        try:
            # Update project status
            if db_session and project_id:
                from .models import RsidProject, RsidProjectStatus
                project = db_session.query(RsidProject).filter(RsidProject.id == project_id).first()
                if project:
                    project.status = RsidProjectStatus.PROCESSING
                    db_session.commit()

            # Parse conversion file
            conversion_mapping = self._parse_conversion_file(conversion_file_path)

            if not conversion_mapping:
                raise ValueError("No valid RsID mappings found in conversion file")

            # Process each individual file
            all_output_groups = []

            for individual_file in individual_files:
                file_path = individual_file['file_path']
                file_name = individual_file['name']

                # Parse individual file header to get output columns
                output_columns = self._parse_individual_file_header(file_path)

                if not output_columns:
                    continue

                # Create output directory for this individual
                individual_output_dir = os.path.join(output_base_dir, f"individual_{file_name}")

                # Process individual file
                output_files_info = self._process_individual_file(
                    file_path,
                    conversion_mapping,
                    output_columns,
                    individual_output_dir,
                    file_name,
                    project_id,
                    db_session
                )

                all_output_groups.append({
                    'individual_name': file_name,
                    'output_files': output_files_info
                })

            # Update project status to completed
            if db_session and project_id:
                project = db_session.query(RsidProject).filter(RsidProject.id == project_id).first()
                if project:
                    project.status = RsidProjectStatus.COMPLETED
                    project.progress = 100
                    db_session.commit()

            return True, all_output_groups

        except Exception as e:
            # Update project status to error
            if db_session and project_id:
                from .models import RsidProject, RsidProjectStatus
                project = db_session.query(RsidProject).filter(RsidProject.id == project_id).first()
                if project:
                    project.status = RsidProjectStatus.ERROR
                    project.error_message = str(e)
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

                if len(columns) < 5:  # SNP, Name, Chr, Position + at least 1 output column
                    result['error'] = "Invalid header format. Expected: SNP\\tName\\tChr\\tPosition\\t[OUTPUT1]..."
                    return result

                if columns[0] != 'SNP' or columns[1] != 'Name' or columns[2] != 'Chr' or columns[3] != 'Position':
                    result['error'] = "Invalid header format. Expected: SNP\\tName\\tChr\\tPosition\\t[OUTPUT1]..."
                    return result

                # Extract output columns
                result['output_columns'] = columns[4:]

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