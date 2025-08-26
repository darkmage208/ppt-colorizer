# GABO - Genetics Analysis and Biosystems Optimization

A web-based platform for Genetics Analysis and Biosystems Optimization that automatically processes and visualizes genetic data through PowerPoint presentations based on Excel data and TXT file inputs.

## Features

- **Template Management**: Upload and version-control PowerPoint templates
- **Excel Data Management**: Manage Excel sheets with genetic data
- **Automated Processing**: Upload TXT files to trigger color automation
- **Real-time Job Tracking**: Monitor processing progress with live updates
- **Multi-format Output**: Download both PPTX and PDF results
- **User Management**: Role-based access control (Admin/User)
- **Cloud Storage**: Files stored securely on Cloudflare R2

## Technology Stack

### Backend
- **FastAPI**: High-performance REST API
- **PostgreSQL**: Database for users, templates, and jobs
- **Celery + Redis**: Asynchronous job queue
- **SQLAlchemy**: ORM for database operations
- **python-pptx**: PowerPoint manipulation
- **pandas/openpyxl**: Excel data processing
- **LibreOffice**: PDF conversion
- **Cloudflare R2**: Cloud file storage

### Frontend
- **React**: User interface framework
- **Vite**: Build tool and dev server
- **TailwindCSS**: Responsive styling
- **React Router**: Client-side routing
- **Axios**: API communication

## Quick Start

### Prerequisites
- Docker and Docker Compose
- Git

### Installation

1. **Clone the repository**
   ```bash
   git clone <repository-url>
   cd gabo
   ```

2. **Environment Setup**
   ```bash
   # Copy environment template
   cp backend/.env.example backend/.env
   
   # Update the .env file with your settings
   nano backend/.env
   ```

3. **Start the application**
   ```bash
   docker-compose up --build
   ```

4. **Access the application**
   - Frontend: http://localhost:3000
   - Backend API: http://localhost:8000
   - API Documentation: http://localhost:8000/docs

### First Time Setup

1. **Create Admin User**: Register the first user through the UI, then manually update their role in the database
2. **Upload Templates**: Admin users can upload PowerPoint templates
3. **Upload Excel Data**: Admin users can upload Excel sheets with genetic data
4. **Process Jobs**: Regular users can upload TXT files and run automation

## Data Format Requirements

### Excel Data Format
The Excel file must contain these columns:
- `GENE`: Gene name
- `SNP (RS)`: SNP identifier (e.g., rs77121614)
- `TEXT`: Description text
- `AZUL`: Blue color conditions
- `VERDE`: Green color conditions  
- `AMARELO`: Yellow color conditions
- `LARANJA`: Orange color conditions
- `VERMELHO`: Red color conditions

### TXT Data Format
Tab-separated file with columns:
- `RSID`: SNP identifier matching Excel data
- `CHROMOSOME`: Chromosome number
- `POSITION`: Position on chromosome
- `RESULT`: Genetic result (e.g., TC, AA, GG)

### PowerPoint Templates
- Must be .pptx format
- Should contain text boxes with SNP identifiers (rs numbers)
- Text boxes will have their background colors changed based on processing

## Processing Workflow

1. **Data Loading**: System loads Excel template and TXT data
2. **SNP Matching**: For each Excel record, finds matching RSID in TXT data
3. **Color Determination**: Compares TXT result with Excel color columns
4. **PPT Processing**: Finds text boxes containing SNP IDs in presentation
5. **Color Application**: Changes background colors of matched text boxes
6. **Output Generation**: Saves processed PPTX and converts to PDF

## API Endpoints

### Authentication
- `POST /auth/register` - Register new user
- `POST /auth/token` - Login and get JWT token
- `GET /auth/me` - Get current user info

### Templates
- `GET /templates/` - List templates
- `POST /templates/` - Upload template (Admin)
- `DELETE /templates/{id}` - Delete template (Admin)

### Excel Data
- `GET /excel-data/` - List Excel data
- `POST /excel-data/` - Upload Excel data (Admin)
- `DELETE /excel-data/{id}` - Delete Excel data (Admin)

### Jobs
- `GET /jobs/` - List user jobs
- `POST /jobs/` - Create new job
- `GET /jobs/{id}` - Get job details
- `GET /jobs/{id}/download-pptx` - Download PPTX result
- `GET /jobs/{id}/download-pdf` - Download PDF result

### Users (Admin only)
- `GET /users/` - List all users
- `PUT /users/{id}` - Update user role/status

## Development

### Backend Development
```bash
cd backend
pip install -r requirements.txt
uvicorn app.main:app --reload
```

### Frontend Development
```bash
cd frontend
npm install
npm run dev
```

### Database Migrations
```bash
cd backend
alembic revision --autogenerate -m "Description"
alembic upgrade head
```

## Deployment

### Production Docker Compose
Update `docker-compose.yml` for production:
- Change database passwords
- Update SECRET_KEY
- Configure domain names
- Set up SSL certificates
- Update Cloudflare R2 credentials

### Environment Variables
Key environment variables to configure:
- `DATABASE_URL`: PostgreSQL connection string
- `SECRET_KEY`: JWT signing key
- `R2_*`: Cloudflare R2 storage credentials
- `REDIS_URL`: Redis connection for Celery

## Color Mapping

The system uses these color mappings:
- **Column D (AZUL)**: Blue (RGB: 0, 0, 255)
- **Column E (VERDE)**: Green (RGB: 0, 255, 0)
- **Column F (AMARELO)**: Yellow (RGB: 255, 255, 0)
- **Column G (LARANJA)**: Orange (RGB: 255, 165, 0)
- **Column H (VERMELHO)**: Red (RGB: 255, 0, 0)

## Security Features

- JWT-based authentication
- Role-based access control
- File upload validation
- SQL injection prevention
- CORS protection
- Secure file storage

## Troubleshooting

### Common Issues

1. **LibreOffice PDF Conversion Fails**
   - Ensure LibreOffice is installed in the Docker container
   - Check that the temp directories are writable

2. **Celery Jobs Not Processing**
   - Verify Redis connection
   - Check Celery worker logs
   - Ensure database connectivity

3. **File Upload Errors**
   - Verify Cloudflare R2 credentials
   - Check file size limits
   - Ensure proper file formats

4. **Database Connection Issues**
   - Verify PostgreSQL is running
   - Check connection string format
   - Ensure database exists

### Logs
- Backend logs: `docker-compose logs backend`
- Celery logs: `docker-compose logs celery`
- Frontend logs: `docker-compose logs frontend`

## Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Add tests if applicable
5. Submit a pull request

## License

This project is licensed under the MIT License - see the LICENSE file for details.