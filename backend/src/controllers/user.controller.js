import {asyncHandler} from "../utils/asyncHandler.js";
import {ApiError} from "../utils/ApiError.js"
import {User} from "../models/user.model.js"
import {uploadOnCloudinary} from "../utils/cloudinary.js";
import { ApiResponse } from "../utils/ApiResponse.js";
import jwt from "jsonwebtoken";
const generateAccessAndRefreshToken = async(userId)=>{
    try{
        const user = await User.findById(userId)
        const accessToken = user.generateAccessToken();
        console.log( "accesstoken",accessToken)
        const refreshToken = user.generateRefreshToken();
        console.log(accessToken,refreshToken)
        user.refreshToken = refreshToken
        await user.save({validateBeforeSave : false})

        return {accessToken,refreshToken}

    }catch(error){
        throw new ApiError(500, "something went wrong while creating refresh and access token!")
    }
}

const registerUser = asyncHandler ( async(req,res)=>{
    const {fullName,userName, password,email} = req.body;//destructuring
    console.log("email",email);

    // if(!fullname === ""){
    //     throw new ApiError(400, "full name is required");
    // }
    if([fullName,userName, password,email].some((field)=>
    field?.trim === "")){
        throw new ApiError(400,"All fields are required!!!!")
    }
    const existedUser =await User.findOne({
        $or : [{userName},{email}]
    })
    if(existedUser){
        throw new ApiError(400, "User with email or username already exists!")
    }
    const avatarLocalPath = req.files?.avatar[0]?.path;
    // const coverImageLocalPath = req.files?.coverImage[0]?.path;
    let coverImageLocalPath;
    if(req.files && Array.isArray(req.files.coverImage) && req.files.coverImage.length > 0){
        coverImageLocalPath = req.files.coverImage[0].path;
    }

    if(!avatarLocalPath){
        throw new ApiError(400, "Avatar file is required!")
    }
    //cover image is not compulsory. so , not throwing error.

    const avatar = await uploadOnCloudinary(avatarLocalPath);
    const coverImage = await uploadOnCloudinary(coverImageLocalPath);
    if (!avatar){
        throw new ApiError(400, "Avatar file is required!")
    }
    const user = await User.create({
        fullName,
        avatar : avatar.url,
        coverImage : coverImage?.url || '',
        email,
        password,
        userName : userName.toLowerCase()
    })
     const createdUser = await User.findById(user._id).select("-password -refreshToken");

     if(!createdUser){
        throw new ApiError(500, "Something went wrong while registering user");
     }
     return res.status(200).json(
        new ApiResponse(200,createdUser, "user created successfully!!!")
     )

})

const loginUser = asyncHandler ( async (req,res)=>{
    const {userName,email,password} = req.body;
    if(!userName && !email){
        throw new ApiError (400, "username or email is required");
    }
    const user =await User.findOne({
        $or : [{userName},{email}]
    })
    if(!user){
        throw new ApiError (400, "user does not exists!")
    }
    const isPasswordValid = await user.isPasswordCorrect(password)
    if(!isPasswordValid){
        throw new ApiError(400, "password invalid");
    }

    const {accessToken,refreshToken} = await generateAccessAndRefreshToken(user._id)
    const loggedInUser = await User.findById(user._id).select(
        "-password -refreshToken"
    )
    const options = {
        httpOnly : true,
        secure : true
    }
    return res
    .status(200)
    .cookie("accessToken",accessToken,options)
    .cookie("refreshToken",refreshToken,options)
    .json(
        new ApiResponse(200,{
            user : loggedInUser , accessToken,refreshToken
        },"user logged in successfully!")
    )
})

const logOutUser = asyncHandler( async (req,res)=>{
    await User.findByIdAndUpdate(
        req.user._id,
        {
            $set :{
                refreshToken : undefined
            }
        },
        {new:true}
    )
    const options = {
        httpOnly : true,
        secure : true
    }
    return res
            .status(200)
            .clearCookie("accessToken",options)
            .clearCookie("refreshToken",options)
            .json(new ApiResponse (200, {}, "User LoggedOut successfully!"))
})

