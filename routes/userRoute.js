import express from "express";
import { database } from "../db/firebaseConfig.js";
import { ref, set, get } from "firebase/database";
import bcrypt from "bcrypt";
import jwt from "jsonwebtoken";

const JWT_SECRET = process.env.JWT_SECRET || "jwt_secret_token";
const saltRounds = 10;

const router = express.Router();

// TODO: make sure to change id from 21/1510 to 21-1510 for submission
// Scratch that
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

    const email = userData.email
    const first_name = userData.first_name
    const last_name = userData.last_name

    const userDetails = {userId, email, first_name, last_name}

    res.status(200).json({ message: "Login successful", token: token, userDetails: userDetails});
  } catch (error) {
    res.status(500).json({ message: "Error logging in", error });
  }
});

export default router;
