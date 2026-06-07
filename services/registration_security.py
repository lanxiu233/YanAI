from __future__ import annotations

import base64
import hashlib
import hmac
import re
import secrets
import smtplib
import ssl
import time
from dataclasses import dataclass
from email.message import EmailMessage
from email.utils import formataddr
from threading import RLock

from services.config import config


_CODE_TTL_SECONDS = 10 * 60
_SEND_COOLDOWN_SECONDS = 60
_EMAIL_RE = re.compile(r"^[^@\s]+@[^@\s]+\.[^@\s]+$")


@dataclass
class VerificationRecord:
    code_hash: str
    expires_at: float
    sent_at: float
    attempts: int = 0


_lock = RLock()
_codes: dict[str, VerificationRecord] = {}


def normalize_email(value: object) -> str:
    return str(value or "").strip().lower()


def split_email(email: str) -> tuple[str, str]:
    normalized = normalize_email(email)
    if normalized.count("@") != 1 or not _EMAIL_RE.match(normalized):
        raise ValueError("email is invalid")
    local, domain = normalized.rsplit("@", 1)
    if not local or not domain:
        raise ValueError("email is invalid")
    return local, domain


def _domain_matches(domain: str, pattern: str) -> bool:
    if not pattern:
        return False
    if pattern.startswith("*."):
        suffix = pattern[2:]
        return domain.endswith(f".{suffix}") and domain != suffix
    return domain == pattern


def validate_registration_email(email: str) -> str:
    normalized = normalize_email(email)
    local, domain = split_email(normalized)

    if config.email_alias_restriction_enabled:
        if "+" in local:
            raise ValueError("email aliases are not allowed")
        if domain in {"gmail.com", "googlemail.com"} and "." in local:
            raise ValueError("gmail dot aliases are not allowed")

    if config.email_domain_whitelist_enabled:
        allowed = config.email_domain_whitelist
        if not allowed:
            raise ValueError("email domain whitelist is empty")
        if not any(_domain_matches(domain, item) for item in allowed):
            raise ValueError("email domain is not allowed")

    return normalized


def _code_hash(email: str, code: str) -> str:
    secret = config.auth_key or "registration-email-code"
    message = f"{normalize_email(email)}:{str(code or '').strip()}".encode("utf-8")
    return hmac.new(secret.encode("utf-8"), message, hashlib.sha256).hexdigest()


def _force_auth_login(client: smtplib.SMTP, username: str, password: str) -> None:
    code, response = client.docmd("AUTH", "LOGIN")
    if code != 334:
        raise smtplib.SMTPAuthenticationError(code, response)
    code, response = client.docmd(base64.b64encode(username.encode("utf-8")).decode("ascii"))
    if code != 334:
        raise smtplib.SMTPAuthenticationError(code, response)
    code, response = client.docmd(base64.b64encode(password.encode("utf-8")).decode("ascii"))
    if code != 235:
        raise smtplib.SMTPAuthenticationError(code, response)


def _send_email(receiver: str, subject: str, html: str) -> None:
    host = config.smtp_host
    port = config.smtp_port
    username = config.smtp_username
    password = config.smtp_password
    sender = config.smtp_from_email
    sender_name = config.smtp_from_name
    if not host or not sender:
        raise ValueError("SMTP is not configured")

    message = EmailMessage()
    message["Subject"] = subject
    message["From"] = formataddr((sender_name, sender)) if sender_name else sender
    message["To"] = receiver
    message.set_content("你正在注册颜值AI账号。验证码已包含在 HTML 邮件中，10 分钟内有效。")
    message.add_alternative(html, subtype="html")

    context = ssl.create_default_context()
    if config.smtp_use_ssl or port == 465:
        client: smtplib.SMTP = smtplib.SMTP_SSL(host, port, timeout=15, context=context)
    else:
        client = smtplib.SMTP(host, port, timeout=15)

    try:
        client.ehlo()
        if not (config.smtp_use_ssl or port == 465) and config.smtp_use_starttls:
            client.starttls(context=context)
            client.ehlo()
        if username or password:
            if config.smtp_force_auth_login:
                _force_auth_login(client, username, password)
            else:
                client.login(username, password)
        client.send_message(message)
    finally:
        try:
            client.quit()
        except Exception:
            client.close()


def send_registration_verification_code(email: str) -> None:
    normalized = validate_registration_email(email)
    now = time.time()
    with _lock:
        record = _codes.get(normalized)
        if record and now - record.sent_at < _SEND_COOLDOWN_SECONDS:
            wait_seconds = int(_SEND_COOLDOWN_SECONDS - (now - record.sent_at))
            raise ValueError(f"please wait {wait_seconds}s before requesting another code")

    code = f"{secrets.randbelow(1_000_000):06d}"
    brand_name = config.smtp_from_name or "颜值AI"
    html = f"""
    <div style="margin:0;background:#f8fafc;padding:28px 0;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI','PingFang SC','Microsoft YaHei',sans-serif;color:#1c1917">
      <div style="max-width:520px;margin:0 auto;border:1px solid #e7e5e4;border-radius:18px;background:#ffffff;padding:28px;box-shadow:0 18px 48px rgba(15,23,42,0.08)">
        <div style="font-size:13px;font-weight:700;letter-spacing:.08em;color:#e11d48;text-transform:uppercase">{brand_name}</div>
        <h2 style="margin:12px 0 8px;font-size:22px;line-height:1.35;color:#0c0a09">邮箱验证码</h2>
        <p style="margin:0;color:#57534e;font-size:14px;line-height:1.8">你正在注册 {brand_name} 账号，请在页面中输入以下验证码完成邮箱验证。</p>
        <div style="margin:24px 0;border-radius:16px;background:#fff1f2;padding:22px;text-align:center">
          <div style="font-size:32px;font-weight:800;letter-spacing:8px;color:#be123c">{code}</div>
        </div>
        <p style="margin:0;color:#78716c;font-size:13px;line-height:1.8">验证码 10 分钟内有效。若不是你本人操作，可以忽略这封邮件。</p>
      </div>
    </div>
    """.strip()
    _send_email(normalized, f"{brand_name} 邮箱验证码", html)

    with _lock:
        _codes[normalized] = VerificationRecord(
            code_hash=_code_hash(normalized, code),
            expires_at=now + _CODE_TTL_SECONDS,
            sent_at=now,
        )


def verify_registration_code(email: str, code: str) -> None:
    normalized = validate_registration_email(email)
    candidate = str(code or "").strip()
    if not candidate:
        raise ValueError("verification code is required")
    now = time.time()
    with _lock:
        record = _codes.get(normalized)
        if not record:
            raise ValueError("verification code is invalid or expired")
        if record.expires_at < now:
            _codes.pop(normalized, None)
            raise ValueError("verification code is invalid or expired")
        if record.attempts >= 5:
            _codes.pop(normalized, None)
            raise ValueError("verification code has too many failed attempts")
        if not hmac.compare_digest(record.code_hash, _code_hash(normalized, candidate)):
            record.attempts += 1
            raise ValueError("verification code is invalid or expired")
        _codes.pop(normalized, None)


def clear_verification_codes() -> None:
    with _lock:
        _codes.clear()
