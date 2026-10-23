import express from 'express';
import cors from 'cors'
import cookieParser from 'cookie-parser'
import bodyParser from 'body-parser'
import mongoose from 'mongoose';
import { isLoggedIn } from './middlewares/Auth.js';
import { userRoutes } from './App/routes/user.js';

const app = express();

app.use(cookieParser())
app.use(cors({
    origin: process.env.FRONTEND_URL,
    credentials: true
}))
app.use(express.json());
app.use(isLoggedIn)

app.get('/', (req, res) => {
    res.send("Hello World");
})
app.use('/' , userRoutes)

mongoose.connect(process.env.DB_URL, {
    dbName: "VideoCallApp"
}).then(() => {
    console.log("Connected to MongoDB Atlas")
    app.listen(process.env.PORT, () => {
        console.log("Server is running on port", process.env.PORT);
    })
})