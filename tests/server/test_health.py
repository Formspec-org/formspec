"""Baseline health-check and definition endpoint tests."""


def test_health(client):
    r = client.get("/health")
    assert r.status_code == 200
    assert r.json() == {"ok": True}


def test_get_definition(client):
    r = client.get("/definition")
    assert r.status_code == 200
    body = r.json()
    assert "items" in body
    assert "binds" in body
