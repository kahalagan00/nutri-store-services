const fs = require('fs');
const mongoose = require('mongoose');
const dotenv = require('dotenv');
// const Product = require('../../models/productModel');
import Product from '../../models/productModel';
const User = require('../../models/userModel');
const Cart = require('../../models/cartModel');

dotenv.config({ path: '../../config.env' });

const DB = process.env.DATABASE?.replace(
  '<db_password>',
  process.env.DATABASE_PASSWORD as string
);

mongoose.connect(DB).then(() => {
  // console.log('conn' , conn.connections);
  console.log('DB connected successfully 👍');
});

// READ JSON FILE
const products = JSON.parse(
  fs.readFileSync(`${__dirname}/products-simple.json`, 'utf-8')
);
// const users = JSON.parse(fs.readFileSync(`${__dirname}/users.json`, 'utf-8'));
// const carts = JSON.parse(
//   fs.readFileSync(`${__dirname}/carts.json`, 'utf-8')
// );

// IMPORT DATA INTO DB
const importData = async () => {
  try {
    await Product.create(products);
    // await User.create(users, { validateBeforeSave: false });
    // await Cart.create(carts);
    console.log('Data successfully loaded!');
  } catch (err) {
    console.log('Data failed to be loaded 💔');
    console.error(err);
  }
  process.exit();
};

// DELETE ALL DATA FROM DB
const deleteData = async () => {
  try {
    await Product.deleteMany();
    // await User.deleteMany();
    // await Cart.deleteMany();
    console.log('Data successfully deleted!');
  } catch (err) {
    console.error(err);
  }
  process.exit();
};

if (process.argv[2] === '--import') {
  importData();
} else if (process.argv[2] === '--delete') {
  deleteData();
}

console.log(process.argv);
