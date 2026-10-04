from dotenv import load_dotenv
from pathlib import Path
load_dotenv(Path(__file__).parent / ".env")

import os
import uuid
import logging
from datetime import datetime, timezone
from typing import List, Optional, Any

from fastapi import FastAPI, APIRouter, Depends, HTTPException, Query, UploadFile, File, Form
from fastapi.responses import FileResponse
from cryptography.fernet import Fernet, InvalidToken
from starlette.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field

from database import db, client
from auth import auth_router, get_current_user, seed_admin
import ai_service

logging.basicConfig(level=logging.INFO,
                    format="%(asctime)s - %(name)s - %(levelname)s - %(message)s")
logger = logging.getLogger("wassilha")

app = FastAPI(title="WASSILHA API")
api = APIRouter(prefix="/api")


def now_iso() -> str:
    return datetime.now(timezone.utc).isoformat()


def new_id() -> str:
    return str(uuid.uuid4())


# ----------------------------- Models -----------------------------
class Customer(BaseModel):
    name: str = Field(min_length=1, max_length=160)
    phone: Optional[str] = ""
    email: Optional[str] = ""
    address: Optional[str] = ""
    notes: Optional[str] = ""
    status: str = "active"
    lat: Optional[float] = None
    lng: Optional[float] = None


class Product(BaseModel):
    name: str = Field(min_length=1, max_length=160)
    description: Optional[str] = ""
    price: float = 0
    category: Optional[str] = ""
    sku: Optional[str] = ""
    type: str = "product"  # product | service
    unit: Optional[str] = ""
    status: str = "available"
    notes: Optional[str] = ""


class LineItem(BaseModel):
    product_id: Optional[str] = None
    name: str = ""
    quantity: float = 1
    unit_price: float = 0
    discount: float = 0  # amount per line


class DocumentIn(BaseModel):
    customer_id: Optional[str] = None
    items: List[LineItem] = []
    discount: float = 0
    tax_rate: float = 0
    notes: Optional[str] = ""
    status: Optional[str] = None
    date: Optional[str] = None
    currency: Optional[str] = None
    valid_until: Optional[str] = None
    due_date: Optional[str] = None
    delivery_address: Optional[str] = None
    delivery_lat: Optional[float] = None
    delivery_lng: Optional[float] = None
    delivery_status: Optional[str] = None


class Task(BaseModel):
    title: str = Field(min_length=1, max_length=200)
    description: Optional[str] = ""
    due_date: Optional[str] = None
    priority: str = "medium"
    status: str = "todo"
    customer_id: Optional[str] = None
    order_id: Optional[str] = None


class CalendarEvent(BaseModel):
    title: str = Field(min_length=1, max_length=200)
    date: str
    time: Optional[str] = ""
    type: str = "event"
    notes: Optional[str] = ""
    customer_id: Optional[str] = None


class PaymentIn(BaseModel):
    customer_id: Optional[str] = None
    invoice_id: Optional[str] = None
    order_id: Optional[str] = None
    amount: float = 0
    date: Optional[str] = None
    method: str = "cash"
    notes: Optional[str] = ""


class ConversationIn(BaseModel):
    customer_id: Optional[str] = None
    subject: str = "Conversation"


class MessageIn(BaseModel):
    text: Optional[str] = ""
    sender: str = "business"
    kind: str = "text"  # text | audio | image | file
    attachment_id: Optional[str] = None
    attachment_url: Optional[str] = None
    file_name: Optional[str] = None
    mime_type: Optional[str] = None
    size: Optional[int] = None
    duration: Optional[float] = None


class FeedbackIn(BaseModel):
    type: str = "general"
    subject: str = ""
    message: str = Field(min_length=1)
    contact: Optional[str] = ""


class SettingsIn(BaseModel):
    business_name: Optional[str] = None
    business_phone: Optional[str] = None
    business_email: Optional[str] = None
    business_address: Optional[str] = None
    business_lat: Optional[float] = None
    business_lng: Optional[float] = None
    currency: Optional[str] = None
    language: Optional[str] = None
    theme: Optional[str] = None
    ai_provider: Optional[str] = None
    ai_model: Optional[str] = None
    ai_api_key: Optional[str] = None


class AIChatIn(BaseModel):
    messages: List[dict]
    language: str = "en"
    session_id: Optional[str] = None


# ----------------------------- Helpers -----------------------------
def clean(doc: dict) -> dict:
    doc.pop("_id", None)
    return doc




def _fernet() -> Fernet:
    key = os.environ.get("DATA_ENCRYPTION_KEY")
    if not key:
        raise RuntimeError("DATA_ENCRYPTION_KEY is not configured")
    return Fernet(key.encode())

def encrypt_secret(value: str) -> str:
    return _fernet().encrypt(value.encode()).decode()

def decrypt_secret(value: str) -> str:
    return _fernet().decrypt(value.encode()).decode()

def compute_totals(items: List[dict], discount: float, tax_rate: float) -> dict:
    subtotal = 0.0
    for it in items:
        line = (it.get("quantity", 0) or 0) * (it.get("unit_price", 0) or 0) - (it.get("discount", 0) or 0)
        subtotal += max(line, 0)
    subtotal = round(subtotal, 2)
    discount = round(discount or 0, 2)
    taxable = max(subtotal - discount, 0)
    tax_total = round(taxable * (tax_rate or 0) / 100, 2)
    total = round(taxable + tax_total, 2)
    return {"subtotal": subtotal, "discount_total": discount,
            "tax_total": tax_total, "total": total}


async def next_number(owner_id: str, collection: str, prefix: str) -> str:
    count = await db[collection].count_documents({"owner_id": owner_id})
    return f"{prefix}-{count + 1:04d}"


