from __future__ import annotations

from services.repositories.sqlalchemy import (
    AccountRow as AccountModel,
    AuditLogRow as AuditLogModel,
    AuthKeyRow as AuthKeyModel,
    Base,
    ChannelRow as ChannelModel,
    ImageRecordRow as ImageRecordModel,
    PromptLibraryRow as PromptLibraryItemModel,
    QuotaReservationRow as QuotaReservationModel,
    RedeemCodeRow as RedeemCodeModel,
    SQLAlchemyRepositoryProvider,
    SessionRow as SessionModel,
    SystemLogRow as SystemLogModel,
    SystemSettingRow as SystemSettingModel,
    UserRow as UserModel,
)
from services.repositories.storage_adapter import RepositoryStorageAdapter


class DatabaseStorageBackend(RepositoryStorageAdapter):
    """Database storage backend backed by split repositories."""

    def __init__(self, database_url: str):
        self.database_url = database_url
        self.repository_provider = SQLAlchemyRepositoryProvider(database_url)
        self.engine = self.repository_provider.engine
        self.Session = self.repository_provider.Session
        super().__init__(self.repository_provider)

    def close(self) -> None:
        self.engine.dispose()


__all__ = [
    "AccountModel",
    "AuditLogModel",
    "AuthKeyModel",
    "Base",
    "ChannelModel",
    "DatabaseStorageBackend",
    "ImageRecordModel",
    "PromptLibraryItemModel",
    "QuotaReservationModel",
    "RedeemCodeModel",
    "SessionModel",
    "SystemLogModel",
    "SystemSettingModel",
    "UserModel",
]
