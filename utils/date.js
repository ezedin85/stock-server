const fiveMinutesFromNow = () => new Date(Date.now() + 5 * 60 * 1000);

const oneDayFromNow = () => new Date(Date.now() + 24 * 60 * 60 * 1000);

module.exports = {
  fiveMinutesFromNow,
  oneDayFromNow,
};
