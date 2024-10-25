import express from "express";
import { database, admin } from "../db/firebaseConfig.js";
import { ref, set, get, update } from "firebase/database";

const router = express.Router();

const getCurrentTimestamp = () => new Date().toISOString();

router.post("/place-order/:userId", async (req, res) => {
  const userId = req.params.userId;
  const { totalAmount, address } = req.body;

  if ((!totalAmount, !address)) {
    return res
      .status(400)
      .json({ message: "Total amount and address are required" });
  }

  try {
    const userCartRef = ref(database, `users/${userId}/cart`);
    const cartSnapshot = await get(userCartRef);

    if (!cartSnapshot.exists()) {
      return res.status(404).json({ message: "Cart is empty" });
    }

    const cartItems = cartSnapshot.val();

    const orderId = `order_${Date.now()}`;
    let items = {};

    for (const productId in cartItems) {
      const { quantity, price } = cartItems[productId];

      items[productId] = { quantity, price };

      const productRef = ref(database, `products/${productId}`);
      const productSnapshot = await get(productRef);

      if (productSnapshot.exists()) {
        const productData = productSnapshot.val();
        const updatedQuantity = productData.quantity - quantity;

        if (updatedQuantity < 0) {
          return res
            .status(400)
            .json({ message: `Not enough stock for product: ${productId}` });
        }

        await update(productRef, {
          quantity: updatedQuantity,
          updated_at: new Date().toISOString(),
        });
      }
    }

    const orderData = {
      status: "pending",
      totalAmount: totalAmount,
      address: address,
      order_date: getCurrentTimestamp(),
      items,
      updated_at: getCurrentTimestamp(),
    };

    const orderRef = ref(database, `orders/${userId}/${orderId}`);
    await set(orderRef, orderData);

    await set(userCartRef, null);

    res.status(201).json({ message: "Order created successfully", orderId });
  } catch (error) {
    console.error("Error creating order:", error);
    res.status(500).json({ message: "Internal server error", error });
  }
});

router.post("/order-on-delivery/:orderId/:userId", async (req, res) => {
  const { orderId, userId } = req.params;

  try {
    const orderRef = ref(database, `orders/${userId}/${orderId}`);
    const snapshot = await get(orderRef);

    if (!snapshot.exists()) {
      return res.status(404).json({ message: "No order found" });
    }

    await update(orderRef, {
      status: "on-delivery",
      updated_at: getCurrentTimestamp(),
    });

    res.status(201).json({ message: "Order updated successfully", orderId });
  } catch (error) {
    console.error("Error updating order:", error);
    res.status(500).json({ message: "Internal server error", error });
  }
});

async function getUserToken(userId) {
  const db = getDatabase();
  const tokenRef = ref(db, `users/${userId}/fcmToken`); 
  const snapshot = await get(tokenRef);

  if (snapshot.exists()) {
    return snapshot.val(); 
  } else {
    throw new Error("FCM token not found for the user");
  }
}

router.post("/order-at-doorstep/:orderId/:userId", async (req, res) => {
  const { orderId, userId } = req.params;

  try {
    const orderRef = ref(database, `orders/${userId}/${orderId}`);
    const snapshot = await get(orderRef);

    if (!snapshot.exists()) {
      return res.status(404).json({ message: "No order found" });
    }

    await update(orderRef, {
      status: "at-doorstep",
      updated_at: getCurrentTimestamp(),
    });

    const userToken = await getUserToken(userId); // Function to retrieve the user's FCM token from your database
    const message = {
      notification: {
        title: "Delivery Update",
        body: "Your order is now at your doorstep!",
      },
      token: userToken,
    };

    await admin.messaging().send(message);

    res.status(201).json({ message: "Order updated successfully", orderId });
  } catch (error) {
    console.error("Error updating order:", error);
    res.status(500).json({ message: "Internal server error", error });
  }
});

router.post("/order-delivered/:orderId/:userId", async (req, res) => {
  const { orderId, userId } = req.params;

  try {
    const orderRef = ref(database, `orders/${userId}/${orderId}`);
    const snapshot = await get(orderRef);

    if (!snapshot.exists()) {
      return res.status(404).json({ message: "No order found" });
    }

    await update(orderRef, {
      status: "delivered",
      updated_at: getCurrentTimestamp(),
    });

    res.status(201).json({ message: "Order updated successfully", orderId });
  } catch (error) {
    console.error("Error updating order:", error);
    res.status(500).json({ message: "Internal server error", error });
  }
});

router.post("/order-returned/:orderId/:userId", async (req, res) => {
  const { orderId, userId } = req.params;

  try {
    const orderRef = ref(database, `orders/${userId}/${orderId}`);
    const snapshot = await get(orderRef);

    if (!snapshot.exists()) {
      return res.status(404).json({ message: "No order found" });
    }

    await update(orderRef, {
      status: "returned",
      updated_at: getCurrentTimestamp(),
    });

    res.status(201).json({ message: "Order updated successfully", orderId });
  } catch (error) {
    console.error("Error updating order:", error);
    res.status(500).json({ message: "Internal server error", error });
  }
});

router.get("/get-order/:userId", async (req, res) => {
  const { userId } = req.params;

  try {
    const orderRef = ref(database, `orders/${userId}`);
    const snapshot = await get(orderRef);

    if (!snapshot.exists()) {
      return res.status(404).json({ message: "No orders found" });
    }

    const orders = snapshot.val();

    res
      .status(200)
      .json({ message: "Order retrieval successful", orders: orders });
  } catch (error) {
    console.error("Error updating order:", error);
    res.status(500).json({ message: "Internal server error", error });
  }
});

router.get("/get-order-details/:orderId/:userId", async (req, res) => {
  const { orderId, userId } = req.params;

  try {
    const orderRef = ref(database, `orders/${userId}/${orderId}`);
    const snapshot = await get(orderRef);

    if (!snapshot.exists()) {
      return res.status(404).json({ message: "No order found" });
    }

    const orderDetails = snapshot.val();

    res
      .status(200)
      .json({
        message: "Order details retrieval successful",
        orderDetails: orderDetails,
      });
  } catch (error) {}
});

router.post("/send-notification/:userId", async (req, res) => {
  const { userId } = req.params;

  try {
    const userToken = await getUserToken(userId); // Function to retrieve the user's FCM token from your database
    const message = {
      notification: {
        title: "Delivery Update",
        body: "Your order is now at your doorstep!",
      },
      token: userToken,
    };

    await admin.messaging().send(message);

    res.status(200).json({ message: "Message sent", message });
  } catch (error) {
    console.error("Error sending message:", error);
    res.status(500).json({ message: "Internal server error", error });
  }
});

export default router;