async def get_owned(collection: str, item_id: str, owner_id: str) -> dict:
    doc = await db[collection].find_one({"id": item_id, "owner_id": owner_id}, {"_id": 0})
    if not doc:
        raise HTTPException(status_code=404, detail="Not found")
    return doc


async def customer_name(owner_id: str, customer_id: Optional[str]) -> str:
    if not customer_id:
        return ""
    c = await db.customers.find_one({"id": customer_id, "owner_id": owner_id}, {"_id": 0, "name": 1})
    return c["name"] if c else ""


# ----------------------------- Generic CRUD for simple resources -----------------------------
def register_simple(path: str, collection: str, Model, search_fields: List[str]):
    @api.get(f"/{path}")
    async def list_items(user: dict = Depends(get_current_user),
                         search: Optional[str] = None, status: Optional[str] = None):
        q: dict = {"owner_id": user["id"]}
        if status and status != "all":
            q["status"] = status
        if search:
            q["$or"] = [{f: {"$regex": search, "$options": "i"}} for f in search_fields]
        items = await db[collection].find(q, {"_id": 0}).sort("created_at", -1).to_list(1000)
        return items

    @api.post(f"/{path}")
    async def create_item(data: Model, user: dict = Depends(get_current_user)):
        doc = data.model_dump()
        doc.update({"id": new_id(), "owner_id": user["id"],
                    "created_at": now_iso(), "updated_at": now_iso()})
        await db[collection].insert_one(dict(doc))
        return clean(doc)

    @api.get(f"/{path}/{{item_id}}")
    async def get_item(item_id: str, user: dict = Depends(get_current_user)):
        return await get_owned(collection, item_id, user["id"])

    @api.put(f"/{path}/{{item_id}}")
    async def update_item(item_id: str, data: Model, user: dict = Depends(get_current_user)):
        await get_owned(collection, item_id, user["id"])
        upd = data.model_dump()
        upd["updated_at"] = now_iso()
        await db[collection].update_one({"id": item_id, "owner_id": user["id"]}, {"$set": upd})
        return await get_owned(collection, item_id, user["id"])

    @api.delete(f"/{path}/{{item_id}}")
    async def delete_item(item_id: str, user: dict = Depends(get_current_user)):
        res = await db[collection].delete_one({"id": item_id, "owner_id": user["id"]})
        if res.deleted_count == 0:
            raise HTTPException(status_code=404, detail="Not found")
        return {"ok": True}


register_simple("customers", "customers", Customer, ["name", "phone", "email", "address"])
register_simple("products", "products", Product, ["name", "sku", "category", "description"])
register_simple("tasks", "tasks", Task, ["title", "description"])
register_simple("events", "events", CalendarEvent, ["title", "notes"])


# ----------------------------- Documents (quotes / orders / invoices) -----------------------------
DOC_CONFIG = {
    "quotes": {"prefix": "QT", "default_status": "draft"},
    "orders": {"prefix": "ORD", "default_status": "new"},
    "invoices": {"prefix": "INV", "default_status": "draft"},
}


async def build_document(owner_id: str, collection: str, data: DocumentIn) -> dict:
    cfg = DOC_CONFIG[collection]
    items = [i.model_dump() for i in data.items]
    totals = compute_totals(items, data.discount, data.tax_rate)
    doc = {
        "id": new_id(), "owner_id": owner_id,
        "number": await next_number(owner_id, collection, cfg["prefix"]),
        "customer_id": data.customer_id,
        "customer_name": await customer_name(owner_id, data.customer_id),
        "items": items, "discount": data.discount, "tax_rate": data.tax_rate,
        "notes": data.notes or "", "status": data.status or cfg["default_status"],
        "date": data.date or now_iso()[:10], "currency": data.currency,
        "amount_paid": 0, **totals,
        "created_at": now_iso(), "updated_at": now_iso(),
    }
    if collection == "quotes":
        doc["valid_until"] = data.valid_until
    if collection == "invoices":
        doc["due_date"] = data.due_date
    if collection == "orders":
        doc["delivery_address"] = data.delivery_address or ""
        doc["delivery_lat"] = data.delivery_lat
        doc["delivery_lng"] = data.delivery_lng
        doc["delivery_status"] = data.delivery_status or "pending"
    return doc


