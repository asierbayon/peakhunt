const passport = require('passport');
const mongoose = require('mongoose');
const User = require('../models/users.model');
const LocalStrategy = require('passport-local').Strategy;
const GoogleStrategy = require('passport-google-oauth').OAuth2Strategy;

passport.serializeUser((user, next) => {
    next(null, user.id);
});

passport.deserializeUser((id, next) => {
    User.findById(id)
        .then(user => next(null, user))
        .catch(next);
});

passport.use('local-auth', new LocalStrategy({
    usernameField: 'email',
    passwordField: 'password'
}, (email, password, next) => {
    console.log('mail', email)
    User.findOne({ email })
        .then(user => {
            if (!user) {
                next(null, null, { email: 'Invalid email or password.' })
            } else {
                return user.checkPassword(password)
                    .then(match => {
                        if (match) {
                            if (user.verified && user.verified.date) {
                                next(null, user)
                            } else {
                                next(null, null, { email: 'Please, verify your account before logging in.' })
                            }
                        } else {
                            next(null, null, { email: 'Invalid email or password.' })
                        }
                    })
            }
        }).catch(next)
}));


passport.use('google-auth', new GoogleStrategy({
    clientID: process.env.G_CLIENT_ID,
    clientSecret: process.env.G_CLIENT_SECRET,
    callbackURL: process.env.G_REDIRECT_URI || '/authenticate/google/cb',
}, (accessToken, refreshToken, profile, next) => {
    const providerData = profile._json;
    const googleId = profile.id;
    const email = profile.emails[0] ? profile.emails[0].value : undefined;
    const name = email.split('@')[0];
    const avatar = (providerData.picture) ? providerData.picture : undefined;

    if (googleId && name && email) {
        User.findOne({
            $or: [
                { email },
                { 'social.google': googleId }
            ]
        })
            .then(user => {
                if (!user) {
                    user = new User({
                        avatar,
                        name,
                        email,
                        social: {
                            google: googleId
                        },
                        verified: {
                            date: new Date()
                        },
                        password: mongoose.Types.ObjectId()
                    });
                    return user.save()
                        .then(user => next(null, user));
                } else {
                    next(null, user);
                }
            }).catch(next)

    } else {
        next(null, null, { auth: 'Invalid configuration' })
    }

}));