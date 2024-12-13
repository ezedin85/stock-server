const ALL_PERMISSIONS = [

  // Settings
  { group: "Settings", crud_type: "READ", code_name: "can_manage_company_settings", description: "can manage company settings",  },
  { group: "Settings", crud_type: "UPDATE", code_name: "can_update_company_settings", description: "can update company settings",  },

  // Telegram Notified Users
  { group: "Telegram-Notified Users", crud_type: "CREATE", code_name: "can_add_telegram_notified_users", description: "can add telegram notified users",  },
  { group: "Telegram-Notified Users", crud_type: "UPDATE", code_name: "can_update_telegram_notified_users", description: "can update telegram notified users",  },
  { group: "Telegram-Notified Users", crud_type: "DELETE", code_name: "can_delete_telegram_notified_users", description: "can delete telegram notified users",  },

  // Report
  { group: "Report", crud_type: "READ", code_name: "can_view_reports", description: "can view reports",  },

  // Transaction report
  { group: "Transaction Report", crud_type: "READ", code_name: "can_view_transaction_reports", description: "can view transaction reports",  },

  //Company Reports
  { group: "Company Report", crud_type: "READ", code_name: "can_view_company_reports", description: "can view company reports",  },

  //admins
  { group: "Admins", crud_type: "CREATE", code_name: "can_create_user", description: "can create user",  },
  { group: "Admins", crud_type: "READ", code_name: "can_view_user", description: "can view user",  },
  { group: "Admins", crud_type: "UPDATE", code_name: "can_update_user", description: "can update user",  },
  { group: "Admins", crud_type: "DELETE", code_name: "can_delete_user", description: "can delete user",  },

  //admins account activate and suspend
  { group: "Account Activate Suspend", crud_type: "UPDATE", code_name: "can_suspend_activate_user", description: "can suspend activate user",  },

  { group: "Admins Password", crud_type: "UPDATE", code_name: "can_change_users_password", description: "can change user's password",  },

  //own Profile
  { group: "Own Profile", crud_type: "READ", code_name: "can_view_own_profile", description: "can view own profile",  },
  { group: "Own Profile", crud_type: "UPDATE", code_name: "can_change_own_profile", description: "can change own profile",  },

  //own Password
  { group: "Own Password", crud_type: "UPDATE", code_name: "can_change_own_password", description: "can change own password",  },

  //role 
  { group: "Role", crud_type: "CREATE", code_name: "can_create_roles", description: "can create roles",  },
  { group: "Role", crud_type: "READ", code_name: "can_view_roles", description: "can view roles",  },
  { group: "Role", crud_type: "UPDATE", code_name: "can_update_roles", description: "can update roles",  },
  { group: "Role", crud_type: "DELETE", code_name: "can_delete_roles", description: "can delete roles",  },

  //Notification
  { group: "Low Stock Notifications", crud_type: "READ", code_name: "can_get_low_stock_notifications", description: "can get low stock notifications",  },


  //Product category
  { group: "Product Category", crud_type: "CREATE", code_name: "can_create_product_category", description: "can create product category",  },
  { group: "Product Category", crud_type: "READ", code_name: "can_view_product_category", description: "can view product category",  },
  { group: "Product Category", crud_type: "UPDATE", code_name: "can_update_product_category", description: "can update product category",  },
  { group: "Product Category", crud_type: "DELETE", code_name: "can_delete_product_category", description: "can delete product category",  },

  

  //Product unit
  { group: "Product Unit", crud_type: "CREATE", code_name: "can_create_product_unit", description: "can create product unit",  },
  { group: "Product Unit", crud_type: "READ", code_name: "can_view_product_unit", description: "can view product unit",  },
  { group: "Product Unit", crud_type: "UPDATE", code_name: "can_update_product_unit", description: "can update product unit",  },
  { group: "Product Unit", crud_type: "DELETE", code_name: "can_delete_product_unit", description: "can delete product unit",  },


  //Product subcategory
  { group: "Product sub category", crud_type: "CREATE", code_name: "can_create_product_subcategory", description: "can create product subcategory",  },
  { group: "Product sub category", crud_type: "READ", code_name: "can_view_product_subcategory", description: "can view product subcategory",  },
  { group: "Product sub category", crud_type: "UPDATE", code_name: "can_update_product_subcategory", description: "can update product subcategory",  },
  { group: "Product sub category", crud_type: "DELETE", code_name: "can_delete_product_subcategory", description: "can delete product subcategory",  },

  //Warehouse and Branches
  { group: "Warehouse and Branches", crud_type: "CREATE", code_name: "can_create_locations", description: "can create locations",  },
  { group: "Warehouse and Branches", crud_type: "READ", code_name: "can_view_locations", description: "can view locations",  },
  { group: "Warehouse and Branches", crud_type: "UPDATE", code_name: "can_update_locations", description: "can update locations",  },
  { group: "Warehouse and Branches", crud_type: "DELETE", code_name: "can_delete_locations", description: "can delete locations",  },

  //customers
  { group: "Customer", crud_type: "CREATE", code_name: "can_create_customer", description: "can create customers",  },
  { group: "Customer", crud_type: "READ", code_name: "can_view_customer", description: "can view customers",  },
  { group: "Customer", crud_type: "UPDATE", code_name: "can_update_customer", description: "can update customers",  },
  { group: "Customer", crud_type: "DELETE", code_name: "can_delete_customer", description: "can delete customers",  },

  //suppliers
  { group: "Supplier", crud_type: "CREATE", code_name: "can_create_supplier", description: "can create suppliers",  },
  { group: "Supplier", crud_type: "READ", code_name: "can_view_supplier", description: "can view suppliers",  },
  { group: "Supplier", crud_type: "UPDATE", code_name: "can_update_supplier", description: "can update suppliers",  },
  { group: "Supplier", crud_type: "DELETE", code_name: "can_delete_supplier", description: "can delete suppliers",  },


   //Transfers
   { group: "Transfer", crud_type: "CREATE", code_name: "can_create_transfers", description: "can create transfers",  },
   { group: "Transfer", crud_type: "READ", code_name: "can_view_transfers", description: "can view transfers",  },
   { group: "Transfer", crud_type: "UPDATE", code_name: "can_update_transfers", description: "can update transfers",  },

  //products
  { group: "Product", crud_type: "CREATE", code_name: "can_create_products", description: "can create products",  },
  { group: "Product", crud_type: "READ", code_name: "can_view_products", description: "can view products",  },
  { group: "Product", crud_type: "UPDATE", code_name: "can_update_products", description: "can update products",  },
  { group: "Product", crud_type: "DELETE", code_name: "can_delete_products", description: "can delete products",  },

  //Purchase
  { group: "Purchase", crud_type: "CREATE", code_name: "can_create_purchase", description: "can create purchase",  },
  { group: "Purchase", crud_type: "READ", code_name: "can_view_purchase", description: "can view purchase",  },
  { group: "Purchase", crud_type: "UPDATE", code_name: "can_update_purchase", description: "can update purchase",  },
  { group: "Purchase", crud_type: "DELETE", code_name: "can_delete_purchase", description: "can delete purchase",  },

  //Sale
  { group: "Sale", crud_type: "CREATE", code_name: "can_create_sale", description: "can create sale",  },
  { group: "Sale", crud_type: "READ", code_name: "can_view_sale", description: "can view sale",  },
  { group: "Sale", crud_type: "UPDATE", code_name: "can_update_sale", description: "can update sale",  },
  { group: "Sale", crud_type: "DELETE", code_name: "can_delete_sale", description: "can delete sale",  },


  //Transaction History
  { group: "Transaction History", crud_type: "READ", code_name: "can_view_transaction_history", description: "can view transaction history",  },

  //Stock Adjustment
  { group: "Stock Adjustment", crud_type: "CREATE", code_name: "can_create_stock_adjustment", description: "can create stock adjustment",  },
  { group: "Stock Adjustment", crud_type: "READ", code_name: "can_view_stock_adjustment", description: "can view stock adjustment",  },
  { group: "Stock Adjustment", crud_type: "UPDATE", code_name: "can_update_stock_adjustment", description: "can update stock adjustment",  },
  { group: "Stock Adjustment", crud_type: "DELETE", code_name: "can_delete_stock_adjustment", description: "can delete stock adjustment",  },

  //Payments
  { group: "Payment", crud_type: "CREATE", code_name: "can_add_payment", description: "can add payment",  },
  { group: "Payment", crud_type: "READ", code_name: "can_manage_payments", description: "can manage payments",  },
  { group: "Payment", crud_type: "UPDATE", code_name: "can_update_payments", description: "can update payments",  },
  { group: "Payment", crud_type: "DELETE", code_name: "can_remove_payments", description: "can remove payments",  },


];
module.exports = { ALL_PERMISSIONS };
