"""POST /changelog — Definition version diffing endpoint tests."""


def test_changelog_identical_definitions(client):
    """Two identical definitions should produce no changes."""
    defn = client.get("/definition").json()
    r = client.post("/changelog", json={"old": defn, "new": defn})
    assert r.status_code == 200
    body = r.json()
    assert body["semverImpact"] == "patch"
    assert isinstance(body["changes"], list)


def test_changelog_added_item(client):
    """Adding an item should be classified as compatible/minor."""
    defn = client.get("/definition").json()
    modified = {**defn, "version": "1.1.0"}
    modified["items"] = [*defn["items"], {
        "key": "newField",
        "type": "field",
        "dataType": "string",
        "label": "New Field",
    }]
    r = client.post("/changelog", json={"old": defn, "new": modified})
    assert r.status_code == 200
    body = r.json()
    assert any(c["type"] == "added" for c in body["changes"])
    assert body["semverImpact"] in ("minor", "patch")


def test_changelog_missing_old(client):
    r = client.post("/changelog", json={"new": {"items": []}})
    assert r.status_code == 422
