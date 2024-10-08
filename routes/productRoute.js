import express from "express";
import { database } from "../db/firebaseConfig.js";
import { ref, set, get } from "firebase/database";
// import { getStorage, ref, uploadBytes, getDownloadURL } from "firebase/storage";
// import multer from "multer";

const router = express.Router();
// const storage = getStorage();

// const upload = multer({ storage: multer.memoryStorage() });

// router.post("/create-product", upload.single("image"), async (req, res) => {
//   const { name, description, price, categoryId } = req.body;

//   try {
//     const file = req.file;
//     const storageRef = ref(storage, `images/${file.originalname}`);
//     await uploadBytes(storageRef, file.buffer);

//     const imageUrl = await getDownloadURL(storageRef);

//     // Create a new product reference in the "products" collection
//     const newProductRef = firebaseApp.database().ref("products").push();
//     await newProductRef.set({
//       name,
//       description,
//       price,
//       image_url: imageUrl,
//       category_id: categoryId,
//       created_at: new Date().toISOString(), // Use ISO string for timestamp
//       updated_at: new Date().toISOString(),
//     });

//     res.status(201).json({
//       message: "Product created successfully!",
//       id: newProductRef.key,
//     });
//   } catch (error) {
//     res.status(500).json({ message: "Error creating product", error });
//   }
// });

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

export default router;
