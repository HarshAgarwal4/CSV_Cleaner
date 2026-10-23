import { setUser } from "../../services/Auth.js";
import { verifyPassword } from "../../services/encryption.js";
import { sendOtp, verifyOtp } from "../../services/otp.js";
import UserModel from "../models/user.js";

async function signUp(req, res) {
    let { name, email, password, otp } = req.body;
    if (!email || !name || !password || !otp) {
        return res.send({ status: 7, msg: "Invalid fields" })
    }
    let obj = { name, email, password }
    try {
        let isOTPmatched = await verifyOtp(email, otp)
        if (isOTPmatched) return res.send({ status: 2, msg: "Inavlid OTP" })
        let user = new UserModel(obj)
        let token = await setUser(user._id)
        if (!token) return res.send({ status: 11, msg: "error in token" })
        user.sessions = [{ token }]
        res.cookie('UID', token, {
            httpOnly: process.env.production === 'true',
            secure: process.env.production === 'true',
            sameSite: process.env.production === 'true' ? 'none' : 'lax',
            maxAge: 7 * 24 * 60 * 60 * 1000,
        })
        await user.save()
        return res.send({ status: 1, msg: "User registered succesfully" })
    } catch (err) {
        console.log(err)
        return res.send({ status: 0, msg: "Internal server error" })
    }
}

async function login(req, res) {
    let { email, password } = req.body
    if (!email || !password) return res.send({ status: 7, msg: "Invalid fields" })
    try {
        let findUser = await UserModel.findOne({ email })
        if (!findUser) return res.send({ status: 9, msg: "No user found" })
        let hashedPassword = findUser.password;
        let r = await verifyPassword(password, hashedPassword)
        if (!r) return res.send({ status: 10, msg: "Invalid email or password" })
        let token = await setUser(findUser._id);
        if (!token) return res.send({ status: 11, msg: "error in token" })
        findUser.sessions = [{ token }]
        res.cookie('UID', token, {
            httpOnly: process.env.production === 'true',
            secure: process.env.production === 'true',
            sameSite: process.env.production === 'true' ? 'none' : 'lax',
            maxAge: 7 * 24 * 60 * 60 * 1000,
        })
        await findUser.save()
        console.log('login sucessful')
        return res.send({ status: 1, msg: "Login successfull" })
    } catch (err) {
        console.log(err)
        return res.send({ status: 0, msg: "intrnal server error" })
    }
}

async function sendOTPToEmail(req, res) {
    let { email } = req.body;
    if (!email) return res.send({ status: 7, msg: "Inavlid fields" })
    try {
        let r = await sendOtp(email)
        if (!r) return res.send({ status: 8, msg: "error in generating otp" })
        return res.send({ status: 1, msg: "OTP sent successfully" })
    } catch (err) {
        console.log(err)
        return res.send({ status: 0, msg: "Internal server error" })
    }
}

async function fetchUser(req, res) {
    try {
        if (req.user) return res.send({ status: 1, user: req.user })
    }
    catch (err) {
        console.log(err)
        return res.send({ status: 0, msg: "No user found" })
    }
}

async function logout(req, res) {
    try {
        let token = req.cookies?.UID;
        if (!token) return res.send({ status: 1, msg: "Logged out successfully" });
        res.clearCookie('UID', {
            httpOnly: process.env.PRODUCTION === "true",
            secure: process.env.PRODUCTION === "true",
            sameSite: process.env.PRODUCTION === "true" ? "none" : "lax",
            maxAge: 7 * 24 * 60 * 60 * 1000,
        })
        req.user.sessions = req.user.sessions.filter((session) => session.token !== token);
        await req.user.save();
        req.user = null
        return res.send({ status: 1, msg: "Logged out successfully" })
    } catch (err) {
        console.log(err)
        return res.send({ status: 0, msg: "server error" })
    }
}

export { signUp, login, sendOTPToEmail, fetchUser , logout }