const catchErrors = require("../utils/catchErrors");
const HTTP_STATUS = require("../constants/http");
const SettingsModel = require("../models/setting.model");
const appAssert = require("../utils/appAssert");
const utils = require("../utils/utils");
const { SETTING_ID } = require("../constants/constants");
const { scheduleJob } = require("../helpers/scheduleHelper");

exports.getSettings = catchErrors(async (req, res) => {
  // validate request
  // call service

  let settings = await SettingsModel.findOne({ setting_id: SETTING_ID })
    .select("daily_report_time inventory_method stock_alert_to daily_report_to")
    .populate([
      {
        path: "stock_alert_to",
        select: "first_name last_name"
      },
      {
        path: "daily_report_to",
        select: "first_name last_name"
      },
    ]);

  //assert record exists
  appAssert(settings, HTTP_STATUS.NOT_FOUND, `settings not found`);

  // return response
  return res.status(HTTP_STATUS.OK).json(settings);
});

exports.updateSettings = catchErrors(async (req, res) => {
  // validate request,
  let { daily_report_time, stock_alert_to, daily_report_to } = req.body;
  stock_alert_to = JSON.parse(stock_alert_to);
  daily_report_to = JSON.parse(daily_report_to);

  //check for required fields
  utils.validateRequiredFields({ daily_report_time });

  // call service
  // Extract hours and minutes from "HH:MM" format
  const [hours, minutes] = daily_report_time.split(":").map(Number);

  appAssert(
    !isNaN(hours) && !isNaN(minutes),
    HTTP_STATUS.BAD_REQUEST,
    "Invalid time format. Use HH:MM."
  );

  //schedule time
  const cronTime = `${minutes} ${hours} * * *`;
  scheduleJob(cronTime);

  const updatedData = await SettingsModel.findOneAndUpdate(
    { setting_id: SETTING_ID },
    {
      $set: {
        daily_report_time,
        stock_alert_to,
        daily_report_to,
      },
    },
    { new: true }
  );

  appAssert(
    updatedData,
    HTTP_STATUS.BAD_REQUEST,
    "Couldn't update settings. please try again later"
  );
  // return response
  return res
    .status(HTTP_STATUS.OK)
    .json({ message: `Setting Updated Sucessfully` });
});
