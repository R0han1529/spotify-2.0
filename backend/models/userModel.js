const mongoose = require("mongoose");
const bcrypt = require('bcrypt');
const { Schema } = mongoose;

const userSchema = new Schema({
    name: {
        type: String,
        required: [true, "Please add a name"]
    },

    email: {
        type: String,
        required: [true, "Please add a email"],
        unique: true,

        // trim is used for remove unwanted space in email
        trim: true,

        // match is used Email validation
        match: [
            /^(([^<>()[\]\\.,;:\s@"]+(\.[^<>()[\]\\.,;:\s@"]+)*)|(".+"))@((\[[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}\])|(([a-zA-Z\-0-9]+\.)+[a-zA-Z]{2,}))$/,
            "Please enter a valid email"
        ]
    },

    password: {
        type: String,
        required: [true, "Please add a password"],
        minLength: [6, "Password word must be upto 6 characters"]
        // maxLength:[,"Password not be more than 15 characters"],   
    },

    photo: {
        type: String,
        required: [true, "Please add a photo"],
        default: "https://i.ibb.co/4pDNDk1/avatar.png"
    },

    phone: {
        type: String,
        default: "+234"
    },

    bio: {
        type: String,
        maxLength: [215, "Bio not be more than 215 characters"],
        default: "bio"
    },

}, {
    timestamps: true
});


// encrypt password before saving to DB
userSchema.pre("save", async function (next) {
      
    if(!this.isModified("password")){
        return next();
    }

    // Hash Password
    const salt = bcrypt.genSaltSync(10);
    const hash = bcrypt.hashSync(this.password, salt);
    this.password = hash;
    next();
})

const User = mongoose.model('User', userSchema);
module.exports = User;
