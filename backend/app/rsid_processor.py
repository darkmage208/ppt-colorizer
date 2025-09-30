import os
import csv
from typing import Dict, List, Optional, TextIO, Set, Tuple
from datetime import datetime
import re
import gc  # For garbage collection to manage memory


class RsidProcessor:
    """
    RsID conversion processor that processes conversion files and individual files
    to generate output files based on RsID mapping.
    Handles large files using streaming processing to minimize memory usage.
    """

    def __init__(self):
        self.BUFFER_SIZE = 8192  # 8KB buffer for file reading
        self.PROGRESS_UPDATE_INTERVAL = 1000  # Update progress every 1000 rows for better performance
        self.CHUNK_SIZE = 10000  # Process files in chunks to manage memory

    def _parse_conversion_file(self, file_path: str) -> Dict[str, str]:
        """
        Parse the conversion file and create a mapping from Name to RsID.
        Returns a dictionary where key=Name and value=RsID.
        Skips entries where RsID is '.' (empty).
        Uses memory-efficient processing for large conversion files (300k+ rows).
        """
        name_to_rsid = {}
        processed_lines = 0

        with open(file_path, 'r', encoding='utf-8') as file:
            # Read header line
            header = file.readline().strip()
            if not header.startswith('Name'):
                raise ValueError("Invalid conversion file format. Expected header: Name\tRsID")

            # Process data lines in chunks for memory efficiency
            chunk_buffer = []

            for line in file:
                line = line.strip()
                if not line:
                    continue

                chunk_buffer.append(line)

                # Process chunk when buffer is full
                if len(chunk_buffer) >= self.CHUNK_SIZE:
                    self._process_conversion_chunk(chunk_buffer, name_to_rsid)
                    processed_lines += len(chunk_buffer)
                    chunk_buffer = []

                    # Trigger garbage collection periodically for large files
                    if processed_lines % (self.CHUNK_SIZE * 10) == 0:
                        gc.collect()

            # Process remaining lines in buffer
            if chunk_buffer:
                self._process_conversion_chunk(chunk_buffer, name_to_rsid)

        return name_to_rsid

    def _process_conversion_chunk(self, chunk_buffer: List[str], name_to_rsid: Dict[str, str]) -> None:
        """
        Process a chunk of conversion file lines.
        """
        for line in chunk_buffer:
            parts = line.split('\t')
            if len(parts) != 2:
                continue

            name, rsid = parts[0].strip(), parts[1].strip()

            # Skip entries with empty RsID (marked as '.')
            if rsid != '.' and rsid:
                name_to_rsid[name] = rsid

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

    def _is_rsid_format(self, snp_name: str) -> bool:
        """
        Check if SNP name is already in rs000 format.
        Returns True if the name starts with 'rs' followed by numbers.
        """
        return bool(re.match(r'^rs\d+$', snp_name.strip()))

    def _extract_rs_number(self, rsid: str) -> int:
        """
        Extract numeric part from rsID for sorting.
        Example: "rs123456" -> 123456
        """
        match = re.match(r'^rs(\d+)$', rsid.strip())
        return int(match.group(1)) if match else 0

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
        Process a single individual file with optimized workflow.
        New logic:
        1. Check if SNP Name is already in rs000 format first
        2. Only look up conversion if not in rs format
        3. Collect unique RSID/CHROMOSOME/POSITION combinations
        4. Sort by rs number before output
        5. Memory-efficient processing with chunking
        """
        output_files_info = []

        # Create output directory
        os.makedirs(output_dir, exist_ok=True)

        # Dictionary to store unique combinations: {(rsid, chromosome, position): {output_col: result}}
        unique_combinations = {}
        processed_rows = 0
        total_rows = self._count_file_lines(individual_file_path) - 1  # Exclude header

        try:
            with open(individual_file_path, 'r', encoding='utf-8') as file:
                # Read header
                header = file.readline().strip()
                columns = header.split('\t')

                # Process file in chunks for memory efficiency
                chunk_buffer = []

                for line in file:
                    line = line.strip()
                    if not line:
                        continue

                    chunk_buffer.append(line)

                    # Process chunk when buffer is full
                    if len(chunk_buffer) >= self.CHUNK_SIZE:
                        processed_rows += len(chunk_buffer)
                        self._process_chunk(chunk_buffer, columns, conversion_mapping, output_columns, unique_combinations)
                        chunk_buffer = []

                        # Trigger garbage collection to free memory
                        gc.collect()

                        # Update progress
                        if processed_rows % self.PROGRESS_UPDATE_INTERVAL == 0:
                            file_progress = (processed_rows / total_rows) * 100 if total_rows > 0 else 100
                            self._update_job_progress(job_id, current_file_index, total_files, file_progress, db_session)

                # Process remaining rows in buffer
                if chunk_buffer:
                    self._process_chunk(chunk_buffer, columns, conversion_mapping, output_columns, unique_combinations)
                    processed_rows += len(chunk_buffer)

            # Generate sorted output files for each output column
            for output_col in output_columns:
                output_filename = f"{individual_name}_{output_col}_{datetime.now().strftime('%Y%m%d%H%M%S')}.txt"
                output_file_path = os.path.join(output_dir, output_filename)

                self._write_sorted_output_file(unique_combinations, output_col, output_file_path)

                # Store file info
                output_files_info.append({
                    'name': output_col,
                    'filename': output_filename,
                    'file_path': output_file_path,
                    'file_size': os.path.getsize(output_file_path) if os.path.exists(output_file_path) else 0
                })

            # Final progress update for this file
            self._update_job_progress(job_id, current_file_index, total_files, 100, db_session)

        except Exception as e:
            print(f"Error processing individual file {individual_file_path}: {str(e)}")
            raise

        return output_files_info

    def _process_chunk(
        self,
        chunk_buffer: List[str],
        columns: List[str],
        conversion_mapping: Dict[str, str],
        output_columns: List[str],
        unique_combinations: Dict[Tuple[str, str, str], Dict[str, str]]
    ) -> None:
        """
        Process a chunk of rows and update unique_combinations dictionary.
        """
        for line in chunk_buffer:
            parts = line.split('\t')
            if len(parts) < len(columns):
                continue

            # Extract basic information
            snp_name = parts[0].strip()
            chromosome = parts[1].strip()
            position = parts[2].strip()

            # Step 1: Check if SNP Name is already in rs000 format
            if self._is_rsid_format(snp_name):
                rsids = [snp_name]
            else:
                # Step 2: Look up RsID in conversion mapping
                rsid_str = conversion_mapping.get(snp_name)
                if not rsid_str:
                    continue  # Skip if not found

                # Split RsIDs if multiple
                rsids = self._split_rsids(rsid_str)
                if not rsids:
                    continue

            # Process each output column for this row
            for i, output_col in enumerate(output_columns):
                col_index = 3 + i  # Skip first 3 columns (SNP Name, Chr, Position)
                if col_index >= len(parts):
                    continue

                result = parts[col_index].strip()

                # Skip if result is '--'
                if result == '--':
                    continue

                # Step 3: Store unique combinations (avoid duplicates)
                for rsid in rsids:
                    key = (rsid, chromosome, position)
                    if key not in unique_combinations:
                        unique_combinations[key] = {}

                    # Only store the result if not already present (RSID/CHROMOSOME/POSITION are the same)
                    if output_col not in unique_combinations[key]:
                        unique_combinations[key][output_col] = result

    def _write_sorted_output_file(
        self,
        unique_combinations: Dict[Tuple[str, str, str], Dict[str, str]],
        output_col: str,
        output_file_path: str
    ) -> None:
        """
        Write sorted output file for a specific output column.
        Step 4: Sort by rs number in ascending order.
        """
        # Collect rows for this output column
        rows_to_write = []

        for (rsid, chromosome, position), results in unique_combinations.items():
            if output_col in results:
                rows_to_write.append((rsid, chromosome, position, results[output_col]))

        # Step 4: Sort by rs number (extract numeric part)
        rows_to_write.sort(key=lambda row: self._extract_rs_number(row[0]))

        # Write to file
        with open(output_file_path, 'w', encoding='utf-8', newline='') as file:
            writer = csv.writer(file, delimiter='\t')

            # Write header
            writer.writerow(['RSID', 'CHROMOSOME', 'POSITION', 'RESULT'])

            # Write sorted data
            for row in rows_to_write:
                writer.writerow(row)

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