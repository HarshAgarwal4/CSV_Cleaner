import jwt from 'jsonwebtoken'

async function setUser(id) {
    if(!id) return null
    const payload = {id: id}
    const token = await jwt.sign(payload , process.env.JWT_SECRET , {expiresIn : '7d'});
    return token
}

function getUser(token) {
    if(!token){
        return false
    }
    try{
        let r = jwt.verify(token , process.env.JWT_SECRET)
        return r
    }
    catch(err) {
         console.error("JWT error:", err)
        return false
    }
}

export {getUser , setUser}