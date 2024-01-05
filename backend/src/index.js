import dotenv from "dotenv";
import connectDB from "./db/index.js";
import express from "express";
const app = express();
dotenv.config({
    path:'./env'
})
const port = process.env.PORT || 5000;
connectDB()
.then(()=>{
    app.listen(port,()=>{
        console.log(`app is running on ${port}`);
    })
})
.catch((err)=>{
    console.log('MONGO DB connection failed...!',err)
});