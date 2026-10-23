import bcrypt

async def hashPassword(password: str):
    if not password:
        return None
    salt_rounds = 10
    try:
        salt = bcrypt.gensalt(salt_rounds)
        hashed_password = bcrypt.hashpw(password.encode("utf-8"), salt)
        return hashed_password.decode("utf-8")
    except Exception as err:
        print(err)
        return None

async def verifyPassword(password: str, hashed_password: str):
    try:
        if not password or not hashed_password:
            return False
        r = bcrypt.checkpw(password.encode("utf-8"), hashed_password.encode("utf-8"))
        return r
    except Exception as err:
        print(err)
        return False

