const asyncHandler = require('express-async-handler');
const User = require("../models/userModel")
const jwt = require("jsonwebtoken")
const bcrypt = require('bcrypt');
const Token = require("../models/tokenModel")
const crypto = require("crypto");
const { reset } = require('nodemon');
const sendEmail = require('../utils/sendEmail');

// Generate Token
const generateToken = (id) => {
    return jwt.sign({ id }, process.env.JWT_SECRET, { expiresIn: "1d" });
};


// Register User
const registerUser = asyncHandler(async (req, res) => {

    const { name, email, password } = req.body

    // Validation
    if (!name || !email || !password) {
        res.status(400);
        throw new Error("Please fill all required fields");
    }

    if (password.length < 6) {
        res.status(400);
        throw new Error("password must be 6 characters");
    }

    // check if user email is already exists
    const userExists = await User.findOne({ email })
    if (userExists) {
        res.status(400);
        throw new Error("Email already exists");
    }


    // create new user
    const user = await User.create({
        name,
        email,
        password,

    })

    //   Generate Token
    const token = generateToken(user._id);

    //  Send HTTP-only cookie
    res.cookie("TOKEN_GENETATED", token, {
        path: "/",
        httpOnly: true,
        expires: new Date(Date.now() + 1000 * 86400), //1 day
        sameSite: "none",
        secure: true,
    });

    if (user) {
        const { _id, name, email, password, photo, phone, bio } = user;
        res.status(201).json({
            _id, name, email, password, photo, phone, bio, token,
        })
    }
    else {
        res.status(400);
        throw new Error("Invalid user data");
    }

});

// Login User
const loginUser = asyncHandler(async (req, res) => {

    const { email, password } = req.body;

    // Validate Request
    if (!email || !password) {
        res.status(400);
        throw new Error("Please fill email and password");
    }

    // Check if user exists
    const user = await User.findOne({ email });
    if (!user) {
        res.status(400);
        throw new Error("User not Found");
    }

    // User exists , check if password is correct
    const isPasswordCorrect = await bcrypt.compare(password, user.password);

    //   Generate Token
    const token = generateToken(user._id);

    //  Send HTTP-only cookie
    res.cookie("TOKEN_GENETATED", token, {
        path: "/",
        httpOnly: true,
        expires: new Date(Date.now() + 1000 * 86400), //1 day
        sameSite: "none",
        secure: true,

    });


    if (user && isPasswordCorrect) {
        const { _id, name, email, password, photo, phone, bio } = user;

        res.status(200).json({
            _id, name, email, password, photo, phone, bio, token,
        });
    }
    else {
        res.status(400);
        throw new Error("Invalid Email or Password");
    }

});

const logout = asyncHandler(async (req, res) => {
    res.cookie("TOKEN_GENETATED", "", {
        path: "/",
        httpOnly: true,
        expires: new Date(0),
        sameSite: "none",
        secure: true,
    });
    return res.status(200).json({ message: "Successfully Logged out" });
});


// Get User Data
const getUser = asyncHandler(async (req, res) => {
    const user = await User.findById(req.user._id);

    if (user) {
        const { _id, name, email, photo, phone, bio } = user;
        res.status(200).json({
            _id,
            name,
            email,
            photo,
            phone,
            bio,
        });
    } else {
        res.status(400);
        throw new Error("User Not Found");
    }
});


// Get Login Status
const loginStatus = asyncHandler(async (req, res) => {
    const token = req.cookies.TOKEN_GENETATED;
    if (!token) {
        return res.json(false);
    }

    // Verify Token
    const verified = jwt.verify(token, process.env.JWT_SECRET);
    if (verified) {
        return res.json(true);
    }
    return res.json(false);

});


// Update User
const updateUser = asyncHandler(async (req, res) => {

    const user = await User.findById(req.user._id);

    if (user) {
        const { name, email, photo, phone, bio } = user;
        user.email = email;
        user.name = req.body.name || name;
        user.phone = req.body.phone || phone;
        user.bio = req.body.bio || bio;
        user.photo = req.body.photo || photo;

        const updatedUser = await user.save();
        res.status(200).json({
            _id: updatedUser._id,
            name: updatedUser.name,
            email: updatedUser.email,
            photo: updatedUser.photo,
            phone: updatedUser.phone,
            bio: updatedUser.bio,
        })
    }
    else {
        res.status(404);
        throw new Error("User Not Found");
    }
});


// Change Password
const changePassword = asyncHandler(async (req, res) => {
    const user = await User.findById(req.user._id);
    const { oldPassword, password } = req.body;

    if (!user) {
        res.status(400);
        throw new Error("User Not Found,Please signup");
    }

    // Validation
    if (!oldPassword || !password) {
        res.status(400);
        throw new Error("Please enter old and new password");
    }

    // check if old password matches password in DB
    const passwordIsCorrect = await bcrypt.compare(oldPassword, user.password);

    // Save new Password
    if (user && passwordIsCorrect) {
        user.password = password;
        await user.save();
        res.status(200).send("password change Successful");
    }
    else {
        res.status(400);
        throw new Error("Old password is incorrect");
    }
});

const forgetPassword = asyncHandler(async (req, res) => {
    const { email } = req.body;
    const user = await User.findOne({ email });

    if (!user) {
        res.status(404);
        throw new Error("User does not exist");
    }

    // Delete token if it exists in DB
    let token = await Token.findOne({ userId: user._id })
    if (token) {
        await token.deleteOne()
    }

    // Create Reset Token
    let resetToken = crypto
        .randomBytes(32)
        .toString("hex") + user._id;

    console.log(resetToken);

    // Hash token before saving to DB
    const hashedToken = crypto
        .createHash("sha256")
        .update(resetToken)
        .digest("hex");


    // Save Token to DB
    await new Token({
        userId: user._id,
        token: hashedToken,
        createdAt: Date.now(),
        expiresAt: Date.now() + 30 * (60 * 1000)  // 30 minutes
    }).save()

    // Construct reset URL
    const resetUrl = `${process.env.FRONTEND_URL}/
resetpassword/${resetToken}`

    // Reset Email
    const message = `
 <h2> Hello ${user.name} </h2>
 <p> Please use the url below to reset your password </p>

 <a href = ${resetUrl} clicktracking=off> ${resetUrl} </a>

 <p>Regards...</p>
`;

    const subject = "Password Reset Request"
    const send_to = user.email
    const send_from = process.env.EMAIL_USER

    try {
        await sendEmail(subject, message, send_to, send_from)
        res.status(200).json({ success: true, message: "Reset Email Sent" })
    }
    catch (error) {
        res.status(500)
        throw new Error("Email not sent,Please try again")
    }

});


// Reset Password
const resetPassword = asyncHandler(async (req, res) => {

    const { password } = req.body;
    const { resetToken } = req.params;

    // Hash token, then compare to Token in DB
    const hashedToken = crypto
        .createHash("sha256")
        .update(resetToken)
        .digest("hex");

    const userToken = await Token.findOne({
        token: hashedToken,
        expiresAt: { $gt: Date.now() }
    })

    if (!userToken) {
        res.status(404)
        throw new Error("Invalid or expire token");
    }

    // Find user
    const user = await User.findOne({ _id: userToken.userId })
    user.password = password
    await user.save();

    res.status(200).json({
        message: "password reset succesfull please login"
    })

});





module.exports = {
    registerUser,
    loginUser,
    logout,
    getUser,
    loginStatus,
    updateUser,
    changePassword,
    forgetPassword,
    resetPassword,
}