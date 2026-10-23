import random
import time
from .mail import sendMail

otpStorage = {}

def genereateOTP():
    return random.randint(100000, 999999)

async def sendOtp(email: str):
    if not email:
        return False
    otp = genereateOTP()
    if email in otpStorage:
        del otpStorage[email]
    otpStorage[email] = {
        "otp": otp,
        "expires_at": time.time() + (5 * 60)
    }
    try:
        r = await sendMail(
            email,
            "OTP",
            f"<h1>Your OTP for Video Call App is {otp}</h1><p>This OTP is valid for 5 minutes. Please do not share it with anyone.</p>"
        )
        if not r:
            return False
        return True
    except Exception as err:
        print(err)
        return False

async def verifyOtp(email: str, otp):
    if not email or not otp:
        return False
    if email not in otpStorage:
        return False
    stored = otpStorage[email]
    if time.time() > stored["expires_at"]:
        del otpStorage[email]
        return False
    if str(stored["otp"]) != str(otp):
        return False
    del otpStorage[email]
    return True

