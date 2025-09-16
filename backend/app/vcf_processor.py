import gzip
import re
from typing import Dict, Optional, TextIO
import os


class VcfProcessor:
    """
    VCF file processor that converts VCF files to TXT format with memory-efficient streaming.
    Handles large files by processing line by line to minimize RAM usage.
    """

    def __init__(self):
        self.BUFFER_SIZE = 8192  # 8KB buffer for file reading

    def _open_file(self, file_path: str) -> TextIO:
        """
        Open VCF file, handling both compressed (.vcf.gz) and uncompressed (.vcf) files.
        """
        if file_path.endswith('.gz'):
            return gzip.open(file_path, 'rt', encoding='utf-8')
        else:
            return open(file_path, 'r', encoding='utf-8')

    def _parse_vcf_line(self, line: str) -> Optional[Dict[str, str]]:
        """
        Parse a single VCF data line and extract relevant information.
        Returns None for header lines or invalid data lines.
        """
        line = line.strip()

        # Skip header lines
        if line.startswith('#') or not line:
            return None

        # Split VCF line into columns
        fields = line.split('\t')

        # VCF format: CHROM POS ID REF ALT QUAL FILTER INFO FORMAT SAMPLE...
        if len(fields) < 10:
            return None

        chrom = fields[0]
        pos = fields[1]
        rsid = fields[2] if fields[2] != '.' else None
        ref = fields[3]
        alt = fields[4]
        format_field = fields[8] if len(fields) > 8 else ""
        sample_data = fields[9] if len(fields) > 9 else ""

        # Skip if no RS ID (we only process variants with RS IDs)
        if not rsid or not rsid.startswith('rs'):
            return None

        # Parse genotype from sample data
        genotype = self._extract_genotype(format_field, sample_data, ref, alt)

        if genotype is None:
            return None

        return {
            'rsid': rsid,
            'chromosome': chrom.replace('chr', ''),  # Remove 'chr' prefix if present
            'position': pos,
            'result': genotype
        }

    def _extract_genotype(self, format_field: str, sample_data: str, ref: str, alt: str) -> Optional[str]:
        """
        Extract genotype from FORMAT and sample data fields.
        Returns genotype in the format expected by the output (e.g., 'AA', 'AG', 'GG', 'DI', 'II').
        """
        if not format_field or not sample_data:
            return None

        # Split format and sample data
        format_fields = format_field.split(':')
        sample_values = sample_data.split(':')

        # Find GT (genotype) field
        try:
            gt_index = format_fields.index('GT')
            genotype_raw = sample_values[gt_index]
        except (ValueError, IndexError):
            return None

        # Parse genotype (e.g., '0/1', '1/1', '0|1')
        genotype_pattern = re.match(r'(\d+)[/|](\d+)', genotype_raw)
        if not genotype_pattern:
            return None

        allele1_idx = int(genotype_pattern.group(1))
        allele2_idx = int(genotype_pattern.group(2))

        # Create alleles list (0=REF, 1+=ALT)
        alleles = [ref] + alt.split(',')

        try:
            allele1 = alleles[allele1_idx]
            allele2 = alleles[allele2_idx]
        except IndexError:
            return None

        # Handle special cases for deletions/insertions
        if allele1 == '-' or allele2 == '-':
            # Handle deletions represented as '-'
            return 'DI'

        # Handle indels and complex variants based on length differences
        if len(allele1) > 1 or len(allele2) > 1:
            # For insertions/deletions, return 'DI' for deletion/insertion
            if len(allele1) != len(allele2):
                return 'DI'
            # For complex substitutions, return 'II'
            return 'II'

        # Sort alleles to ensure consistent output (A comes before G, etc.)
        genotype_alleles = sorted([allele1, allele2])

        return ''.join(genotype_alleles)

    def _count_variants(self, file_path: str) -> int:
        """
        Count total number of valid variants in the VCF file for progress tracking.
        """
        count = 0
        with self._open_file(file_path) as file:
            for line in file:
                line = line.strip()
                if not line.startswith('#') and line:
                    fields = line.split('\t')
                    if len(fields) >= 3 and fields[2] != '.' and fields[2].startswith('rs'):
                        count += 1
        return count

    def _update_progress(self, conversion_id: int, processed: int, total: int, db_session):
        """
        Update conversion progress in database.
        """
        if db_session and conversion_id:
            from .models import VcfConversion
            conversion = db_session.query(VcfConversion).filter(VcfConversion.id == conversion_id).first()
            if conversion:
                conversion.processed_variants = processed
                conversion.total_variants = total
                conversion.progress = int((processed / total) * 100) if total > 0 else 0
                db_session.commit()

    def convert_vcf_to_txt(
        self,
        vcf_file_path: str,
        output_file_path: str,
        conversion_id: Optional[int] = None,
        db_session = None
    ) -> bool:
        """
        Convert VCF file to TXT format with streaming processing.

        Args:
            vcf_file_path: Path to input VCF file
            output_file_path: Path to output TXT file
            conversion_id: Optional conversion ID for progress tracking
            db_session: Optional database session for progress updates

        Returns:
            True if conversion successful, False otherwise
        """
        try:
            # Count total variants for progress tracking
            if conversion_id and db_session:
                total_variants = self._count_variants(vcf_file_path)
                self._update_progress(conversion_id, 0, total_variants, db_session)

            processed_count = 0

            # Create output directory if it doesn't exist
            os.makedirs(os.path.dirname(output_file_path), exist_ok=True)

            with self._open_file(vcf_file_path) as vcf_file, \
                 open(output_file_path, 'w', encoding='utf-8') as txt_file:

                # Write header
                txt_file.write("RSID\tCHROMOSOME\tPOSITION\tRESULT\n")

                # Process VCF file line by line
                for line in vcf_file:
                    variant_data = self._parse_vcf_line(line)

                    if variant_data:
                        # Write variant to output file
                        txt_file.write(
                            f"{variant_data['rsid']}\t"
                            f"{variant_data['chromosome']}\t"
                            f"{variant_data['position']}\t"
                            f"{variant_data['result']}\n"
                        )
                        processed_count += 1

                        # Update progress more frequently for better real-time feedback
                        if conversion_id and db_session and processed_count % 100 == 0:
                            self._update_progress(conversion_id, processed_count, total_variants, db_session)

                # Final progress update
                if conversion_id and db_session:
                    self._update_progress(conversion_id, processed_count, total_variants, db_session)

            return True

        except Exception as e:
            print(f"Error during VCF conversion: {str(e)}")
            return False

    def validate_vcf_file(self, file_path: str) -> Dict[str, any]:
        """
        Validate VCF file format and return basic statistics.

        Returns:
            Dictionary with validation results and file statistics
        """
        result = {
            'valid': False,
            'error': None,
            'total_lines': 0,
            'header_lines': 0,
            'variant_lines': 0,
            'variants_with_rsid': 0,
            'file_size': 0
        }

        try:
            if os.path.exists(file_path):
                result['file_size'] = os.path.getsize(file_path)

            with self._open_file(file_path) as file:
                for line in file:
                    result['total_lines'] += 1
                    line = line.strip()

                    if line.startswith('#'):
                        result['header_lines'] += 1
                    elif line:
                        result['variant_lines'] += 1
                        fields = line.split('\t')
                        if len(fields) >= 3 and fields[2] != '.' and fields[2].startswith('rs'):
                            result['variants_with_rsid'] += 1

            result['valid'] = result['variant_lines'] > 0
            if result['variant_lines'] == 0:
                result['error'] = "No variant data found in VCF file"

        except Exception as e:
            result['error'] = str(e)

        return result