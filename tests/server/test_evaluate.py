"""POST /evaluate — FEL expression evaluation endpoint tests."""


def test_evaluate_simple_arithmetic(client):
    r = client.post("/evaluate", json={
        "expression": "1 + 2",
        "data": {},
    })
    assert r.status_code == 200
    body = r.json()
    assert body["value"] == 3
    assert body["type"] == "number"
    assert body["diagnostics"] == []


def test_evaluate_field_reference(client):
    r = client.post("/evaluate", json={
        "expression": "$price * $quantity",
        "data": {"price": 10, "quantity": 5},
    })
    assert r.status_code == 200
    assert r.json()["value"] == 50


def test_evaluate_string_function(client):
    r = client.post("/evaluate", json={
        "expression": "upper('hello')",
        "data": {},
    })
    assert r.status_code == 200
    assert r.json()["value"] == "HELLO"
    assert r.json()["type"] == "string"


def test_evaluate_syntax_error(client):
    r = client.post("/evaluate", json={
        "expression": "1 + + 2",
        "data": {},
    })
    assert r.status_code == 400
    assert "error" in r.json()["detail"]


def test_evaluate_missing_expression(client):
    r = client.post("/evaluate", json={"data": {}})
    assert r.status_code == 422
