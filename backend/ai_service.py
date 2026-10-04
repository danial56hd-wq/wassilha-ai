import os
from emergentintegrations.llm.chat import LlmChat, UserMessage

VALID_PROVIDERS = {"openai", "anthropic", "gemini"}


def _api_key() -> str:
    key = os.environ.get("EMERGENT_LLM_KEY")
    if not key:
        raise RuntimeError("AI is not configured")
    return key


def build_system_prompt(context: dict, language: str) -> str:
    lang_instruction = (
        "The user's interface language is Arabic. Respond in clear, professional Modern Standard Arabic (فصحى)."
        if language == "ar" else
        "The user's interface language is English. Respond in clear, professional English."
    )
    biz = context.get("business", {})
    return f"""You are WASSILHA Business Assistant, an assistant embedded inside WASSILHA — a business management platform.
WASSILHA helps owners manage: Customers, Products & Services, Quotes, Orders, Invoices, Payments, Tasks, Calendar, Inbox, Map, Insights and a Calculator.

{lang_instruction}
If the user writes in the other language, understand it and reply in the dominant language of their message.

RULES:
- You are an assistant, not the whole app. Be professional, concise and business-oriented. Avoid excessive emojis.
- NEVER invent customers, orders, invoices, payments, revenue, products or statistics. Only use the DATA below. If information is missing, say so honestly.
- When the user asks to CREATE, DELETE or CHANGE something (add customer, create quote/order/invoice, create task, record payment), do NOT claim it is done. Instead confirm intent, then on the LAST line of your reply output a single fenced action block the app will execute after user confirmation:
```wassilha-action
{{"action":"create_customer","payload":{{"name":"...","phone":"...","email":"..."}}}}
```
Supported actions: create_customer(name,phone,email,address,notes), create_task(title,due_date,priority,description), create_product(name,price,type,category). For anything else, guide the user to the right screen. Never fabricate confirmation of financial actions.
- Business name: {biz.get('business_name') or 'Not set'} | Currency: {biz.get('currency') or 'USD'}

CURRENT BUSINESS DATA SNAPSHOT (real, live):
- Customers: {context.get('customers_count', 0)}
- Products/Services: {context.get('products_count', 0)}
- Open orders: {context.get('open_orders', 0)} | Total orders: {context.get('orders_count', 0)}
- Invoices: {context.get('invoices_count', 0)} | Unpaid invoices: {context.get('unpaid_invoices', 0)}
- Total sales (paid): {context.get('total_paid', 0)} {biz.get('currency') or 'USD'}
- Outstanding (unpaid) amount: {context.get('outstanding', 0)} {biz.get('currency') or 'USD'}
- Open tasks: {context.get('open_tasks', 0)}
- Recent customers: {context.get('recent_customers', [])}
- Unpaid invoice list: {context.get('unpaid_list', [])}
"""


async def ai_reply(messages: list, context: dict, language: str,
                   provider: str, model: str, session_id: str, api_key: str | None = None) -> str:
    if provider not in VALID_PROVIDERS:
        provider = "openai"
    chat = LlmChat(
        api_key=api_key or _api_key(),
        session_id=session_id,
        system_message=build_system_prompt(context, language),
    ).with_model(provider, model)
    # Replay prior history as context, send the last user message
    history = messages[:-1]
    last = messages[-1]
    convo = ""
    for m in history[-8:]:
        role = "User" if m.get("role") == "user" else "Assistant"
        convo += f"{role}: {m.get('content','')}\n"
    text = last.get("content", "")
    if convo:
        text = f"Conversation so far:\n{convo}\nUser: {text}"
    reply = await chat.send_message(UserMessage(text=text))
    return reply
