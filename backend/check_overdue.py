#!/usr/bin/env python
"""Standalone overdue-reminder job.

Run from cron / a systemd timer to email readers whose books are overdue:

    cd /var/www/ukrlibrary/backend
    venv/bin/python check_overdue.py

It loads the same app config (and .env) as the web server, so SMTP settings and
the database path are shared. Safe to run daily — each reminder is recorded and
not re-sent within OVERDUE_RESEND_DAYS (default 7).

Example crontab (every day at 09:00):
    0 9 * * * cd /var/www/ukrlibrary/backend && venv/bin/python check_overdue.py >> /var/log/ukrlibrary-overdue.log 2>&1
"""

import sys

from app import create_app
from app.overdue import run_overdue_reminders


def main():
    app = create_app()
    with app.app_context():
        result = run_overdue_reminders()
    print('Overdue reminder run:', result)
    if not result.get('smtp_configured'):
        print('WARNING: SMTP is not configured — no emails were sent. '
              'Set SMTP_HOST/MAIL_FROM (and credentials) in .env.', file=sys.stderr)
        return 1
    return 0


if __name__ == '__main__':
    sys.exit(main())