const refreshAccessToken = asyncHandler ( async (req,res)=>{
    const incomingRefreshToken = req.cookies?.refreshToken || req.body.refreshToken;
    if(!incomingRefreshToken){
        throw new ApiError(400, "Unauthorized access request!!!")
    }
    try{
        const decodedToken = jwt.verify(incomingRefreshToken,process.env.REFRESH_TOKEN_SECRET);
        const user =await User.findById(decodedToken?._id);
        if(!user){
            throw new ApiError(401,"Invalid refresh Token")
        }
        if(incomingRefreshToken !== user?.refreshToken){
            throw new ApiError(401,"refresh token is expired or used")
        }
        const options = {
            httpOnly :true,
            secure : true
        }
        const {accessToken,newRefreshToken} = await generateAccessAndRefreshToken(user._id);
         return res.status(200)
                    .cookie("accessToken",accessToken,options)
                    .cookie("refreshToken",newRefreshToken,options)
                    .json(
                        new ApiResponse(200, 
                            {accessToken,refreshToken:newRefreshToken},
                            "Access Token refreshed!!!")
                    )
    }catch(error){
        throw new ApiError(400,error?.message || "Invalid Refresh Token")
    }
})
 const changeCurrentPassword = asyncHandler( async (req,res) =>{
    const {oldPassword,newPassword} = req.body
        const user = await User.findById(req.user?._id)
        const isPasswordCorrect = await user.isPasswordCorrect(oldPassword)
        if(!isPasswordCorrect){
            throw new ApiError(400,"Invalid old password");
        }
        user.password = newPassword;
        await user.save({ validateBeforeSave : false})

        return res.status(200)
                   .json(
                    new ApiResponse (200, {}, 
                        "passwrd updated successfully")
                   )
 })
 const getCurrentUser = asyncHandler (async (req,res) => {
    return res.status(200)
                .json(200,req.user,
                    "current user fetched successfully")
 })

 const updateAccountDetails = asyncHandler( async (req,res)=>{
        const {fullName, email} = req.body;
        if (!fullName || !email){
            throw new ApiError(401,"All fields are required!!!")
        }
        const user =await User.findByIdAndUpdate(
            req.user?._id,
            {
                $set : {
                    fullName,
                    email : email
                }
            },
            {
                new : true
            }
        ).select ("-password")

        return res.status(200)
                  .json(
                    new ApiResponse(200,user,
                        "account details updated successfully")
                  )
 })

 const updateUserAvatar = asyncHandler ( async (req,res) =>{
        const avatarLocalPath = req.file?.path;
        if(!avatarLocalPath){
            throw new ApiError(400, "Avatar file is missing")
        }

        const avatar = await uploadOnCloudinary(avatarLocalPath)

        if(!avatar.url){
            throw new ApiError(400, "Error while uploading avatar!!!");
        }
        
        const user = await User.findByIdAndUpdate(
            req.user?._id,
            {
                $set : {
                    avatar : avatar.url
                }
            },
            {
                new : true
            }
        ).select("-password")

        return res.status(200)
                  .json(
                    new ApiResponse(200 , user,
                        "Avatar file updated successfully...!!!")
                  )
 })

const updateUserCoverImage = asyncHandler ( async (req,res)=>{
    const coverImageLocalPath = req.file?.path;
    if(!coverImageLocalPath){
        throw new ApiError(401,"cover image in missing...!!!")
    }
    const coverImage = await uploadOnCloudinary(coverImageLocalPath);

    if(!coverImage.url){
        throw new ApiError(401, "Error while uploading on coverImage....!!!")
    }

    const user = await User.findByIdAndUpdate(
        req.user?._id,
        {
            $set :{
                coverImage : coverImage.url
            }
        },
        {
            new:true
        }
    ).select("-password")

    return res.status(200)
              .json(200, user ,
                "cover image updated successfully...!!!")
})


export {registerUser,
loginUser,
logOutUser,
refreshAccessToken,
changeCurrentPassword,
getCurrentUser,
updateAccountDetails,
updateUserAvatar,
updateUserCoverImage
}