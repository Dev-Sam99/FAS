import {asyncHandler} from "../utils/asyncHandler.js";

const registerUser = asyncHandler ( async(req,res)=>{
    res.status(200).json({
        message : "OK!"
    })
        // const {fullName,userName, password,email} = req.body;

})

export {registerUser}