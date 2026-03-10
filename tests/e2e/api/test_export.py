"""POST /export/{format} — Multi-format export endpoint tests."""


def test_export_json(client):
    r = client.post("/export/json", json={"data": {"applicantInfo": {"orgName": "Test Org"}}})
    assert r.status_code == 200
    assert r.headers["content-type"].startswith("application/json")


def test_export_csv(client):
    r = client.post("/export/csv", json={"data": {"applicantInfo": {"orgName": "Test Org"}}})
    assert r.status_code == 200
    assert "text/csv" in r.headers["content-type"]


def test_export_xml(client):
    r = client.post("/export/xml", json={"data": {"applicantInfo": {"orgName": "Test Org"}}})
    assert r.status_code == 200
    assert "xml" in r.headers["content-type"]


def test_export_invalid_format(client):
    r = client.post("/export/yaml", json={"data": {}})
    assert r.status_code == 400
