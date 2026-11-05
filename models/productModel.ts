import mongoose from 'mongoose';
import slugify from 'slugify';

// Define the interface for the product
interface IProduct extends mongoose.Document {
  name: string;
  purpose: string;
  image: string;
  grams: number;
  matterType: string;
  price: number;
  availability: boolean;
  stockQuantity: number;
  warnings?: string[]; // Optional field
  ingredients?: string[]; // Optional field
  nutritionalFacts: {
    calories?: number;
    carbohydrates?: number;
    protein?: number;
  };
  slug?: string; // Optional field
}

const productSchema = new mongoose.Schema<IProduct>({
  name: {
    type: String,
    required: [true, 'A product must have a name'],
    unique: true,
  },
  purpose: {
    type: String,
    required: [true, 'The purpose of the product must be specified'],
    trim: true,
  },
  image: {
    type: String,
    required: [true, 'The product must have a picture'],
  },
  grams: {
    type: Number,
    required: [true, 'The product must have a weight (grams)'],
  },
  matterType: {
    type: String,
    trim: true, //  Removes whitespaces from right and left
    required: [true, 'The product must specify their matter state'],
  },
  price: {
    type: Number,
    required: [true, 'The product must have a price'],
  },
  availability: {
    type: Boolean,
    default: true,
    required: [true, 'The availability of the product needs to be specified'],
  },
  stockQuantity: {
    type: Number,
    required: [true, 'The number of products in stock must be specified'],
  },
  warnings: [String],
  ingredients: [String],
  nutritionalFacts: {
    type: {
      calories: {
        type: Number,
      },
      carbohydrates: {
        type: Number,
      },
      protein: {
        type: Number,
      },
    },
    required: [true, 'The product must contain its specific nutritional facts'],
  },
  slug: String,
});

// DOCUMENT MIDDLEWARE
// runs before .save() and .create()
productSchema.pre('save', function (next) {
  // Converts the product name into lowercase and separates them
  // by dashes
  this.slug = slugify(this.name, { lower: true });
  next();
});

const Product = mongoose.model('Product', productSchema);

export default Product;
