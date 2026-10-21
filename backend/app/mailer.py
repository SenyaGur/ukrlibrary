"""Email sending via SMTP.

Send-only mailer built on the standard library ``smtplib``. All configuration
is read from environment variables so the domain SMTP credentials can be supplied
in ``.env`` without code changes:

    SMTP_HOST        e.g. smtp.your-domain.com   (required to send)
    SMTP_PORT        default 587
    SMTP_USER        SMTP login (often the full mailbox address)
    SMTP_PASSWORD    SMTP password / app password
    SMTP_USE_TLS     "true" (default) -> STARTTLS on a plain connection
    SMTP_USE_SSL     "true" -> implicit TLS (SMTPS, usually port 465)
    MAIL_FROM        From address, e.g. library@your-domain.com  (required to send)
    MAIL_FROM_NAME   Display name, default "Бібліотека"

When SMTP is not configured the mailer is a safe no-op: it logs a warning and
returns False instead of raising, so the rest of the app keeps working before
credentials are wired up.
"""

import os
import smtplib
import logging
from email.mime.multipart import MIMEMultipart
from email.mime.text import MIMEText
from email.utils import formataddr

logger = logging.getLogger(__name__)


def _cfg(key, default=None):
    value = os.environ.get(key, default)
    return value


def _flag(key, default):
    return str(_cfg(key, default)).strip().lower() in ('1', 'true', 'yes', 'on')


def is_configured():
    """True when the minimum settings required to send mail are present."""
    return bool(_cfg('SMTP_HOST') and _cfg('MAIL_FROM'))


def send_email(to, subject, html_body, text_body=None):
    """Send an HTML email (with optional plain-text alternative).

    ``to`` may be a single address string or an iterable of addresses.
    Returns True on success, False on failure or when SMTP is unconfigured.
    Never raises — callers can rely on the boolean result.
    """
    recipients = [to] if isinstance(to, str) else list(to or [])
    recipients = [r.strip() for r in recipients if r and r.strip()]
    if not recipients:
        logger.warning('send_email: no valid recipients for "%s"', subject)
        return False

    if not is_configured():
        logger.warning(
            'send_email: SMTP not configured (SMTP_HOST/MAIL_FROM missing); '
            'skipping "%s" to %s', subject, recipients
        )
        return False

    host = _cfg('SMTP_HOST')
    port = int(_cfg('SMTP_PORT', '587'))
    user = _cfg('SMTP_USER')
    password = _cfg('SMTP_PASSWORD')
    use_ssl = _flag('SMTP_USE_SSL', 'false')
    use_tls = _flag('SMTP_USE_TLS', 'true')
    mail_from = _cfg('MAIL_FROM')
    from_name = _cfg('MAIL_FROM_NAME', 'Бібліотека')

    msg = MIMEMultipart('alternative')
    msg['Subject'] = subject
    msg['From'] = formataddr((str(from_name), mail_from))
    msg['To'] = ', '.join(recipients)
    if text_body:
        msg.attach(MIMEText(text_body, 'plain', 'utf-8'))
    msg.attach(MIMEText(html_body, 'html', 'utf-8'))

    server = None
    try:
        if use_ssl:
            server = smtplib.SMTP_SSL(host, port, timeout=20)
        else:
            server = smtplib.SMTP(host, port, timeout=20)
            if use_tls:
                server.starttls()
        if user and password:
            server.login(user, password)
        server.sendmail(mail_from, recipients, msg.as_string())
        logger.info('send_email: sent "%s" to %s', subject, recipients)
        return True
    except Exception as exc:  # noqa: BLE001 - never let mail failures break a request
        logger.error('send_email: failed to send "%s" to %s: %s', subject, recipients, exc)
        return False
    finally:
        if server is not None:
            try:
                server.quit()
            except Exception:  # noqa: BLE001
                pass
