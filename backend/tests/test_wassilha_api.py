"""WASSILHA end-to-end backend API tests."""
import os
import time
import pytest
import requests

BASE_URL = os.environ.get("REACT_APP_BACKEND_URL", "https://wassilha-business.preview.emergentagent.com").rstrip("/")
API = f"{BASE_URL}/api"

ADMIN_EMAIL = "nidalwatfa99@gmail.com"
ADMIN_PASSWORD = "Wassilha@2026"


@pytest.fixture(scope="session")
def admin_session():
    s = requests.Session()
    s.headers.update({"Content-Type": "application/json"})
    r = s.post(f"{API}/auth/login", json={"email": ADMIN_EMAIL, "password": ADMIN_PASSWORD})
    assert r.status_code == 200, f"login failed: {r.status_code} {r.text}"
    return s


# ---------- Auth ----------
class TestAuth:
    def test_login_admin(self):
        s = requests.Session()
        r = s.post(f"{API}/auth/login", json={"email": ADMIN_EMAIL, "password": ADMIN_PASSWORD})
        assert r.status_code == 200
        data = r.json()
        assert data["email"] == ADMIN_EMAIL
        assert data["role"] == "admin"
        assert "access_token" in s.cookies

    def test_login_invalid(self):
        r = requests.post(f"{API}/auth/login", json={"email": ADMIN_EMAIL, "password": "bad"})
        assert r.status_code in (401, 429)

    def test_me_requires_auth(self):
        r = requests.get(f"{API}/auth/me")
        assert r.status_code == 401

    def test_me_ok(self, admin_session):
        r = admin_session.get(f"{API}/auth/me")
        assert r.status_code == 200
        assert r.json()["email"] == ADMIN_EMAIL

    def test_register_new_user_and_isolation(self):
        s = requests.Session()
        s.headers.update({"Content-Type": "application/json"})
        email = f"test_{int(time.time())}@example.com"
        r = s.post(f"{API}/auth/register", json={"name": "TEST User", "email": email, "password": "pass12345"})
        assert r.status_code == 200, r.text
        assert r.json()["email"] == email
        # seeded demo data present
        rc = s.get(f"{API}/customers")
        assert rc.status_code == 200
        assert len(rc.json()) >= 1

    def test_register_and_login_by_phone(self):
        s = requests.Session()
        phone = f"+316{int(time.time()) % 100000000}"
        r = s.post(f"{API}/auth/register", json={"name": "Phone User", "phone": phone, "password": "pass12345"})
        assert r.status_code == 200, r.text
        s2 = requests.Session()
        r2 = s2.post(f"{API}/auth/login", json={"identifier": phone, "password": "pass12345"})
        assert r2.status_code == 200, r2.text
        assert r2.json()["phone"] == phone

    def test_logout(self, admin_session):
        s = requests.Session()
        s.post(f"{API}/auth/login", json={"email": ADMIN_EMAIL, "password": ADMIN_PASSWORD})
        r = s.post(f"{API}/auth/logout")
        assert r.status_code == 200


# ---------- Dashboard & Insights ----------
class TestDashboard:
    def test_dashboard(self, admin_session):
        r = admin_session.get(f"{API}/dashboard")
        assert r.status_code == 200
        d = r.json()
        for k in ("stats", "sales_series", "recent_orders", "recent_payments", "upcoming_tasks", "currency"):
            assert k in d
        assert "customers_count" in d["stats"]

    def test_insights(self, admin_session):
        r = admin_session.get(f"{API}/insights")
        assert r.status_code == 200
        d = r.json()
        assert "top_products" in d and "top_customers" in d


