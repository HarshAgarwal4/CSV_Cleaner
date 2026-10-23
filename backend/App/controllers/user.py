import os
from fastapi import Request, Response, Depends
from sqlalchemy.orm import Session
from sqlalchemy.orm.attributes import flag_modified

from services.Auth import setUser
from services.encryption import hashPassword, verifyPassword
from services.otp import sendOtp, verifyOtp
from ..models.database import get_db
from ..models.user import UserModel

def is_production():
    return os.getenv("production", "").lower() == "true" or os.getenv("PRODUCTION", "").lower() == "true"

async def signUp(request: Request, response: Response, db: Session = Depends(get_db)):
    try:
        body = await request.json()
    except Exception:
        body = {}

    name = body.get("name")
    email = body.get("email")
    password = body.get("password")
    otp = body.get("otp")

    if not email or not name or not password or not otp:
        return {"status": 7, "msg": "Invalid fields"}

    try:
        is_otp_matched = await verifyOtp(email, otp)
        if not is_otp_matched:
            return {"status": 2, "msg": "Inavlid OTP"}

        existing_user = db.query(UserModel).filter(UserModel.email == email).first()
        if existing_user:
            return {"status": 6, "msg": "Email already exists"}

        hashed = await hashPassword(password)
        user = UserModel(name=name, email=email, password=hashed, sessions=[])
        db.add(user)
        db.commit()
        db.refresh(user)

        token = await setUser(user.id)
        if not token:
            return {"status": 11, "msg": "error in token"}

        user.sessions = [{"token": token}]
        flag_modified(user, "sessions")
        db.commit()

        is_prod = is_production()
        response.set_cookie(
            key="UID",
            value=token,
            httponly=is_prod,
            secure=is_prod,
            samesite="none" if is_prod else "lax",
            max_age=7 * 24 * 60 * 60,
        )
        return {"status": 1, "msg": "User registered succesfully"}
    except Exception as err:
        print(err)
        return {"status": 0, "msg": "Internal server error"}

async def login(request: Request, response: Response, db: Session = Depends(get_db)):
    try:
        body = await request.json()
    except Exception:
        body = {}

    email = body.get("email")
    password = body.get("password")

    if not email or not password:
        return {"status": 7, "msg": "Invalid fields"}

    try:
        find_user = db.query(UserModel).filter(UserModel.email == email).first()
        if not find_user:
            return {"status": 9, "msg": "No user found"}

        hashed_password = find_user.password
        r = await verifyPassword(password, hashed_password)
        if not r:
            return {"status": 10, "msg": "Invalid email or password"}

        token = await setUser(find_user.id)
        if not token:
            return {"status": 11, "msg": "error in token"}

        find_user.sessions = [{"token": token}]
        flag_modified(find_user, "sessions")
        db.commit()

        is_prod = is_production()
        response.set_cookie(
            key="UID",
            value=token,
            httponly=is_prod,
            secure=is_prod,
            samesite="none" if is_prod else "lax",
            max_age=7 * 24 * 60 * 60,
        )
        print("login sucessful")
        return {"status": 1, "msg": "Login successfull"}
    except Exception as err:
        print(err)
        return {"status": 0, "msg": "intrnal server error"}

async def sendOTPToEmail(request: Request):
    try:
        body = await request.json()
    except Exception:
        body = {}

    email = body.get("email")
    if not email:
        return {"status": 7, "msg": "Inavlid fields"}

    try:
        r = await sendOtp(email)
        if not r:
            return {"status": 8, "msg": "error in generating otp"}
        return {"status": 1, "msg": "OTP sent successfully"}
    except Exception as err:
        print(err)
        return {"status": 0, "msg": "Internal server error"}

async def fetchUser(request: Request):
    try:
        user = getattr(request.state, "user", None)
        if user:
            return {"status": 1, "user": user}
        return {"status": 0, "msg": "No user found"}
    except Exception as err:
        print(err)
        return {"status": 0, "msg": "No user found"}

async def logout(request: Request, response: Response, db: Session = Depends(get_db)):
    try:
        token = request.cookies.get("UID")
        if not token:
            return {"status": 1, "msg": "Logged out successfully"}

        is_prod = is_production()
        response.delete_cookie(
            key="UID",
            httponly=is_prod,
            secure=is_prod,
            samesite="none" if is_prod else "lax",
        )

        user_data = getattr(request.state, "user", None)
        if user_data:
            user_id = user_data.get("id") or user_data.get("_id")
            try:
                user_id_val = int(user_id)
                find_user = db.query(UserModel).filter(UserModel.id == user_id_val).first()
            except (ValueError, TypeError):
                find_user = db.query(UserModel).filter(UserModel.id == user_id).first()

            if find_user and find_user.sessions:
                find_user.sessions = [s for s in find_user.sessions if s.get("token") != token]
                flag_modified(find_user, "sessions")
                db.commit()

        request.state.user = None
        return {"status": 1, "msg": "Logged out successfully"}
    except Exception as err:
        print(err)
        return {"status": 0, "msg": "server error"}

