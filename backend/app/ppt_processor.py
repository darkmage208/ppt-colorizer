import pandas as pd
import io
from pptx import Presentation
from pptx.util import Inches, Pt
from pptx.dml.color import RGBColor
from typing import Dict, Optional
import re
import logging
from datetime import datetime
import os
from .storage import storage

logger = logging.getLogger(__name__)

class PPTProcessor:
    COLOR_MAP = {
        'D': RGBColor(0, 112, 192),      # BLUE
        'E': RGBColor(0, 128, 0),      # DARKER GREEN
        'F': RGBColor(255, 255, 0),    # YELLOW
        'G': RGBColor(255, 165, 0),    # ORANGE
        'H': RGBColor(255, 0, 0),      # RED
    }

    def __init__(self):
        self.excel_data = None
        self.txt_data = None
        self.presentation = None
        self.excel_filename = None
        self.txt_filename = None
        self.template_name = None
        # Performance optimization caches
        self._txt_lookup_cache = None
        self._shape_rsid_map = None
        self._rsid_color_cache = None
    
    def set_template_name(self, template_name: str):
        """Set the template name to be used as patient name"""
        self.template_name = template_name
        logger.info(f"Template name set to: {template_name}")
    
    def load_excel_data(self, excel_file_path: str) -> pd.DataFrame:
        # Store the filename for patient name extraction
        self.excel_filename = os.path.basename(excel_file_path)
        
        excel_content = storage.download_file(excel_file_path)
        excel_io = io.BytesIO(excel_content)
        
        # Read Excel file
        df = pd.read_excel(excel_io)
        
        # Ensure we have at least columns A through H
        if len(df.columns) < 8:
            raise ValueError(f"Excel file must have at least 8 columns (A-H), found {len(df.columns)}")
        
        # Rename columns to standard letters for easy access
        column_names = ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H']
        for i, col_name in enumerate(column_names):
            if i < len(df.columns):
                df.columns.values[i] = col_name
        
        # Column B should contain SNP data (RSID)
        self.excel_data = df
        return df
    
    def load_txt_data(self, txt_file_path: str, original_filename: str = None) -> pd.DataFrame:
        # Store the original filename if provided, otherwise use the file path basename
        self.txt_filename = original_filename or os.path.basename(txt_file_path)
        
        txt_content = storage.download_file(txt_file_path)
        txt_str = txt_content.decode('utf-8')
        
        # Parse TXT file - could be tab-separated or comma-separated
        lines = txt_str.strip().split('\n')
        if len(lines) < 2:
            raise ValueError("TXT file must have at least header and one data row")
        
        # Try tab-separated first, then comma-separated
        separator = '\t' if '\t' in lines[0] else ','
        
        header = lines[0].split(separator)
        data = []
        for line in lines[1:]:
            if line.strip():
                row = line.split(separator)
                # Pad with empty strings if row is shorter than header
                while len(row) < len(header):
                    row.append('')
                data.append(row)
        
        df = pd.DataFrame(data, columns=header)
        df.columns = df.columns.str.strip()
        
        # Create a mapping from RSID to RESULT for quick lookup
        if 'RSID' not in df.columns:
            raise ValueError("TXT file must have an 'RSID' column")
        if 'RESULT' not in df.columns:
            raise ValueError("TXT file must have a 'RESULT' column")
        
        self.txt_data = df
        # Clear cache when new TXT data is loaded
        self._txt_lookup_cache = None
        self._rsid_color_cache = None
        return df
    
    def extract_patient_name(self) -> str:
        """
        Use the TXT filename as the patient name
        Falls back to template name if TXT filename not available
        """
        logger.info(f"Extracting patient name - txt_filename: {self.txt_filename}, template_name: {self.template_name}")
        
        # Primary: Use TXT filename
        if self.txt_filename:
            base_name = os.path.splitext(self.txt_filename)[0]
            logger.info(f"Using TXT filename as patient name: {base_name}")
            return base_name
        
        # Fallback to template name if TXT filename not available
        if self.template_name:
            logger.info(f"TXT filename not available, using template name as patient name: {self.template_name}")
            return self.template_name
        
        logger.warning("No TXT filename or template name available, using 'Unknown Patient'")
        return "Unknown Patient"
    
    def get_current_date(self) -> str:
        """
        Get current date in DD-MM-YYYY format
        Example: 23-08-2025
        """
        return datetime.now().strftime("%d-%m-%Y")
    
    def replace_patient_and_date_info(self):
        """
        Find text frames containing "PATIENT" heading and reformat the entire content
        to the standard format: "PATIENT: [name]\nDATE: [date]"
        Searches recursively through groups with depth control.
        """
        if not self.presentation:
            return

        patient_name = self.extract_patient_name()
        current_date = self.get_current_date()

        for slide_idx, slide in enumerate(self.presentation.slides):
            for shape_idx, shape in enumerate(slide.shapes):
                self._find_and_update_patient_text_frame(shape, patient_name, current_date)

    def _find_and_update_patient_text_frame(self, shape, patient_name: str, current_date: str, depth: int = 0, max_depth: int = 3):
        """
        Recursively search for text frames containing "PATIENT" and reformat them.

        Args:
            shape: The shape to examine
            patient_name: Patient name to use
            current_date: Current date to use
            depth: Current recursion depth
            max_depth: Maximum recursion depth for group searching
        """
        try:
            # Handle individual text frames
            if hasattr(shape, 'text_frame') and shape.text_frame:
                full_text = shape.text_frame.text.strip().upper()

                # Check if this text frame contains "PATIENT" heading
                if "PATIENT" in full_text:
                    self._reformat_patient_text_frame(shape.text_frame, patient_name, current_date)
                    logger.debug(f"Updated patient info text frame at depth {depth}")
                    return True

            # Handle groups recursively (with depth control)
            elif hasattr(shape, 'shape_type') and shape.shape_type == 6 and depth < max_depth:  # Group
                found = False
                for sub_shape in shape.shapes:
                    if self._find_and_update_patient_text_frame(sub_shape, patient_name, current_date, depth + 1, max_depth):
                        found = True
                return found

        except Exception as e:
            logger.warning(f"Error processing shape at depth {depth}: {e}")

        return False

    def _reformat_patient_text_frame(self, text_frame, patient_name: str, current_date: str):
        """
        Reformat the text frame content to the standard format while preserving all formatting:
        PATIENT: [name]
        DATE: [date]

        Uses a careful approach to preserve existing formatting by copying font properties.

        Args:
            text_frame: The text frame to reformat
            patient_name: Patient name to use
            current_date: Current date to use
        """
        try:
            # Store formatting properties from existing runs
            saved_formats = []
            for paragraph in text_frame.paragraphs:
                para_formats = []
                for run in paragraph.runs:
                    # Save font properties
                    font_props = {
                        'name': getattr(run.font, 'name', None),
                        'size': getattr(run.font, 'size', None),
                        'bold': getattr(run.font, 'bold', None),
                        'italic': getattr(run.font, 'italic', None),
                        'underline': getattr(run.font, 'underline', None),
                        'color': None
                    }
                    try:
                        if hasattr(run.font, 'color') and hasattr(run.font.color, 'rgb'):
                            font_props['color'] = run.font.color.rgb
                    except:
                        pass
                    para_formats.append(font_props)
                saved_formats.append(para_formats)

            # Use the simplest approach: replace the entire text and then restore formatting
            text_frame.text = f"PATIENT: {patient_name}\nDATE: {current_date}"

            # Restore formatting to the new content
            if saved_formats and text_frame.paragraphs:
                # Apply formatting to patient line (first paragraph)
                if len(text_frame.paragraphs) > 0 and len(saved_formats) > 0 and len(saved_formats[0]) > 0:
                    first_para = text_frame.paragraphs[0]
                    if first_para.runs:
                        self._apply_font_properties(first_para.runs[0].font, saved_formats[0][0])

                # Apply formatting to date line (second paragraph)
                if len(text_frame.paragraphs) > 1:
                    second_para = text_frame.paragraphs[1]
                    if second_para.runs:
                        # Use second paragraph formatting if available, otherwise use first
                        format_to_use = saved_formats[1][0] if len(saved_formats) > 1 and saved_formats[1] else saved_formats[0][0]
                        self._apply_font_properties(second_para.runs[0].font, format_to_use)

            logger.debug(f"Reformatted text frame with patient: {patient_name}, date: {current_date}")

        except Exception as e:
            logger.warning(f"Error reformatting patient text frame: {e}")
            # Fallback: try simple text replacement without formatting preservation
            try:
                text_frame.text = f"PATIENT: {patient_name}\nDATE: {current_date}"
                logger.debug("Used fallback text replacement")
            except Exception as fallback_error:
                logger.error(f"Fallback text replacement also failed: {fallback_error}")

    def _apply_font_properties(self, target_font, font_props):
        """
        Apply saved font properties to a target font object.

        Args:
            target_font: The font object to apply properties to
            font_props: Dictionary of font properties to apply
        """
        try:
            if font_props.get('name'):
                target_font.name = font_props['name']
            if font_props.get('size'):
                target_font.size = font_props['size']
            if font_props.get('bold') is not None:
                target_font.bold = font_props['bold']
            if font_props.get('italic') is not None:
                target_font.italic = font_props['italic']
            if font_props.get('underline') is not None:
                target_font.underline = font_props['underline']
            if font_props.get('color'):
                target_font.color.rgb = font_props['color']
        except Exception as e:
            logger.debug(f"Could not apply some font properties: {e}")

    def load_presentation(self, ppt_file_path: str) -> Presentation:
        ppt_content = storage.download_file(ppt_file_path)
        ppt_io = io.BytesIO(ppt_content)
        
        self.presentation = Presentation(ppt_io)
        # Clear cache when new presentation is loaded
        self._shape_rsid_map = None
        return self.presentation

    def _build_txt_lookup_cache(self):
        """Build a fast lookup cache for TXT data: RSID -> RESULT"""
        if self._txt_lookup_cache is not None:
            return self._txt_lookup_cache

        if self.txt_data is None:
            return {}

        logger.info("Building TXT lookup cache...")
        self._txt_lookup_cache = {}

        for _, row in self.txt_data.iterrows():
            rsid = str(row['RSID']).strip()
            result = str(row['RESULT']).strip().upper()
            self._txt_lookup_cache[rsid] = result

        logger.info(f"TXT lookup cache built with {len(self._txt_lookup_cache)} entries")
        return self._txt_lookup_cache

    def _build_shape_rsid_map(self):
        """Build a map of RSID -> [shape objects] for fast lookup"""
        if self._shape_rsid_map is not None:
            return self._shape_rsid_map

        if self.presentation is None:
            return {}

        logger.info("Building PowerPoint shape-RSID mapping...")
        self._shape_rsid_map = {}

        def extract_shapes_recursive(shapes, level=0):
            """Recursively extract all text shapes and their RSIDs"""
            shape_count = 0
            for shape in shapes:
                try:
                    # Handle individual text frames
                    if hasattr(shape, 'text_frame') and shape.text_frame:
                        text_content = shape.text_frame.text.strip()
                        if text_content and text_content.startswith('rs'):  # RSID pattern
                            if text_content not in self._shape_rsid_map:
                                self._shape_rsid_map[text_content] = []
                            self._shape_rsid_map[text_content].append(shape)
                            shape_count += 1

                    # Handle groups recursively
                    elif hasattr(shape, 'shape_type') and shape.shape_type == 6 and level < 4:  # Group, max 4 levels
                        shape_count += extract_shapes_recursive(shape.shapes, level + 1)

                except Exception as e:
                    logger.warning(f"Error processing shape at level {level}: {e}")

            return shape_count

        total_shapes = 0
        for slide_idx, slide in enumerate(self.presentation.slides):
            slide_shapes = extract_shapes_recursive(slide.shapes)
            total_shapes += slide_shapes

        logger.info(f"Shape-RSID mapping built: {len(self._shape_rsid_map)} unique RSIDs found across {total_shapes} shapes")
        return self._shape_rsid_map

    def _build_rsid_color_cache(self):
        """Pre-compute colors for all RSIDs found in Excel data"""
        if self._rsid_color_cache is not None:
            return self._rsid_color_cache

        if self.excel_data is None:
            return {}

        logger.info("Building RSID-color cache...")
        self._rsid_color_cache = {}
        txt_cache = self._build_txt_lookup_cache()

        for _, row in self.excel_data.iterrows():
            rsid = str(row['B']).strip()
            if not rsid or rsid == 'nan':
                continue

            # Get RESULT from TXT data using cache
            result_value = txt_cache.get(rsid)
            if not result_value:
                continue

            # Find matching color column
            color_columns = ['D', 'E', 'F', 'G', 'H']
            for col in color_columns:
                cell_value = str(row[col]).strip().upper()
                if not cell_value or cell_value == 'NAN':
                    continue

                # Handle comma-separated values
                cell_values = [v.strip().upper() for v in cell_value.split(',')]
                if result_value in cell_values:
                    self._rsid_color_cache[rsid] = self.COLOR_MAP[col]
                    break

        logger.info(f"RSID-color cache built with {len(self._rsid_color_cache)} color mappings")
        return self._rsid_color_cache

    def find_color_for_rsid(self, rsid: str) -> Optional[RGBColor]:
        """
        Find the appropriate color for an RSID using pre-built cache.
        Much faster than the original implementation.
        """
        rsid_str = str(rsid).strip()
        color_cache = self._build_rsid_color_cache()
        return color_cache.get(rsid_str)
    
    def _apply_colors_to_shapes_optimized(self, rsid_color_map):
        """
        Optimized method to apply colors to shapes using pre-built mappings.
        Only iterates through shapes once instead of once per RSID.
        """
        if not rsid_color_map:
            return 0

        logger.info(f"Applying colors to shapes for {len(rsid_color_map)} RSIDs...")
        shape_map = self._build_shape_rsid_map()
        colored_count = 0

        # Batch apply colors using the pre-built shape map
        for rsid, color in rsid_color_map.items():
            shapes = shape_map.get(rsid, [])
            for shape in shapes:
                try:
                    if color:
                        shape.fill.solid()
                        shape.fill.fore_color.rgb = color
                        colored_count += 1
                        logger.debug(f"Applied {color} to RSID {rsid}")
                except Exception as e:
                    logger.warning(f"Error applying color to shape for RSID {rsid}: {e}")

        logger.info(f"Color application complete: {colored_count} shapes colored")
        return colored_count

    def find_and_modify_text_in_group(self, rsid: str, new_color):
        """
        Legacy method - kept for backward compatibility.
        For better performance, use process_presentation_optimized() instead.
        """
        rsid_str = str(rsid).strip()
        shape_map = self._build_shape_rsid_map()

        shapes = shape_map.get(rsid_str, [])
        for shape in shapes:
            try:
                if new_color:
                    shape.fill.solid()
                    shape.fill.fore_color.rgb = new_color
            except Exception as e:
                logger.warning(f"Error modifying shape for RSID {rsid}: {e}")

    def apply_background_color(self, shape, color: RGBColor):
        if hasattr(shape, 'fill'):
            shape.fill.solid()
            shape.fill.fore_color.rgb = color
    
    def process_presentation(self, progress_callback=None) -> Dict[str, int]:
        """
        Process presentation according to the workflow:
        1. Iterate through all records in Excel template
        2. Extract SNP [column B] text (RSID)
        3. Find RSID in TXT data and get RESULT value
        4. Find which column (D,E,F,G,H) contains the RESULT value
        5. Find text box in PPT with exact RSID match
        6. Apply the corresponding color to the text box background
        """
        if not all([self.excel_data is not None, self.txt_data is not None, self.presentation is not None]):
            raise ValueError("Excel data, TXT data, and presentation must be loaded first")
        
        results = {
            'total_records': 0,
            'processed': 0,
            'colored': 0,
            'skipped': 0
        }
        
        total_records = len(self.excel_data)
        results['total_records'] = total_records
        
        logger.info(f"Starting to process {total_records} Excel records")
        
        # Replace PATIENT and DATE information before processing colors
        self.replace_patient_and_date_info()
        
        # Step 1: Iterate through all records in Excel template
        for idx, row in self.excel_data.iterrows():
            results['processed'] += 1
            
            # Step 2: Extract SNP [column B] text (RSID format: rs57108, rs131415, etc.)
            rsid = str(row['B']).strip()
            if not rsid or rsid == 'nan':
                results['skipped'] += 1
                continue
            
            logger.debug(f"Processing RSID: {rsid}")
            
            # Step 3: Find RSID in TXT data and get RESULT value
            # Step 4: Find which column contains the RESULT value and get color
            color = self.find_color_for_rsid(rsid)
            
            if color is None:
                results['skipped'] += 1
                continue
            
            # # Step 5: Find text box in PPT that exactly matches RSID
            # text_boxes = self.find_text_boxes_with_rsid(rsid)
            # if not text_boxes:
            #     results['skipped'] += 1
            #     continue
            
            # # Step 6: Apply color to text box background
            # for slide_idx, shape_idx, shape in text_boxes:
            #     self.apply_background_color(shape, color)
            #     results['colored'] += 1
            #     logger.debug(f"Applied color to RSID {rsid} on slide {slide_idx+1}")
            self.find_and_modify_text_in_group(rsid, color)
            
            if progress_callback:
                progress = int((idx + 1) / total_records * 100)
                progress_callback(progress)
        
        logger.info(f"Processing complete. Colored: {results['colored']}, Skipped: {results['skipped']}")
        return results

    def process_presentation_optimized(self, progress_callback=None) -> Dict[str, int]:
        """
        OPTIMIZED presentation processing with significant performance improvements:
        - Pre-builds lookup caches once instead of searching repeatedly
        - Uses reverse lookup: finds all shapes first, then applies colors in batch
        - Reduces complexity from O(n*m) to O(n+m)
        - Expected speedup: 10-100x faster depending on file sizes
        """
        if not all([self.excel_data is not None, self.txt_data is not None, self.presentation is not None]):
            raise ValueError("Excel data, TXT data, and presentation must be loaded first")

        results = {
            'total_records': 0,
            'processed': 0,
            'colored': 0,
            'skipped': 0,
            'cache_build_time': 0,
            'color_apply_time': 0
        }

        import time
        start_time = time.time()

        total_records = len(self.excel_data)
        results['total_records'] = total_records

        logger.info(f"Starting OPTIMIZED processing of {total_records} Excel records")

        # Replace PATIENT and DATE information before processing colors
        self.replace_patient_and_date_info()

        # OPTIMIZATION 1: Build all caches upfront (one-time cost)
        cache_start = time.time()
        logger.info("Building optimization caches...")

        # Build caches in optimal order
        txt_cache = self._build_txt_lookup_cache()
        shape_map = self._build_shape_rsid_map()
        color_cache = self._build_rsid_color_cache()

        cache_time = time.time() - cache_start
        results['cache_build_time'] = cache_time
        logger.info(f"Cache building completed in {cache_time:.2f}s")

        # OPTIMIZATION 2: Filter only RSIDs that exist in both Excel and PowerPoint
        excel_rsids = set()
        for _, row in self.excel_data.iterrows():
            rsid = str(row['B']).strip()
            if rsid and rsid != 'nan':
                excel_rsids.add(rsid)

        ppt_rsids = set(shape_map.keys())
        matching_rsids = excel_rsids.intersection(ppt_rsids)

        logger.info(f"Found {len(matching_rsids)} RSIDs that exist in both Excel ({len(excel_rsids)}) and PowerPoint ({len(ppt_rsids)})")

        # OPTIMIZATION 3: Build final color mapping only for matching RSIDs
        final_color_map = {}
        for rsid in matching_rsids:
            color = color_cache.get(rsid)
            if color:
                final_color_map[rsid] = color
                results['processed'] += 1
            else:
                results['skipped'] += 1

        logger.info(f"Color mapping built: {len(final_color_map)} RSIDs will be colored")

        # OPTIMIZATION 4: Apply all colors in one batch operation
        apply_start = time.time()
        colored_count = self._apply_colors_to_shapes_optimized(final_color_map)
        apply_time = time.time() - apply_start

        results['colored'] = colored_count
        results['color_apply_time'] = apply_time

        # Update progress
        if progress_callback:
            progress_callback(100)

        total_time = time.time() - start_time
        logger.info(f"OPTIMIZED processing complete in {total_time:.2f}s (cache: {cache_time:.2f}s, apply: {apply_time:.2f}s)")
        logger.info(f"Performance: {total_records/total_time:.1f} records/sec, {colored_count/total_time:.1f} shapes/sec")
        logger.info(f"Results: Colored: {results['colored']}, Skipped: {results['skipped']}")

        return results
    
    def save_presentation(self, output_path: str = None) -> str:
        if self.presentation is None:
            raise ValueError("No presentation loaded")
        
        output_io = io.BytesIO()
        self.presentation.save(output_io)
        output_io.seek(0)
        
        if output_path is None:
            # Use TXT filename for output if available, otherwise use timestamp
            if self.txt_filename:
                base_name = os.path.splitext(self.txt_filename)[0]
                output_filename = f"{base_name}.pptx"
                logger.info(f"Using TXT-based filename: {output_filename} (from {self.txt_filename})")
            else:
                output_filename = f"output_{pd.Timestamp.now().strftime('%Y%m%d_%H%M%S')}.pptx"
                logger.info(f"Using timestamp-based filename: {output_filename}")
            output_path = f"processed_presentations/{output_filename}"
        
        logger.info(f"Saving presentation to storage with filename: {output_path.split('/')[-1]}, folder: processed_presentations")
        file_key = storage.upload_file(output_io, output_path.split('/')[-1], "processed_presentations")
        logger.info(f"Presentation saved with key: {file_key}")
        return file_key
    
    # def convert_to_pdf(self, pptx_key: str) -> str:
    #     import subprocess
    #     import tempfile
    #     import os
    #     import shutil
        
    #     pptx_content = storage.download_file(pptx_key)
        
    #     with tempfile.NamedTemporaryFile(suffix='.pptx', delete=False) as temp_pptx:
    #         temp_pptx.write(pptx_content)
    #         temp_pptx_path = temp_pptx.name
        
    #     temp_pdf_dir = tempfile.mkdtemp()
    #     temp_pdf_path = os.path.join(temp_pdf_dir, 'output.pdf')
        
    #     try:
    #         # Method 1: Try LibreOffice (simple, basic conversion)
    #         if shutil.which('libreoffice'):
    #             logger.info("Using basic LibreOffice for PDF conversion")
    #             subprocess.run([
    #                 'libreoffice', '--headless', '--convert-to', 'pdf',
    #                 '--outdir', temp_pdf_dir,
    #                 temp_pptx_path
    #             ], check=True, timeout=60)
                
    #             # LibreOffice creates PDF with same base name as input
    #             actual_pdf_path = os.path.join(temp_pdf_dir, os.path.basename(temp_pptx_path).replace('.pptx', '.pdf'))
                
    #         # Method 2: Try unoconv
    #         elif shutil.which('unoconv'):
    #             logger.info("Using unoconv for PDF conversion")
    #             subprocess.run([
    #                 'unoconv', '-f', 'pdf', '-o', temp_pdf_path, temp_pptx_path
    #             ], check=True, timeout=60)
    #             actual_pdf_path = temp_pdf_path
                
    #         # Method 3: Fallback to Python-based solution (create basic PDF report)
    #         else:
    #             logger.warning("No LibreOffice or unoconv found, using fallback PDF generation")
    #             actual_pdf_path = self._create_fallback_pdf(temp_pptx_path, temp_pdf_path)
            
    #         # Upload the generated PDF
    #         logger.info(f"Uploading PDF from: {actual_pdf_path}")
    #         if not os.path.exists(actual_pdf_path):
    #             raise Exception(f"Generated PDF file not found: {actual_pdf_path}")
            
    #         pdf_size = os.path.getsize(actual_pdf_path)
    #         logger.info(f"PDF file size: {pdf_size} bytes")
            
    #         with open(actual_pdf_path, 'rb') as pdf_file:
    #             # Verify PDF header
    #             pdf_file.seek(0)
    #             header = pdf_file.read(8)
    #             pdf_file.seek(0)
                
    #             if not header.startswith(b'%PDF-'):
    #                 logger.warning(f"Generated file doesn't appear to be a valid PDF. Header: {header}")
                
    #             pdf_filename = pptx_key.replace('.pptx', '.pdf').split('/')[-1]
    #             logger.info(f"Uploading PDF as: {pdf_filename}")
                
    #             try:
    #                 pdf_key = storage.upload_file(pdf_file, pdf_filename, "processed_pdfs")
    #                 logger.info(f"PDF uploaded successfully to: {pdf_key}")
    #             except Exception as upload_error:
    #                 logger.error(f"Failed to upload PDF to storage: {upload_error}")
    #                 raise Exception(f"PDF upload failed: {upload_error}")
            
    #         return pdf_key
            
    #     finally:
    #         # Clean up temporary files
    #         try:
    #             os.unlink(temp_pptx_path)
    #         except FileNotFoundError:
    #             pass
    #         try:
    #             shutil.rmtree(temp_pdf_dir)
    #         except:
    #             pass
    
    # def _create_fallback_pdf(self, pptx_path: str, pdf_path: str) -> str:
    #     """
    #     Create a basic PDF report when LibreOffice is not available
    #     """
    #     try:
    #         from reportlab.lib.pagesizes import letter, A4
    #         from reportlab.pdfgen import canvas
    #         from reportlab.lib import colors
    #         from reportlab.lib.styles import getSampleStyleSheet
    #         from reportlab.platypus import SimpleDocTemplate, Paragraph, Spacer, Table, TableStyle
    #         from pptx import Presentation
            
    #         # Load the presentation to extract text content
    #         ppt = Presentation(pptx_path)
            
    #         # Create PDF
    #         doc = SimpleDocTemplate(pdf_path, pagesize=A4)
    #         styles = getSampleStyleSheet()
    #         story = []
            
    #         # Add title
    #         title = Paragraph("PowerPoint to PDF - Content Summary", styles['Title'])
    #         story.append(title)
    #         story.append(Spacer(1, 12))
            
    #         # Extract content from each slide
    #         for slide_num, slide in enumerate(ppt.slides, 1):
    #             slide_title = Paragraph(f"Slide {slide_num}", styles['Heading2'])
    #             story.append(slide_title)
    #             story.append(Spacer(1, 6))
                
    #             # Extract text from shapes
    #             slide_text = []
    #             for shape in slide.shapes:
    #                 if hasattr(shape, 'text_frame') and shape.text_frame:
    #                     text = shape.text_frame.text.strip()
    #                     if text:
    #                         slide_text.append(text)
                
    #             if slide_text:
    #                 for text in slide_text:
    #                     para = Paragraph(text, styles['Normal'])
    #                     story.append(para)
    #                     story.append(Spacer(1, 6))
    #             else:
    #                 para = Paragraph("(No text content found)", styles['Italic'])
    #                 story.append(para)
                
    #             story.append(Spacer(1, 12))
            
    #         # Add note about conversion
    #         note = Paragraph(
    #             "<b>Note:</b> This PDF was generated as a fallback since LibreOffice is not installed. "
    #             "For full PowerPoint to PDF conversion with images and formatting, please install LibreOffice.",
    #             styles['Normal']
    #         )
    #         story.append(note)
            
    #         # Build PDF
    #         doc.build(story)
    #         logger.info(f"Fallback PDF created: {pdf_path}")
            
    #         return pdf_path
            
    #     except ImportError as e:
    #         logger.error(f"Required libraries not available for fallback PDF: {e}")
    #         raise Exception("PDF conversion failed: No converter available and fallback libraries missing")
    #     except Exception as e:
    #         logger.error(f"Fallback PDF creation failed: {e}")
    #         raise Exception(f"PDF conversion failed: {e}")