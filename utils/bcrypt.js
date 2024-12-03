const bcrypt = require("bcrypt");

// Hash a value with a given number of salt rounds (default is 10)
const hashValue = async (val, saltRounds = 10) => {
  return bcrypt.hash(val, saltRounds);
};

// Compare a plain value with a hashed value
const compareValue = async (val, hashedValue) => {
  try {
    return await bcrypt.compare(val, hashedValue);
  } catch {
    return false;
  }
};

module.exports = {
  hashValue,
  compareValue,
};
