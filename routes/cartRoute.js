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

      res.status(201).json({ message: "Product quantity updated in cart" });
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

router.delete("/remove-from-cart/:userId/:productId", async (req, res) => {
  const { userId, productId } = req.params;

  if (!userId || !productId) {
    return res.status(400).json({
      message: "User ID and Product ID are required.",
    });
  }

  try {
    const userCartItemRef = ref(database, `users/${userId}/cart/${productId}`);

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

export default router;