def register_documents(path: str):
    @api.get(f"/{path}")
    async def list_docs(user: dict = Depends(get_current_user),
                        status: Optional[str] = None, customer_id: Optional[str] = None,
                        search: Optional[str] = None):
        q: dict = {"owner_id": user["id"]}
        if status and status != "all":
            q["status"] = status
        if customer_id:
            q["customer_id"] = customer_id
        if search:
            q["$or"] = [{"number": {"$regex": search, "$options": "i"}},
                        {"customer_name": {"$regex": search, "$options": "i"}}]
        return await db[path].find(q, {"_id": 0}).sort("created_at", -1).to_list(1000)

    @api.post(f"/{path}")
    async def create_doc(data: DocumentIn, user: dict = Depends(get_current_user)):
        doc = await build_document(user["id"], path, data)
        await db[path].insert_one(dict(doc))
        return clean(doc)

    @api.get(f"/{path}/{{item_id}}")
    async def get_doc(item_id: str, user: dict = Depends(get_current_user)):
        return await get_owned(path, item_id, user["id"])

    @api.put(f"/{path}/{{item_id}}")
    async def update_doc(item_id: str, data: DocumentIn, user: dict = Depends(get_current_user)):
        existing = await get_owned(path, item_id, user["id"])
        items = [i.model_dump() for i in data.items]
        totals = compute_totals(items, data.discount, data.tax_rate)
        upd = {"customer_id": data.customer_id,
               "customer_name": await customer_name(user["id"], data.customer_id),
               "items": items, "discount": data.discount, "tax_rate": data.tax_rate,
               "notes": data.notes or "", "date": data.date or existing.get("date"),
               "currency": data.currency, "updated_at": now_iso(), **totals}
        if data.status:
            upd["status"] = data.status
        if path == "quotes":
            upd["valid_until"] = data.valid_until
        if path == "invoices":
            upd["due_date"] = data.due_date
            upd["status"] = data.status or existing.get("status")
        if path == "orders":
            if data.delivery_address is not None:
                upd["delivery_address"] = data.delivery_address
            if data.delivery_lat is not None:
                upd["delivery_lat"] = data.delivery_lat
            if data.delivery_lng is not None:
                upd["delivery_lng"] = data.delivery_lng
            if data.delivery_status is not None:
                upd["delivery_status"] = data.delivery_status
        await db[path].update_one({"id": item_id, "owner_id": user["id"]}, {"$set": upd})
        return await get_owned(path, item_id, user["id"])

    @api.patch(f"/{path}/{{item_id}}/status")
    async def set_status(item_id: str, body: dict, user: dict = Depends(get_current_user)):
        await get_owned(path, item_id, user["id"])
        status = body.get("status")
        if not status:
            raise HTTPException(status_code=400, detail="status required")
        await db[path].update_one({"id": item_id, "owner_id": user["id"]},
                                  {"$set": {"status": status, "updated_at": now_iso()}})
        return await get_owned(path, item_id, user["id"])

    @api.delete(f"/{path}/{{item_id}}")
    async def delete_doc(item_id: str, user: dict = Depends(get_current_user)):
        res = await db[path].delete_one({"id": item_id, "owner_id": user["id"]})
        if res.deleted_count == 0:
            raise HTTPException(status_code=404, detail="Not found")
        return {"ok": True}


register_documents("quotes")
register_documents("orders")
register_documents("invoices")


@api.post("/quotes/{item_id}/convert")
async def quote_to_order(item_id: str, user: dict = Depends(get_current_user)):
    q = await get_owned("quotes", item_id, user["id"])
    order = await build_document(user["id"], "orders", DocumentIn(
        customer_id=q.get("customer_id"),
        items=[LineItem(**i) for i in q.get("items", [])],
        discount=q.get("discount", 0), tax_rate=q.get("tax_rate", 0),
        notes=q.get("notes", ""), currency=q.get("currency")))
    order["quote_id"] = item_id
    await db.orders.insert_one(dict(order))
    await db.quotes.update_one({"id": item_id, "owner_id": user["id"]},
                               {"$set": {"status": "accepted", "order_id": order["id"],
                                         "updated_at": now_iso()}})
    return clean(order)


@api.post("/orders/{item_id}/invoice")
async def order_to_invoice(item_id: str, user: dict = Depends(get_current_user)):
    o = await get_owned("orders", item_id, user["id"])
    if o.get("invoice_id"):
        existing = await db.invoices.find_one({"id": o["invoice_id"], "owner_id": user["id"]}, {"_id": 0})
        if existing:
            return existing
    inv = await build_document(user["id"], "invoices", DocumentIn(
        customer_id=o.get("customer_id"),
        items=[LineItem(**i) for i in o.get("items", [])],
        discount=o.get("discount", 0), tax_rate=o.get("tax_rate", 0),
        notes=o.get("notes", ""), currency=o.get("currency"),
        status="sent"))
    inv["order_id"] = item_id
    await db.invoices.insert_one(dict(inv))
    await db.orders.update_one({"id": item_id, "owner_id": user["id"]},
                               {"$set": {"invoice_id": inv["id"], "updated_at": now_iso()}})
    return clean(inv)


# ----------------------------- Payments -----------------------------
async def recompute_invoice(owner_id: str, invoice_id: str):
    inv = await db.invoices.find_one({"id": invoice_id, "owner_id": owner_id}, {"_id": 0})
    if not inv:
        return
    payments = await db.payments.find({"owner_id": owner_id, "invoice_id": invoice_id}, {"_id": 0}).to_list(1000)
    paid = round(sum(p.get("amount", 0) for p in payments), 2)
    total = inv.get("total", 0)
    if inv.get("status") == "cancelled":
        status = "cancelled"
    elif paid <= 0:
        status = inv.get("status") if inv.get("status") in ("draft", "sent", "overdue") else "sent"
    elif paid < total:
        status = "partially_paid"
    else:
        status = "paid"
    await db.invoices.update_one({"id": invoice_id, "owner_id": owner_id},
                                 {"$set": {"amount_paid": paid, "status": status, "updated_at": now_iso()}})


@api.get("/payments")
async def list_payments(user: dict = Depends(get_current_user),
                        customer_id: Optional[str] = None, method: Optional[str] = None):
    q: dict = {"owner_id": user["id"]}
    if customer_id:
        q["customer_id"] = customer_id
    if method and method != "all":
        q["method"] = method
    return await db.payments.find(q, {"_id": 0}).sort("created_at", -1).to_list(1000)


@api.post("/payments")
async def create_payment(data: PaymentIn, user: dict = Depends(get_current_user)):
    doc = data.model_dump()
    cid = data.customer_id
    if not cid and data.invoice_id:
        inv = await db.invoices.find_one({"id": data.invoice_id, "owner_id": user["id"]}, {"_id": 0})
        cid = inv.get("customer_id") if inv else None
    doc.update({"id": new_id(), "owner_id": user["id"], "customer_id": cid,
                "customer_name": await customer_name(user["id"], cid),
                "date": data.date or now_iso()[:10], "status": "completed",
                "created_at": now_iso(), "updated_at": now_iso()})
    await db.payments.insert_one(dict(doc))
    if data.invoice_id:
        await recompute_invoice(user["id"], data.invoice_id)
    return clean(doc)


