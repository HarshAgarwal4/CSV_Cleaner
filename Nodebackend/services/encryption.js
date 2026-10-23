import bcrypt from 'bcryptjs';

async function hashPassword(password) {
    if(!password) return null;
    const saltRounds = 10;
    try{
        let hashedPassword = await bcrypt.hash(password , saltRounds)
        return hashedPassword
    }catch(err) {
        console.log(err)
        return null
    }
}

async function verifyPassword(password , hashedPassword) {
    try {
        let r = await bcrypt.compare(password , hashedPassword)
        return r
    }catch(err){
        console.log(err)
        return false
    }
}

export {hashPassword , verifyPassword}