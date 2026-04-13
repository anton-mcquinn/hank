import logging
import os
import asyncio
import uuid
from dotenv import load_dotenv
import markdown

logger = logging.getLogger(__name__)
from datetime import datetime
from io import StringIO
from html.parser import HTMLParser
from reportlab.lib.pagesizes import letter
from reportlab.lib import colors
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
from reportlab.platypus import SimpleDocTemplate, Paragraph, Spacer, Table, TableStyle, Image

load_dotenv()

INVOICE_DIR = os.getenv("INVOICE_DIR", "./invoices")

# Ensure invoice directory exists
os.makedirs(INVOICE_DIR, exist_ok=True)

class HTMLToReportLabParser(HTMLParser):
    """Simple parser to convert HTML to ReportLab elements"""
    
    def __init__(self):
        super().__init__()
        self.styles = getSampleStyleSheet()
        self.elements = []
        self.current_text = ""
        self.in_table = False
        self.table_data = []
        self.current_row = []
        self.in_th = False
        self.in_td = False
        self.in_header = False
        self.header_level = 0
        
        # Add custom styles
        self.styles.add(ParagraphStyle(
            name='Heading1Bold',
            parent=self.styles['Heading1'],
            fontName='Helvetica-Bold'
        ))
        self.styles.add(ParagraphStyle(
            name='TableHeader',
            parent=self.styles['Normal'],
            fontName='Helvetica-Bold',
            alignment=1  # Center
        ))
    
    def handle_starttag(self, tag, attrs):
        # Flush any pending text
        self.flush_text()
        
        # Handle specific tags
        if tag == 'h1':
            self.in_header = True
            self.header_level = 1
        elif tag == 'h2':
            self.in_header = True
            self.header_level = 2
        elif tag == 'h3':
            self.in_header = True
            self.header_level = 3
        elif tag == 'p':
            pass  # Will handle text in handle_data
        elif tag == 'br':
            self.current_text += "<br/>"
        elif tag == 'hr':
            self.elements.append(Spacer(1, 10))
            self.elements.append(
                Table([['']], colWidths=[450], style=TableStyle([
                    ('LINEABOVE', (0, 0), (-1, 0), 1, colors.lightgrey)
                ]))
            )
            self.elements.append(Spacer(1, 10))
        elif tag == 'table':
            self.in_table = True
            self.table_data = []
        elif tag == 'tr':
            self.current_row = []
        elif tag == 'th':
            self.in_th = True
        elif tag == 'td':
            self.in_td = True
    
    def handle_endtag(self, tag):
        # Handle closing tags
        if tag == 'h1' or tag == 'h2' or tag == 'h3':
            style_name = f'Heading{self.header_level}'
            self.elements.append(Paragraph(self.current_text, self.styles[style_name]))
            self.elements.append(Spacer(1, 12))
            self.current_text = ""
            self.in_header = False
        elif tag == 'p':
            if self.current_text:
                self.elements.append(Paragraph(self.current_text, self.styles['Normal']))
                self.elements.append(Spacer(1, 6))
                self.current_text = ""
        elif tag == 'table':
            if self.table_data:
                # Create and style the table
                table = Table(self.table_data)
                
                # Apply table styles
                style = [
                    ('BACKGROUND', (0, 0), (-1, 0), colors.lightgrey),
                    ('TEXTCOLOR', (0, 0), (-1, 0), colors.black),
                    ('ALIGN', (0, 0), (-1, 0), 'CENTER'),
                    ('FONTNAME', (0, 0), (-1, 0), 'Helvetica-Bold'),
                    ('BOTTOMPADDING', (0, 0), (-1, 0), 12),
                    ('BACKGROUND', (0, 1), (-1, -1), colors.white),
                    ('GRID', (0, 0), (-1, -1), 1, colors.black)
                ]
                
                table.setStyle(TableStyle(style))
                self.elements.append(table)
                self.elements.append(Spacer(1, 12))
                
                self.in_table = False
                self.table_data = []
        elif tag == 'tr':
            if self.current_row:
                self.table_data.append(self.current_row)
                self.current_row = []
        elif tag == 'th':
            if self.current_text:
                self.current_row.append(Paragraph(self.current_text, self.styles['TableHeader']))
                self.current_text = ""
            self.in_th = False
        elif tag == 'td':
            if self.current_text:
                self.current_row.append(Paragraph(self.current_text, self.styles['Normal']))
                self.current_text = ""
            self.in_td = False
    
    def handle_data(self, data):
        # Accumulate text content
        if data.strip():
            self.current_text += data
    
    def flush_text(self):
        # Add any remaining text as a paragraph
        if self.current_text and not (self.in_table or self.in_header):
            self.elements.append(Paragraph(self.current_text, self.styles['Normal']))
            self.elements.append(Spacer(1, 6))
            self.current_text = ""

async def convert_markdown_to_pdf(markdown_content, filename_prefix=None):
    """
    Convert markdown content to a PDF file using ReportLab directly
    
    Args:
        markdown_content (str): Markdown content to convert
        filename_prefix (str, optional): Prefix for the generated filename
        
    Returns:
        str: Path to the generated PDF file
    """
    try:
        # Generate a filename
        if not filename_prefix:
            filename_prefix = "document"
        
        timestamp = datetime.now().strftime("%Y%m%d%H%M%S")
        unique_id = str(uuid.uuid4())[:8]
        filename = f"{filename_prefix}_{timestamp}_{unique_id}.pdf"
        file_path = os.path.join(INVOICE_DIR, filename)
        
        # Convert markdown to HTML
        html_content = markdown.markdown(markdown_content)
        
        # Parse HTML into ReportLab elements
        parser = HTMLToReportLabParser()
        parser.feed(html_content)
        
        # Build PDF using ReportLab
        loop = asyncio.get_running_loop()
        
        def build_pdf():
            doc = SimpleDocTemplate(
                file_path,
                pagesize=letter,
                rightMargin=72,
                leftMargin=72,
                topMargin=72,
                bottomMargin=72
            )
            
            # Build the PDF
            doc.build(parser.elements)
            return file_path
        
        # Run in a thread pool to avoid blocking
        pdf_path = await loop.run_in_executor(None, build_pdf)
        
        return pdf_path
    
    except Exception as e:
        logger.error("Error converting markdown to PDF: %s", e, exc_info=True)
        return None
