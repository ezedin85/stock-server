#!/usr/bin/env node
const {program} = require('commander');
const { prompt } = require('inquirer');
const {
  createSuperAdminUser,createPermission,updatePermissions,
} = require('./index');

// Customer Questions
const questions = [
  {
    type: 'input',
    name: 'first_name',
    message: 'Enter First Name: '
  },
  {
    type: 'input',
    name: 'last_name',
    message: 'Enter Last Name: '
  },
  {
    type: 'input',
    name: 'phone',
    message: 'Enter Phone Number: '
  },
  {
    type: 'password',
    name: 'password',
    message: 'Enter Password: '
  }
   
];


program 
  .version('1.0.0')
  .alias('v')
  .description('Clizle Technologies CLI')
 
// Add SuperUser Command
program
  .command('createsuperuser')
  .alias('c-su')
  .description('Create New Superuser')
  .action(() => {
    prompt(questions).then(user => createSuperAdminUser(user));
  });

program
.command('createpermission')
.alias('c-p')
.description('Add Permission')
.action(() => createPermission());


program
.command('updatepermissions')
.alias('u-p')
.description('Update Permissions')
.action(() => updatePermissions());

program.parse(process.argv);