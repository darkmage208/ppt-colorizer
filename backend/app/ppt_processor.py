import pandas as pd
import io
from pptx import Presentation
from pptx.util import Inches, Pt
from pptx.dml.color import RGBColor
from typing import Dict, List, Tuple, Optional
import re
import logging
from .storage import storage

logger = logging.getLogger(__name__)

class PPTProcessor:
    COLOR_MAP = {
        'D': RGBColor(0, 0, 255),      # BLUE
        'E': RGBColor(0, 255, 0),      # GREEN  
        'F': RGBColor(255, 255, 0),    # YELLOW
        'G': RGBColor(255, 165, 0),    # ORANGE
        'H': RGBColor(255, 0, 0),      # RED
    }
    
    def __init__(self):
        self.excel_data = None
        self.txt_data = None
        self.presentation = None
    
    def load_excel_data(self, excel_file_path: str) -> pd.DataFrame:
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
    
    def load_txt_data(self, txt_file_path: str) -> pd.DataFrame:
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
        return df
    
    def load_presentation(self, ppt_file_path: str) -> Presentation:
        ppt_content = storage.download_file(ppt_file_path)
        ppt_io = io.BytesIO(ppt_content)
        
        self.presentation = Presentation(ppt_io)
        return self.presentation
    
    
    def find_color_for_rsid(self, rsid: str) -> Optional[RGBColor]:
        """
        Find the appropriate color for an RSID according to the workflow:
        1. Find the RSID in Excel column B 
        2. Find the same RSID in TXT data and get its RESULT value
        3. Check which column (D, E, F, G, H) in Excel contains this RESULT value
        4. Return the corresponding color
        """
        if self.excel_data is None or self.txt_data is None:
            raise ValueError("Excel and TXT data must be loaded first")
        
        # Step 1: Find the RSID in Excel column B
        rsid_str = str(rsid).strip()
        excel_matches = self.excel_data[self.excel_data['B'].astype(str).str.strip() == rsid_str]
        if excel_matches.empty:
            logger.debug(f"RSID {rsid} not found in Excel column B")
            return None
        
        excel_row = excel_matches.iloc[0]
        
        # Step 2: Find the RSID in TXT data and get its RESULT value
        txt_matches = self.txt_data[self.txt_data['RSID'].astype(str).str.strip() == rsid_str]
        if txt_matches.empty:
            logger.debug(f"RSID {rsid} not found in TXT data")
            return None
        
        txt_row = txt_matches.iloc[0]
        result_value = str(txt_row['RESULT']).strip().upper()
        logger.debug(f"RSID {rsid} has RESULT value: {result_value}")
        
        # Step 3 & 4: Check which column (D, E, F, G, H) contains this RESULT value
        color_columns = ['D', 'E', 'F', 'G', 'H']
        
        for col in color_columns:
            cell_value = str(excel_row[col]).strip().upper()
            logger.debug(f"Checking column {col}: '{cell_value}' vs RESULT '{result_value}'")
            
            if not cell_value or cell_value == 'NAN':
                continue
            
            # Handle comma-separated values
            cell_values = [v.strip().upper() for v in cell_value.split(',')]
            
            if result_value in cell_values:
                logger.debug(f"Match found in column {col}: {result_value}")
                return self.COLOR_MAP[col]
        
        logger.debug(f"No color match found for RSID {rsid} with RESULT {result_value}")
        return None
    
    def find_and_modify_text_in_group(self, rsid: str, new_color):
        """
        Find and modify text within groups by accessing the underlying XML
        """
        
        rsid_str = str(rsid).strip()
        
        for slide_idx, slide in enumerate(self.presentation.slides):
            for shape_idx, shape in enumerate(slide.shapes):
                
                # Handle individual shapes as before
                if hasattr(shape, 'text_frame') and shape.text_frame:
                    try:
                        text_content = shape.text_frame.text.strip()
                        if text_content == rsid_str:
                            if new_color:
                                shape.fill.solid()
                                shape.fill.fore_color.rgb = new_color
                    except Exception as e:
                        logger.warning(f"Error modifying group shape: {e}")

                elif hasattr(shape, 'shape_type') and shape.shape_type == 6:  # Group
                    try:
                        # Access the group's shapes collection
                        for sub_shape in shape.shapes:
                            if hasattr(sub_shape, 'text_frame') and sub_shape.text_frame:
                                text_content = sub_shape.text_frame.text.strip()
                                if text_content == rsid_str:
                                    # Force fill color change
                                    if new_color:
                                        sub_shape.fill.solid()
                                        sub_shape.fill.fore_color.rgb = new_color
                            elif hasattr(sub_shape, 'shape_type') and sub_shape.shape_type == 6:  # Group
                                try:
                                    # Access the group's shapes collection (Level 2)
                                    for sub_sub_shape in sub_shape.shapes:
                                        if hasattr(sub_sub_shape, 'text_frame') and sub_sub_shape.text_frame:
                                            text_content = sub_sub_shape.text_frame.text.strip()
                                            if text_content == rsid_str:
                                                # Force fill color change
                                                if new_color:
                                                    sub_sub_shape.fill.solid()
                                                    sub_sub_shape.fill.fore_color.rgb = new_color
                                        elif hasattr(sub_sub_shape, 'shape_type') and sub_sub_shape.shape_type == 6:  # Nested group (Level 3)
                                            try:
                                                # Access the nested group's shapes collection
                                                for sub_sub_sub_shape in sub_sub_shape.shapes:
                                                    if hasattr(sub_sub_sub_shape, 'text_frame') and sub_sub_sub_shape.text_frame:
                                                        text_content = sub_sub_sub_shape.text_frame.text.strip()
                                                        if text_content == rsid_str:
                                                            # Force fill color change
                                                            if new_color:
                                                                sub_sub_sub_shape.fill.solid()
                                                                sub_sub_sub_shape.fill.fore_color.rgb = new_color
                                            except Exception as e:
                                                logger.warning(f"Error modifying nested group shape (Level 3): {e}")
                            
                                except Exception as e:
                                    logger.warning(f"Error modifying group shape: {e}")
                                    
                    except Exception as e:
                        logger.warning(f"Error modifying group shape: {e}")

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
    
    def save_presentation(self, output_path: str = None) -> str:
        if self.presentation is None:
            raise ValueError("No presentation loaded")
        
        output_io = io.BytesIO()
        self.presentation.save(output_io)
        output_io.seek(0)
        
        if output_path is None:
            output_path = f"processed_presentations/output_{pd.Timestamp.now().strftime('%Y%m%d_%H%M%S')}.pptx"
        
        file_key = storage.upload_file(output_io, output_path.split('/')[-1], "processed_presentations")
        return file_key
    
    def convert_to_pdf(self, pptx_key: str) -> str:
        import subprocess
        import tempfile
        import os
        
        pptx_content = storage.download_file(pptx_key)
        
        with tempfile.NamedTemporaryFile(suffix='.pptx', delete=False) as temp_pptx:
            temp_pptx.write(pptx_content)
            temp_pptx_path = temp_pptx.name
        
        with tempfile.NamedTemporaryFile(suffix='.pdf', delete=False) as temp_pdf:
            temp_pdf_path = temp_pdf.name
        
        try:
            subprocess.run([
                'libreoffice', '--headless', '--convert-to', 'pdf',
                '--outdir', os.path.dirname(temp_pdf_path),
                temp_pptx_path
            ], check=True, timeout=60)
            
            actual_pdf_path = temp_pptx_path.replace('.pptx', '.pdf')
            
            with open(actual_pdf_path, 'rb') as pdf_file:
                pdf_key = storage.upload_file(pdf_file, f"{pptx_key.replace('.pptx', '.pdf')}", "processed_pdfs")
            
            return pdf_key
            
        finally:
            for path in [temp_pptx_path, temp_pdf_path, temp_pptx_path.replace('.pptx', '.pdf')]:
                try:
                    os.unlink(path)
                except FileNotFoundError:
                    pass