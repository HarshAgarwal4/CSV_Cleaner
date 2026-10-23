import express from 'express';
import { fetchUser, login, logout, sendOTPToEmail, signUp } from '../controllers/user.js';
const userRoutes = express.Router();

userRoutes.post('/signup' , signUp)
userRoutes.post('/login' , login)
userRoutes.post('/sendotp' , sendOTPToEmail)
userRoutes.post('/me' , fetchUser)
userRoutes.post('/logout' , logout)

export {userRoutes}