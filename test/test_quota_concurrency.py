from __future__ import annotations

import tempfile
import unittest
from concurrent.futures import ThreadPoolExecutor
from pathlib import Path

from sqlalchemy import text

from services.storage.database_storage import DatabaseStorageBackend


class QuotaReservationConcurrencyTest(unittest.TestCase):
    def test_concurrent_reservations_only_one_succeeds_for_single_quota(self) -> None:
        with tempfile.TemporaryDirectory() as tmp_dir:
            db_path = Path(tmp_dir) / "quota.db"
            storage = DatabaseStorageBackend(f"sqlite:///{db_path.as_posix()}")
            storage.save_users([
                {
                    "id": "user-a",
                    "email": "user-a@example.com",
                    "role": "user",
                    "status": "active",
                    "quota": 1,
                    "quota_used": 0,
                }
            ])
            repo = storage.repository_provider.quota_reservations

            def reserve(index: int) -> bool:
                try:
                    repo.reserve("user-a", 1, f"request-{index}")
                    return True
                except ValueError:
                    return False

            with ThreadPoolExecutor(max_workers=10) as executor:
                results = list(executor.map(reserve, range(10)))

            self.assertEqual(sum(1 for item in results if item), 1)
            users = storage.load_users()
            self.assertEqual(users[0]["quota"], 0)
            self.assertEqual(repo.count(), 1)
            storage.close()

    def test_release_returns_reserved_quota(self) -> None:
        with tempfile.TemporaryDirectory() as tmp_dir:
            db_path = Path(tmp_dir) / "quota.db"
            storage = DatabaseStorageBackend(f"sqlite:///{db_path.as_posix()}")
            storage.save_users([
                {
                    "id": "user-a",
                    "email": "user-a@example.com",
                    "role": "user",
                    "status": "active",
                    "quota": 1,
                    "quota_used": 0,
                }
            ])
            repo = storage.repository_provider.quota_reservations

            repo.reserve("user-a", 1, "request-a")
            self.assertEqual(storage.load_users()[0]["quota"], 0)

            released = repo.release("request-a")

            self.assertIsNotNone(released)
            self.assertEqual(released["status"], "released")
            self.assertEqual(storage.load_users()[0]["quota"], 1)
            self.assertEqual(storage.load_users()[0]["quota_used"], 0)
            storage.close()

    def test_confirm_refunds_unused_reserved_quota(self) -> None:
        with tempfile.TemporaryDirectory() as tmp_dir:
            db_path = Path(tmp_dir) / "quota.db"
            storage = DatabaseStorageBackend(f"sqlite:///{db_path.as_posix()}")
            storage.save_users([
                {
                    "id": "user-a",
                    "email": "user-a@example.com",
                    "role": "user",
                    "status": "active",
                    "quota": 4,
                    "quota_used": 0,
                }
            ])
            repo = storage.repository_provider.quota_reservations

            repo.reserve("user-a", 3, "request-a")
            confirmed = repo.confirm("request-a", amount=2)
            user = storage.load_users()[0]

            self.assertIsNotNone(confirmed)
            self.assertEqual(confirmed["status"], "confirmed")
            self.assertEqual(confirmed["confirmed_amount"], 2)
            self.assertEqual(confirmed["released_amount"], 1)
            self.assertEqual(user["quota"], 2)
            self.assertEqual(user["quota_used"], 2)
            storage.close()

    def test_expired_reservation_returns_quota(self) -> None:
        with tempfile.TemporaryDirectory() as tmp_dir:
            db_path = Path(tmp_dir) / "quota.db"
            storage = DatabaseStorageBackend(f"sqlite:///{db_path.as_posix()}")
            storage.save_users([
                {
                    "id": "user-a",
                    "email": "user-a@example.com",
                    "role": "user",
                    "status": "active",
                    "quota": 1,
                    "quota_used": 0,
                }
            ])
            repo = storage.repository_provider.quota_reservations

            repo.reserve("user-a", 1, "request-a")
            with storage.engine.begin() as connection:
                connection.execute(
                    text("UPDATE quota_reservations SET expires_at = :expires_at"),
                    {"expires_at": "2000-01-01T00:00:00+00:00"},
                )

            self.assertEqual(repo.expire(), 1)
            reservation = repo.list()[0]
            user = storage.load_users()[0]

            self.assertEqual(reservation["status"], "expired")
            self.assertEqual(user["quota"], 1)
            self.assertEqual(user["quota_used"], 0)
            storage.close()


if __name__ == "__main__":
    unittest.main()