@api.delete("/payments/{item_id}")
async def delete_payment(item_id: str, user: dict = Depends(get_current_user)):
    p = await db.payments.find_one({"id": item_id, "owner_id": user["id"]}, {"_id": 0})
    if not p:
        raise HTTPException(status_code=404, detail="Not found")
    await db.payments.delete_one({"id": item_id, "owner_id": user["id"]})
    if p.get("invoice_id"):
        await recompute_invoice(user["id"], p["invoice_id"])
    return {"ok": True}


# ----------------------------- Inbox -----------------------------
@api.get("/conversations")
async def list_conversations(user: dict = Depends(get_current_user)):
    return await db.conversations.find({"owner_id": user["id"]}, {"_id": 0}).sort("updated_at", -1).to_list(500)


@api.post("/conversations")
async def create_conversation(data: ConversationIn, user: dict = Depends(get_current_user)):
    doc = {"id": new_id(), "owner_id": user["id"], "customer_id": data.customer_id,
           "customer_name": await customer_name(user["id"], data.customer_id),
           "subject": data.subject, "messages": [],
           "created_at": now_iso(), "updated_at": now_iso()}
    await db.conversations.insert_one(dict(doc))
    return clean(doc)


@api.post("/conversations/{conv_id}/messages")
async def add_message(conv_id: str, data: MessageIn, user: dict = Depends(get_current_user)):
    await get_owned("conversations", conv_id, user["id"])
    msg = {"id": new_id(), "text": data.text or "", "sender": data.sender,
           "kind": data.kind, "attachment_id": data.attachment_id,
           "attachment_url": data.attachment_url, "file_name": data.file_name,
           "mime_type": data.mime_type, "size": data.size, "duration": data.duration,
           "at": now_iso()}
    await db.conversations.update_one({"id": conv_id, "owner_id": user["id"]},
                                      {"$push": {"messages": msg},
                                       "$set": {"updated_at": now_iso()}})
    return msg


@api.delete("/conversations/{conv_id}")
async def delete_conversation(conv_id: str, user: dict = Depends(get_current_user)):
    res = await db.conversations.delete_one({"id": conv_id, "owner_id": user["id"]})
    if res.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Not found")
    return {"ok": True}


# ----------------------------- Feedback -----------------------------
@api.post("/feedback")
async def create_feedback(data: FeedbackIn, user: dict = Depends(get_current_user)):
    doc = data.model_dump()
    doc.update({"id": new_id(), "owner_id": user["id"], "user_email": user.get("email"),
                "created_at": now_iso()})
    await db.feedback.insert_one(dict(doc))
    return {"ok": True, "id": doc["id"]}


# ----------------------------- Settings -----------------------------
DEFAULT_SETTINGS = {
    "business_name": "", "business_phone": "", "business_email": "",
    "business_address": "", "business_lat": None, "business_lng": None,
    "currency": "USD", "language": "auto",
    "theme": "system", "ai_provider": os.environ.get("AI_PROVIDER", "openai"),
    "ai_model": os.environ.get("AI_MODEL", "gpt-5.4"), "ai_api_key_enc": None,
}


async def ensure_settings(owner_id: str) -> dict:
    s = await db.settings.find_one({"owner_id": owner_id}, {"_id": 0})
    if not s:
        s = {"owner_id": owner_id, **DEFAULT_SETTINGS,
             "created_at": now_iso(), "updated_at": now_iso()}
        await db.settings.insert_one(dict(s))
    return clean(s)


@api.get("/settings")
async def get_settings(user: dict = Depends(get_current_user)):
    s = await ensure_settings(user["id"])
    s["ai_configured"] = bool(s.get("ai_api_key_enc") or os.environ.get("EMERGENT_LLM_KEY"))
    s.pop("ai_api_key_enc", None)
    return s


@api.put("/settings")
async def update_settings(data: SettingsIn, user: dict = Depends(get_current_user)):
    await ensure_settings(user["id"])
    raw = data.model_dump()
    ai_key = raw.pop("ai_api_key", None)
    upd = {k: v for k, v in raw.items() if v is not None}
    if ai_key is not None:
        if ai_key.strip():
            try: upd["ai_api_key_enc"] = encrypt_secret(ai_key.strip())
            except RuntimeError as exc: raise HTTPException(status_code=500, detail=str(exc))
        else:
            upd["ai_api_key_enc"] = None
    upd["updated_at"] = now_iso()
    await db.settings.update_one({"owner_id": user["id"]}, {"$set": upd})
    s = await ensure_settings(user["id"])
    s["ai_configured"] = bool(s.get("ai_api_key_enc") or os.environ.get("EMERGENT_LLM_KEY"))
    s.pop("ai_api_key_enc", None)
    return s


# ----------------------------- Dashboard / Insights -----------------------------
async def _sum_field(collection: str, owner_id: str, field: str, match: dict = None) -> float:
    q = {"owner_id": owner_id}
    if match:
        q.update(match)
    docs = await db[collection].find(q, {"_id": 0, field: 1}).to_list(5000)
    return round(sum(d.get(field, 0) or 0 for d in docs), 2)


