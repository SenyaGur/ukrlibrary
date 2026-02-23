import os
from datetime import timedelta


class Config:
    SECRET_KEY = os.environ.get('SECRET_KEY', 'your-secret-key-change-in-production')
    DATABASE_PATH = os.environ.get('DATABASE_PATH', 'library.db')
    UPLOAD_FOLDER = os.environ.get('UPLOAD_FOLDER', 'uploads')
    JWT_EXPIRY = timedelta(hours=24)
