const jwt = require("jsonwebtoken");
const Audience = require("../constants/audience");

const defaults = {
  audience: [Audience.User],
};

const accessTokenSignOptions = {
  expiresIn: "5m",
  secret: process.env.JWT_ACCESS_SECRET,
};

const refreshTokenSignOptions = {
  expiresIn: "1d",
  secret: process.env.JWT_REFRESH_SECRET,
};

//generate Token
const signToken = (payload, options = accessTokenSignOptions) => {
  const { secret, ...signOpts } = options;
  return jwt.sign(payload, secret, {
    ...defaults,
    ...signOpts,
  });
};

//validate token
const verifyToken = (token, options = {}) => {
  const { secret = process.env.JWT_ACCESS_SECRET, ...verifyOpts } = options;
  try {
    const payload = jwt.verify(token, secret, {
      ...defaults,
      ...verifyOpts,
    });

    return { payload };
  } catch (error) {
    return {
      error: error.message,
    };
  }
};

module.exports = {
  signToken,
  verifyToken,
  refreshTokenSignOptions,
};