async def dashboard_context(owner_id: str) -> dict:
    customers_count = await db.customers.count_documents({"owner_id": owner_id})
    products_count = await db.products.count_documents({"owner_id": owner_id})
    orders_count = await db.orders.count_documents({"owner_id": owner_id})
    open_orders = await db.orders.count_documents(
        {"owner_id": owner_id, "status": {"$in": ["new", "confirmed", "processing", "ready"]}})
    invoices_count = await db.invoices.count_documents({"owner_id": owner_id})
    unpaid_invoices = await db.invoices.count_documents(
        {"owner_id": owner_id, "status": {"$in": ["sent", "pending", "partially_paid", "overdue"]}})
    open_tasks = await db.tasks.count_documents({"owner_id": owner_id, "status": {"$ne": "done"}})
    total_paid = await _sum_field("payments", owner_id, "amount")
    inv_total = await _sum_field("invoices", owner_id, "total",
                                 {"status": {"$ne": "cancelled"}})
    inv_paid = await _sum_field("invoices", owner_id, "amount_paid",
                                {"status": {"$ne": "cancelled"}})
    outstanding = round(max(inv_total - inv_paid, 0), 2)
    recent_customers = await db.customers.find({"owner_id": owner_id}, {"_id": 0, "name": 1}).sort("created_at", -1).limit(5).to_list(5)
    unpaid_list = await db.invoices.find(
        {"owner_id": owner_id, "status": {"$in": ["sent", "pending", "partially_paid", "overdue"]}},
        {"_id": 0, "number": 1, "customer_name": 1, "total": 1, "amount_paid": 1}).limit(8).to_list(8)
    return {
        "customers_count": customers_count, "products_count": products_count,
        "orders_count": orders_count, "open_orders": open_orders,
        "invoices_count": invoices_count, "unpaid_invoices": unpaid_invoices,
        "open_tasks": open_tasks, "total_paid": total_paid, "outstanding": outstanding,
        "recent_customers": [c["name"] for c in recent_customers],
        "unpaid_list": unpaid_list,
    }


@api.get("/dashboard")
async def dashboard(user: dict = Depends(get_current_user)):
    ctx = await dashboard_context(user["id"])
    # sales by month (last 6 months) from payments
    payments = await db.payments.find({"owner_id": user["id"]}, {"_id": 0, "amount": 1, "date": 1}).to_list(5000)
    by_month: dict = {}
    for p in payments:
        d = (p.get("date") or "")[:7]
        if d:
            by_month[d] = round(by_month.get(d, 0) + (p.get("amount", 0) or 0), 2)
    months = sorted(by_month.keys())[-6:]
    sales_series = [{"month": m, "amount": by_month[m]} for m in months]
    # orders by status
    order_statuses = {}
    for st in ["new", "confirmed", "processing", "ready", "delivered", "cancelled"]:
        c = await db.orders.count_documents({"owner_id": user["id"], "status": st})
        if c:
            order_statuses[st] = c
    recent_orders = await db.orders.find({"owner_id": user["id"]}, {"_id": 0}).sort("created_at", -1).limit(5).to_list(5)
    recent_payments = await db.payments.find({"owner_id": user["id"]}, {"_id": 0}).sort("created_at", -1).limit(5).to_list(5)
    tasks = await db.tasks.find({"owner_id": user["id"], "status": {"$ne": "done"}}, {"_id": 0}).sort("due_date", 1).limit(6).to_list(6)
    settings = await ensure_settings(user["id"])
    return {"stats": ctx, "sales_series": sales_series, "order_statuses": order_statuses,
            "recent_orders": recent_orders, "recent_payments": recent_payments,
            "upcoming_tasks": tasks, "currency": settings.get("currency", "USD")}


@api.get("/insights")
async def insights(user: dict = Depends(get_current_user)):
    ctx = await dashboard_context(user["id"])
    # top products by quantity across invoices+orders
    counter: dict = {}
    for coll in ["invoices", "orders"]:
        docs = await db[coll].find({"owner_id": user["id"]}, {"_id": 0, "items": 1}).to_list(3000)
        for d in docs:
            for it in d.get("items", []):
                key = it.get("name") or "—"
                counter[key] = counter.get(key, 0) + (it.get("quantity", 0) or 0)
    top_products = sorted(counter.items(), key=lambda x: x[1], reverse=True)[:6]
    # top customers by paid amount
    payments = await db.payments.find({"owner_id": user["id"]}, {"_id": 0, "customer_name": 1, "amount": 1}).to_list(5000)
    cust: dict = {}
    for p in payments:
        n = p.get("customer_name") or "—"
        cust[n] = round(cust.get(n, 0) + (p.get("amount", 0) or 0), 2)
    top_customers = sorted(cust.items(), key=lambda x: x[1], reverse=True)[:6]
    settings = await ensure_settings(user["id"])
    return {"stats": ctx,
            "top_products": [{"name": n, "qty": q} for n, q in top_products],
            "top_customers": [{"name": n, "amount": a} for n, a in top_customers],
            "currency": settings.get("currency", "USD")}


# ----------------------------- AI -----------------------------
_ai_calls: dict = {}


def rate_limit(owner_id: str, limit: int = 30, window: int = 60):
    import time
    now = time.time()
    calls = [t for t in _ai_calls.get(owner_id, []) if now - t < window]
    if len(calls) >= limit:
        raise HTTPException(status_code=429, detail="Too many AI requests. Please wait a moment.")
    calls.append(now)
    _ai_calls[owner_id] = calls


@api.get("/ai/status")
async def ai_status(user: dict = Depends(get_current_user)):
    s = await ensure_settings(user["id"])
    return {"configured": bool(s.get("ai_api_key_enc") or os.environ.get("EMERGENT_LLM_KEY")),
            "provider": s.get("ai_provider"), "model": s.get("ai_model")}


class AITestIn(BaseModel):
    provider: str
    api_key: str = Field(min_length=8)
    model: Optional[str] = None

