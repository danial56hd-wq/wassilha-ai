import os
import bcrypt
import jwt
import secrets
from datetime import datetime, timezone, timedelta
from fastapi import APIRouter, HTTPException, Request, Response, Depends
from pydantic import BaseModel, EmailStr, Field
from database import db

JWT_ALGORITHM = "HS256"
ACCESS_MINUTES = 30
REFRESH_DAYS = 14

auth_router = APIRouter(prefix="/api/auth", tags=["auth"])


def hash_password(password: str) -> str:
    return bcrypt.hashpw(password.encode("utf-8"), bcrypt.gensalt()).decode("utf-8")


def verify_password(plain: str, hashed: str) -> bool:
    try:
        return bcrypt.checkpw(plain.encode("utf-8"), hashed.encode("utf-8"))
    except Exception:
        return False


def get_jwt_secret() -> str:
    return os.environ["JWT_SECRET"]


def create_access_token(user_id: str, identifier: str) -> str:
    payload = {"sub": user_id, "identifier": identifier,
               "exp": datetime.now(timezone.utc) + timedelta(minutes=ACCESS_MINUTES), "type": "access"}
    return jwt.encode(payload, get_jwt_secret(), algorithm=JWT_ALGORITHM)


def create_refresh_token(user_id: str) -> str:
    payload = {"sub": user_id,
               "exp": datetime.now(timezone.utc) + timedelta(days=REFRESH_DAYS), "type": "refresh"}
    return jwt.encode(payload, get_jwt_secret(), algorithm=JWT_ALGORITHM)


def set_auth_cookies(response: Response, user_id: str, identifier: str):
    access = create_access_token(user_id, identifier)
    refresh = create_refresh_token(user_id)
    response.set_cookie("access_token", access, httponly=True, secure=True,
                        samesite="none", max_age=ACCESS_MINUTES * 60, path="/")
    response.set_cookie("refresh_token", refresh, httponly=True, secure=True,
                        samesite="none", max_age=REFRESH_DAYS * 86400, path="/")
    return access


PHONE_RE = __import__("re").compile(r"^\+?[1-9]\d{6,14}$")

def normalize_phone(value: str) -> str:
    value = "".join((value or "").strip().split())
    if not PHONE_RE.fullmatch(value):
        raise ValueError("Invalid phone number")
    return value


class RegisterInput(BaseModel):
    name: str = Field(min_length=1, max_length=120)
    email: Optional[EmailStr] = None
    phone: Optional[str] = None
    password: str = Field(min_length=8, max_length=200)

    def model_post_init(self, __context):
        if not self.email and not self.phone:
            raise ValueError("Email or phone is required")
        if self.phone:
            try: self.phone = normalize_phone(self.phone)
            except ValueError as exc: raise ValueError(str(exc))


class LoginInput(BaseModel):
    identifier: Optional[str] = None
    email: Optional[EmailStr] = None
    password: str

    def model_post_init(self, __context):
        if not (self.identifier or self.email):
            raise ValueError("Email or phone is required")


def public_user(u: dict) -> dict:
    return {"id": u["id"], "name": u.get("name"), "email": u.get("email"), "phone": u.get("phone"), "role": u.get("role", "user")}


async def _decode(token: str) -> dict:
    payload = jwt.decode(token, get_jwt_secret(), algorithms=[JWT_ALGORITHM])
    return payload


async def get_current_user(request: Request) -> dict:
    token = request.cookies.get("access_token")
    if not token:
        header = request.headers.get("Authorization", "")
        if header.startswith("Bearer "):
            token = header[7:]
    if not token:
        raise HTTPException(status_code=401, detail="Not authenticated")
    try:
        payload = await _decode(token)
        if payload.get("type") != "access":
            raise HTTPException(status_code=401, detail="Invalid token type")
        user = await db.users.find_one({"id": payload["sub"]}, {"_id": 0})
        if not user:
            raise HTTPException(status_code=401, detail="User not found")
        return user
    except jwt.ExpiredSignatureError:
        raise HTTPException(status_code=401, detail="Token expired")
    except jwt.InvalidTokenError:
        raise HTTPException(status_code=401, detail="Invalid token")


LOCK_THRESHOLD = 6
LOCK_MINUTES = 15


