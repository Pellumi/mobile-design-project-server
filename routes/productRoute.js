import express from "express";
import { storage, database } from "../db/firebaseConfig.js";
import { ref as dbRef, set, push, get } from "firebase/database";
import {
  ref as storageRef,
  getDownloadURL,
  uploadBytes,
} from "firebase/storage";
import multer from "multer";

const router = express.Router();

const upload = multer({ storage: multer.memoryStorage() });

router.post("/create-category", async (req, res) => {
  const { mainCategoryId, name, description, subcategories } = req.body;

  if (!mainCategoryId || !name || !description) {
    return res.status(400).json({
      message: "Main category ID, name, and description are required",
    });
  }

  try {
    const newCategoryRef = ref(database, `categories/${mainCategoryId}`);
    const snapshot = await get(newCategoryRef);

    if (snapshot.exists()) {
      return res.status(400).json({ message: "Category already exists" });
    }

    await set(newCategoryRef, {
      name,
      description,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      subcategories: {},
    });

    if (subcategories && typeof subcategories === "object") {
      for (const subcategoryId in subcategories) {
        const subcategory = subcategories[subcategoryId];
        const subcategoryRef = ref(
          database,
          `categories/${mainCategoryId}/subcategories/${subcategoryId}`
        );
        await set(subcategoryRef, {
          name: subcategory.name,
          description: subcategory.description,
          created_at: new Date().toISOString(),
        });
      }
    }

    res.status(201).json({ message: "Category created successfully!" });
  } catch (error) {
    res
      .status(500)
      .json({ message: "Error creating category", error: error.message });
  }
});

router.post("/create-product", upload.single("image"), async (req, res) => {
  const {
    name,
    description,
    price,
    brand,
    quantity,
    categoryId,
    subcategoryId,
  } = req.body;
  const imageFile = req.file;

  if (
    !name ||
    !description ||
    !price ||
    !brand ||
    !quantity ||
    !imageFile ||
    !categoryId ||
    !subcategoryId
  ) {
    return res.status(400).json({
      message:
        "All fields are required: name, description, price, brand, quantity image, categoryId, subcategoryId",
    });
  }

  try {
    const imageRef = storageRef(
      storage,
      `products/${categoryId}/${Date.now()}_${imageFile.originalname}`
    );
    const snapshot = await uploadBytes(imageRef, imageFile.buffer);
    const imageUrl = await getDownloadURL(snapshot.ref);

    const productsRef = dbRef(database, "products");
    const newProductRef = push(productsRef);

    await set(newProductRef, {
      name,
      description,
      brand,
      price,
      quantity,
      imageUrl,
      productId: newProductRef.key,
      categoryId,
      subcategoryId,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    });

    res.status(201).json({
      message: "Product created successfully!",
      productId: newProductRef.key,
    });
  } catch (error) {
    res.status(500).json({
      message: "Error creating product",
      error: error.message,
    });
  }
});

router.get("/product-id/:productId", async (req, res) => {
  const productId = req.params.productId;

  try {
    if (!productId) {
      return res.status(400).json({ message: "Product id is required" });
    }

    const productRef = dbRef(database, `products/${productId}`);
    const snapshot = await get(productRef);

    if (!snapshot.exists()) {
      return res.status(404).json({ message: "No product found" });
    }

    const product = snapshot.val();
    res.status(200).json(product);
  } catch (error) {
    res
      .status(500)
      .json({ message: "Error retrieving product", error: error.message });
  }
});

router.get("/search", async (req, res) => {
  const { keyword } = req.query;

  try {
    if (!keyword) {
      return res.status(400).json({ message: "Keyword is required" });
    }

    const productsRef = dbRef(database, `products`);
    const snapshot = await get(productsRef);

    if (!snapshot.exists()) {
      return res.status(404).json({ message: "No product found" });
    }

    const products = snapshot.val();
    const filteredProducts = Object.keys(products).reduce((result, key) => {
      const product = products[key];

      if (
        product.description &&
        product.description.toLowerCase().includes(keyword.toLowerCase())
      ) {
        result[key] = product;
      }
      return result;
    }, {});

    if (Object.keys(filteredProducts).length === 0) {
      return res
        .status(404)
        .json({ message: "No products match the search keyword" });
    }

    res.status(200).json(filteredProducts);
  } catch (error) {
    res
      .status(500)
      .json({ message: "Error retrieving product", error: error.message });
  }
});

router.get("/get-product/:categoryId/:subcategoryId", async (req, res) => {
  const { categoryId, subcategoryId } = req.params;

  try {
    const productsRef = dbRef(database, "products");
    const snapshot = await get(productsRef);

    if (!snapshot.exists()) {
      return res.status(404).json({ message: "No products found" });
    }

    const products = snapshot.val();

    const filteredProducts = Object.keys(products).reduce((result, key) => {
      const product = products[key];
      if (
        product.categoryId == categoryId &&
        product.subcategoryId == subcategoryId
      ) {
        result[key] = product;
      }
      return result;
    }, {});

    if (Object.keys(filteredProducts).length === 0) {
      return res.status(404).json({
        message: "No products found for this category and subcategory",
      });
    }

    res.status(200).json(filteredProducts);
  } catch (error) {
    res
      .status(500)
      .json({ message: "Error retrieving products", error: error.message });
  }
});

export default router;