@api.post("/ai/test")
async def ai_test(data: AITestIn, user: dict = Depends(get_current_user)):
    import requests as http
    provider = data.provider.lower().strip()
    try:
        if provider == "openai":
            r = http.get("https://api.openai.com/v1/models", headers={"Authorization": f"Bearer {data.api_key}"}, timeout=12)
        elif provider == "anthropic":
            r = http.get("https://api.anthropic.com/v1/models", headers={"x-api-key": data.api_key, "anthropic-version": "2023-06-01"}, timeout=12)
        elif provider == "gemini":
            r = http.get("https://generativelanguage.googleapis.com/v1beta/models", params={"key": data.api_key}, timeout=12)
        else:
            raise HTTPException(status_code=400, detail="Unsupported AI provider")
        if not r.ok:
            raise HTTPException(status_code=400, detail="The provider rejected the API key")
        return {"ok": True, "provider": provider}
    except HTTPException:
        raise
    except Exception:
        raise HTTPException(status_code=502, detail="Could not reach the AI provider")


@api.post("/ai/chat")
async def ai_chat(data: AIChatIn, user: dict = Depends(get_current_user)):
    if not data.messages:
        raise HTTPException(status_code=400, detail="messages required")
    rate_limit(user["id"])
    ctx = await dashboard_context(user["id"])
    s = await ensure_settings(user["id"])
    ctx["business"] = s
    key = None
    if s.get("ai_api_key_enc"):
        try: key = decrypt_secret(s["ai_api_key_enc"])
        except (InvalidToken, RuntimeError): raise HTTPException(status_code=500, detail="Stored AI credential is unavailable")
    key = key or os.environ.get("EMERGENT_LLM_KEY")
    if not key:
        raise HTTPException(status_code=503, detail="AI assistant is not configured")
    session_id = data.session_id or f"{user['id']}-ai"
    try:
        reply = await ai_service.ai_reply(data.messages, ctx, data.language,
            s.get("ai_provider", "openai"), s.get("ai_model", "gpt-5.4"), session_id, api_key=key)
    except Exception as e:
        logger.error(f"AI error: {e}")
        raise HTTPException(status_code=502, detail="AI assistant is temporarily unavailable")
    return {"reply": reply}


# ----------------------------- Export -----------------------------
@api.get("/export")
async def export_data(user: dict = Depends(get_current_user)):
    out = {"exported_at": now_iso(), "app": "WASSILHA"}
    for coll in ["customers", "products", "quotes", "orders", "invoices",
                 "payments", "tasks", "events", "conversations"]:
        out[coll] = await db[coll].find({"owner_id": user["id"]}, {"_id": 0}).to_list(10000)
    out["settings"] = await ensure_settings(user["id"])
    return out


@api.post("/import")
async def import_data(payload: dict, user: dict = Depends(get_current_user)):
    allowed = ["customers", "products", "quotes", "orders", "invoices",
               "payments", "tasks", "events", "conversations"]
    imported = {}
    for coll in allowed:
        rows = payload.get(coll)
        if not isinstance(rows, list):
            continue
        n = 0
        for row in rows:
            if not isinstance(row, dict):
                continue
            row.pop("_id", None)
            row["owner_id"] = user["id"]
            row["id"] = row.get("id") or new_id()
            row["imported_at"] = now_iso()
            await db[coll].update_one({"id": row["id"], "owner_id": user["id"]},
                                      {"$set": row}, upsert=True)
            n += 1
        imported[coll] = n
    return {"ok": True, "imported": imported}


@api.get("/")
async def root():
    return {"app": "WASSILHA", "status": "ok"}


# ----------------------------- Demo data -----------------------------
async def seed_demo_data(owner_id: str):
    if await db.customers.count_documents({"owner_id": owner_id}) > 0:
        return
    import random
    names = [("Ahmad Al-Sayed", "أحمد السيد", "+963 991 234 567", 33.5138, 36.2765),
             ("Layla Hassan", "ليلى حسن", "+963 992 345 678", 33.5102, 36.2913),
             ("Omar Khalil", "عمر خليل", "+963 993 456 789", 33.5000, 36.3000),
             ("Sara Nassar", "سارة نصار", "+963 994 567 890", 33.5200, 36.2600),
             ("Karim Fares", "كريم فارس", "+963 995 678 901", 33.4980, 36.2800)]
    cust_ids = []
    for en, ar, phone, lat, lng in names:
        cid = new_id()
        cust_ids.append((cid, en))
        await db.customers.insert_one({
            "id": cid, "owner_id": owner_id, "name": en, "phone": phone,
            "email": en.split()[0].lower() + "@example.com",
            "address": "Damascus, Syria", "notes": "", "status": "active",
            "lat": lat, "lng": lng, "created_at": now_iso(), "updated_at": now_iso()})
    products = [("Consultation Service", "service", 150, "Services"),
                ("Website Package", "service", 900, "Services"),
                ("Wireless Keyboard", "product", 45, "Electronics"),
                ("Office Chair", "product", 220, "Furniture"),
                ("Monthly Maintenance", "service", 80, "Services"),
                ("USB-C Cable", "product", 12, "Electronics")]
    prod_ids = []
    for name, ptype, price, cat in products:
        pid = new_id()
        prod_ids.append((pid, name, price))
        await db.products.insert_one({
            "id": pid, "owner_id": owner_id, "name": name, "type": ptype,
            "price": price, "category": cat, "sku": "", "unit": "",
            "description": "", "status": "available", "notes": "",
            "created_at": now_iso(), "updated_at": now_iso()})

    def rand_items():
        picks = random.sample(prod_ids, 2)
        return [{"product_id": p[0], "name": p[1], "quantity": random.randint(1, 3),
                 "unit_price": p[2], "discount": 0} for p in picks]

    # invoices with some payments
    for i in range(4):
        cid, cname = random.choice(cust_ids)
        items = rand_items()
        totals = compute_totals(items, 0, 10)
        inv = {"id": new_id(), "owner_id": owner_id,
               "number": await next_number(owner_id, "invoices", "INV"),
               "customer_id": cid, "customer_name": cname, "items": items,
               "discount": 0, "tax_rate": 10, "notes": "", "currency": "USD",
               "date": now_iso()[:10], "due_date": now_iso()[:10],
               "status": "sent", "amount_paid": 0, **totals,
               "created_at": now_iso(), "updated_at": now_iso()}
        await db.invoices.insert_one(dict(inv))
        if i < 2:
            await db.payments.insert_one({
                "id": new_id(), "owner_id": owner_id, "customer_id": cid,
                "customer_name": cname, "invoice_id": inv["id"], "order_id": None,
                "amount": inv["total"], "date": now_iso()[:10], "method": "cash",
                "notes": "", "status": "completed",
                "created_at": now_iso(), "updated_at": now_iso()})
            await recompute_invoice(owner_id, inv["id"])
    # orders
    for _ in range(3):
        cid, cname = random.choice(cust_ids)
        items = rand_items()
        totals = compute_totals(items, 0, 0)
        await db.orders.insert_one({
            "id": new_id(), "owner_id": owner_id,
            "number": await next_number(owner_id, "orders", "ORD"),
            "customer_id": cid, "customer_name": cname, "items": items,
            "discount": 0, "tax_rate": 0, "notes": "", "currency": "USD",
            "date": now_iso()[:10], "status": random.choice(["new", "confirmed", "processing"]),
            "amount_paid": 0, **totals, "created_at": now_iso(), "updated_at": now_iso()})
    # quote
    cid, cname = random.choice(cust_ids)
    items = rand_items()
    totals = compute_totals(items, 0, 0)
    await db.quotes.insert_one({
        "id": new_id(), "owner_id": owner_id,
        "number": await next_number(owner_id, "quotes", "QT"),
        "customer_id": cid, "customer_name": cname, "items": items,
        "discount": 0, "tax_rate": 0, "notes": "", "currency": "USD",
        "date": now_iso()[:10], "valid_until": None, "status": "sent",
        "amount_paid": 0, **totals, "created_at": now_iso(), "updated_at": now_iso()})
    # tasks
    for t, pr in [("Call Ahmad about renewal", "high"), ("Prepare monthly report", "medium"),
                  ("Follow up on quote QT-0001", "medium"), ("Order new inventory", "low")]:
        await db.tasks.insert_one({
            "id": new_id(), "owner_id": owner_id, "title": t, "description": "",
            "due_date": now_iso()[:10], "priority": pr, "status": "todo",
            "customer_id": None, "order_id": None,
            "created_at": now_iso(), "updated_at": now_iso()})


