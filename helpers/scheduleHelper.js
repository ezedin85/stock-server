const schedule = require("node-schedule");
const {
  getTransactionReport,
} = require("../controllers/report.controller");
const FormData = require("form-data");
const axios = require("axios");
const PDFDocument = require("pdfkit");
const fs = require("fs");
const path = require("path");
const UserModel = require("../models/user.model");
const SettingModel = require("../models/setting.model");
const LocationModel = require("../models/location.model");
const { SETTING_ID } = require("../constants/constants");

let daily_report_job_schedule = null; // Variable to store the current scheduled job

// Function to schedule a job and cancel any existing one
function scheduleJob(cronTime) {
  try {
    if (daily_report_job_schedule) {
      daily_report_job_schedule.cancel();
      console.log("Previous job canceled.");
    }

    // Define the task to run daily at 10:45 PM
    daily_report_job_schedule = schedule.scheduleJob(cronTime, () => {
      try {
        sendTodaysReport({ transaction_type: "sale" });
        sendTodaysReport({ transaction_type: "purchase" });
      } catch (error) {
        console.log(error.message);
      }
    });

    console.log(`New job scheduled for: ${cronTime}`);
  } catch (error) {
    console.log(`Failed To Schedule a daily report time job: ${error.message}`);
  }
}

// Load and set the schedule when the server starts
async function init() {
  try {
    const setting = await SettingModel.findOneAndUpdate({
      setting_id: SETTING_ID,
    });

    const daily_report_time = setting.daily_report_time

    if (daily_report_time) {
      const [hours, minutes] = daily_report_time.split(":").map(Number);
      const cronTime = `${minutes} ${hours} * * *`;
      scheduleJob(cronTime);
      console.log(
        `Job loaded from database and scheduled for: ${daily_report_time}`
      );
    } else {
      console.log("No existing schedule found in database.");
    }
  } catch (error) {
    console.log(error.message);
    
  }
}

init(); // Initialize the schedule on server startup

const sendTodaysReport = async ({ transaction_type }) => {
  try {
    const doc = new PDFDocument();
    const today = new Date();
    const formattedDate = today.toISOString().slice(0, 10); // Format: YYYY-MM-DD
    const daysOfWeek = [
      "Sunday",
      "Monday",
      "Tuesday",
      "Wednesday",
      "Thursday",
      "Friday",
      "Saturday",
    ];
    const dayName = daysOfWeek[today.getDay()];
    const filePath = `uploads/${transaction_type}-${formattedDate}-${dayName}.pdf`;

    // Get transaction data
    const startOfToday = new Date();
    startOfToday.setHours(0, 0, 0, 0); // Midnight today
    const endOfToday = new Date();
    endOfToday.setHours(23, 59, 59, 999); // End of today

    const writeStream = fs.createWriteStream(filePath);
    doc.pipe(writeStream);
    // Add title
    doc
      .fontSize(25)
      .text(`${dayName}'s ${transaction_type} Transactions`, { align: "center" });
    doc.moveDown();

    // Transaction Details
    doc
      .fontSize(14)
      .text(`${formattedDate} - [${dayName}]`, { underline: true });
    doc.moveDown();

    const tableHeaders = ["Product", "Qty", "Amount"];

    // Define a function to add a table row with borders
    function addTableRowWithBorders(doc, row, options = {}) {
      const colWidth = options.colWidth || [183, 133, 133];
      const startX = options.startX || 50;
      let startY = options.startY || doc.y; // Track the Y position for each row
      const rowHeight = 20;

      colWidth.forEach((width, index) => {
        // Draw the text for each cell
        doc.text(
          row[index],
          startX + colWidth.slice(0, index).reduce((a, b) => a + b, 0) + 5,
          startY + 5,
          { width, align: "left" }
        );

        // Draw the cell borders
        const xPos =
          startX + colWidth.slice(0, index).reduce((a, b) => a + b, 0);
        doc.rect(xPos, startY, width, rowHeight).stroke();
      });

      // Increment startY for the next row
      options.startY = startY + rowHeight;
    }

    const locations = await LocationModel.find({deleted: false});
    for (const location of locations) {
      const { result, error } = await getTransactionReport({
        transaction_type,
        startDate: startOfToday,
        endDate: endOfToday,
        location: location._id,
      });

      if (error) throw new Error(error); // Handle errors from getTransactionReport

      // if (result?.length > 0) {
      // Add table headers with borders
      addTableRowWithBorders(
        doc,
        [`.`, `${location.name} (${location.location_type})`, "."],
        { startX: 50 }
      );
      addTableRowWithBorders(doc, tableHeaders, { startX: 50 });

      let grandTotalAmount = 0;
      // Iterate over transactions and add rows with borders for each
      result.forEach((item) => {
        grandTotalAmount += item.total;
        const row = [
          item.product_name,
          item.quantity,
          `ETB ${item.total.toFixed(2)}`,
        ];
        addTableRowWithBorders(doc, row, { startX: 50 });
      });

      addTableRowWithBorders(
        doc,
        [
          "",
          `Total ${transaction_type}:`,
          `ETB ${grandTotalAmount.toFixed(2)}`,
        ],
        { startX: 50 }
      );

      doc.moveDown();
    }
    // }

    // Finalize the PDF and end the stream
    doc.end();

    // Listen for the finish event to know when the file is fully written
    writeStream.on("finish", async () => {
      try {
        const fullPath = path.join(process.cwd(), filePath);

        let settings = await SettingModel.findOne({ setting_id: SETTING_ID });

        const daily_report_to = settings.daily_report_to

        const daily_report_users = await UserModel.find({_id :{$in: daily_report_to}, deleted: false, is_active: true})

        for (const admin of daily_report_users) {
          // Prepare FormData to send the file to Telegram
          const formData = new FormData();
          formData.append("chat_id", admin.tgChatId);
          formData.append("document", fs.createReadStream(fullPath));

          const url = `https://api.telegram.org/bot${process.env.BOT_TOKEN}/sendDocument`;

          const response = await axios.post(url, formData, {
            headers: formData.getHeaders(),
          });
        }

        // Remove file from server
        fs.unlinkSync(fullPath); // Use fs.unlinkSync to remove the file

        console.log(`PDF generated and sent: ${filePath}`);
        // Assuming req and res are accessible here; adjust as needed
      } catch (innerError) {
        console.error("Error in finish listener:", innerError.message);
      }
    });

    writeStream.on("error", (streamError) => {
      console.error("Write stream error:", streamError.message);
    });
  } catch (error) {
    console.error("Error in sendTodaysReport:", error.message);
  }
};

module.exports = { scheduleJob };
