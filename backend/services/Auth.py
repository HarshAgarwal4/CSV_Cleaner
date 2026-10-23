import os
from datetime import datetime, timedelta, timezone
from jose import jwt

async def setUser(id):
    if not id:
        return None
    secret = os.getenv("JWT_SECRET", "default_secret")
    payload = {
        "id": str(id),
        "exp": datetime.now(timezone.utc) + timedelta(days=7)
    }
    token = jwt.encode(payload, secret, algorithm="HS256")
    return token

def getUser(token):
    if not token:
        return False
    try:
        secret = os.getenv("JWT_SECRET", "default_secret")
        r = jwt.decode(token, secret, algorithms=["HS256"])
        return r
    except Exception as err:
        print("JWT error:", err)
        return False

