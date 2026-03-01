"""Tests for GET /registry and GET /registry/validate endpoints."""


def test_registry_list_all(client):
    r = client.get("/registry")
    assert r.status_code == 200
    body = r.json()
    assert "entries" in body
    assert len(body["entries"]) > 0


def test_registry_filter_by_category(client):
    r = client.get("/registry?category=dataType")
    assert r.status_code == 200
    body = r.json()
    for entry in body["entries"]:
        assert entry["category"] == "dataType"


def test_registry_filter_by_status(client):
    r = client.get("/registry?status=stable")
    assert r.status_code == 200
    for entry in r.json()["entries"]:
        assert entry["status"] == "stable"


def test_registry_filter_by_name(client):
    r = client.get("/registry?name=x-grants-gov-ssn")
    assert r.status_code == 200
    body = r.json()
    assert len(body["entries"]) >= 1
    assert body["entries"][0]["name"] == "x-grants-gov-ssn"


def test_registry_validate(client):
    r = client.get("/registry/validate")
    assert r.status_code == 200
    body = r.json()
    assert "errors" in body
