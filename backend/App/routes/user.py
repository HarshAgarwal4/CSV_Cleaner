from fastapi import APIRouter
from ..controllers.user import signUp, login, sendOTPToEmail, fetchUser, logout

userRoutes = APIRouter()

userRoutes.post('/signup')(signUp)
userRoutes.post('/login')(login)
userRoutes.post('/sendotp')(sendOTPToEmail)
userRoutes.post('/me')(fetchUser)
userRoutes.post('/logout')(logout)

