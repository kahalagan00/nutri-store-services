import mongoose from 'mongoose';

interface ICartItem {
  productId: mongoose.Types.ObjectId;
  name: string;
  price: number;
  quantity: number;
  image: string;
  purpose: string;
}

// Define the interface for the User
interface ICart extends mongoose.Document {
  totalPrice: number;
  userId: typeof mongoose.Schema.ObjectId;
  cartItems: ICartItem[];
}

const cartSchema = new mongoose.Schema<ICart>({
  totalPrice: {
    type: Number,
    default: 0,
    required: [
      true,
      'The total amount of all products in the cart need to be added.',
    ],
  },
  userId: {
    type: mongoose.Schema.ObjectId,
    ref: 'User',
    required: [true, 'A cart must belong to a user'],
    select: true,
  },
  cartItems: [
    // Items added to cart will be updated/pushed here in this array
    {
      type: {
        productId: mongoose.Schema.ObjectId,
        name: String,
        price: Number,
        quantity: Number,
        image: String,
        purpose: String,
      },
    },
  ],
});

const Cart = mongoose.model('Cart', cartSchema);

export default Cart;
