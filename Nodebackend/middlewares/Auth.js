import userModel from "../App/models/user.js"
import { getUser } from "../services/Auth.js"

let allowedPaths = ['/', '/signup', '/login', '/sendotp']

async function isLoggedIn(req, res, next) {
    if (allowedPaths.includes(req.path)) return next()
    req.user = null;
    let token = req.cookies?.UID
    if (!token) return res.send({ status: 50, msg: "Np token found" })
    let user = await getUser(token)
    if (!user) return res.send({ status: 51, msg: "Invalid jwt signature" })
    const id = user.id
    let findUser
    try {
        findUser = await userModel.findById(id)
        let t = findUser.sessions[0].token
        if (t !== token) return res.send({ status: 53, msg: "Invalid credentils" })
        req.user = findUser
        next()
    } catch (err) {
        console.log(err)
        return res.send({ status: 100, msg: "Unwanted error occured" })
    }
}

export { isLoggedIn }