# ----------------------------- Uploads (files / images / voice) -----------------------------
UPLOAD_DIR = ROOT_DIR / "uploads" if (ROOT_DIR := Path(__file__).parent) else Path("uploads")
UPLOAD_DIR.mkdir(exist_ok=True)
MAX_UPLOAD = 20 * 1024 * 1024
ALLOWED_MIME_PREFIX = ("image/", "audio/")
ALLOWED_MIME_EXACT = {
    "application/pdf", "text/plain", "text/csv",
    "application/msword",
    "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    "application/vnd.ms-excel",
    "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    "application/octet-stream",
}


def _mime_ok(mime: str) -> bool:
    return mime.startswith(ALLOWED_MIME_PREFIX) or mime in ALLOWED_MIME_EXACT


@api.post("/uploads")
async def upload_file(file: UploadFile = File(...),
                      conversation_id: Optional[str] = Form(None),
                      duration: Optional[float] = Form(None),
                      user: dict = Depends(get_current_user)):
    mime = file.content_type or "application/octet-stream"
    if not _mime_ok(mime):
        raise HTTPException(status_code=400, detail="File type not allowed")
    data = await file.read()
    if len(data) > MAX_UPLOAD:
        raise HTTPException(status_code=400, detail="File too large (max 20MB)")
    uid = new_id()
    orig = (file.filename or "file")
    suffix = ""
    if "." in orig:
        suffix = "." + orig.rsplit(".", 1)[-1].lower()[:8]
    stored = f"{uid}{suffix}"
    (UPLOAD_DIR / stored).write_bytes(data)
    kind = "image" if mime.startswith("image/") else "audio" if mime.startswith("audio/") else "file"
    doc = {"id": uid, "owner_id": user["id"], "conversation_id": conversation_id,
           "file_name": orig[:200], "stored_name": stored, "mime_type": mime,
           "size": len(data), "kind": kind, "duration": duration,
           "url": f"/api/uploads/{uid}", "created_at": now_iso()}
    await db.uploads.insert_one(dict(doc))
    return clean(doc)


@api.get("/uploads/{upload_id}")
async def get_upload(upload_id: str, user: dict = Depends(get_current_user)):
    doc = await db.uploads.find_one({"id": upload_id, "owner_id": user["id"]}, {"_id": 0})
    if not doc:
        raise HTTPException(status_code=404, detail="Not found")
    path = UPLOAD_DIR / doc["stored_name"]
    if not path.exists():
        raise HTTPException(status_code=404, detail="File missing")
    return FileResponse(str(path), media_type=doc["mime_type"], filename=doc["file_name"])


@api.delete("/uploads/{upload_id}")
async def delete_upload(upload_id: str, user: dict = Depends(get_current_user)):
    doc = await db.uploads.find_one({"id": upload_id, "owner_id": user["id"]}, {"_id": 0})
    if not doc:
        raise HTTPException(status_code=404, detail="Not found")
    try:
        (UPLOAD_DIR / doc["stored_name"]).unlink(missing_ok=True)
    except Exception:
        pass
    await db.uploads.delete_one({"id": upload_id, "owner_id": user["id"]})
    return {"ok": True}