# ---------- CRUD: customers/products/tasks/events ----------
class TestCustomerCRUD:
    def test_create_get_update_delete(self, admin_session):
        r = admin_session.post(f"{API}/customers", json={"name": "TEST_Customer", "phone": "111", "email": "t@t.com"})
        assert r.status_code == 200
        cid = r.json()["id"]
        assert r.json()["name"] == "TEST_Customer"

        rg = admin_session.get(f"{API}/customers/{cid}")
        assert rg.status_code == 200 and rg.json()["phone"] == "111"

        ru = admin_session.put(f"{API}/customers/{cid}", json={"name": "TEST_Customer2", "phone": "222"})
        assert ru.status_code == 200 and ru.json()["name"] == "TEST_Customer2"

        # search
        rs = admin_session.get(f"{API}/customers?search=TEST_Customer2")
        assert rs.status_code == 200
        assert any(c["id"] == cid for c in rs.json())

        rd = admin_session.delete(f"{API}/customers/{cid}")
        assert rd.status_code == 200
        rg2 = admin_session.get(f"{API}/customers/{cid}")
        assert rg2.status_code == 404


class TestProductCRUD:
    def test_product_crud(self, admin_session):
        r = admin_session.post(f"{API}/products", json={"name": "TEST_Prod", "price": 25, "type": "product"})
        assert r.status_code == 200
        pid = r.json()["id"]
        ru = admin_session.put(f"{API}/products/{pid}", json={"name": "TEST_Prod2", "price": 50, "type": "product"})
        assert ru.json()["price"] == 50
        admin_session.delete(f"{API}/products/{pid}")


class TestTaskCRUD:
    def test_task(self, admin_session):
        r = admin_session.post(f"{API}/tasks", json={"title": "TEST_Task", "priority": "high"})
        assert r.status_code == 200
        tid = r.json()["id"]
        # mark done via PUT
        ru = admin_session.put(f"{API}/tasks/{tid}", json={"title": "TEST_Task", "status": "done"})
        assert ru.json()["status"] == "done"
        admin_session.delete(f"{API}/tasks/{tid}")


class TestEventCRUD:
    def test_event(self, admin_session):
        r = admin_session.post(f"{API}/events", json={"title": "TEST_Event", "date": "2026-02-01"})
        assert r.status_code == 200
        eid = r.json()["id"]
        admin_session.delete(f"{API}/events/{eid}")


# ---------- Documents / conversion / payment flow ----------
class TestDocumentFlow:
    def test_quote_to_order_to_invoice_payment(self, admin_session):
        # customer
        cr = admin_session.post(f"{API}/customers", json={"name": "TEST_DocFlowCust"})
        cid = cr.json()["id"]
        # product
        pr = admin_session.post(f"{API}/products", json={"name": "TEST_Item", "price": 100, "type": "product"})
        pid = pr.json()["id"]
        # quote
        q = admin_session.post(f"{API}/quotes", json={
            "customer_id": cid, "tax_rate": 10, "discount": 0,
            "items": [{"product_id": pid, "name": "TEST_Item", "quantity": 2, "unit_price": 100, "discount": 0}]
        })
        assert q.status_code == 200
        qdata = q.json()
        assert qdata["subtotal"] == 200
        assert qdata["tax_total"] == 20
        assert qdata["total"] == 220
        qid = qdata["id"]

        # convert
        conv = admin_session.post(f"{API}/quotes/{qid}/convert")
        assert conv.status_code == 200
        oid = conv.json()["id"]
        assert conv.json()["quote_id"] == qid

        # order->invoice
        inv = admin_session.post(f"{API}/orders/{oid}/invoice")
        assert inv.status_code == 200
        inv_data = inv.json()
        iid = inv_data["id"]
        assert inv_data["total"] == 220

        # partial payment
        p1 = admin_session.post(f"{API}/payments", json={"invoice_id": iid, "amount": 100, "method": "cash"})
        assert p1.status_code == 200
        rinv = admin_session.get(f"{API}/invoices/{iid}").json()
        assert rinv["amount_paid"] == 100
        assert rinv["status"] == "partially_paid"

        # full payment
        p2 = admin_session.post(f"{API}/payments", json={"invoice_id": iid, "amount": 120, "method": "card"})
        assert p2.status_code == 200
        rinv2 = admin_session.get(f"{API}/invoices/{iid}").json()
        assert rinv2["amount_paid"] == 220
        assert rinv2["status"] == "paid"

        # delete payment recomputes
        admin_session.delete(f"{API}/payments/{p2.json()['id']}")
        rinv3 = admin_session.get(f"{API}/invoices/{iid}").json()
        assert rinv3["status"] == "partially_paid"

        # cleanup
        admin_session.delete(f"{API}/payments/{p1.json()['id']}")
        admin_session.delete(f"{API}/invoices/{iid}")
        admin_session.delete(f"{API}/orders/{oid}")
        admin_session.delete(f"{API}/quotes/{qid}")
        admin_session.delete(f"{API}/products/{pid}")
        admin_session.delete(f"{API}/customers/{cid}")


