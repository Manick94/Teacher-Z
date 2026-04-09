from __future__ import annotations

import pytest
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker

from backend.app.db.database import Base, get_db

# In-memory SQLite for tests
TEST_DATABASE_URL = "sqlite:///:memory:"

engine = create_engine(TEST_DATABASE_URL, connect_args={"check_same_thread": False})
TestingSessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)


@pytest.fixture(scope="session", autouse=True)
def db_engine():
    from backend.app.models import orm  # noqa — register ORM models with Base
    Base.metadata.create_all(bind=engine)
    yield engine
    Base.metadata.drop_all(bind=engine)


@pytest.fixture
def db(db_engine):
    connection = db_engine.connect()
    transaction = connection.begin()
    session = TestingSessionLocal(bind=connection)
    yield session
    session.close()
    transaction.rollback()
    connection.close()


@pytest.fixture
def client(db):
    # Import here to avoid early lifespan trigger
    from backend.app.main import app

    def override_get_db():
        yield db

    app.dependency_overrides[get_db] = override_get_db
    # use_lifespan=False keeps the startup from touching the real SQLite file
    with TestClient(app, raise_server_exceptions=True) as c:
        yield c
    app.dependency_overrides.clear()


@pytest.fixture
def auth_headers(client):
    """Register + login, return Bearer headers."""
    client.post("/api/v1/auth/register", json={
        "email": "test@teacher.z",
        "password": "testpassword123",
        "full_name": "Test Teacher",
    })
    resp = client.post("/api/v1/auth/login", json={
        "email": "test@teacher.z",
        "password": "testpassword123",
    })
    assert resp.status_code == 200, f"Login failed: {resp.text}"
    token = resp.json()["access_token"]
    return {"Authorization": f"Bearer {token}"}
