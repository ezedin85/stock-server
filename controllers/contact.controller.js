const HTTP_STATUS = require("../constants/http");
const ContactModel = require("../models/contact.model");
const appAssert = require("../utils/appAssert");
const catchErrors = require("../utils/catchErrors");
const { CONTACT_TYPES } = require("../constants/constants");
const utils = require("../utils/utils");

exports.getContacts = catchErrors(async (req, res) => {
  // validate request
  const { contact_type } = req.params;
  appAssert(
    CONTACT_TYPES.includes(contact_type),
    HTTP_STATUS.BAD_REQUEST,
    "Unrecognized Contact Type"
  );

  // call service
  const contacts = await ContactModel.find({
    contact_type,
    deleted: false,
  }).populate([
    {
      path: "created_by",
      select: "first_name last_name",
    },
    {
      path: "updated_by",
      select: "first_name last_name",
    },
  ]);

  // return response
  return res.status(HTTP_STATUS.OK).json(contacts);
});

exports.getContact = catchErrors(async (req, res) => {
  // call service
  const { id, contact_type } = req.params;
  appAssert(
    CONTACT_TYPES.includes(contact_type),
    HTTP_STATUS.BAD_REQUEST,
    "Unrecognized Contact Type"
  );

  const contact = await ContactModel.findOne({
    _id: id,
    contact_type,
    deleted: false,
  });

  appAssert(contact, HTTP_STATUS.NOT_FOUND, `${contact_type} not found`);

  // return response
  return res.status(HTTP_STATUS.OK).json(contact);
});

exports.addRecord = catchErrors(async (req, res) => {
  // validate request
  const { contact_type } = req.params;
  const { name, mobile_number, address, email, company_name, company_email } =
    req.body;
  const created_by = req.userId;

  //assert contact type
  appAssert(
    CONTACT_TYPES.includes(contact_type),
    HTTP_STATUS.BAD_REQUEST,
    "Unrecognized Contact Type"
  );

  //assert required fields
  utils.validateRequiredFields({ name });

  const existing_contact = await ContactModel.findOne({
    contact_type,
    name: { $regex: new RegExp(`^${name}$`, "i") },
  });

  //assert no name conflict
  appAssert(
    !existing_contact,
    HTTP_STATUS.BAD_REQUEST,
    `The name for the ${contact_type} must be unique. This name is already in use.`
  );

  // call service
  await ContactModel.create({
    name,
    mobile_number,
    address,
    email,
    company_name,
    company_email,
    contact_type,
    created_by,
  });

  // return response
  return res
    .status(HTTP_STATUS.CREATED)
    .json({ message: `${contact_type} created successfully` });
});

exports.updateRecord = catchErrors(async (req, res) => {
  // validate request
  const { contact_type, id } = req.params;
  const { name, mobile_number, address, email, company_name, company_email } =
    req.body;
  const updated_by = req.userId;

  // 1. Validate contact type
  appAssert(
    CONTACT_TYPES.includes(contact_type),
    HTTP_STATUS.BAD_REQUEST,
    "Invalid contact type provided."
  );

  // 2. Validate required fields
  utils.validateRequiredFields({ name });

  // 3. Check for duplicate contact name (case-insensitive and excluding current contact)
  const existing_contact = await ContactModel.findOne({
    name: { $regex: new RegExp(`^${name}$`, "i") },
    contact_type,
    _id: { $ne: id },
  });

  appAssert(
    !existing_contact,
    HTTP_STATUS.BAD_REQUEST,
    `The name for the ${contact_type} must be unique. This name is already in use.`
  );

  // 4. Check if the contact exists and is not marked as deleted
  const contactData = await ContactModel.findOne({
    _id: id,
    contact_type,
    deleted: false,
  });
  appAssert(contactData, HTTP_STATUS.NOT_FOUND, "Contact not found!");

  // 5. Update contact
  // call service
  const updatedRecord = await ContactModel.findByIdAndUpdate(
    id,
    {
      name,
      mobile_number,
      address,
      email,
      company_name,
      company_email,
      updated_by,
    },
    {
      new: true,
      runValidators: true,
    }
  );

  //assert contact found and updated
  appAssert(
    updatedRecord,
    HTTP_STATUS.BAD_REQUEST,
    "Unable to update the contact. Please try again later."
  );

  // return response
  return res
    .status(HTTP_STATUS.OK)
    .json({ message: `${contact_type} Updated Successfully` });
});

exports.deleteRecord = catchErrors(async (req, res) => {
  // validate request
  const { contact_type, id } = req.params;
  appAssert(
    CONTACT_TYPES.includes(contact_type),
    HTTP_STATUS.BAD_REQUEST,
    "Unrecognized Contact Type"
  );

  const contact = await ContactModel.findOne({ _id: id, deleted: false });
  //assert contact exists
  appAssert(contact, HTTP_STATUS.BAD_REQUEST, "Contact not found!");

  // call service
  const milliseconds_now = Date.now(); //add unique, if item gets deleted many times
  contact.name = `_${contact.name}_${milliseconds_now}`;
  contact.deleted = true;
  contact.deleted_by = req.userId;
  await contact.save();

  // return response
  return res
    .status(HTTP_STATUS.OK)
    .json({ message: `${contact_type} deleted Successfully` });
});