@auth_router.post("/register")
async def register(data: RegisterInput, response: Response):
    email = str(data.email).lower().strip() if data.email else None
    phone = normalize_phone(data.phone) if data.phone else None
    if email and await db.users.find_one({"email": email}):
        raise HTTPException(status_code=400, detail="An account with this email already exists")
    if phone and await db.users.find_one({"phone": phone}):
        raise HTTPException(status_code=400, detail="An account with this phone number already exists")
    import uuid
    uid = str(uuid.uuid4())
    doc = {"id": uid, "name": data.name.strip(), "email": email, "phone": phone,
           "password_hash": hash_password(data.password), "role": "user",
           "created_at": datetime.now(timezone.utc).isoformat()}
    await db.users.insert_one(doc)
    from server import seed_demo_data, ensure_settings
    await ensure_settings(uid)
    await seed_demo_data(uid)
    set_auth_cookies(response, uid, email or phone)
    return public_user(doc)


@auth_router.post("/login")
async def login(data: LoginInput, request: Request, response: Response):
    identifier = (data.identifier or str(data.email)).strip()
    is_email = "@" in identifier
    if is_email:
        identifier = identifier.lower()
        lookup = {"email": identifier}
    else:
        try: identifier = normalize_phone(identifier)
        except ValueError: raise HTTPException(status_code=422, detail="Enter a valid email address or phone number")
        lookup = {"phone": identifier}
    ip = request.client.host if request.client else "?"
    ident = f"{ip}:{identifier}"
    now = datetime.now(timezone.utc)
    attempt = await db.login_attempts.find_one({"identifier": ident})
    if attempt and attempt.get("count", 0) >= LOCK_THRESHOLD:
        locked_until = attempt.get("locked_until")
        if locked_until and datetime.fromisoformat(locked_until) > now:
            raise HTTPException(status_code=429, detail="Too many attempts. Try again later.")
    user = await db.users.find_one(lookup)
    if not user or not verify_password(data.password, user["password_hash"]):
        await db.login_attempts.update_one(
            {"identifier": ident},
            {"$inc": {"count": 1},
             "$set": {"locked_until": (now + timedelta(minutes=LOCK_MINUTES)).isoformat()}},
            upsert=True)
        raise HTTPException(status_code=401, detail="Invalid email/phone or password")
    await db.login_attempts.delete_one({"identifier": ident})
    set_auth_cookies(response, user["id"], user.get("email") or user.get("phone"))
    return public_user(user)


@auth_router.post("/logout")
async def logout(response: Response):
    response.delete_cookie("access_token", path="/")
    response.delete_cookie("refresh_token", path="/")
    return {"ok": True}


@auth_router.get("/me")
async def me(user: dict = Depends(get_current_user)):
    return public_user(user)


@auth_router.post("/refresh")
async def refresh(request: Request, response: Response):
    token = request.cookies.get("refresh_token")
    if not token:
        raise HTTPException(status_code=401, detail="No refresh token")
    try:
        payload = await _decode(token)
        if payload.get("type") != "refresh":
            raise HTTPException(status_code=401, detail="Invalid token type")
        user = await db.users.find_one({"id": payload["sub"]}, {"_id": 0})
        if not user:
            raise HTTPException(status_code=401, detail="User not found")
        set_auth_cookies(response, user["id"], user.get("email") or user.get("phone"))
        return public_user(user)
    except jwt.InvalidTokenError:
        raise HTTPException(status_code=401, detail="Invalid token")


async def seed_admin():
    email = os.environ.get("ADMIN_EMAIL", "admin@example.com").lower()
    password = os.environ.get("ADMIN_PASSWORD", "admin123")
    existing = await db.users.find_one({"email": email})
    import uuid
    if existing is None:
        uid = str(uuid.uuid4())
        await db.users.insert_one({
            "id": uid, "name": "Nidal Watfa", "email": email,
            "password_hash": hash_password(password), "role": "admin",
            "created_at": datetime.now(timezone.utc).isoformat()})
        from server import seed_demo_data, ensure_settings
        await ensure_settings(uid)
        await seed_demo_data(uid)
    elif not verify_password(password, existing["password_hash"]):
        await db.users.update_one({"email": email},
                                  {"$set": {"password_hash": hash_password(password)}})
