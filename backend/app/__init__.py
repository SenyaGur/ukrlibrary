import os
from flask import Flask, send_from_directory
from flask_cors import CORS
from dotenv import load_dotenv

from app.config import Config
from app.database import init_db, close_db


def create_app():
    load_dotenv()

    app = Flask(__name__, static_folder=None)
    app.config.from_object(Config)

    CORS(
        app,
        origins=['http://localhost:8080', 'http://localhost:5051', 'https://library.uakidsclub-sofia.org', 'http://library.uakidsclub-sofia.org', 'http://4.155.74.140'],
        methods=['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
        allow_headers=['Content-Type', 'Authorization'],
        supports_credentials=True
    )

    app.teardown_appcontext(close_db)

    with app.app_context():
        init_db()

    # Static file serving for uploads
    upload_folder = app.config['UPLOAD_FOLDER']

    @app.route('/uploads/<path:filename>')
    def serve_upload(filename):
        return send_from_directory(
            os.path.abspath(upload_folder),
            filename
        )

    # Register route blueprints
    from app.routes.auth import auth_bp
    from app.routes.books import books_bp
    from app.routes.categories import categories_bp
    from app.routes.series import series_bp
    from app.routes.publishers import publishers_bp
    from app.routes.readers import readers_bp, children_bp
    from app.routes.rentals import rentals_bp
    from app.routes.users import users_bp
    from app.routes.upload import upload_bp
    from app.routes.audit import audit_bp
    from app.routes.booklookup import booklookup_bp

    app.register_blueprint(auth_bp)
    app.register_blueprint(books_bp)
    app.register_blueprint(categories_bp)
    app.register_blueprint(series_bp)
    app.register_blueprint(publishers_bp)
    app.register_blueprint(readers_bp)
    app.register_blueprint(children_bp)
    app.register_blueprint(rentals_bp)
    app.register_blueprint(users_bp)
    app.register_blueprint(upload_bp)
    app.register_blueprint(audit_bp)
    app.register_blueprint(booklookup_bp)

    # Record every mutating request in the audit log (who did what).
    from app.audit import init_audit
    init_audit(app)

    return app