# ---------- Inbox ----------
class TestInbox:
    def test_conversation_flow(self, admin_session):
        r = admin_session.post(f"{API}/conversations", json={"subject": "TEST_Conv"})
        assert r.status_code == 200
        conv_id = r.json()["id"]
        m = admin_session.post(f"{API}/conversations/{conv_id}/messages", json={"text": "hello", "sender": "business"})
        assert m.status_code == 200 and m.json()["text"] == "hello"
        lst = admin_session.get(f"{API}/conversations").json()
        got = [c for c in lst if c["id"] == conv_id][0]
        assert len(got["messages"]) == 1
        admin_session.delete(f"{API}/conversations/{conv_id}")


# ---------- Feedback ----------
class TestFeedback:
    def test_submit(self, admin_session):
        r = admin_session.post(f"{API}/feedback", json={"type": "bug", "subject": "TEST", "message": "hello"})
        assert r.status_code == 200 and r.json()["ok"] is True


# ---------- Settings, Export/Import ----------
class TestSettings:
    def test_update_and_export(self, admin_session):
        r = admin_session.put(f"{API}/settings", json={"currency": "EUR", "language": "en"})
        assert r.status_code == 200 and r.json()["currency"] == "EUR"
        g = admin_session.get(f"{API}/settings").json()
        assert g["currency"] == "EUR"
        # restore
        admin_session.put(f"{API}/settings", json={"currency": "USD"})
        ex = admin_session.get(f"{API}/export")
        assert ex.status_code == 200
        d = ex.json()
        for k in ("customers", "products", "quotes", "orders", "invoices", "payments", "tasks", "settings"):
            assert k in d


# ---------- AI ----------
class TestAI:
    def test_status(self, admin_session):
        r = admin_session.get(f"{API}/ai/status")
        assert r.status_code == 200 and r.json()["configured"] is True

    def test_chat_en(self, admin_session):
        r = admin_session.post(f"{API}/ai/chat", json={
            "messages": [{"role": "user", "content": "How many customers do I have?"}],
            "language": "en"
        }, timeout=45)
        assert r.status_code == 200, r.text
        assert isinstance(r.json().get("reply"), str) and len(r.json()["reply"]) > 0

    def test_chat_missing_msgs(self, admin_session):
        r = admin_session.post(f"{API}/ai/chat", json={"messages": [], "language": "en"})
        assert r.status_code == 400


# ---------- Multi-tenancy ----------
class TestIsolation:
    def test_user_cannot_see_admin_data(self):
        # register new user
        s = requests.Session()
        s.headers.update({"Content-Type": "application/json"})
        email = f"iso_{int(time.time())}@example.com"
        r = s.post(f"{API}/auth/register", json={"name": "IsoUser", "email": email, "password": "pass12345"})
        assert r.status_code == 200
        # create customer as this user
        rc = s.post(f"{API}/customers", json={"name": "IsoOnlyCustomer"})
        assert rc.status_code == 200
        my_cid = rc.json()["id"]

        # admin login and check they can't see it
        a = requests.Session()
        a.headers.update({"Content-Type": "application/json"})
        a.post(f"{API}/auth/login", json={"email": ADMIN_EMAIL, "password": ADMIN_PASSWORD})
        ra = a.get(f"{API}/customers/{my_cid}")
        assert ra.status_code == 404
