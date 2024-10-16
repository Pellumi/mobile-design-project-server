import express from "express";
import productRoute from "./routes/productRoute.js";
import userRoute from "./routes/userRoute.js";
import cartRoute from "./routes/cartRoute.js";
import orderRoute from "./routes/orderRoute.js";

const app = express();
app.use(express.json());

app.use("/api/products", productRoute);
app.use("/api/users", userRoute);
app.use("/api/cart", cartRoute);
app.use("/api/order", orderRoute);

const PORT = 3000;

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
