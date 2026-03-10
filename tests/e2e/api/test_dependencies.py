"""Tests for GET /dependencies — field dependency graph."""


def test_dependencies_returns_graph(client):
    r = client.get("/dependencies")
    assert r.status_code == 200
    body = r.json()
    assert isinstance(body, dict)
    assert len(body) > 0


def test_dependencies_structure(client):
    r = client.get("/dependencies")
    body = r.json()
    for path, info in body.items():
        assert "depends_on" in info
        assert "expression" in info
        assert isinstance(info["depends_on"], list)
        assert isinstance(info["expression"], str)


def test_dependencies_known_field(client):
    """budget.lineItems[*].subtotal has calculate: '$unitCost * $quantity'"""
    r = client.get("/dependencies")
    body = r.json()
    assert "budget.lineItems[*].subtotal" in body
    entry = body["budget.lineItems[*].subtotal"]
    assert "unitCost" in entry["depends_on"]
    assert "quantity" in entry["depends_on"]
