"""
Basic API tests
"""

import pytest
from fastapi.testclient import TestClient
from main import app

client = TestClient(app)


def test_health_check():
    """Test health check endpoint"""
    response = client.get("/health")
    assert response.status_code == 200
    data = response.json()
    assert data["status"] == "operational"
    assert "version" in data


def test_root_endpoint():
    """Test root endpoint"""
    response = client.get("/")
    assert response.status_code == 200
    data = response.json()
    assert "message" in data
    assert "version" in data


def test_api_documentation():
    """Test API documentation is accessible in debug mode"""
    response = client.get("/api/v1/docs")
    # Should return HTML for docs or redirect
    assert response.status_code in [200, 307]