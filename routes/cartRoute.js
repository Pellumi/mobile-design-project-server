import express from "express";
import { database } from "../db/firebaseConfig.js";
import { ref, set, get, update, remove } from "firebase/database";

const router = express.Router();

router.post("/add-to-cart/:userId", async (req, res) => {
  const { productId, quantity } = req.body;
  const userId = req.params.userId;

  if (!productId || !quantity) {
    return res
      .status(400)
      .json({ message: "Product ID and Quantity are required" });
  }

  try {
    const productRef = ref(database, `products/${productId}`);
    const productSnapshot = await get(productRef);

    if (!productSnapshot.exists()) {
      return res.status(404).json({ message: "Product not found." });
    }

    const productData = productSnapshot.val();

    if (quantity <= 0 || quantity > productData.quantity) {
      return res.status(400).json({ message: "Invalid quantity" });
    }

    const userCartRef = ref(database, `users/${userId}/cart/${productId}`);
    const cartSnapshot = await get(userCartRef);

    const totalPrice = productData.price * quantity;

    if (cartSnapshot.exists()) {
      await update(userCartRef, {
        quantity: quantity,
        totalPrice: totalPrice,
      });

      res.status(200).json({ message: "Product quantity updated in cart" });
    } else {
      await set(userCartRef, {
        productId,
        price: productData.price,
        quantity,
        totalPrice,
      });

      res.status(201).json({ message: "Product added to cart" });
    }
  } catch (error) {
    res.status(500).json({
      message: "Error adding item to cart",
      error: error.message,
    });
  }
});

router.get("/show-cart/:userId", async (req, res) => {
  const userId = req.params.userId;

  if (!userId) {
    return res.status(400).json({ message: "UserId is required" });
  }

  try {
    const userCartRef = ref(database, `users/${userId}/cart`);
    const cartSnapshot = await get(userCartRef);

    if (!cartSnapshot.exists()) {
      return res.status(404).json({ message: "No products found in cart" });
    }

    const userCart = cartSnapshot.val();
    res.status(200).json(userCart);
  } catch (error) {
    res.status(500).json({ message: "Error getting cart: ", error });
  }
});

router.delete("/remove-from-cart/:userId/:productId", async (req, res) => {
  const { userId, productId } = req.params;

  if (!userId || !productId) {
    return res.status(400).json({
      message: "User ID and Product ID are required.",
    });
  }

  try {
    const userCartItemRef = ref(database, `users/${userId}/cart/${productId}`);
    const cartItemSnapshot = await get(userCartItemRef);

    if (!cartItemSnapshot.exists()) {
      return res.status(404).json({ message: "Product not found in cart" });
    }

    await remove(userCartItemRef);
    res.status(200).json({
      message: "Item removed from cart successfully!",
    });
  } catch (error) {
    res.status(500).json({
      message: "Error removing item from cart",
      error: error.message,
    });
  }
});

router.post("/save-item/:userId/:productId", async (req, res) => {
  const { userId, productId } = req.params;

  if (!userId || !productId) {
    return res.status(400).json({
      message: "User ID and Product ID are required.",
    });
  }

  try {
    const productRef = ref(database, `products/${productId}`);
    const productSnapshot = await get(productRef);

    if (!productSnapshot.exists()) {
      return res.status(404).json({ message: "Product not found." });
    }

    const userSavedRef = ref(
      database,
      `users/${userId}/savedItems/${productId}`
    );
    const savedSnapshot = await get(userSavedRef);

    if (savedSnapshot.exists()) {
      res.status(404).json({ message: "Item has already been saved" });
    } else {
      await set(userSavedRef, {
        productId,
      });

      res.status(201).json({ message: "Product saved for later" });
    }
  } catch (error) {
    res.status(500).json({
      message: "Error saving item for later",
      error: error.message,
    });
  }
});

router.delete("/remove-saved-item/:userId/:productId", async (req, res) => {
  const { userId, productId } = req.params;

  if (!userId || !productId) {
    return res.status(400).json({
      message: "User ID and Product ID are required.",
    });
  }

  try {
    const userSavedItemRef = ref(
      database,
      `users/${userId}/savedItems/${productId}`
    );
    const savedItemSnapshot = await get(userSavedItemRef);

    if (!savedItemSnapshot.exists()) {
      return res
        .status(404)
        .json({ message: "Product not found in savedItems" });
    }

    await remove(userSavedItemRef);
    res.status(200).json({
      message: "Item removed from savedItems successfully!",
    });
  } catch (error) {
    res.status(500).json({
      message: "Error removing item from savedItems",
      error: error.message,
    });
  }
});

router.get("/get-saved-item/:userId", async (req, res) => {
  const userId = req.params.userId;

  if (!userId) {
    return res.status(404).json({ message: "User Id is required" });
  }

  try {
    const savedItemRef = ref(database, `users/${userId}/savedItems`);
    const savedItemSnapshot = await get(savedItemRef);

    if(!savedItemSnapshot.exists()){
      return res.status(400).json({message : "No items saved by this user"})
    }

    const savedItems = savedItemSnapshot.val();
    res.status(200).json({savedItems});
  } catch (error) {
    res.status(500).json({ message: "Error getting saved items: ", error });
    console.log(error)
  }
});

export default router;