# ----------------------------- Live status -----------------------------
@api.get("/live")
async def live(user: dict = Depends(get_current_user)):
    oid = user["id"]
    open_orders = await db.orders.count_documents(
        {"owner_id": oid, "status": {"$in": ["new", "confirmed", "processing", "ready"]}})
    unpaid = await db.invoices.count_documents(
        {"owner_id": oid, "status": {"$in": ["sent", "pending", "partially_paid", "overdue"]}})
    open_tasks = await db.tasks.count_documents({"owner_id": oid, "status": {"$ne": "done"}})
    convos = await db.conversations.count_documents({"owner_id": oid})
    return {"status": "live", "server_time": now_iso(),
            "open_orders": open_orders, "unpaid_invoices": unpaid,
            "open_tasks": open_tasks, "conversations": convos}


# ----------------------------- Notifications -----------------------------
async def build_notifications(oid: str) -> list:
    today = now_iso()[:10]
    notes = []
    overdue = await db.invoices.find(
        {"owner_id": oid, "status": {"$in": ["overdue"]}}, {"_id": 0}).limit(20).to_list(20)
    unpaid = await db.invoices.find(
        {"owner_id": oid, "status": {"$in": ["sent", "pending", "partially_paid"]}},
        {"_id": 0}).limit(20).to_list(20)
    for i in overdue + unpaid:
        notes.append({"id": f"invoice-{i['id']}", "type": "invoice",
                      "title": i.get("customer_name") or "—", "number": i.get("number"),
                      "status": i.get("status"), "link": f"/view/invoices/{i['id']}",
                      "created_at": i.get("updated_at")})
    tasks = await db.tasks.find(
        {"owner_id": oid, "status": {"$ne": "done"}, "due_date": {"$lte": today}},
        {"_id": 0}).limit(20).to_list(20)
    for tk in tasks:
        notes.append({"id": f"task-{tk['id']}", "type": "task", "title": tk.get("title"),
                      "status": tk.get("priority"), "link": "/tasks", "created_at": tk.get("due_date")})
    orders = await db.orders.find(
        {"owner_id": oid, "status": "new"}, {"_id": 0}).sort("created_at", -1).limit(10).to_list(10)
    for o in orders:
        notes.append({"id": f"order-{o['id']}", "type": "order",
                      "title": o.get("customer_name") or "—", "number": o.get("number"),
                      "status": o.get("status"), "link": f"/view/orders/{o['id']}",
                      "created_at": o.get("created_at")})
    return notes


@api.get("/notifications")
async def notifications(user: dict = Depends(get_current_user)):
    notes = await build_notifications(user["id"])
    rec = await db.notif_reads.find_one({"owner_id": user["id"]}, {"_id": 0})
    read_ids = set(rec.get("ids", [])) if rec else set()
    for n in notes:
        n["read"] = n["id"] in read_ids
    notes.sort(key=lambda x: x.get("created_at") or "", reverse=True)
    unread = sum(1 for n in notes if not n["read"])
    return {"items": notes, "unread": unread}


@api.post("/notifications/read")
async def mark_read(body: dict, user: dict = Depends(get_current_user)):
    ids = body.get("ids")
    if ids == "all":
        notes = await build_notifications(user["id"])
        ids = [n["id"] for n in notes]
    if not isinstance(ids, list):
        raise HTTPException(status_code=400, detail="ids required")
    await db.notif_reads.update_one({"owner_id": user["id"]},
                                    {"$addToSet": {"ids": {"$each": ids}}}, upsert=True)
    return {"ok": True}


# ----------------------------- Global search -----------------------------
@api.get("/search")
async def search(q: str = Query(..., min_length=1), user: dict = Depends(get_current_user)):
    oid = user["id"]
    rx = {"$regex": q, "$options": "i"}
    out = []
    for c in await db.customers.find({"owner_id": oid, "$or": [{"name": rx}, {"phone": rx}, {"email": rx}]}, {"_id": 0}).limit(6).to_list(6):
        out.append({"type": "customer", "id": c["id"], "label": c["name"], "sub": c.get("phone") or "", "link": f"/customers/{c['id']}"})
    for p in await db.products.find({"owner_id": oid, "name": rx}, {"_id": 0}).limit(6).to_list(6):
        out.append({"type": "product", "id": p["id"], "label": p["name"], "sub": p.get("category") or "", "link": "/products"})
    for coll, pref in [("quotes", "quotes"), ("orders", "orders"), ("invoices", "invoices")]:
        for d in await db[coll].find({"owner_id": oid, "$or": [{"number": rx}, {"customer_name": rx}]}, {"_id": 0}).limit(5).to_list(5):
            out.append({"type": coll[:-1], "id": d["id"], "label": d.get("number"), "sub": d.get("customer_name") or "", "link": f"/view/{coll}/{d['id']}"})
    for tk in await db.tasks.find({"owner_id": oid, "title": rx}, {"_id": 0}).limit(5).to_list(5):
        out.append({"type": "task", "id": tk["id"], "label": tk.get("title"), "sub": "", "link": "/tasks"})
    return {"results": out}


# ----------------------------- App wiring -----------------------------
app.include_router(auth_router)
app.include_router(api)

app.add_middleware(
    CORSMiddleware,
    allow_origins=[o.strip() for o in os.environ.get("CORS_ORIGINS", "http://localhost:3000").split(",")],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.on_event("startup")
async def startup():
    await db.users.create_index("email", unique=True, sparse=True)
    await db.users.create_index("phone", unique=True, sparse=True)
    await db.users.create_index("id", unique=True)
    for c in ["customers", "products", "quotes", "orders", "invoices",
              "payments", "tasks", "events", "conversations", "uploads"]:
        await db[c].create_index("owner_id")
    await seed_admin()
    logger.info("WASSILHA backend ready")


@app.on_event("shutdown")
async def shutdown():
    client.close()
