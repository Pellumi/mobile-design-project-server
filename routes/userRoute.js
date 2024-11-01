import express from "express";
import { database } from "../db/firebaseConfig.js";
import { ref, set, get, update } from "firebase/database";
import bcrypt from "bcrypt";
import jwt from "jsonwebtoken";
import crypto from "crypto";
import dotenv from "dotenv";
import nodemailer from "nodemailer";
import bodyParser from "body-parser";

const JWT_SECRET = process.env.JWT_SECRET || "jwt_secret_token";
const saltRounds = 10;

dotenv.config();

const router = express.Router();

router.post("/signup", async (req, res) => {
  const { userId, first_name, last_name, email, password } = req.body;

  if (!userId || !first_name || !last_name || !email || !password) {
    return res.status(400).json({ message: "All fields are required" });
  }

  const isGoogleEmail =
    email.endsWith("@gmail.com") || email.endsWith("@googlemail.com");
  if (!isGoogleEmail) {
    return res.status(400).json({
      message: "Please use a valid Google email (gmail.com or googlemail.com)",
    });
  }

  try {
    const userRef = ref(database, `users/${userId}`);
    const snapshot = await get(userRef);

    if (snapshot.exists()) {
      return res.status(400).json({ message: "User already exists" });
    }

    const usersRef = ref(database, "users");
    const usersSnapshot = await get(usersRef);

    let emailExists = false;

    usersSnapshot.forEach((childSnapshot) => {
      const userData = childSnapshot.val();
      if (userData.email === email) {
        emailExists = true;
      }
    });

    if (emailExists) {
      return res
        .status(400)
        .json({ message: "User with this email already exists" });
    }

    const hashedPassword = await bcrypt.hash(password, saltRounds);

    await set(userRef, {
      first_name: first_name,
      last_name: last_name,
      email,
      password_hash: hashedPassword,
      created_at: Date.now(),
      updated_at: Date.now(),
    });

    res.status(201).json({ message: "User created successfully!" });
  } catch (error) {
    console.error("Error creating user:", error);
    res
      .status(500)
      .json({ message: "Error creating user", error: error.message });
  }
});

router.post("/login", async (req, res) => {
  const { userId, password } = req.body;

  try {
    const userRef = ref(database, `users/${userId}`);
    const snapshot = await get(userRef);

    if (!snapshot.exists()) {
      return res.status(404).json({ message: "User not found" });
    }

    const userData = snapshot.val();
    const passwordMatch = await bcrypt.compare(
      password,
      userData.password_hash
    );

    if (!passwordMatch) {
      return res.status(401).json({ message: "Invalid credentials" });
    }

    const token = jwt.sign({ userId }, JWT_SECRET);

    const email = userData.email;
    const first_name = userData.first_name;
    const last_name = userData.last_name;

    const userDetails = { userId, email, first_name, last_name };

    res.status(200).json({
      message: "Login successful",
      token: token,
      userDetails: userDetails,
    });
  } catch (error) {
    res.status(500).json({ message: "Error logging in", error });
  }
});

router.post("/create-token/:userId", async (req, res) => {
  const { userId } = req.params;
  const { fcmToken } = req.body;

  if (!fcmToken) {
    return res.status(400).json({ message: "FCM token is required" });
  }

  try {
    const tokenRef = ref(database, `users/${userId}/fcmToken`);
    await set(tokenRef, fcmToken);

    res.status(201).json({ message: "FCM token created successfully", userId });
  } catch (error) {
    console.error("Error creating token:", error);
    res.status(500).json({ message: "Internal server error", error });
  }
});

router.put("/update-token/:userId", async (req, res) => {
  const { userId } = req.params;
  const { fcmToken } = req.body;

  try {
    const tokenRef = ref(database, `users/${userId}/fcmToken`);
    await set(tokenRef, fcmToken);

    res.status(200).json({ message: "FCM token updated successfully", userId });
  } catch (error) {
    console.error("Error updating token:", error);
    res.status(500).json({ message: "Internal server error", error });
  }
});

router.post("/password-recovery/:userId", async (req, res) => {
  const userId = req.params.userId;
  const { email } = req.body;

  if (!userId) {
    return res.status(400).json({ message: "User Id is required" });
  }

  if (!email) {
    return res.status(400).json({ message: "Email is required" });
  }

  try {
    const userRef = ref(database, `users/${userId}`);
    const snapshot = await get(userRef);

    if (!snapshot.exists()) {
      return res.status(404).json({ message: "User not found" });
    }

    const token = crypto.randomBytes(20).toString("hex");
    const tokenRef = ref(database, `users/${userId}`);

    await set(tokenRef, {
      ...snapshot.val(),
      resetToken: token,
    });

    const transporter = nodemailer.createTransport({
      service: "Gmail",
      auth: {
        user: process.env.GMAIL_ADDRESS,
        pass: process.env.APP_PASSWORD,
      },
    });

    const mailOptions = {
      to: email,
      subject: "Password Recovery",
      text: `You are receiving this email because you (or someone else) requested a password reset. 
                   Click the link to reset your password: 
                   https://babrite-reset-password.netlify.app?token=${token}&userId=${userId}`,
    };

    transporter.sendMail(mailOptions, (error) => {
      if (error) {
        console.error("Error sending email:", error);
        return res.status(500).json({ message: "Error sending email" });
      }
      res.status(200).json({ message: "Recovery email sent" });
    });
  } catch (error) {
    console.error("Internal server error:", error);
    res.status(500).json({ message: "Internal server error", error });
  }
});

router.post("/reset-password", async (req, res) => {
  const { userId, token } = req.query;
  const { newPassword } = req.body;

  if (!userId) {
    return res.status(400).json({ message: "User Id is required" });
  }

  if (!token || !newPassword) {
    return res
      .status(400)
      .json({ message: "token and new password are required" });
  }

  try {
    const userRef = ref(database, `users/${userId}`);
    const snapshot = await get(userRef);

    if (!snapshot.exists()) {
      return res.status(404).json({ message: "User not found" });
    }

    const userData = snapshot.val();

    if (userData.resetToken !== token) {
      return res.status(400).json({ message: "Invalid or expired token" });
    }

    const passwordMatch = await bcrypt.compare(
      newPassword,
      userData.password_hash
    );

    if (passwordMatch) {
      return res
        .status(401)
        .json({
          message: "New password cannot be the same as the previous password",
        });
    }

    const hashedPassword = await bcrypt.hash(newPassword, 10);

    await update(userRef, {
      password_hash: hashedPassword,
      resetToken: null,
    });

    res.status(200).json({ message: "Password reset successful" });
  } catch (error) {
    console.error("Error resetting password:", error);
    res.status(500).json({ message: "Internal server error" });
  }
});
export default router;
