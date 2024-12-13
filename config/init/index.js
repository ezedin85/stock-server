require("./db_config");
require("dotenv").config();
const UserModel = require("../../models/user.model");
const PermissionModel = require("../../models/permission.model");
const bcrypt = require("bcrypt");
const { ALL_PERMISSIONS } = require("../permissions");
const LocationModel = require("../../models/location.model");

// function for creating superuser.
exports.createSuperAdminUser = async (userObject) => {
    try {
        const {first_name,last_name, phone, password} = userObject;

        UserModel.findOne({ phone }).then((user) => {
            if (user != null) {
                console.error("User With this phone number already exists")
                process.exit(1);
            }
        });

        const salt = await bcrypt.genSalt(10);
        const hashedPwd = await bcrypt.hash(password, salt);

        const tempoLocation = await LocationModel.create({name: "Initial Location", location_type: "warehouse", })

        UserModel.create({first_name, last_name, phone, password: hashedPwd, locations: [tempoLocation._id]})
                 .then(async (newAdminUser) => {

            newAdminUser.is_super_admin = true;
            newAdminUser.is_active = true;
            newAdminUser.gender = 'MALE';
            newAdminUser.roles = [];
            await newAdminUser.save();
            console.dir("Superuser created successfully", { colors: true });
            process.exit(0);
        }).catch((error) => {
            console.log(error.message);
            process.exit(1);
        });

    } catch (error) {
        console.log(error.message);
        process.exit(1);
    }
};

// function for creating permissions.
exports.createPermission = async () => {
    console.log('Creating New Permissions...');
    for (let index = 0; index < ALL_PERMISSIONS.length; index++) {
        const permission = ALL_PERMISSIONS[index];

        try {
            const existingPermission = await PermissionModel.findOne({ code_name: permission.code_name });

            if (existingPermission == null) {
                const newPermission = await PermissionModel.create(permission);
                console.dir(`Permission Inserted Successfully --- ${newPermission.description}`, { colors: true });
            } else {
                console.dir(`Permission Already Exists --- ${permission.description}`, { colors: false });
            }
        } catch (error) {
            console.log(error.message);
        }

        //=ACTION: EXIT
        if (index == ALL_PERMISSIONS.length - 1) {
            console.log(`Creating New Permissions Ended at ${index} ...`);
            process.exit(0);
        }
    }
};


// function for updating permissions.
exports.updatePermissions = async () => {
    console.log('Updating Permissions...');
    ALL_PERMISSIONS.map((permission, index) => {
        PermissionModel.findOne({ code_name: permission.code_name }, async (err, obj) => {
            if (obj == null) {
                PermissionModel.create(permission).then((permission) => {
                    console.dir(`🔵 Permission Inserted Successfully --- ${permission.description}`, { colors: true });
                }).catch((error) => {
                    console.log(error.message);
                });
            } else {
                 await PermissionModel.findOneAndUpdate(
                    {code_name: permission.code_name,},
                    {
                        group: permission.group,
                        description: permission.description,
                        crud_type: permission.crud_type
                    },
                    { new: true, runValidators: true }
                )
                console.dir(`🟢 Permission Updated Successfully: ${permission.description}`, { colors: true });
            }
        });  
        
    });

    //= ACTION: REMOVE UNEXISTING PERMISSIONS
    //1, get updated permissions code names
    const codeNames = []
    ALL_PERMISSIONS.map(p=>codeNames.push(p.code_name))
    //2, remove permissions in database which don't exist in new permission list (permission.js)
    const removed  = await PermissionModel.deleteMany({code_name: {$nin: codeNames}})
    console.log(`🔴 ${removed?.deletedCount} Permsissions Deleted`);
    process.exit(0);

}


exports.updatePermissions = async () => {
    try {
      console.log('Updating Permissions...');
  
      for (const permission of ALL_PERMISSIONS) {
        const existingPermission = await PermissionModel.findOne({ code_name: permission.code_name });
  
        if (existingPermission == null) {
          try {
            const newPermission = await PermissionModel.create(permission);
            console.dir(`🔵 Permission Inserted Successfully --- ${newPermission.description}`, { colors: true });
          } catch (error) {
            console.log(error.message);
          }
        } else {
          try {
            await PermissionModel.findOneAndUpdate(
              { code_name: permission.code_name },
              {
                group: permission.group,
                description: permission.description,
                crud_type: permission.crud_type
              },
              { new: true, runValidators: true }
            );
            console.dir(`🟢 Permission Updated Successfully: ${permission.description}`, { colors: true });
          } catch (error) {
            console.log(`Error updating permission: ${error.message}`);
          }
        }
      }
      
        //= ACTION: REMOVE UNEXISTING PERMISSIONS
      // Remove permissions that do not exist in the updated permissions list
      const codeNames = ALL_PERMISSIONS.map(p => p.code_name);
      const removed = await PermissionModel.deleteMany({ code_name: { $nin: codeNames } });
  
      console.log(`🔴 ${removed?.deletedCount} Permissions Deleted`);
    } catch (error) {
      console.log(`Error updating permissions: ${error.message}`);
    } finally {
      process.exit(0);
    }
  };
  