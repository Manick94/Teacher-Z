"""
Core API tests for Teacher-Z.

Run with: pytest backend/tests/ -v
"""
from __future__ import annotations

import io
import os


class TestHealth:
    def test_health(self, client):
        r = client.get("/health")
        assert r.status_code == 200
        body = r.json()
        assert body["status"] == "ok"
        assert "version" in body

    def test_readiness(self, client):
        r = client.get("/health/ready")
        assert r.status_code == 200


class TestAuth:
    def test_register(self, client):
        r = client.post("/api/v1/auth/register", json={
            "email": "newuser@teacher.z",
            "password": "securepass123",
            "full_name": "New Teacher",
        })
        assert r.status_code == 201
        assert r.json()["email"] == "newuser@teacher.z"

    def test_register_duplicate_email(self, client):
        payload = {"email": "dup@teacher.z", "password": "pass1234xx"}
        client.post("/api/v1/auth/register", json=payload)
        r = client.post("/api/v1/auth/register", json=payload)
        assert r.status_code == 409

    def test_login(self, client):
        client.post("/api/v1/auth/register", json={
            "email": "login@teacher.z",
            "password": "loginpass123",
        })
        r = client.post("/api/v1/auth/login", json={
            "email": "login@teacher.z",
            "password": "loginpass123",
        })
        assert r.status_code == 200
        data = r.json()
        assert "access_token" in data
        assert "refresh_token" in data

    def test_login_wrong_password(self, client):
        client.post("/api/v1/auth/register", json={
            "email": "wrongpass@teacher.z",
            "password": "correctpass123",
        })
        r = client.post("/api/v1/auth/login", json={
            "email": "wrongpass@teacher.z",
            "password": "wrongpass123",
        })
        assert r.status_code == 401

    def test_me(self, client, auth_headers):
        r = client.get("/api/v1/auth/me", headers=auth_headers)
        assert r.status_code == 200
        assert r.json()["email"] == "test@teacher.z"

    def test_me_no_token(self, client):
        r = client.get("/api/v1/auth/me")
        # HTTPBearer returns 403 when Authorization header is absent
        assert r.status_code in (401, 403)


class TestDatasets:
    def test_list_datasets(self, client, auth_headers):
        r = client.get("/api/v1/datasets", headers=auth_headers)
        assert r.status_code == 200
        assert isinstance(r.json(), list)

    def test_create_dataset(self, client, auth_headers, tmp_path, monkeypatch):
        # Patch the datasets_root property so the folder is created in tmp_path
        from backend.app.core.config import get_settings
        settings = get_settings()
        monkeypatch.setattr(type(settings), "datasets_root",
                            property(lambda self: tmp_path / "datasets"))

        r = client.post("/api/v1/datasets", json={
            "name": "test-science",
            "display_name": "Test Science",
            "subject": "science",
            "grade_level": "5",
        }, headers=auth_headers)
        assert r.status_code == 201
        data = r.json()
        assert data["name"] == "test-science"
        assert data["subject"] == "science"


class TestGenerate:
    def _setup(self, client, auth_headers, tmp_path, monkeypatch, ds_name: str):
        """Helper: create dataset folder + image + register dataset."""
        from backend.app.core.config import get_settings
        settings = get_settings()
        datasets_root = tmp_path / "datasets"
        monkeypatch.setattr(type(settings), "datasets_root",
                            property(lambda self: datasets_root))
        monkeypatch.setattr(type(settings), "models_root",
                            property(lambda self: tmp_path / "models"))
        monkeypatch.setattr(settings, "llm_provider", "stub")
        monkeypatch.setattr(settings, "image_provider", "stub")

        ds_folder = datasets_root / ds_name
        ds_folder.mkdir(parents=True, exist_ok=True)

        # Create a minimal valid PNG (1x1 pixel)
        import struct, zlib
        def tiny_png():
            def chunk(name, data):
                c = struct.pack(">I", len(data)) + name + data
                return c + struct.pack(">I", zlib.crc32(name + data) & 0xFFFFFFFF)
            hdr = b"\x89PNG\r\n\x1a\n"
            return hdr + chunk(b"IHDR", struct.pack(">IIBBBBB", 1, 1, 8, 2, 0, 0, 0)) + \
                   chunk(b"IDAT", zlib.compress(b"\x00\xff\x00\x00")) + chunk(b"IEND", b"")

        (ds_folder / "test.png").write_bytes(tiny_png())

        resp = client.post("/api/v1/datasets", json={"name": ds_name}, headers=auth_headers)
        assert resp.status_code == 201
        return ds_name

    def test_generate_stub(self, client, auth_headers, tmp_path, monkeypatch):
        """End-to-end generation with stub providers (no ML required)."""
        ds = self._setup(client, auth_headers, tmp_path, monkeypatch, "gen-ds")

        r = client.post("/api/v1/generate", json={
            "dataset_name": ds,
            "image_filename": "test.png",
            "lesson_type": "lesson",
            "subject": "science",
            "grade_level": "5",
        }, headers=auth_headers)

        assert r.status_code == 200
        data = r.json()
        assert "a2ui_schema" in data
        schema = data["a2ui_schema"]
        assert schema["schema_version"] == "1.0"
        assert "components" in schema
        assert len(schema["components"]) > 0
        assert data["cached"] is False

    def test_generate_cached(self, client, auth_headers, tmp_path, monkeypatch):
        """Second call for same image with same params returns cached=True."""
        ds = self._setup(client, auth_headers, tmp_path, monkeypatch, "cache-ds")

        payload = {
            "dataset_name": ds,
            "image_filename": "test.png",
            "lesson_type": "quiz",
            "grade_level": "4",
        }
        r1 = client.post("/api/v1/generate", json=payload, headers=auth_headers)
        assert r1.status_code == 200
        assert r1.json()["cached"] is False

        r2 = client.post("/api/v1/generate", json=payload, headers=auth_headers)
        assert r2.status_code == 200
        assert r2.json()["cached"] is True

    def test_generate_all_lesson_types(self, client, auth_headers, tmp_path, monkeypatch):
        """All lesson types produce valid A2UI documents."""
        ds = self._setup(client, auth_headers, tmp_path, monkeypatch, "types-ds")

        for lesson_type in ("lesson", "quiz", "flashcard", "worksheet", "vocabulary"):
            r = client.post("/api/v1/generate", json={
                "dataset_name": ds,
                "image_filename": "test.png",
                "lesson_type": lesson_type,
                "regenerate": True,
            }, headers=auth_headers)
            assert r.status_code == 200, f"Failed for lesson_type={lesson_type}: {r.text}"
            schema = r.json()["a2ui_schema"]
            assert schema["metadata"]["lesson_type"] == lesson_type
            assert len(schema["components"]) > 0
