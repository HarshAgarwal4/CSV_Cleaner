import os
import smtplib
from email.mime.multipart import MIMEMultipart
from email.mime.text import MIMEText

async def sendMail(to: str, subject: str, text: str):
    user = os.getenv("myGMAIL")
    password = os.getenv("password")
    if not user or not password:
        print("Warning: myGMAIL or password environment variable is missing.")
        return False

    mail_options = MIMEMultipart("alternative")
    mail_options["From"] = f'"Video Call App" <{user}>'
    mail_options["To"] = to
    mail_options["Subject"] = subject

    html_part = MIMEText(text, "html")
    mail_options.attach(html_part)

    try:
        with smtplib.SMTP("smtp.gmail.com", 587) as server:
            server.ehlo()
            server.starttls()
            server.login(user, password)
            server.sendmail(user, to, mail_options.as_string())
        return True
    except Exception as err:
        print(err)
        return False

