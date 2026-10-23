import mongoose from "mongoose";
import { hashPassword } from "../../services/encryption.js";

const userSchema = new mongoose.Schema({
    name: {
        type: String,
        required: true
    },
    email:{
        required: true,
        type: String,
        unique: true
    },
    password: {
        type: String,
        required: true
    },
    profile: {
        type: String,
        default: "/defaultProfile.png"
    },
    sessions: [
        {
            token: String,
            createdAt: {type: Date , default: Date.now }
        }
    ]
})

userSchema.pre('save' , async function () {
    if(!this.isModified('password')) return;
    let r = await hashPassword(this.password)
    this.password = r
})

const UserModel = mongoose.model("User" , userSchema);

export default UserModel