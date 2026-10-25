from starlette.middleware.base import BaseHTTPMiddleware
from starlette.requests import Request
from starlette.responses import JSONResponse
from App.models.database import SessionLocal
from App.models.user import UserModel
from services.Auth import getUser

allowedPaths = {'', '/', '/health', '/signup', '/login', '/sendotp', '/docs', '/openapi.json', '/redoc', '/favicon.ico'}

class AuthMiddleware(BaseHTTPMiddleware):
    async def dispatch(self, request: Request, call_next):
        path = request.url.path.rstrip('/')
        if request.method == "OPTIONS" or request.url.path in allowedPaths or path in allowedPaths or not path:
            return await call_next(request)

        request.state.user = None
        token = request.cookies.get("UID")
        if not token:
            return JSONResponse(content={"status": 50, "msg": "Np token found"})

        user = getUser(token)
        if not user:
            return JSONResponse(content={"status": 51, "msg": "Invalid jwt signature"})

        user_id = user.get("id")
        db = SessionLocal()
        try:
            try:
                user_id_val = int(user_id)
                findUser = db.query(UserModel).filter(UserModel.id == user_id_val).first()
            except (ValueError, TypeError):
                findUser = db.query(UserModel).filter(UserModel.id == user_id).first()

            if not findUser or not findUser.sessions:
                return JSONResponse(content={"status": 53, "msg": "Invalid credentils"})

            t = findUser.sessions[0].get("token") if isinstance(findUser.sessions[0], dict) else None
            if t != token:
                return JSONResponse(content={"status": 53, "msg": "Invalid credentils"})

            request.state.user = findUser.to_dict()
            request.state.user_id = findUser.id
        except Exception as err:
            print(err)
            return JSONResponse(content={"status": 100, "msg": "Unwanted error occured"})
        finally:
            db.close()

        response = await call_next(request)
        return response

isLoggedIn = AuthMiddleware

