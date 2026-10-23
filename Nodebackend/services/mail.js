import nodemailer from 'nodemailer'

const transporter = nodemailer.createTransport({
    service: 'gmail',
    auth: {
        user: process.env.myGMAIL,
        pass: process.env.password
    }
})

async function sendMail(to, subject, text) {
    const mailOptions = {
        from: `"Video Call App" <${process.env.myGMAIL}>`,
        to: to,
        subject: subject,
        html: text,
    };
    try {
        let r = await transporter.sendMail(mailOptions)
        if (!r) return false
        return true
    } catch (err) {
        console.log(err)
        return false
    }
}

export {sendMail}